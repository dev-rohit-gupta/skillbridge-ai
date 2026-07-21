import path from "node:path";
import dotenv from "dotenv";
import {z} from "zod";

// Yarn runs workspace scripts from apps/api. Loading both locations also keeps
// direct `node apps/api/dist/server.js` usage predictable.
dotenv.config({path: path.resolve(process.cwd(), "../../.env"), quiet: true});
dotenv.config({quiet: true});

export const env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default("postgresql://skillbridge:skillbridge@localhost:5432/skillbridge"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  ACCESS_TOKEN_SECRET: z.string().min(32).default("development-access-secret-change-me-123456"),
  REFRESH_TOKEN_SECRET: z.string().min(32).default("development-refresh-secret-change-me-12345"),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  UPLOAD_DIR: z.string().default("./uploads"),
}).parse(process.env);
