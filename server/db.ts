// Shared Postgres handle (Railway PG, plain TCP — node-postgres, NOT the Neon
// serverless driver: that one speaks Neon's proxy protocol only).
// DATABASE_URL unset (local dev without a DB) => db is null and features that
// need it degrade: auth routes 503, ticker cache falls back to memory.

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

let _db: NodePgDatabase<typeof schema> | null = null;

const connectionString = process.env.DATABASE_URL;
if (connectionString) {
  const pool = new Pool({
    connectionString,
    max: 5,
    // Railway PG public proxy requires TLS; the internal hostname does not.
    ssl: /railway\.internal/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  _db = drizzle(pool, { schema });
  console.log("[db] Postgres pool initialized");
} else {
  console.log("[db] no DATABASE_URL — running without a database");
}

export const db = _db;

export function requireDb(): NodePgDatabase<typeof schema> {
  if (!_db) throw new Error("Database not configured (DATABASE_URL unset)");
  return _db;
}
