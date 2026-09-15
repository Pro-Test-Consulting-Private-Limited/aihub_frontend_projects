import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // This Postgres server does not support SSL connections (confirmed via
    // psql connecting without sslmode). Do NOT set an `ssl` option here —
    // pg will attempt SSL negotiation and the server will reject it.
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}