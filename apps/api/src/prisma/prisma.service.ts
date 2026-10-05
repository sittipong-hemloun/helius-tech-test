import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** Prisma 7 talks to PostgreSQL through the pg driver adapter. */
const options = () => ({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Plain client for scripts and tests that run outside Nest. */
export const createPrismaClient = () => new PrismaClient(options());

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super(options());
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
