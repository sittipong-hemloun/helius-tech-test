import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Department, Employee as EmployeeRow, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEmployeeDto, ListEmployeesQuery, SortField, UpdateEmployeeDto } from './employee.dto.js';

/** What the API returns. Salary and dates are strings so no float or time zone can change them. */
export interface Employee {
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

const ORDER_BY: Record<SortField, (dir: Prisma.SortOrder) => Prisma.EmployeeOrderByWithRelationInput> = {
  id: (dir) => ({ id: dir }),
  name: (dir) => ({ name: dir }),
  department: (dir) => ({ department: { name: dir } }),
  salary: (dir) => ({ salary: dir }),
  joinDate: (dir) => ({ joinDate: dir }),
  isActive: (dir) => ({ isActive: dir }),
  lastUpdatedDate: (dir) => ({ lastUpdatedDate: dir }),
};

/** A DATE column comes back from Prisma as UTC midnight, so the first 10 ISO characters are the date. */
const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);
const fromDateOnly = (value: string) => new Date(`${value}T00:00:00Z`);

/** "Today" for Last Updated Date is the calendar day in Bangkok, whatever the server time zone is. */
const todayInBangkok = () => fromDateOnly(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()));

function toEmployee(row: EmployeeRow & { department: Department }): Employee {
  return {
    id: row.id,
    name: row.name,
    departmentId: row.departmentId,
    departmentName: row.department.name,
    salary: row.salary.toFixed(2),
    joinDate: toDateOnly(row.joinDate),
    isActive: row.isActive,
    lastUpdatedDate: toDateOnly(row.lastUpdatedDate),
    version: row.version,
  };
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEmployeesQuery) {
    const where: Prisma.EmployeeWhereInput = {
      // Prisma passes `contains` to ILIKE as is, so escape % and _ to search for them literally.
      name: query.q ? { contains: query.q.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' } : undefined,
      departmentId: query.departmentId,
      isActive: query.status === 'all' ? undefined : query.status === 'active',
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: { department: true },
        orderBy: [ORDER_BY[query.sortBy](query.sortOrder), { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toEmployee),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async get(id: number): Promise<Employee> {
    const row = await this.prisma.employee.findUnique({ where: { id }, include: { department: true } });
    if (!row) throw new NotFoundException('This employee does not exist or was deleted.');
    return toEmployee(row);
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const row = await this.prisma.employee.create({
      data: { ...dto, joinDate: fromDateOnly(dto.joinDate), lastUpdatedDate: todayInBangkok() },
      include: { department: true },
    });
    return toEmployee(row);
  }

  /** Optimistic locking: the write only happens when the stored version is the one the client edited. */
  async update(id: number, dto: UpdateEmployeeDto, version: number): Promise<Employee> {
    const { count } = await this.prisma.employee.updateMany({
      where: { id, version },
      data: {
        ...dto,
        joinDate: dto.joinDate ? fromDateOnly(dto.joinDate) : undefined,
        lastUpdatedDate: todayInBangkok(),
        version: { increment: 1 },
      },
    });
    if (count === 0) await this.throwNotFoundOrConflict(id);
    return this.get(id);
  }

  async remove(id: number, version: number): Promise<void> {
    const { count } = await this.prisma.employee.deleteMany({ where: { id, version } });
    if (count === 0) await this.throwNotFoundOrConflict(id);
  }

  private async throwNotFoundOrConflict(id: number): Promise<never> {
    const exists = await this.prisma.employee.count({ where: { id } });
    if (!exists) throw new NotFoundException('This employee does not exist or was deleted.');
    throw new ConflictException('This employee was changed by another user. Reload the latest version.');
  }
}
