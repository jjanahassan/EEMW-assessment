import fs from "fs";
import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./config/db";
import { redis } from "./config/redis";
import { logger } from "./utils/logger";

async function main() {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  await redis.connect().catch(() => logger.warn("Redis unavailable, continuing without cache"));

  const server = createApp().listen(env.PORT, () =>
    logger.info(`API running on http://localhost:${env.PORT}`),
  );

  const shutdown = async () => {
    logger.info("Shutting down...");
    server.close();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});