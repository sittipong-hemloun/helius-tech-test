import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { PrismaClient } from '../generated/prisma/client.js';
import { unwrap } from '../validation/rule.js';
import { joinDateRule, nameRule, salaryRule, statusFromExcel } from '../employees/employee-rules.js';

interface SourceRow {
  ID: number;
  Name: string;
  Department: string;
  Salary: number;
  'Join Date': string;
  Status: string;
  'Last Updated Date': string;
}

interface SourceFile {
  departments: { id: string; name: string; sortOrder: number }[];
  employees: SourceRow[];
}

/** Finds prisma/seed-data from src/, dist/ or dist-scripts/ layouts alike. */
function seedFile(): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(dir, 'prisma/seed-data/test-exam-data.json');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('prisma/seed-data/test-exam-data.json not found');
}

export function loadSourceData(path = seedFile()): SourceFile {
  return JSON.parse(readFileSync(path, 'utf8')) as SourceFile;
}

/**
 * Maps one Excel row to DB values with explicit conversions (PRD §4.3, §9.5):
 * - Status "Active"/"In Active" → boolean (never Boolean(string))
 * - Salary JSON number → exact 2-decimal string ("65000.00")
 * - Department label → department id via the master list
 * - ID and Last Updated Date are kept as in Excel
 */
export function mapSourceRow(row: SourceRow, departments: SourceFile['departments']) {
  const dept = departments.find((d) => d.name === row.Department);
  if (!dept) throw new Error(`Unknown department "${row.Department}" for ID ${row.ID}`);
  if (!Number.isInteger(row.ID) || row.ID <= 0) throw new Error(`Invalid ID ${row.ID}`);
  if (!Number.isFinite(row.Salary)) throw new Error(`Invalid salary for ID ${row.ID}`);
  return {
    id: row.ID,
    name: unwrap(nameRule(row.Name)),
    departmentId: dept.id,
    salary: unwrap(salaryRule(row.Salary.toFixed(2))),
    joinDate: unwrap(joinDateRule(row['Join Date'])),
    isActive: statusFromExcel(row.Status),
    lastUpdatedDate: unwrap(joinDateRule(row['Last Updated Date'])),
  };
}

export interface SeedSummary {
  departmentsInserted: number;
  employeesInserted: number;
  nextEmployeeId: number;
}

/**
 * Inserts departments and source employees that are missing by primary key.
 * Existing rows are never updated (AC-02). Afterwards the identity sequence is moved to
 * at least max(id) so new records get server IDs after the source range.
 */
export async function seedOriginal(prisma: PrismaClient, now = new Date()): Promise<SeedSummary> {
  const source = loadSourceData();
  return prisma.$transaction(async (tx) => {
    let departmentsInserted = 0;
    for (const d of source.departments) {
      departmentsInserted += await tx.$executeRaw`
        INSERT INTO departments (id, name, sort_order) VALUES (${d.id}, ${d.name}, ${d.sortOrder})
        ON CONFLICT (id) DO NOTHING`;
    }
    let employeesInserted = 0;
    for (const raw of source.employees) {
      const e = mapSourceRow(raw, source.departments);
      employeesInserted += await tx.$executeRaw`
        INSERT INTO employees (id, name, department_id, salary, join_date, is_active, last_updated_date, version, created_at, updated_at)
        VALUES (${e.id}, ${e.name}, ${e.departmentId}, ${e.salary}::numeric, ${e.joinDate}::date, ${e.isActive},
                ${e.lastUpdatedDate}::date, 1, ${now}, ${now})
        ON CONFLICT (id) DO NOTHING`;
    }
    const rows = await tx.$queryRaw<{ next: bigint }[]>`
      SELECT setval(
        pg_get_serial_sequence('employees', 'id'),
        GREATEST(
          COALESCE((SELECT max(id) FROM employees), 0),
          COALESCE(pg_sequence_last_value(pg_get_serial_sequence('employees', 'id')::regclass), 0),
          1
        ),
        true
      ) + 1 AS next`;
    return { departmentsInserted, employeesInserted, nextEmployeeId: Number(rows[0].next) };
  });
}

export async function seedSummary(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<{ total: number; active: number; inactive: number; departments: number; salary_sum: string }[]>`
    SELECT count(*)::int AS total,
           (count(*) FILTER (WHERE is_active))::int AS active,
           (count(*) FILTER (WHERE NOT is_active))::int AS inactive,
           (SELECT count(*)::int FROM departments) AS departments,
           COALESCE(sum(salary), 0)::text AS salary_sum
    FROM employees`;
  return rows[0];
}

export async function databasePurpose(prisma: PrismaClient): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ value: string }[]>`SELECT value FROM app_meta WHERE key = 'database_purpose'`;
  return rows[0]?.value ?? null;
}
