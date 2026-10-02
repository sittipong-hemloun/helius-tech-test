import { Injectable } from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Role } from '../generated/prisma/enums.js';

export class AccountLinkConflict extends Error {}

/** Users are keyed by identity and email for role-based console access. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async upsertFromLogin(input: { googleSub: string; email: string; displayName: string; role: Role }) {
    const now = this.clock.now();
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleSub: input.googleSub }, { email: input.email }],
      },
    });
    if (existing) {
      return await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleSub: input.googleSub,
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          isEnabled: true,
          lastLoginAt: now,
        },
      });
    }
    return await this.prisma.user.create({
      data: { ...input, isEnabled: true, lastLoginAt: now },
    });
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
