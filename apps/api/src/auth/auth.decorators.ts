import { SetMetadata } from '@nestjs/common';
import type { Role } from '../generated/prisma/enums.js';

export const IS_PUBLIC = 'auth:public';
export const ROLES = 'auth:roles';
export const SERVICE_SCOPE = 'auth:service-scope';
export const RATE_LIMIT = 'rate-limit:policy';
export const SKIP_CSRF = 'auth:skip-csrf';

/** No session needed (health, login start/callback). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Session user must hold one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/** Bearer service token for internal worker/scheduler endpoints; sessions are not accepted. */
export const ServiceAuth = (scope: 'worker' | 'scheduler') => SetMetadata(SERVICE_SCOPE, scope);

export type RateLimitPolicy = 'read' | 'write' | 'authStart' | 'claim' | 'none';
export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT, policy);
