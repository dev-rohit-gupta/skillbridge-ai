import { app } from "./app";
import { pool } from "./config/database";
import { env } from "./config/env";
const server = app.listen(env.PORT, () =>
  console.log(`SkillBridge API listening on http://localhost:${env.PORT}`),
);
async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
