import type { Server } from "node:http";

import app from "./app";
import { pool } from "./config/database";
import { env } from "./config/env";

let server: Server | undefined;

if (!env.isServerless) {
  server = app.listen(env.PORT, () => {
    console.log(
      `SkillBridge API listening on http://localhost:${env.PORT}`,
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down.`);

    server?.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

// Allows Vercel to use this file too if it detects server.ts.
export default app;