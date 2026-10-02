import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Clock } from '../common/clock.js';

interface Window {
  count: number;
  resetAt: number;
}

/** Fixed-window counter in process memory. Not shared across instances by design. */
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly windows = new Map<string, Window>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(private readonly clock: Clock) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  hit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.clock.now().getTime();
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return { allowed: w.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  }

  reset(): void {
    this.windows.clear();
  }

  private sweep(): void {
    const now = this.clock.now().getTime();
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }
}
