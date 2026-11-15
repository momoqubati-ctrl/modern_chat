import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Queue, Worker } from "bullmq";
import sharp from "sharp";
import {
  REDIS_KEYS,
  agent_wallets,
  closeDb,
  closeRedis,
  eq,
  getDb,
  getRedis,
  logs,
  lt,
  or,
  profile_visits,
  publishBusEvent,
  sql,
  stats,
  sub,
  topup_order_events,
  topup_orders,
  users,
} from "@newchat/db";
import { DEFAULT_POWER_NON, TOPUP_PENDING_EXPIRY_MS } from "@newchat/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, "../../../.env") });

function getBullConnection() {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const url = new URL(redisUrl);
  return {
    host: url.hostname || "127.0.0.1",
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw as T;
  const text = String(raw).trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function sweepExpiredTopupOrders(): Promise<void> {
  const cutoff = Date.now() - TOPUP_PENDING_EXPIRY_MS;
  const reason = "انتهت مهلة الطلب تلقائيًا";
  try {
    const { db } = getDb();
    const candidatesRes = await db.execute(sql`
      SELECT id FROM topup_orders
      WHERE status = 'pending' AND requested_at > 0 AND requested_at <= ${cutoff}
      ORDER BY requested_at ASC
      LIMIT 25
    `);
    const rows = candidatesRes.rows as Array<{ id?: number | string }>;
    if (!rows.length) return;

    let expiredCount = 0;
    for (const candidate of rows) {
      const orderId = Number(candidate.id || 0);
      if (orderId < 1) continue;

      const expiredResult = await db.transaction(async (tx) => {
        const [orderRow] = await tx
          .select()
          .from(topup_orders)
          .where(eq(topup_orders.id, orderId))
          .for("update");
        if (!orderRow || String(orderRow.status || "").toLowerCase() !== "pending") {
          return null;
        }

        const agentId = Number(orderRow.agent_id || 0);
        const [walletRow] = await tx
          .select()
          .from(agent_wallets)
          .where(eq(agent_wallets.agent_id, agentId))
          .for("update");

        const now = Date.now();
        const coinsAmount = Math.max(0, Number(orderRow.package_coins || 0));
        const agentReservedBefore = Math.max(0, Number(walletRow?.reserved_coins || 0));
        const agentReservedAfter = Math.max(0, agentReservedBefore - coinsAmount);

        if (walletRow) {
          await tx
            .update(agent_wallets)
            .set({ reserved_coins: agentReservedAfter, updated_at: now })
            .where(eq(agent_wallets.agent_id, agentId));
        }

        await tx
          .update(topup_orders)
          .set({
            status: "cancelled",
            processed_by: "system",
            processed_note: reason,
            reject_reason: reason,
            processed_at: now,
          })
          .where(eq(topup_orders.id, orderId));

        await tx.insert(topup_order_events).values({
          order_id: orderId,
          order_no: String(orderRow.order_no || ""),
          event_type: "expired",
          old_status: "pending",
          new_status: "cancelled",
          actor_type: "system",
          actor_id: "system",
          note: `${reason} | الحجز قبل الإلغاء: ${agentReservedBefore} | الحجز بعد الإلغاء: ${agentReservedAfter}`,
          created_at: now,
        });

        return { orderRow, processedAt: now };
      });

      if (!expiredResult) continue;
      expiredCount += 1;

      const { orderRow, processedAt } = expiredResult;
      const orderNo = String(orderRow.order_no || "");

      await publishBusEvent({
        type: "topup_admin",
        payload: {
          id: orderRow.id,
          order_no: orderNo,
          user_uid: orderRow.user_uid,
          user_idreg: orderRow.user_idreg,
          user_topic: orderRow.user_topic,
          agent_id: orderRow.agent_id,
          agent_name: orderRow.agent_name,
          package_coins: orderRow.package_coins,
          event_type: "expired",
          old_status: "pending",
          new_status: "cancelled",
          actor_type: "system",
          actor_id: "system",
          note: reason,
          created_at: processedAt,
          order_status: "cancelled",
        },
      }).catch(() => 0);

      if (orderRow.user_uid) {
        await publishBusEvent({
          type: "socket_direct_uid",
          uid: String(orderRow.user_uid),
          cmd: "not",
          data: {
            topic: "شحن الكوينز",
            force: 1,
            msg: `انتهت مهلة طلب الشحن رقم ${orderNo}`,
            user: "",
          },
        }).catch(() => 0);
      }
    }

    if (expiredCount > 0) {
      console.log(`[Worker] Expired ${expiredCount} pending topup order(s) and released agent reserves.`);
    }
  } catch (err) {
    console.warn("[Worker] Sweep topup skipped:", err instanceof Error ? err.message : err);
  }
}

async function sweepExpiredSubscriptions(): Promise<void> {
  const now = Date.now();
  try {
    const { db } = getDb();
    const subRows = await db.select().from(sub).limit(500);
    if (!subRows.length) return;

    let expiredCount = 0;
    for (const s of subRows) {
      const daysVal = Number.parseFloat(String(s.timeis || "0"));
      const finishMs = Number.parseInt(String(s.timefinish || "0"), 10);
      if (!Number.isFinite(daysVal) || daysVal <= 0) continue;
      if (!Number.isFinite(finishMs) || finishMs <= 0 || finishMs > now) continue;

      const iduserRaw = String(s.iduser || "").trim();
      await db.delete(sub).where(eq(sub.id, s.id));
      expiredCount += 1;

      if (!iduserRaw) continue;
      const idNum = Number.parseInt(iduserRaw, 10);
      const matchedUsers = await db
        .select()
        .from(users)
        .where(
          Number.isFinite(idNum) && String(idNum) === iduserRaw
            ? or(eq(users.idreg, idNum), eq(users.uid, iduserRaw))
            : eq(users.uid, iduserRaw),
        )
        .limit(1);

      const u = matchedUsers[0];
      if (!u) continue;

      await db.update(users).set({ power: "" }).where(eq(users.idreg, u.idreg));

      if (u.uid) {
        await publishBusEvent({
          type: "socket_direct_uid",
          uid: u.uid,
          cmd: "power",
          data: DEFAULT_POWER_NON,
        }).catch(() => 0);

        await publishBusEvent({
          type: "socket_direct_uid",
          uid: u.uid,
          cmd: "not",
          data: {
            topic: "الترقية",
            force: 1,
            msg: "انتهت مدة اشتراكك في الترقية",
            user: "",
          },
        }).catch(() => 0);
      }

      try {
        const redis = getRedis();
        const allPresence = await redis.hgetall("newchat:presence:users");
        for (const [sockId, raw] of Object.entries(allPresence)) {
          const parsed = safeParseJson<Record<string, unknown> | null>(raw, null);
          if (!parsed) continue;
          const uidMatch = u.uid && String(parsed.uid || "") === u.uid;
          const idregMatch = Number(parsed.idreg || 0) === u.idreg;
          if (!uidMatch && !idregMatch) continue;
          const updated = { ...parsed, power: "", rank: "", meta_ts: Date.now() };
          await redis.hset("newchat:presence:users", sockId, JSON.stringify(updated));
          await publishBusEvent({ type: "socket_broadcast", cmd: "u^", data: updated }).catch(() => 0);
        }
      } catch {
        // ignore redis presence update failure
      }
    }

    if (expiredCount > 0) {
      console.log(`[Worker] Swept ${expiredCount} expired power subscription(s).`);
    }
  } catch (err) {
    console.warn("[Worker] Subscription sweep skipped:", err instanceof Error ? err.message : err);
  }
}

async function cleanOldProfileVisits(): Promise<void> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    const { db } = getDb();
    await db.delete(profile_visits).where(lt(profile_visits.time, cutoff));
  } catch (err) {
    console.warn("[Worker] Profile visits cleanup skipped:", err instanceof Error ? err.message : err);
  }
}

