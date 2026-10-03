/** Postgres SQLSTATE helpers for errors surfaced through Prisma raw queries / the pg adapter. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; meta?: { code?: string; driverAdapterError?: { cause?: { originalCode?: string; code?: string } } }; cause?: { code?: string } };
  return (
    e?.meta?.driverAdapterError?.cause?.originalCode ??
    e?.meta?.code ??
    e?.cause?.code ??
    (typeof e?.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) ? e.code : undefined)
  );
}

export const isForeignKeyViolation = (err: unknown) => pgErrorCode(err) === '23503' || (err as { code?: string })?.code === 'P2003';
