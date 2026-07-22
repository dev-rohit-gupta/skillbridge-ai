import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Yarn runs workspace scripts from apps/api. Loading both locations also keeps
// direct `node apps/api/dist/server.js` usage predictable.
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });
dotenv.config({ quiet: true });

const parsedEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_DIRECT: z.string().min(1).optional(),
  WEB_ORIGIN: z.string().url(),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_RESUME_BUCKET: z.string().min(1).default("resumes"),
}).parse(process.env);

export const env = {
  ...parsedEnv,
  isServerless: process.env.VERCEL === "1",
};