async function pruneOldSecurityLogs(): Promise<void> {
  const cutoffMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
  try {
    const { db } = getDb();
    await db.execute(sql`
      DELETE FROM ${logs}
      WHERE (CASE WHEN ${logs.time} ~ '^[0-9]+$' THEN ${logs.time}::bigint ELSE ${cutoffMs} END) < ${cutoffMs}
    `);
    await db.execute(sql`
      DELETE FROM ${stats}
      WHERE (CASE WHEN ${stats.time} ~ '^[0-9]+$' THEN ${stats.time}::bigint ELSE ${cutoffMs} END) < ${cutoffMs}
    `);
  } catch (err) {
    console.warn("[Worker] Security logs prune skipped:", err instanceof Error ? err.message : err);
  }
}

async function sweepExpiredDdosBlocks(): Promise<void> {
  try {
    const redis = getRedis();
    const blockedMap = await redis.hgetall(REDIS_KEYS.ddosBlocked);
    const now = Date.now();
    const expiredIps: string[] = [];

    for (const [ip, raw] of Object.entries(blockedMap)) {
      const parsed = safeParseJson<{ until?: number } | null>(raw, null);
      if (!parsed || Number(parsed.until || 0) <= now) {
        expiredIps.push(ip);
      }
    }

    if (expiredIps.length > 0) {
      await redis.hdel(REDIS_KEYS.ddosBlocked, ...expiredIps);
    }
  } catch (err) {
    console.warn("[Worker] DDoS sweep skipped:", err instanceof Error ? err.message : err);
  }
}

