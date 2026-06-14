import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.trim() === "") {
    console.error("DATABASE_URL is required to run migrations.");
    process.exitCode = 1;
    return;
  }

  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const sql = postgres(url, { max: 1 });
  const migrationDb = drizzle(sql);

  try {
    await migrate(migrationDb, { migrationsFolder });
    console.log("Migrations applied successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 10 });
  }
}

void main();
