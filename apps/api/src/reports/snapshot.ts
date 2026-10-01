import { businessDate } from '../common/dates.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Aggregate-only snapshot (PRD §10.6 SnapshotDto). No names, salaries, emails or employee IDs. */
export interface Snapshot {
  schemaVersion: 1;
  capturedAt: string;
  businessDate: string;
  timezone: 'Asia/Bangkok';
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  departments: Array<{ id: string; name: string; total: number; active: number; inactive: number }>;
}

export async function captureSnapshot(tx: Prisma.TransactionClient, now: Date, timezone: string): Promise<Snapshot> {
  const rows = await tx.$queryRaw<{ id: string; name: string; total: number; active: number }[]>`
    SELECT d.id, d.name, count(e.id)::int AS total, (count(e.id) FILTER (WHERE e.is_active))::int AS active
    FROM departments d LEFT JOIN employees e ON e.department_id = d.id
    GROUP BY d.id, d.name, d.sort_order
    ORDER BY d.sort_order`;
  const departments = rows.map((r) => ({ id: r.id, name: r.name, total: r.total, active: r.active, inactive: r.total - r.active }));
  const totalEmployees = departments.reduce((s, d) => s + d.total, 0);
  const activeEmployees = departments.reduce((s, d) => s + d.active, 0);
  return {
    schemaVersion: 1,
    capturedAt: now.toISOString(),
    businessDate: businessDate(now, timezone),
    timezone: 'Asia/Bangkok',
    totalEmployees,
    activeEmployees,
    inactiveEmployees: totalEmployees - activeEmployees,
    departments,
  };
}

/** Guards the claim payload: only whitelisted aggregate keys leave the API (AC-48). */
export function isAggregateOnly(snapshot: Snapshot): boolean {
  const allowedTop = ['schemaVersion', 'capturedAt', 'businessDate', 'timezone', 'totalEmployees', 'activeEmployees', 'inactiveEmployees', 'departments'];
  const allowedDept = ['id', 'name', 'total', 'active', 'inactive'];
  return (
    Object.keys(snapshot).every((k) => allowedTop.includes(k)) &&
    snapshot.departments.every((d) => Object.keys(d).every((k) => allowedDept.includes(k)))
  );
}
