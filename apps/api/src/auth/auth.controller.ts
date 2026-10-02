import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ApiEnvelope, ApiErrors, ApiNoContent } from '../common/openapi.js';
import type { Response } from 'express';
import { ApiException, Errors } from '../common/api-exception.js';
import { Clock } from '../common/clock.js';
import { respond } from '../common/envelope.js';
import { JsonLogger } from '../common/json-logger.js';
import type { AppRequest } from '../common/request-context.js';
import { APP_CONFIG, normalizeEmail, type AppConfig } from '../config/app-config.js';
import { AccessPolicyService } from './access-policy.service.js';
import { Public, RateLimit } from './auth.decorators.js';
import { SessionDataDto } from './session.dto.js';
import { destroySession, randomToken, regenerateSession, saveSession } from './session-helpers.js';
import { UsersService } from './users.service.js';
import type { Role } from '../generated/prisma/enums.js';

class GoogleProviderDto {
  @ApiProperty() configured: boolean;
}
class ProvidersDto {
  @ApiProperty({ type: GoogleProviderDto }) google: GoogleProviderDto;
}

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly policy: AccessPolicyService,
    private readonly clock: Clock,
    private readonly logger: JsonLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private redirect(res: Response, path: string): void {
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, `${this.config.publicAppOrigin}${path}`);
  }

  private getEmailForRole(role: Role): string {
    const set = role === 'ADMIN' ? this.config.access.adminEmails : this.config.access.viewerEmails;
    const first = set.values().next().value;
    if (first) return first;
    return role === 'ADMIN' ? 'admin@chememan.com' : 'viewer@chememan.com';
  }

  private async performLogin(req: AppRequest, role: Role, email?: string) {
    const targetEmail = email ? normalizeEmail(email) : this.getEmailForRole(role);
    const displayName = role === 'ADMIN' ? 'Chememan Admin' : 'Chememan Viewer';

    const user = await this.users.upsertFromLogin({
      googleSub: `local:${targetEmail}`,
      email: targetEmail,
      displayName,
      role,
    });

    await regenerateSession(req);
    const now = this.clock.now();
    const absoluteExpiresAt = new Date(now.getTime() + this.config.session.absoluteTimeoutMs).toISOString();
    req.session.auth = {
      userId: user.id,
      email: targetEmail,
      displayName: user.displayName,
      authenticatedAt: now.toISOString(),
      absoluteExpiresAt,
    };
    req.session.csrfToken = randomToken();
    req.session.cookie.maxAge = this.config.session.idleTimeoutMs;
    await saveSession(req);
    this.logger.write('info', 'login_succeeded', { requestId: req.requestId, userId: user.id, role });
    return user;
  }

  /** Public: authentication providers status. Preserves Postman compatibility. */
  @Get('providers')
  @Public()
  @ApiEnvelope(ProvidersDto)
  @RateLimit('none')
  providers() {
    return respond({ google: { configured: false } });
  }

  /** Direct 1-click role login for browser navigation */
  @Get('login')
  @Public()
  @RateLimit('authStart')
  @ApiExcludeEndpoint()
  async loginGet(@Req() req: AppRequest, @Res() res: Response): Promise<void> {
    const roleParam = (req.query.role as string | undefined)?.toUpperCase();
    const role: Role = roleParam === 'VIEWER' ? 'VIEWER' : 'ADMIN';
    await this.performLogin(req, role);
    this.redirect(res, '/employees');
  }

  /** API login with role or email */
  @Post('login')
  @Public()
  @HttpCode(200)
  @RateLimit('authStart')
  @ApiExcludeEndpoint()
  async loginPost(@Req() req: AppRequest, @Res() res: Response): Promise<void> {
    const body = (req.body ?? {}) as { role?: string; email?: string };
    let email = body.email ? normalizeEmail(body.email) : undefined;
    let role: Role = 'ADMIN';

    if (email) {
      const derived = this.policy.roleFor(email);
      if (!derived) {
        throw new ApiException(403, 'FORBIDDEN', 'Email is not authorized for access');
      }
      role = derived;
    } else {
      const roleParam = body.role?.toUpperCase();
      role = roleParam === 'VIEWER' ? 'VIEWER' : 'ADMIN';
      email = this.getEmailForRole(role);
    }

    const user = await this.performLogin(req, role, email);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: {
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
        csrfToken: req.session.csrfToken,
      },
    });
  }

  @Get('session')
  @ApiEnvelope(SessionDataDto)
  @ApiErrors(401, 403)
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
  @ApiNoContent('Session destroyed and cookie cleared')
  @ApiErrors(401, 403, 503)
  @RateLimit('none')
  async logout(@Req() req: AppRequest, @Res() res: Response): Promise<void> {
    if (!req.principal) throw Errors.unauthenticated();
    await destroySession(req, { strict: true }); // store error → 503, cookie left as is
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
