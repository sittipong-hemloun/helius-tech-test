import { Inject, Injectable } from '@nestjs/common';
import { ApiException, Errors } from '../common/api-exception.js';
import { Clock } from '../common/clock.js';
import { businessDate } from '../common/dates.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { isForeignKeyViolation } from '../database/db-errors.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPayload } from '../idempotency/idempotency.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';
import { unwrap } from '../validation/rule.js';
import { escapeLike, type ListQuery, type SortField } from './employee-query.js';
import { EMPLOYEE_FIELD_RULES, type EmployeeFields } from './employee-rules.js';

export interface EmployeeRow {
  id: number;
  name: string;
  departmentId: string;
  departmentName: string;
  salary: string;
  joinDate: string;
  isActive: boolean;
  lastUpdatedDate: string;
  version: number;
}

type Tx = Prisma.TransactionClient;

/** Whitelisted ORDER BY expressions; user input never reaches SQL text (PRD §10.3). */
const SORT_SQL: Record<SortField, string> = {
  id: 'e.id',
  name: 'lower(e.name) COLLATE "C"',
  department: 'd.name COLLATE "C"',
  joinDate: 'e.join_date',
  isActive: 'e.is_active',
  lastUpdatedDate: 'e.last_updated_date',
  salary: 'e.salary',
};

