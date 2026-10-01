import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { isUniqueViolation } from '../database/db-errors.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Role } from '../generated/prisma/enums.js';

export class AccountLinkConflict extends Error {}

/** Users are keyed by Google `sub`; an email already bound to another sub is never auto-linked (PRD §11.1). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async upsertFromLogin(input: { googleSub: string; email: string; displayName: string; role: Role }) {
    const now = this.clock.now();
    const bySub = await this.prisma.user.findUnique({ where: { googleSub: input.googleSub } });
    if (!bySub) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (byEmail) throw new AccountLinkConflict();
    }
    try {
      return await this.prisma.user.upsert({
        where: { googleSub: input.googleSub },
        create: { ...input, isEnabled: true, lastLoginAt: now },
        update: { email: input.email, displayName: input.displayName, role: input.role, isEnabled: true, lastLoginAt: now },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AccountLinkConflict();
      throw err;
    }
  }

  /** Startup reconcile: stored role/is_enabled mirror the current allowlist (audit only). */
  async reconcile(roleFor: (email: string) => Role | null): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true, email: true, role: true, isEnabled: true } });
    for (const u of users) {
      const role = roleFor(u.email);
      const isEnabled = role !== null;
      if (u.isEnabled !== isEnabled || (role && role !== u.role)) {
        await this.prisma.user.update({ where: { id: u.id }, data: { isEnabled, ...(role ? { role } : {}) } });
      }
    }
  }
}
