import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export * from "./schema";

export function createDatabase(
  databaseUrl: string,
  options?: { serverless?: boolean },
) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: options?.serverless ? 1 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
