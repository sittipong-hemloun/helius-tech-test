import pg from 'pg';

export const SESSION_POOL = Symbol('SESSION_POOL');

/** Small dedicated pool for the express-session store (connect-pg-simple). */
export function createSessionPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 4,
    options: '-c TimeZone=UTC',
    application_name: 'employee-console-sessions',
  });
}