const COLUMNS = Prisma.sql`e.id, e.name, e.department_id AS "departmentId", d.name AS "departmentName",
  e.salary::text AS salary, e.join_date::text AS "joinDate", e.is_active AS "isActive",
  e.last_updated_date::text AS "lastUpdatedDate", e.version`;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private today(): string {
    return businessDate(this.clock.now(), this.config.timezone);
  }

  async list(query: ListQuery): Promise<{ rows: EmployeeRow[]; total: number }> {
    const conditions: Prisma.Sql[] = [];
    if (query.q) {
      conditions.push(Prisma.sql`lower(e.name) LIKE lower(${`%${escapeLike(query.q)}%`}) ESCAPE '\\'`);
    }
    if (query.departmentId) conditions.push(Prisma.sql`e.department_id = ${query.departmentId}`);
    if (query.status === 'active') conditions.push(Prisma.sql`e.is_active = true`);
    if (query.status === 'inactive') conditions.push(Prisma.sql`e.is_active = false`);
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const direction = query.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const order = Prisma.raw(
      query.sortBy === 'id' ? `e.id ${direction}` : `${SORT_SQL[query.sortBy]} ${direction}, e.id ASC`,
    );
    const offset = (query.page - 1) * query.pageSize;

    // Count and page come from the same snapshot so meta.total matches data (PRD §10.3).
    return this.prisma.$transaction(
      async (tx) => {
        const countRows = await tx.$queryRaw<{ total: number }[]>`
          SELECT count(*)::int AS total FROM employees e ${where}`;
        const total = countRows[0]?.total ?? 0;
        const rows =
          total === 0 || offset >= total
            ? []
            : await tx.$queryRaw<EmployeeRow[]>`
                SELECT ${COLUMNS}
                FROM employees e JOIN departments d ON d.id = e.department_id
                ${where}
                ORDER BY ${order}
                LIMIT ${query.pageSize} OFFSET ${offset}`;
        return { rows, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async get(id: number): Promise<EmployeeRow> {
    const row = await this.findOne(this.prisma, id);
    if (!row) throw Errors.employeeNotFound();
    return row;
  }

  private async findOne(db: Tx | PrismaService, id: number, lock = false): Promise<EmployeeRow | null> {
    const rows = await db.$queryRaw<EmployeeRow[]>`
      SELECT ${COLUMNS}
      FROM employees e JOIN departments d ON d.id = e.department_id
      WHERE e.id = ${id}
      ${lock ? Prisma.sql`FOR UPDATE OF e` : Prisma.empty}`;
    return rows[0] ?? null;
  }

  async create(input: EmployeeFields, idempotencyKey: string) {
    const fields = normalizeAll(input);
    return this.idempotency.run<EmployeeRow>(
      { scope: 'employees.create', key: idempotencyKey, requestHash: hashPayload(fields) },
      async (tx) => {
        const now = this.clock.now();
        try {
          const rows = await tx.$queryRaw<{ id: number }[]>`
            INSERT INTO employees (name, department_id, salary, join_date, is_active, last_updated_date, version, created_at, updated_at)
            VALUES (${fields.name}, ${fields.departmentId}, ${fields.salary}::numeric, ${fields.joinDate}::date,
                    ${fields.isActive}, ${this.today()}::date, 1, ${now}, ${now})
            RETURNING id`;
          const created = await this.findOne(tx, rows[0].id);
          return { status: 201, body: created! };
        } catch (err) {
          if (isForeignKeyViolation(err)) throw departmentInvalid();
          throw err;
        }
      },
    );
  }

  /**
   * Compare-and-update under a row lock. Unchanged input is a no-op: no write,
   * same version and Last Updated Date (PRD §9.4).
   */
  async update(id: number, patch: Partial<EmployeeFields>, expectedVersion: number): Promise<{ employee: EmployeeRow; changed: boolean }> {
    const normalized = normalizePartial(patch);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findOne(tx, id, true);
      if (!current) throw Errors.employeeNotFound();
      if (current.version !== expectedVersion) throw Errors.versionConflict(current.version);

      const next: EmployeeFields = {
        name: normalized.name ?? current.name,
        departmentId: (normalized.departmentId ?? current.departmentId) as EmployeeFields['departmentId'],
        salary: normalized.salary ?? current.salary!,
        joinDate: normalized.joinDate ?? current.joinDate,
        isActive: normalized.isActive ?? current.isActive,
      };
      const unchanged =
        next.name === current.name &&
        next.departmentId === current.departmentId &&
        next.salary === current.salary &&
        next.joinDate === current.joinDate &&
        next.isActive === current.isActive;
      if (unchanged) return { employee: current, changed: false };

      try {
        const updated = await tx.$executeRaw`
          UPDATE employees SET
            name = ${next.name}, department_id = ${next.departmentId}, salary = ${next.salary}::numeric,
            join_date = ${next.joinDate}::date, is_active = ${next.isActive},
            last_updated_date = ${this.today()}::date, updated_at = ${this.clock.now()}, version = version + 1
          WHERE id = ${id} AND version = ${expectedVersion}`;
        if (updated !== 1) throw Errors.versionConflict();
      } catch (err) {
        if (isForeignKeyViolation(err)) throw departmentInvalid();
        throw err;
      }
      return { employee: (await this.findOne(tx, id))!, changed: true };
    });
  }

  /** Atomic compare-and-delete: wrong version → 409, missing → 404. Hard delete (PRD D-06). */
  async remove(id: number, expectedVersion: number): Promise<void> {
    const deleted = await this.prisma.$executeRaw`DELETE FROM employees WHERE id = ${id} AND version = ${expectedVersion}`;
    if (deleted === 1) return;
    const rows = await this.prisma.$queryRaw<{ version: number }[]>`SELECT version FROM employees WHERE id = ${id}`;
    if (rows.length === 0) throw Errors.employeeNotFound();
    throw Errors.versionConflict(rows[0].version);
  }
}

function departmentInvalid(): ApiException {
  return Errors.validation([{ field: 'departmentId', code: 'DEPARTMENT_INVALID', message: 'Department does not exist.' }]);
}

export function normalizeAll(input: EmployeeFields): EmployeeFields {
  return {
    name: unwrap(EMPLOYEE_FIELD_RULES.name(input.name)),
    departmentId: unwrap(EMPLOYEE_FIELD_RULES.departmentId(input.departmentId)),
    salary: unwrap(EMPLOYEE_FIELD_RULES.salary(input.salary)),
    joinDate: unwrap(EMPLOYEE_FIELD_RULES.joinDate(input.joinDate)),
    isActive: unwrap(EMPLOYEE_FIELD_RULES.isActive(input.isActive)),
  };
}

export function normalizePartial(input: Partial<EmployeeFields>): Partial<EmployeeFields> {
  const out: Partial<EmployeeFields> = {};
  if (input.name !== undefined) out.name = unwrap(EMPLOYEE_FIELD_RULES.name(input.name));
  if (input.departmentId !== undefined) out.departmentId = unwrap(EMPLOYEE_FIELD_RULES.departmentId(input.departmentId));
  if (input.salary !== undefined) out.salary = unwrap(EMPLOYEE_FIELD_RULES.salary(input.salary));
  if (input.joinDate !== undefined) out.joinDate = unwrap(EMPLOYEE_FIELD_RULES.joinDate(input.joinDate));
  if (input.isActive !== undefined) out.isActive = unwrap(EMPLOYEE_FIELD_RULES.isActive(input.isActive));
  return out;
}
