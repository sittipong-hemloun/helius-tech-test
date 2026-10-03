import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.js';
import { RateLimiter } from './rate-limiter.js';

@Module({
  providers: [RateLimiter, { provide: APP_GUARD, useClass: RateLimitGuard }],
  exports: [RateLimiter],
})
export class RateLimitModule {}
