import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { pool } from "./config/db";
import { redis } from "./config/redis";
import { logger } from "./utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

  app.get("/health", async (_req, res) => {
    const status = { api: "ok", database: "down", redis: "down" };
    try { await pool.query("SELECT 1"); status.database = "ok"; } catch {}
    try { status.redis = (await redis.ping()) === "PONG" ? "ok" : "down"; } catch {}
    res.status(status.database === "ok" ? 200 : 503).json(status);
  });

  // feature routers will be mounted here:
  // app.use("/api/auth", authRouter);
  // app.use("/api/documents", documentsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler); // must be last
  return app;
}