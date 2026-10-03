import type { LoggerService } from '@nestjs/common';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Keys that must never reach logs (PRD §11.4). Values are replaced, not truncated. */
const REDACT_KEYS = /^(cookie|authorization|set-cookie|password|secret|token|leasetoken|code|state|salary|body|apikey|api_key|x-csrf-token)$/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

/** One JSON object per line: timestamp, level, appEnv, service + safe fields (PRD §13.4). */
export class JsonLogger implements LoggerService {
  constructor(
    private readonly appEnv: string,
    private readonly minLevel: Level = 'info',
    private readonly service = 'api',
  ) {}

  write(level: Level, message: string, fields: Record<string, unknown> = {}): void {
    if (ORDER[level] < ORDER[this.minLevel]) return;
    const line = {
      timestamp: new Date().toISOString(),
      level,
      appEnv: this.appEnv,
      service: this.service,
      message,
      ...(redact(fields) as Record<string, unknown>),
    };
    const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
    out.write(`${JSON.stringify(line)}\n`);
  }

  log(message: unknown, context?: string): void {
    this.write('info', String(message), context ? { context } : {});
  }
  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', String(message), { context, trace: this.minLevel === 'debug' ? trace : undefined });
  }
  warn(message: unknown, context?: string): void {
    this.write('warn', String(message), context ? { context } : {});
  }
  debug(message: unknown, context?: string): void {
    this.write('debug', String(message), context ? { context } : {});
  }
  verbose(message: unknown, context?: string): void {
    this.write('debug', String(message), context ? { context } : {});
  }
}
