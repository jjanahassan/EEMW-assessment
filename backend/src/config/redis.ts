import Redis from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

export const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

redis.on("error", (err) => logger.warn({ err: err.message }, "Redis error (cache disabled)"));