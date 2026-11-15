import crypto from "node:crypto";
import type Redis from "ioredis";
import { getRedis } from "./redis.js";

export const BUS_CHANNEL = "newchat:bus:events";

export type CatalogScope =
  | "rooms"
  | "powers"
  | "settings"
  | "owner"
  | "site"
  | "cuts"
  | "notext"
  | "bans"
  | "bsb"
  | "names"
  | "hosts"
  | "bots"
  | "gifts"
  | "all";

export type BusEvent =
  | { type: "catalog_invalidate"; scopes: CatalogScope[]; updatedAt: number }
  | { type: "socket_broadcast"; cmd: string; data: unknown; volatile?: boolean }
  | {
      type: "socket_room_emit";
      roomId: string;
      cmd: string;
      data: unknown;
      exceptSocketId?: string;
    }
  | { type: "socket_direct_uid"; uid: string; cmd: string; data: unknown }
  | { type: "socket_direct_id"; socketId: string; cmd: string; data: unknown }
  | {
      type: "bot_chat_control";
      action: "start" | "stop";
      message?: string;
      intervalMs?: number;
      messagesPerTick?: number;
    }
  | {
      type: "session_ev";
      uid?: string;
      socketId?: string;
      script: string;
      disconnect?: boolean;
    }
  | { type: "coin_balance"; uid: string; coins: number }
  | { type: "topup_admin"; payload: Record<string, unknown> };

export const REDIS_KEYS = {
  ownerRuntime: "newchat:state:owner:global",
  siteRuntime: "newchat:state:site:1",
  presenceOnline: "newchat:presence:online",
  presenceVirtual: "newchat:presence:virtual",
  presencePinned: "newchat:presence:pinned",
  presenceSessions: "newchat:presence:sessions",
  uidSocketsPrefix: "newchat:uid_sockets:",
  roomMicsPrefix: "newchat:room:mics:",
  pmCalls: "newchat:pm_calls",
  carromGamePrefix: "newchat:carrom:game:",
  carromLockPrefix: "newchat:carrom:lock:",
  ludoGamePrefix: "newchat:ludo:game:",
  ludoLockPrefix: "newchat:ludo:lock:",
  ludoArenaPrefix: "newchat:ludo:arena:",
  ludoArenaIndex: "newchat:ludo:arena:index",
  ludoArenaLockPrefix: "newchat:ludo:arena:lock:",
  chatHistoryPrefix: "newchat:chat:",
  botGamePrefix: "newchat:bot_game:",
  competitionHintPrefix: "newchat:competition_hint:",
  ddosBlocked: "newchat:ddos:blocked",
  ddosCounterPrefix: "newchat:ddos:cnt:",
  rateLimitPrefix: "newchat:rl:",
  idempotencyPrefix: "newchat:idem:",
} as const;

export async function publishBusEvent(event: BusEvent): Promise<number> {
  const redis = getRedis();
  return redis.publish(BUS_CHANNEL, JSON.stringify(event));
}

export function subscribeBusEvents(
  handler: (event: BusEvent) => void | Promise<void>,
): { unsubscribe: () => Promise<void>; client: Redis } {
  const subscriber = getRedis().duplicate();
  subscriber.on("error", (err) => {
    console.error("[RedisBus] subscriber error:", err.message);
  });
  subscriber.subscribe(BUS_CHANNEL).catch((err) => {
    console.error("[RedisBus] subscribe failed:", err.message);
  });
  subscriber.on("message", (channel, raw) => {
    if (channel !== BUS_CHANNEL) return;
    try {
      const parsed = JSON.parse(raw) as BusEvent;
      if (parsed && typeof parsed.type === "string") {
        Promise.resolve(handler(parsed)).catch((err) => {
          console.error("[RedisBus] handler failed:", err);
        });
      }
    } catch (err) {
      console.error("[RedisBus] malformed message:", err);
    }
  });
  return {
    client: subscriber,
    unsubscribe: async () => {
      try {
        await subscriber.unsubscribe(BUS_CHANNEL);
      } catch {
        // ignore
      }
      await subscriber.quit();
    },
  };
}

// -------- Distributed UID -> SocketIds mapping --------

export async function addUidSocket(uid: string, socketId: string): Promise<void> {
  const safeUid = String(uid || "").trim();
  const safeSid = String(socketId || "").trim();
  if (!safeUid || !safeSid) return;
  const redis = getRedis();
  const key = REDIS_KEYS.uidSocketsPrefix + safeUid;
  await redis.sadd(key, safeSid);
  await redis.expire(key, 86400);
}

export async function removeUidSocket(uid: string, socketId: string): Promise<void> {
  const safeUid = String(uid || "").trim();
  const safeSid = String(socketId || "").trim();
  if (!safeUid || !safeSid) return;
  const redis = getRedis();
  await redis.srem(REDIS_KEYS.uidSocketsPrefix + safeUid, safeSid);
}

export async function getUidSockets(uid: string): Promise<string[]> {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return [];
  const redis = getRedis();
  return redis.smembers(REDIS_KEYS.uidSocketsPrefix + safeUid);
}

// -------- Distributed Rate Limiter (Redis Atomic Fixed Window) --------

