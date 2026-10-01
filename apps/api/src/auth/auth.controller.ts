import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiException, Errors } from '../common/api-exception.js';
import { Clock } from '../common/clock.js';
import { respond } from '../common/envelope.js';
import { JsonLogger } from '../common/json-logger.js';
import type { AppRequest } from '../common/request-context.js';
import { APP_CONFIG, normalizeEmail, type AppConfig } from '../config/app-config.js';
import { AccessPolicyService } from './access-policy.service.js';
import { Public, RateLimit } from './auth.decorators.js';
import { OidcService } from './oidc.service.js';
import { SessionDataDto } from './session.dto.js';
import { destroySession, isAbsolutelyExpired, randomToken, regenerateSession, saveSession } from './session-helpers.js';
import { AccountLinkConflict, UsersService } from './users.service.js';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly oidc: OidcService,
    private readonly users: UsersService,
    private readonly policy: AccessPolicyService,
    private readonly clock: Clock,
    private readonly logger: JsonLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private redirect(res: Response, path: string): void {
    // Always build redirects from PUBLIC_APP_ORIGIN, never from Host headers.
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, `${this.config.publicAppOrigin}${path}`);
  }

  private hasValidSession(req: AppRequest): boolean {
    const auth = req.session?.auth;
    return Boolean(auth && !isAbsolutelyExpired(auth.absoluteExpiresAt, this.clock.now()) && this.policy.roleFor(auth.email));
  }

  /** Public: whether Google sign-in is configured (no secrets). Used by the Login page. */
  @Get('providers')
  @Public()
  @RateLimit('none')
  providers() {
    return respond({ google: { configured: this.config.google.configured } });
  }

  @Get('google')
  @Public()
  @RateLimit('authStart')
  @ApiExcludeEndpoint()
  async start(@Req() req: AppRequest, @Res() res: Response): Promise<void> {
    if (!this.config.google.configured) {
      throw new ApiException(503, 'AUTH_NOT_CONFIGURED', 'Google sign-in is not configured on this server.');
    }
    if (this.hasValidSession(req)) return this.redirect(res, '/employees');
    let authRequest;
    try {
      authRequest = await this.oidc.createAuthRequest();
    } catch {
      this.logger.write('warn', 'oidc_discovery_failed', { requestId: req.requestId });
      return this.redirect(res, '/login?error=provider_unavailable');
    }
    req.session.oidc = {
      state: authRequest.state,
      nonce: authRequest.nonce,
      codeVerifier: authRequest.codeVerifier,
      expiresAt: new Date(this.clock.now().getTime() + this.config.session.loginStateTtlMs).toISOString(),
    };
    req.session.cookie.maxAge = this.config.session.loginStateTtlMs;
    await saveSession(req);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, authRequest.url);
  }

  @Get('google/callback')
  @Public()
  @RateLimit('authStart')
  @ApiExcludeEndpoint()
  async callback(@Req() req: AppRequest, @Res() res: Response): Promise<void> {
    const pending = req.session?.oidc;
    if (req.session) delete req.session.oidc; // single use

    if (typeof req.query.error === 'string') {
      await destroySession(req);
      return this.redirect(res, '/login?error=google_cancelled');
    }
    if (!pending || new Date(pending.expiresAt).getTime() <= this.clock.now().getTime()) {
      await destroySession(req);
      return this.redirect(res, '/login?error=login_expired');
    }

    let identity;
    try {
      const callbackUrl = new URL(req.originalUrl, this.config.publicAppOrigin);
      identity = await this.oidc.verifyCallback(callbackUrl, pending);
    } catch (err) {
      this.logger.write('warn', 'oidc_callback_rejected', { requestId: req.requestId, errorName: (err as Error)?.name });
      await destroySession(req);
      return this.redirect(res, '/login?error=login_failed');
    }

    if (!identity.email || !identity.emailVerified) {
      await destroySession(req);
      return this.redirect(res, '/access-denied?reason=email_unverified');
    }
    const email = normalizeEmail(identity.email);
    const role = this.policy.roleFor(email);
    if (!role) {
      await destroySession(req);
      return this.redirect(res, '/access-denied?reason=not_allowed');
    }

    let user;
    try {
      user = await this.users.upsertFromLogin({
        googleSub: identity.sub,
        email,
        displayName: (identity.name ?? email).slice(0, 200),
        role,
      });
    } catch (err) {
      await destroySession(req);
      if (err instanceof AccountLinkConflict) return this.redirect(res, '/access-denied?reason=account_conflict');
      throw err;
    }

    // New session id after login; fresh CSRF token (PRD §11.1 step 7, §11.2).
    await regenerateSession(req);
    const now = this.clock.now();
    const absoluteExpiresAt = new Date(now.getTime() + this.config.session.absoluteTimeoutMs).toISOString();
    req.session.auth = {
      userId: user.id,
      email,
      displayName: user.displayName,
      authenticatedAt: now.toISOString(),
      absoluteExpiresAt,
    };
    req.session.csrfToken = randomToken();
    req.session.cookie.maxAge = this.config.session.idleTimeoutMs;
    await saveSession(req);
    this.logger.write('info', 'login_succeeded', { requestId: req.requestId, userId: user.id, role });
    this.redirect(res, '/employees');
  }

  @Get('session')
  @ApiOkResponse({ type: SessionDataDto })
  session(@Req() req: AppRequest) {
    const p = req.principal!;
    const auth = req.session.auth!;
    if (!req.session.csrfToken) req.session.csrfToken = randomToken();
    return respond({
      user: { id: p.userId, email: p.email, displayName: p.displayName, role: p.role },
      permissions: AccessPolicyService.permissions(p.role),
      csrfToken: req.session.csrfToken,
      absoluteExpiresAt: auth.absoluteExpiresAt,
    });
  }

  @Post('logout')
  @HttpCode(204)
  @RateLimit('none')
  async logout(@Req() req: AppRequest, @Res() res: Response): Promise<void> {
    if (!req.principal) throw Errors.unauthenticated();
    await destroySession(req);
    res.clearCookie(this.config.session.cookieName, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.session.secure,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
  }
}
