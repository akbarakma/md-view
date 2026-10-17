import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "@/lib/db/client";

const MIGRATION_ATTEMPTS = 10;

export async function runMigrationsOrExit(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
      return;
    } catch (err) {
      console.error(`migrations failed (attempt ${attempt}/${MIGRATION_ATTEMPTS}):`, (err as Error).message);
      // A failed register() leaves Next serving 500s forever without exiting, so Docker's restart policy never fires.
      if (attempt === MIGRATION_ATTEMPTS) process.exit(1);
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 10_000)));
    }
  }
}