export async function takeRedisRateSlot(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; remaining: number; retryAfterMs: number }> {
  const safeKey = String(bucketKey || "").trim();
  if (!safeKey) {
    return { ok: false, remaining: 0, retryAfterMs: windowMs };
  }
  const redis = getRedis();
  const fullKey = REDIS_KEYS.rateLimitPrefix + safeKey;
  const tx = redis.multi();
  tx.incr(fullKey);
  tx.pttl(fullKey);
  const res = await tx.exec();
  const count = Number(res?.[0]?.[1] ?? 1);
  let pttl = Number(res?.[1]?.[1] ?? -1);
  if (pttl < 0) {
    await redis.pexpire(fullKey, windowMs);
    pttl = windowMs;
  }
  if (count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(200, pttl),
    };
  }
  return {
    ok: true,
    remaining: Math.max(0, limit - count),
    retryAfterMs: 0,
  };
}

// -------- Distributed Idempotency Store --------

export async function beginRedisIdempotent(
  key: string,
  ttlMs = 60_000,
): Promise<{
  ok: boolean;
  existing?: { status: string; response?: unknown };
}> {
  const fullKey = REDIS_KEYS.idempotencyPrefix + key;
  const redis = getRedis();
  const payload = JSON.stringify({ status: "pending", createdAt: Date.now() });
  const acquired = await redis.set(fullKey, payload, "PX", ttlMs, "NX");
  if (acquired === "OK") {
    return { ok: true };
  }
  const raw = await redis.get(fullKey);
  if (raw) {
    try {
      return {
        ok: false,
        existing: JSON.parse(raw) as { status: string; response?: unknown },
      };
    } catch {
      return { ok: false };
    }
  }
  return { ok: false };
}

export async function completeRedisIdempotent(
  key: string,
  response: unknown,
  ttlMs = 60_000,
): Promise<void> {
  const fullKey = REDIS_KEYS.idempotencyPrefix + key;
  const redis = getRedis();
  await redis.set(
    fullKey,
    JSON.stringify({ status: "done", createdAt: Date.now(), response: response ?? null }),
    "PX",
    ttlMs,
  );
}

// -------- Distributed Carrom Lock --------

export interface CarromLockHandle {
  roomId: string;
  token: string;
}

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export async function acquireCarromLock(
  roomId: string,
  ttlMs = 4000,
  waitMs = 2200,
): Promise<CarromLockHandle> {
  const safeRoomId = String(roomId || "").trim();
  const key = REDIS_KEYS.carromLockPrefix + safeRoomId;
  const token = `${process.pid}:${Date.now()}:${crypto.randomBytes(6).toString("hex")}`;
  const redis = getRedis();
  const deadline = Date.now() + waitMs;

  while (Date.now() <= deadline) {
    const acquired = await redis.set(key, token, "PX", ttlMs, "NX");
    if (acquired === "OK") {
      return { roomId: safeRoomId, token };
    }
    await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 20)));
  }
  throw new Error(`carrom_room_lock_timeout:${safeRoomId}`);
}

export async function releaseCarromLock(handle: CarromLockHandle): Promise<void> {
  const redis = getRedis();
  const key = REDIS_KEYS.carromLockPrefix + handle.roomId;
  await redis.eval(RELEASE_LOCK_LUA, 1, key, handle.token).catch(() => 0);
}

export async function withCarromLock<T>(
  roomId: string,
  fn: () => Promise<T>,
  ttlMs = 4000,
  waitMs = 2200,
): Promise<T> {
  const lock = await acquireCarromLock(roomId, ttlMs, waitMs);
  try {
    return await fn();
  } finally {
    await releaseCarromLock(lock);
  }
}

// -------- Distributed Ludo Lock --------

export async function withLudoLock<T>(
  lockKeyId: string,
  fn: () => Promise<T>,
  ttlMs = 4000,
  waitMs = 2200,
): Promise<T> {
  const safeId = String(lockKeyId || "").trim();
  const key = REDIS_KEYS.ludoLockPrefix + safeId;
  const token = `${process.pid}:${Date.now()}:${crypto.randomBytes(6).toString("hex")}`;
  const redis = getRedis();
  const deadline = Date.now() + waitMs;
  let acquiredOk = false;

  while (Date.now() <= deadline) {
    const acquired = await redis.set(key, token, "PX", ttlMs, "NX");
    if (acquired === "OK") {
      acquiredOk = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 20)));
  }

  if (!acquiredOk) {
    throw new Error(`ludo_lock_timeout:${safeId}`);
  }

  try {
    return await fn();
  } finally {
    await redis.eval(RELEASE_LOCK_LUA, 1, key, token).catch(() => 0);
  }
}

// -------- Recent Chat History Cache (Redis List) --------

export async function pushRecentChatMessage(
  scope: "room" | "wall" | "pm",
  targetId: string,
  payload: unknown,
  limit = 60,
  ttlSec = 21600,
): Promise<void> {
  const redis = getRedis();
  const key = `${REDIS_KEYS.chatHistoryPrefix}${scope}:${String(targetId || "global").trim()}`;
  const serialized = JSON.stringify({ ts: Date.now(), data: payload });
  const tx = redis.multi();
  tx.lpush(key, serialized);
  tx.ltrim(key, 0, Math.max(1, limit) - 1);
  tx.expire(key, ttlSec);
  await tx.exec();
}

export async function getRecentChatMessages<T = unknown>(
  scope: "room" | "wall" | "pm",
  targetId: string,
  limit = 40,
): Promise<T[]> {
  const redis = getRedis();
  const key = `${REDIS_KEYS.chatHistoryPrefix}${scope}:${String(targetId || "global").trim()}`;
  const items = await redis.lrange(key, 0, Math.max(1, limit) - 1);
  const out: T[] = [];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(items[i]!) as { data?: T };
      if (parsed && parsed.data !== undefined) {
        out.push(parsed.data);
      }
    } catch {
      // ignore corrupted entry
    }
  }
  return out;
}
