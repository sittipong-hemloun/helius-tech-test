import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Errors } from '../common/api-exception.js';
import { Clock } from '../common/clock.js';
import type { AppRequest } from '../common/request-context.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import type { Role } from '../generated/prisma/enums.js';
import { AccessPolicyService } from './access-policy.service.js';
import { IS_PUBLIC, RATE_LIMIT, ROLES, SERVICE_SCOPE, SKIP_CSRF, type RateLimitPolicy } from './auth.decorators.js';
import { cookieMaxAge, destroySession, isAbsolutelyExpired, safeEqual } from './session-helpers.js';
import { RateLimiter } from './rate-limiter.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function meta<T>(reflector: Reflector, key: string, ctx: ExecutionContext): T | undefined {
  return reflector.getAllAndOverride<T>(key, [ctx.getHandler(), ctx.getClass()]);
}

/**
 * 1) Authentication. Session routes: the session must belong to an allowlisted
 * account *now* (role is recomputed every request — PRD §11.2). Internal routes:
 * a scope-specific bearer token; session cookies are ignored there.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: AccessPolicyService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();

    const scope = meta<'worker' | 'scheduler'>(this.reflector, SERVICE_SCOPE, ctx);
    if (scope) {
      const expected = scope === 'worker' ? this.config.serviceTokens.worker : this.config.serviceTokens.scheduler;
      const header = req.headers.authorization ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!expected || !token || !safeEqual(token, expected)) throw Errors.invalidServiceToken();
      req.service = { kind: 'service', scope };
      return true;
    }

    if (meta<boolean>(this.reflector, IS_PUBLIC, ctx)) return true;

    const auth = req.session?.auth;
    if (!auth) throw Errors.unauthenticated();
    const now = this.clock.now();
    if (isAbsolutelyExpired(auth.absoluteExpiresAt, now)) {
      await destroySession(req);
      throw Errors.sessionExpired();
    }
    const role = this.policy.roleFor(auth.email);
    if (!role) {
      await destroySession(req);
      throw Errors.accountNotAllowed();
    }
    req.session.cookie.maxAge = cookieMaxAge(this.config.session.idleTimeoutMs, auth.absoluteExpiresAt, now);
    req.principal = {
      kind: 'user',
      userId: auth.userId,
      email: auth.email,
      displayName: auth.displayName,
      role,
      sessionId: req.sessionID,
    };
    return true;
  }
}

/** 2) Role check from @Roles(); hidden UI is never the permission (PRD §7.2). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = meta<Role[]>(this.reflector, ROLES, ctx);
    if (!roles?.length) return true;
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (!req.principal || !roles.includes(req.principal.role)) throw Errors.forbidden();
    return true;
  }
}

/**
 * 3) CSRF for cookie-authenticated mutations: X-CSRF-Token bound to the session,
 * plus Origin (when present) must equal PUBLIC_APP_ORIGIN (PRD §10.1, §11.4).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (!MUTATING.has(req.method)) return true;
    if (req.service) return true; // bearer-token callers are not cookie-authenticated
    if (meta<boolean>(this.reflector, SKIP_CSRF, ctx)) return true;
    if (meta<boolean>(this.reflector, IS_PUBLIC, ctx)) return true;
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== this.config.publicAppOrigin) throw Errors.csrfInvalid();
    const sent = req.headers['x-csrf-token'];
    const expected = req.session?.csrfToken;
    if (typeof sent !== 'string' || !expected || !safeEqual(sent, expected)) throw Errors.csrfInvalid();
    return true;
  }
}

/** 4) In-process fixed-window limits (single API instance — PRD §11.4). */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.config.rateLimits.enabled) return true;
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    let policy = meta<RateLimitPolicy>(this.reflector, RATE_LIMIT, ctx);
    if (!policy) {
      if (!req.principal) return true;
      policy = MUTATING.has(req.method) ? 'write' : 'read';
    }
    if (policy === 'none') return true;
    const limits = this.config.rateLimits;
    const limit = {
      read: limits.readPerWindow,
      write: limits.writePerWindow,
      authStart: limits.authStartPerWindow,
      claim: limits.claimPerWindow,
    }[policy];
    const subject =
      policy === 'authStart'
        ? `ip:${req.ip}`
        : policy === 'claim'
          ? `svc:${req.service?.scope ?? 'none'}`
          : `sid:${req.principal?.sessionId ?? req.ip}`;
    const result = this.limiter.hit(`${policy}:${subject}`, limit, limits.windowMs);
    if (!result.allowed) throw Errors.rateLimited(result.retryAfterSeconds);
    return true;
  }
}
