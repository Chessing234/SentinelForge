import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url !== undefined && url.trim() !== "") {
    return url.trim();
  }
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  ) {
    return "postgresql://postgres:postgres@127.0.0.1:5432/sentinelforge_build";
  }
  throw new Error(
    "DATABASE_URL is not set. Add it to your environment or .env (see .env.example).",
  );
}

const globalForPostgres = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
};

function getOrCreatePostgresClient(): ReturnType<typeof postgres> {
  const url = requireDatabaseUrl();
  if (!globalForPostgres.postgresClient) {
    globalForPostgres.postgresClient = postgres(url, { max: 10 });
  }
  return globalForPostgres.postgresClient;
}

const client = getOrCreatePostgresClient();

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export { client as postgresClient };
