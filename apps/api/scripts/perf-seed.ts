// pnpm perf:seed — deterministic synthetic employees for the performance database only (PRD §15.1).
// Guards: APP_ENV=performance and the database marked "performance". Never touches demo/test data.
// Options: --count=10000 --seed=42
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from '../src/config/env-file.js';
import { createPrismaClient } from '../src/database/prisma.service.js';
import { databasePurpose } from '../src/seed/seed-original.js';

loadEnvFile();
const arg = (name: string, fallback: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const COUNT = arg('count', 10_000);
const SEED = arg('seed', 42);

if (process.env.APP_ENV !== 'performance') {
  console.error('perf:seed requires APP_ENV=performance');
  process.exit(1);
}

/** mulberry32: small, fast, deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fictional name parts (no real people). "Searchwell" marks a fixed 2% group for the search benchmark.
const FIRST = ['Arin', 'Bodhi', 'Chana', 'Dara', 'Ekkarat', 'Fah', 'Gun', 'Hana', 'Isra', 'Jira', 'Kanda', 'Lalin', 'Mek', 'Nara', 'Oat', 'Pim', 'Rin', 'Sai', 'Tawan', 'Ugo', 'Vee', 'Wan', 'Yada', 'Zin'];
const LAST = ['Amornrat', 'Boonmee', 'Chaiyo', 'Dechapol', 'Ekachai', 'Fongsri', 'Kittisak', 'Laemthong', 'Montri', 'Nantawat', 'Phromma', 'Ratchada', 'Sombat', 'Thongdee', 'Wattana', 'Yodsri'];
const DEPARTMENTS = [
  { id: 'engineering', name: 'Engineering', sortOrder: 1, share: 0.4 },
  { id: 'marketing', name: 'Marketing', sortOrder: 2, share: 0.25 },
  { id: 'sales', name: 'Sales', sortOrder: 3, share: 0.2 },
  { id: 'hr', name: 'HR', sortOrder: 4, share: 0.15 },
];

const pad = (n: number) => String(n).padStart(2, '0');
function dateBetween(r: () => number, fromYear: number, toYear: number): string {
  const start = Date.UTC(fromYear, 0, 1);
  const end = Date.UTC(toYear, 11, 31);
  const d = new Date(start + Math.floor(r() * ((end - start) / 86_400_000)) * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

interface Row {
  name: string;
  departmentId: string;
  salary: string;
  joinDate: string;
  isActive: boolean;
  lastUpdatedDate: string;
}

export function generate(count: number, seed: number): Row[] {
  const r = rng(seed);
  const rows: Row[] = [];
  // Exact department sizes (40/25/20/15 %) and 80 % Active within each department.
  for (const dept of DEPARTMENTS) {
    const size = Math.round(count * dept.share);
    const activeCount = Math.round(size * 0.8);
    for (let i = 0; i < size; i += 1) {
      const n = rows.length;
      const last = n % 50 === 0 ? 'Searchwell' : LAST[Math.floor(r() * LAST.length)];
      const cents = Math.floor(r() * 100);
      rows.push({
        name: `${FIRST[Math.floor(r() * FIRST.length)]} ${last} ${String(n).padStart(5, '0')}`,
        departmentId: dept.id,
        salary: `${15_000 + Math.floor(r() * 235_000)}.${pad(cents)}`,
        joinDate: dateBetween(r, 2005, 2026),
        isActive: i < activeCount,
        lastUpdatedDate: dateBetween(r, 2024, 2026),
      });
    }
  }
  return rows.slice(0, count);
}

const prisma = createPrismaClient(process.env.DATABASE_URL!, 2);
try {
  if ((await databasePurpose(prisma)) !== 'performance') {
    console.error('database is not marked "performance"; refusing to load synthetic data');
    process.exit(1);
  }
  const rows = generate(COUNT, SEED);
  const checksum = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('TRUNCATE reports, idempotency_keys, employees RESTART IDENTITY');
      for (const d of DEPARTMENTS) {
        await tx.$executeRaw`INSERT INTO departments (id, name, sort_order) VALUES (${d.id}, ${d.name}, ${d.sortOrder}) ON CONFLICT (id) DO NOTHING`;
      }
      for (let i = 0; i < rows.length; i += 1000) {
        const batch = rows.slice(i, i + 1000);
        await tx.$executeRaw`
          INSERT INTO employees (name, department_id, salary, join_date, is_active, last_updated_date, version, created_at, updated_at)
          SELECT n, d, s::numeric, j::date, a, l::date, 1, now(), now()
          FROM unnest(${batch.map((x) => x.name)}::text[], ${batch.map((x) => x.departmentId)}::text[], ${batch.map((x) => x.salary)}::text[],
                      ${batch.map((x) => x.joinDate)}::text[], ${batch.map((x) => x.isActive)}::boolean[], ${batch.map((x) => x.lastUpdatedDate)}::text[])
               AS t(n, d, s, j, a, l)`;
      }
    },
    { timeout: 120_000 },
  );
  await prisma.$executeRawUnsafe('ANALYZE employees');
  const stats = await prisma.$queryRaw<{ department_id: string; total: number; active: number }[]>`
    SELECT department_id, count(*)::int AS total, (count(*) FILTER (WHERE is_active))::int AS active FROM employees GROUP BY 1 ORDER BY 1`;
  const searchwell = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM employees WHERE lower(name) LIKE '%searchwell%'`;
  const manifest = {
    generator: 'apps/api/scripts/perf-seed.ts (mulberry32)',
    seed: SEED,
    count: rows.length,
    distribution: { engineering: 0.4, marketing: 0.25, sales: 0.2, hr: 0.15, activeShare: 0.8 },
    searchGroup: { query: 'searchwell', matches: searchwell[0].n },
    checksumSha256: checksum,
    byDepartment: stats,
  };
  writeFileSync(resolve(process.cwd(), '../../tests/performance/seed-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`perf seed: ${rows.length} employees, checksum ${checksum.slice(0, 16)}…, searchwell=${searchwell[0].n}`);
} finally {
  await prisma.$disconnect();
}
