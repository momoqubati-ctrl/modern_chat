import Redis from "ioredis";

let sharedRedis: Redis | null = null;

export function getRedis(url?: string): Redis {
  if (!sharedRedis) {
    const redisUrl = url || process.env.REDIS_URL || "redis://127.0.0.1:6379";
    sharedRedis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
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
