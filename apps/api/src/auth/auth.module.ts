import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessPolicyService } from './access-policy.service.js';
import { AuthController } from './auth.controller.js';
import { AuthenticationGuard, CsrfGuard, RateLimitGuard, RolesGuard } from './guards.js';
import { RateLimiter } from './rate-limiter.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AccessPolicyService,
    UsersService,
    RateLimiter,
    // Order matters: authenticate → role → CSRF → rate limit.
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [AccessPolicyService, UsersService, RateLimiter],
})
export class AuthModule {}
