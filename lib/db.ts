import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _konvergePool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres123@localhost:5432/konverge';

export const pool =
  global._konvergePool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== 'production') {
  global._konvergePool = pool;
}

export type DbPool = typeof pool;

export default pool;
