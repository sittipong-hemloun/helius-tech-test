import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from './generated/prisma/client.js';

/** One row of the Excel sheet "Example Data", copied to prisma/seed-data/test-exam-data.json. */
interface ExcelRow {
  ID: number;
  Name: string;
  Department: string;
  Salary: number;
  'Join Date': string;
  Status: string;
  'Last Updated Date': string;
}

interface SeedData {
  departments: { id: string; name: string; sortOrder: number }[];
  employees: ExcelRow[];
}

export function loadSeedData(): SeedData {
  return JSON.parse(readFileSync(resolve(import.meta.dirname, '../prisma/seed-data/test-exam-data.json'), 'utf8')) as SeedData;
}

/** Excel row → employee columns. Status is compared explicitly: Boolean("In Active") would be true. */
export function toEmployeeRow(row: ExcelRow, departments: SeedData['departments']) {
  const department = departments.find((d) => d.name === row.Department);
  if (!department) throw new Error(`Unknown department "${row.Department}" for ID ${row.ID}`);
  return {
    id: row.ID,
    name: row.Name,
    departmentId: department.id,
    salary: row.Salary.toFixed(2),
    joinDate: new Date(`${row['Join Date']}T00:00:00Z`),
    isActive: row.Status === 'Active',
    lastUpdatedDate: new Date(`${row['Last Updated Date']}T00:00:00Z`),
  };
}

/**
 * Loads the 5 Excel records when the employees table is empty; existing rows are never touched.
 * `reset` deletes every employee first. Either way the next new employee gets ID 106.
 * Returns how many employees were inserted.
 */
export async function seed(prisma: PrismaClient, { reset = false } = {}): Promise<number> {
  const { departments, employees } = loadSeedData();
  return prisma.$transaction(async (tx) => {
    if (reset) await tx.$executeRaw`TRUNCATE employees RESTART IDENTITY`;
    await tx.department.createMany({ data: departments, skipDuplicates: true });
    if ((await tx.employee.count()) > 0) return 0;
    const { count } = await tx.employee.createMany({ data: employees.map((row) => toEmployeeRow(row, departments)) });
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('employees', 'id'), (SELECT max(id) FROM employees))`;
    return count;
  });
}
