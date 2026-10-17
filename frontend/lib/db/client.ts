import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let db: NodePgDatabase | null = null;

// Created on first use, not at import: `next build` loads route modules without a DATABASE_URL.
export function getDb(): NodePgDatabase {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 5 });
  pool.on("error", (err) => console.error("postgres idle client error:", err.message));
  db = drizzle(pool);
  return db;
}
