import { createDatabase } from "@skillbridge/database";
import { env } from "./env";

export const { db, pool } = createDatabase(env.DATABASE_URL, {
  serverless: env.isServerless,
});
