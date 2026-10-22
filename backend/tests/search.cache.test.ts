import { describe, expect, it, vi } from "vitest";
import { SearchCache } from "../src/modules/documents/document.search.cache";
import { EventBus } from "../src/events/eventBus";

function fakeRedis(status = "ready") {
  const store = new Map<string, string>();
  return {
    status,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => (store.set(k, v), "OK")),
    incr: vi.fn(async (k: string) => {
      const next = Number(store.get(k) ?? 0) + 1;
      store.set(k, String(next));
      return next;
    }),
  };
}

describe("SearchCache", () => {
  it("computes once, then serves from cache", async () => {
    const cache = new SearchCache(fakeRedis() as never);
    const compute = vi.fn().mockResolvedValue({ n: 1 });
    const first = await cache.getOrCompute("s", { q: "a" }, compute);
    const second = await cache.getOrCompute("s", { q: "a" }, compute);
    expect(first.cached).toBe(false);
    expect(second).toEqual({ value: { n: 1 }, cached: true });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("keeps scopes and params separate", async () => {
    const cache = new SearchCache(fakeRedis() as never);
    const compute = vi.fn().mockResolvedValue(1);
    await cache.getOrCompute("userA", { q: "a" }, compute);
    await cache.getOrCompute("userB", { q: "a" }, compute);
    await cache.getOrCompute("userA", { q: "b" }, compute);
    expect(compute).toHaveBeenCalledTimes(3);
  });

  it("recomputes after invalidateAll", async () => {
    const cache = new SearchCache(fakeRedis() as never);
    const compute = vi.fn().mockResolvedValue(1);
    await cache.getOrCompute("s", {}, compute);
    await cache.invalidateAll();
    const result = await cache.getOrCompute("s", {}, compute);
    expect(result.cached).toBe(false);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("skips Redis entirely when it is not ready", async () => {
    const redis = fakeRedis("end");
    const cache = new SearchCache(redis as never);
    const compute = vi.fn().mockResolvedValue(1);
    await cache.getOrCompute("s", {}, compute);
    await cache.getOrCompute("s", {}, compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("falls back to computing when Redis throws", async () => {
    const redis = fakeRedis();
    redis.get.mockRejectedValue(new Error("boom"));
    const cache = new SearchCache(redis as never);
    await expect(cache.getOrCompute("s", {}, async () => 42)).resolves.toEqual({ value: 42, cached: false });
  });
});

describe("EventBus", () => {
  it("calls every handler and survives a failing one", async () => {
    const bus = new EventBus();
    const good = vi.fn();
    bus.subscribe(async () => {
      throw new Error("bad listener");
    });
    bus.subscribe(good);
    await expect(bus.publish({ type: "document.uploaded", documentId: "d", userId: "u" })).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledTimes(1);
  });
});