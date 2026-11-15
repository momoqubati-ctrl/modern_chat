import Redis from "ioredis";

let sharedRedis: Redis | null = null;

export function getRedis(url?: string): Redis {
  if (!sharedRedis) {
    const redisUrl = url || process.env.REDIS_URL || "redis://127.0.0.1:6379";
    sharedRedis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
      enableOfflineQueue: false,
      commandTimeout: 2000,
      retryStrategy(times) {
        return Math.min(times * 1000, 15000);
      },
    });
    sharedRedis.on("error", (err) => {
      console.error("[Redis/Memurai] error:", err.message);
    });
  }
  return sharedRedis;
}

export async function closeRedis() {
  if (sharedRedis) {
    await sharedRedis.quit();
    sharedRedis = null;
  }
}
