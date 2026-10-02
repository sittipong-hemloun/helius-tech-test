import { CanActivate, ExecutionContext, Inject, Injectable, Module, SetMetadata } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Errors } from '../common/api-exception.js';
import type { AppRequest } from '../common/request-context.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { RateLimiter } from './rate-limiter.js';

export const RATE_LIMIT = 'rate-limit:policy';
export type RateLimitPolicy = 'read' | 'write' | 'none';
/** Override the default policy (reads vs. writes by HTTP method). */
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT, policy);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** In-process fixed-window limits per client IP (single API instance — PRD §11.4). */
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
    const policy =
      this.reflector.getAllAndOverride<RateLimitPolicy>(RATE_LIMIT, [ctx.getHandler(), ctx.getClass()]) ??
      (MUTATING.has(req.method) ? 'write' : 'read');
    if (policy === 'none') return true;
    const limits = this.config.rateLimits;
    const limit = policy === 'write' ? limits.writePerWindow : limits.readPerWindow;
    const result = this.limiter.hit(`${policy}:${req.ip}`, limit, limits.windowMs);
    if (!result.allowed) throw Errors.rateLimited(result.retryAfterSeconds);
    return true;
  }
}

@Module({
  providers: [RateLimiter, { provide: APP_GUARD, useClass: RateLimitGuard }],
  exports: [RateLimiter],
})
export class RateLimitModule {}
