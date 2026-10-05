import request from 'supertest';
import { createApp } from '../../src/app.js';
import { loadEnv } from '../../src/env.js';
import { createPrismaClient } from '../../src/prisma/prisma.service.js';

loadEnv();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

/** The real app on a random local port, plus a Prisma client for checking rows directly. */
export async function startApp() {
  const app = await createApp();
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as { port: number };
  const prisma = createPrismaClient();
  return {
    prisma,
    http: request(`http://127.0.0.1:${port}`),
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof startApp>>;
