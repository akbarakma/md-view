import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let db: NodePgDatabase | null = null;

// Created on first use, not at import: `next build` loads route modules without database settings.
// Without DATABASE_URL, pg reads PGHOST/PGUSER/PGPASSWORD/PGDATABASE from the environment.
export function getDb(): NodePgDatabase {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url && !process.env.PGHOST) throw new Error("Set DATABASE_URL or PGHOST");
  const pool = new Pool({ connectionString: url, max: 5 });
  pool.on("error", (err) => console.error("postgres idle client error:", err.message));
  db = drizzle(pool);
  return db;
}
