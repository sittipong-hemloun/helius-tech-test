import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, normalizeEmail, type AppConfig } from '../config/app-config.js';
import type { Role } from '../generated/prisma/enums.js';

export interface Permissions {
  canWriteEmployees: boolean;
  canViewSalary: boolean;
  canGenerateReports: boolean;
  canViewIntegrations: boolean;
}

/**
 * Allowlist → role (PRD §6.5, §11.3). Evaluated on every request from the current
 * configuration, so a role stored in a session or the users table is never trusted.
 */
@Injectable()
export class AccessPolicyService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  roleFor(email: string): Role | null {
    const e = normalizeEmail(email);
    if (this.config.access.adminEmails.has(e)) return 'ADMIN';
    if (this.config.access.viewerEmails.has(e)) return 'VIEWER';
    return null;
  }

  static permissions(role: Role): Permissions {
    const admin = role === 'ADMIN';
    return {
      canWriteEmployees: admin,
      canViewSalary: admin,
      canGenerateReports: admin,
      canViewIntegrations: admin,
    };
  }
}
