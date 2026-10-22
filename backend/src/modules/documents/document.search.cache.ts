import crypto from "crypto";
import type Redis from "ioredis";
import { logger } from "../../utils/logger";

const VERSION_KEY = "search:version";

export class SearchCache {
  constructor(
    private redis: Redis,
    private ttlSeconds = 60,
  ) {}

  private async keyFor(scope: string, params: unknown): Promise<string> {
    const version = (await this.redis.get(VERSION_KEY)) ?? "0";
    const hash = crypto.createHash("sha1").update(JSON.stringify(params)).digest("hex");
    return `search:${version}:${scope}:${hash}`;
  }

  /**
   * Cache-aside. The key (which contains the version) is built ONCE before computing, so if an
   * upload invalidates the cache while we compute, our result is stored under the old version
   * and is never read. If Redis is unavailable we simply compute.
   */
  async getOrCompute<T>(scope: string, params: unknown, compute: () => Promise<T>) {
    if (this.redis.status !== "ready") return { value: await compute(), cached: false };

    let key: string | null = null;
    try {
      key = await this.keyFor(scope, params);
      const raw = await this.redis.get(key);
      if (raw) return { value: JSON.parse(raw) as T, cached: true };
    } catch (err) {
      logger.warn({ err: String(err) }, "Search cache read failed");
    }

    const value = await compute();

    if (key) {
      try {
        await this.redis.set(key, JSON.stringify(value), "EX", this.ttlSeconds);
      } catch (err) {
        logger.warn({ err: String(err) }, "Search cache write failed");
      }
    }
    return { value, cached: false };
  }

  // Bumping the version orphans every cached search at once; old keys expire via TTL
  async invalidateAll(): Promise<void> {
    if (this.redis.status !== "ready") return;
    try {
      await this.redis.incr(VERSION_KEY);
    } catch (err) {
      logger.warn({ err: String(err) }, "Search cache invalidation failed");
    }
  }
}