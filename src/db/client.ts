import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
  query_timeout: env.DATABASE_QUERY_TIMEOUT_MS,
});

export const db = drizzle({ client: pool });
