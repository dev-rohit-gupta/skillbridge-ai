import path from "node:path";
import dotenv from "dotenv";
import {defineConfig} from "drizzle-kit";

dotenv.config({path: path.resolve(process.cwd(), "../../.env"), quiet: true});
dotenv.config({quiet: true});

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {url: process.env.DATABASE_URL ?? "postgresql://skillbridge:skillbridge@localhost:5432/skillbridge"},
});