async function startWorker() {
  const connection = getBullConnection();
  const mainQueue = new Queue("mainQueue", { connection });

  await mainQueue.upsertJobScheduler(
    "sweep-topup-orders-scheduler",
    { every: 60_000 },
    { name: "sweep-topup-orders" },
  );

  await mainQueue.upsertJobScheduler(
    "sweep-expired-subs-scheduler",
    { every: 5 * 60 * 1000 },
    { name: "sweep-expired-subs" },
  );

  await mainQueue.upsertJobScheduler(
    "sweep-ddos-blocks-scheduler",
    { every: 2 * 60 * 1000 },
    { name: "sweep-ddos-blocks" },
  );

  await mainQueue.upsertJobScheduler(
    "daily-visits-cleanup-scheduler",
    { every: 6 * 60 * 60 * 1000 },
    { name: "daily-visits-cleanup" },
  );

  await mainQueue.upsertJobScheduler(
    "prune-security-logs-scheduler",
    { every: 12 * 60 * 60 * 1000 },
    { name: "prune-security-logs" },
  );

  const mainWorker = new Worker(
    "mainQueue",
    async (job) => {
      switch (job.name) {
        case "sweep-topup-orders":
          await sweepExpiredTopupOrders();
          break;
        case "sweep-expired-subs":
          await sweepExpiredSubscriptions();
          break;
        case "sweep-ddos-blocks":
          await sweepExpiredDdosBlocks();
          break;
        case "daily-visits-cleanup":
          await cleanOldProfileVisits();
          break;
        case "prune-security-logs":
          await pruneOldSecurityLogs();
          break;
        default:
          break;
      }
    },
    { connection, concurrency: 4 },
  );

  const imageWorker = new Worker(
    "imageQueue",
    async (job) => {
      if (job.name === "post-process-upload") {
        const outPath = String(job.data?.outPath || "");
        if (!outPath) return;
        const thumbPath = outPath.replace(/\.webp$/i, ".thumb.webp");
        if (thumbPath === outPath) return;
        try {
          await sharp(outPath).resize(160, 160, { fit: "cover" }).webp({ quality: 75 }).toFile(thumbPath);
        } catch {
          // ignore if source missing or non-image
        }
      }
    },
    { connection, concurrency: 2 },
  );

  mainWorker.on("failed", (job, err) => {
    console.error(`[Worker:main] Job ${job?.name} failed:`, err.message);
  });

  imageWorker.on("failed", (job, err) => {
    console.error(`[Worker:image] Job ${job?.name} failed:`, err.message);
  });

  console.log("[Worker] BullMQ Workers (mainQueue + imageQueue) running against Memurai/Redis.");

  const shutdown = async () => {
    await mainWorker.close();
    await imageWorker.close();
    await mainQueue.close();
    await closeRedis();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker().catch((err) => {
  console.error("[Worker] Fatal startup error:", err);
  process.exit(1);
});
