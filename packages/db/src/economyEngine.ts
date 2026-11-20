import crypto from "node:crypto";
import { getDb } from "./client.js";
import {
  users,
  coin_ledger,
  gift_notifications,
  gift_fee_slabs,
  gift_settings,
  site_master_wallet,
  site_master_wallet_ledger,
  hosting_owner_wallet,
  hosting_owner_wallet_ledger,
} from "./schema/index.js";
import { eq, or, asc, sql } from "drizzle-orm";
import { getRedis } from "./redis.js";

export const SITE_MASTER_WALLET_SITE_ID = 1;
const GIFT_FEE_SLABS_CACHE_KEY = "newchat:gift:fee-slabs:v1";
const GIFT_SETTINGS_CACHE_KEY = "newchat:gift:settings:v1";

function giftSettingDefault(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export class UnifiedEconomyError extends Error {
  code: string;
  isDeadlock?: boolean;

  constructor(code: string, message?: string, isDeadlock = false) {
    super(message || code);
    this.name = "UnifiedEconomyError";
    this.code = code;
    this.isDeadlock = isDeadlock;
  }
}

export function isUnifiedEconomyError(err: unknown, code?: string): err is UnifiedEconomyError {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; code?: unknown };
  if (e.name !== "UnifiedEconomyError" && typeof e.code !== "string") return false;
  return code ? e.code === code : true;
}

export interface GiftFeeSlab {
  id: number;
  slab_min_coin: number;
  slab_max_coin: number | null;
  platform_fee_bps: number;
  is_active: boolean;
}

export interface GiftSystemSettings {
  maxQty: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  giftEnabled: boolean;
}

const DEFAULT_GIFT_SETTINGS: GiftSystemSettings = {
  maxQty: giftSettingDefault("GIFT_DEFAULT_MAX_QTY", 100, 1, 100),
  rateLimitMax: giftSettingDefault("GIFT_DEFAULT_RATE_LIMIT_MAX", 6, 1, 100),
  rateLimitWindowMs: giftSettingDefault("GIFT_DEFAULT_RATE_LIMIT_WINDOW_MS", 15_000, 1000, 60_000),
  giftEnabled: true,
};

async function readGiftCache(key: string): Promise<string | null> {
  try {
    return await getRedis().get(key);
  } catch (err) {
    console.warn("[Gift] Redis cache read failed; using PostgreSQL:", err);
    return null;
  }
}

async function writeGiftCache(key: string, value: string): Promise<void> {
  try {
    await getRedis().set(key, value, "EX", 60);
  } catch (err) {
    console.warn("[Gift] Redis cache write failed:", err);
  }
}

export async function invalidateGiftConfigCache(): Promise<void> {
  try {
    await getRedis().del(GIFT_FEE_SLABS_CACHE_KEY, GIFT_SETTINGS_CACHE_KEY);
  } catch (err) {
    console.warn("[Gift] Redis cache invalidation failed:", err);
  }
}

export async function loadGiftFeeSlabs(): Promise<GiftFeeSlab[]> {
  const cached = await readGiftCache(GIFT_FEE_SLABS_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as GiftFeeSlab[];
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      console.warn("[Gift] Invalid fee-slab cache; refreshing from PostgreSQL:", err);
    }
  }

  const { db } = getDb();
  const rows = await db
    .select()
    .from(gift_fee_slabs)
    .where(eq(gift_fee_slabs.is_active, true))
    .orderBy(asc(gift_fee_slabs.slab_min_coin));
  const slabs = rows.map((row) => ({
    id: Number(row.id),
    slab_min_coin: Number(row.slab_min_coin),
    slab_max_coin: row.slab_max_coin === null ? null : Number(row.slab_max_coin),
    platform_fee_bps: Number(row.platform_fee_bps),
    is_active: Boolean(row.is_active),
  }));
  await writeGiftCache(GIFT_FEE_SLABS_CACHE_KEY, JSON.stringify(slabs));
  return slabs;
}

export async function loadGiftSettings(): Promise<GiftSystemSettings> {
  const cached = await readGiftCache(GIFT_SETTINGS_CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as GiftSystemSettings;
      if (
        Number.isSafeInteger(parsed.maxQty) &&
        parsed.maxQty >= 1 &&
        parsed.maxQty <= 100 &&
        Number.isSafeInteger(parsed.rateLimitMax) &&
        parsed.rateLimitMax >= 1 &&
        parsed.rateLimitMax <= 100 &&
        Number.isSafeInteger(parsed.rateLimitWindowMs) &&
        parsed.rateLimitWindowMs >= 1000 &&
        parsed.rateLimitWindowMs <= 60_000 &&
        typeof parsed.giftEnabled === "boolean"
      ) {
        return parsed;
      }
    } catch (err) {
      console.warn("[Gift] Invalid settings cache; refreshing from PostgreSQL:", err);
    }
  }

  const { db } = getDb();
  const rows = await db.select().from(gift_settings);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const settings = {
    maxQty: Number(values.get("max_qty") ?? DEFAULT_GIFT_SETTINGS.maxQty),
    rateLimitMax: Number(values.get("rate_limit_max") ?? DEFAULT_GIFT_SETTINGS.rateLimitMax),
    rateLimitWindowMs: Number(
      values.get("rate_limit_window_ms") ?? DEFAULT_GIFT_SETTINGS.rateLimitWindowMs,
    ),
    giftEnabled: (values.get("gift_enabled") ?? "true") === "true",
  };
  if (
    !Number.isInteger(settings.maxQty) ||
    settings.maxQty < 1 ||
    settings.maxQty > 100 ||
    !Number.isInteger(settings.rateLimitMax) ||
    settings.rateLimitMax < 1 ||
    settings.rateLimitMax > 100 ||
    !Number.isInteger(settings.rateLimitWindowMs) ||
    settings.rateLimitWindowMs < 1000 ||
    settings.rateLimitWindowMs > 60_000
  ) {
    throw new UnifiedEconomyError("INVALID_GIFT_SETTINGS", "إعدادات الهدايا غير صالحة");
  }
  await writeGiftCache(GIFT_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  return settings;
}

export function calculateGiftFees(
  totalCoin: number,
  slabs: GiftFeeSlab[],
  hostingFeePct: number,
): { platformFee: number; hostingFee: number; receiverNet: number } {
  if (!Number.isSafeInteger(totalCoin) || totalCoin < 1) {
    throw new UnifiedEconomyError("INVALID_GIFT_AMOUNT", "قيمة الهدية غير صالحة");
  }
  if (!Number.isFinite(hostingFeePct) || hostingFeePct < 0 || hostingFeePct > 50) {
    throw new UnifiedEconomyError("INVALID_HOSTING_FEE", "إعداد رسوم الاستضافة غير صالح");
  }

  const matches = slabs.filter(
    (slab) =>
      slab.is_active &&
      totalCoin >= slab.slab_min_coin &&
      (slab.slab_max_coin === null || totalCoin <= slab.slab_max_coin),
  );
  if (matches.length !== 1) {
    throw new UnifiedEconomyError("GIFT_FEE_SLAB_NOT_FOUND", "لا توجد شريحة رسوم صالحة لهذه الهدية");
  }
  const platformFee = Math.floor((totalCoin * matches[0]!.platform_fee_bps) / 10_000);
  const hostingFee = Math.floor((totalCoin * hostingFeePct) / 100);
  return {
    platformFee,
    hostingFee,
    receiverNet: totalCoin - platformFee - hostingFee,
  };
}

function getHostingFeePercent(): number {
  const raw = process.env.HOSTING_FEE_PERCENT?.trim();
  const percent = raw ? Number(raw) : 10;
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
    throw new UnifiedEconomyError("INVALID_HOSTING_FEE", "إعداد رسوم الاستضافة غير صالح");
  }
  return percent;
}

export function makeCoinTxId(prefix = "gift"): string {
  return `${String(prefix || "gift")}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export interface UnifiedGiftTransferInput {
  senderIdreg: number;
  senderUid?: string;
  senderIp?: string;
  receiverIdreg: number;
  receiverUid?: string;
  receiverTopic?: string;
  giftFile: string;
  unitCoin: number;
  quantity?: number;
  txid?: string;
  noteSender?: string;
  noteReceiver?: string;
  isOnlineTarget?: boolean;
  sourceType?: "room" | "feed_post" | "admin" | "api";
  idempotencyContext?: {
    userUid: string;
    idempotencyKey: string;
    ownerToken: string;
    responseJsonBuilder?: (result: UnifiedGiftTransferResult) => Record<string, unknown>;
  };
}

export interface UnifiedGiftTransferResult {
  ok: true;
  txid: string;
  senderAfter: number;
  senderBefore: number;
  receiverAfter: number;
  receiverBefore: number;
  receiverGiftsAfter: number;
  quantity: number;
  totalCoin: number;
  receiverCoin: number;
  platformFee: number;
  hostingFee: number;
  senderUid: string;
  senderIdreg: number;
  receiverUid: string;
  receiverIdreg: number;
}

/**
 * Core unified financial transaction engine for member-to-member gift transfers.
 * Executes double-entry coin deduction, receiver credit, platform fee deposit,
 * deterministic ascending user locking, and DB notifications in a single ACID transaction.
 */
export async function executeUnifiedGiftTransfer(
  input: UnifiedGiftTransferInput,
): Promise<UnifiedGiftTransferResult> {
  // 1. Strict input & bounds validation
  let senderIdreg = Number(input.senderIdreg || 0);
  let receiverIdreg = Number(input.receiverIdreg || 0);

  if (senderIdreg < 1 || receiverIdreg < 1) {
    if (input.senderUid && input.receiverUid) {
      const { db } = getDb();
      const rows = await db
        .select({ idreg: users.idreg, uid: users.uid })
        .from(users)
        .where(or(eq(users.uid, input.senderUid), eq(users.uid, input.receiverUid)));
      const s = rows.find((r) => r.uid === input.senderUid);
      const r = rows.find((r) => r.uid === input.receiverUid);
      if (!s) throw new UnifiedEconomyError("SENDER_NOT_FOUND", "تعذر العثور على حساب المرسل");
      if (!r) throw new UnifiedEconomyError("RECEIVER_NOT_FOUND", "تعذر العثور على حساب المستلم");
      senderIdreg = s.idreg;
      receiverIdreg = r.idreg;
    } else {
      throw new UnifiedEconomyError("INVALID_USER_IDS", "معرفات المستخدمين غير صالحة");
    }
  }

  if (senderIdreg === receiverIdreg) {
    throw new UnifiedEconomyError("CANNOT_GIFT_SELF", "لا يمكنك إرسال هدية لنفسك");
  }

  const rawQuantity = Number(input.quantity ?? 1);
  if (!Number.isFinite(rawQuantity) || !Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > 100) {
    throw new UnifiedEconomyError("INVALID_QUANTITY", "كمية الهدية غير صالحة");
  }
  const quantity = rawQuantity;

  const rawUnitCoin = Number(input.unitCoin);
  if (!Number.isFinite(rawUnitCoin) || !Number.isInteger(rawUnitCoin) || rawUnitCoin < 1) {
    throw new UnifiedEconomyError("INVALID_GIFT_PRICE", "سعر الهدية غير صالح");
  }
  const unitCoin = rawUnitCoin;

  const totalCoin = unitCoin * quantity;
  if (!Number.isSafeInteger(totalCoin)) {
    throw new UnifiedEconomyError("INVALID_GIFT_AMOUNT", "قيمة الهدية غير صالحة");
  }
  const fees = calculateGiftFees(totalCoin, await loadGiftFeeSlabs(), getHostingFeePercent());
  if (fees.receiverNet < 1) {
    throw new UnifiedEconomyError("GIFT_FEES_TOO_HIGH", "قيمة الهدية أقل من الرسوم المطبقة");
  }
  const { platformFee, hostingFee } = fees;
  const receiverCoin = fees.receiverNet;
  const txid = input.txid ? String(input.txid).trim() : makeCoinTxId("gift");

  // Deterministic topological order for locking users (avoids deadlocks between concurrent transfers)
  const orderedIds = senderIdreg <= receiverIdreg ? [senderIdreg, receiverIdreg] : [receiverIdreg, senderIdreg];

  const { db } = getDb();
  try {
    return await db.transaction(async (tx) => {
      // 0. Set transaction-local lock timeout (2500ms) to prevent infinite lock waits
      await tx.execute(sql`SET LOCAL lock_timeout = '2500ms'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '5000ms'`);

      // 0.1 If idempotencyContext is provided, lock and verify idempotency record inside transaction
      if (input.idempotencyContext) {
        const { userUid, idempotencyKey, ownerToken } = input.idempotencyContext;
        const idemRes = await tx.execute(
          sql`SELECT owner_token, lease_expires_at, status, locked_unit_coin 
              FROM idempotency_records 
              WHERE user_uid = ${userUid} AND idempotency_key = ${idempotencyKey} 
              FOR UPDATE`
        );
        if (!idemRes.rows || idemRes.rows.length === 0) {
          throw new UnifiedEconomyError("IDEMPOTENCY_NOT_FOUND", "تعذر العثور على سجل التحقق من العملية");
        }
        const idemRow = idemRes.rows[0] as {
          owner_token: string;
          lease_expires_at: number | string;
          status: string;
          locked_unit_coin: number | string;
        };
        if (idemRow.status !== "pending") {
          throw new UnifiedEconomyError(
            "IDEMPOTENCY_INVALID_STATUS",
            `حالة العملية الحالية (${idemRow.status}) لا تسمح بالتنفيذ`
          );
        }
        if (idemRow.owner_token !== ownerToken) {
          throw new UnifiedEconomyError(
            "IDEMPOTENCY_LOST_OWNERSHIP",
            "فقدت المعاملة ملكية الحجز لصالح طلب أحدث"
          );
        }
        if (Number(idemRow.lease_expires_at) < Date.now()) {
          throw new UnifiedEconomyError(
            "IDEMPOTENCY_LEASE_EXPIRED",
            "انتهت مهلة الحجز المخصصة للعملية قبل بدء التحويل"
          );
        }

        // Strict Price Drift verification: transaction must execute with frozen price
        const lockedPrice = Number(idemRow.locked_unit_coin);
        if (!Number.isFinite(lockedPrice) || lockedPrice < 1) {
          throw new UnifiedEconomyError("INVALID_LOCKED_PRICE", "السعر المثبت للعملية غير صالح");
        }
        if (lockedPrice !== unitCoin) {
          throw new UnifiedEconomyError(
            "PRICE_DRIFT_DETECTED",
            `سعر العملية غير متطابق: السعر المثبت (${lockedPrice}) يختلف عن السعر المطلوب (${unitCoin})`
          );
        }
      }

      // 1. Lock sender and receiver in deterministic ascending idreg order
      const lockedUsers = await tx
        .select({
          idreg: users.idreg,
          uid: users.uid,
          topic: users.topic,
          username: users.username,
          coins: users.coins,
          gifts_received_count: users.gifts_received_count,
        })
        .from(users)
        .where(or(eq(users.idreg, orderedIds[0]!), eq(users.idreg, orderedIds[1]!)))
        .orderBy(asc(users.idreg))
        .for("update");

      const senderRow = lockedUsers.find((u) => u.idreg === senderIdreg);
      const receiverRow = lockedUsers.find((u) => u.idreg === receiverIdreg);

      if (!senderRow) {
        throw new UnifiedEconomyError("SENDER_NOT_FOUND", "تعذر العثور على حسابك");
      }
      if (!receiverRow) {
        throw new UnifiedEconomyError("RECEIVER_NOT_FOUND", "حساب المستلم غير موجود");
      }

      // 2. Strict identity verification against locked DB rows
      if (input.senderUid && senderRow.uid && senderRow.uid !== input.senderUid) {
        throw new UnifiedEconomyError("SENDER_IDENTITY_MISMATCH", "تطابق هوية المرسل غير صحيح");
      }
      if (input.receiverUid && receiverRow.uid && receiverRow.uid !== input.receiverUid) {
        throw new UnifiedEconomyError("RECEIVER_IDENTITY_MISMATCH", "تطابق هوية المستلم غير صحيح");
      }

      // 3. Sender balance check
      const senderBefore = Math.max(0, Number(senderRow.coins || 0));
      if (senderBefore < totalCoin) {
        throw new UnifiedEconomyError("INSUFFICIENT_COINS", "رصيد الكوينز غير كافٍ");
      }

      const receiverBefore = Math.max(0, Number(receiverRow.coins || 0));
      const senderAfter = senderBefore - totalCoin;
      const receiverAfter = receiverBefore + receiverCoin;
      const nextGiftsCount = Math.max(0, Number(receiverRow.gifts_received_count || 0)) + quantity;
      const cleanGiftFile = input.giftFile.replace(/^\/?gifts_git\//, "");

      // 4. Update balances and receiver gifts count (the receiver's gift icon is never altered by gifts)
      await tx
        .update(users)
        .set({ coins: senderAfter })
        .where(eq(users.idreg, senderIdreg));

      await tx
        .update(users)
        .set({
          coins: receiverAfter,
          gifts_received_count: nextGiftsCount,
        })
        .where(eq(users.idreg, receiverIdreg));

      const now = Date.now();
      const actorUid = String(senderRow.uid || input.senderUid || "");
      const targetUid = String(receiverRow.uid || input.receiverUid || "");
      const noteSender = input.noteSender ?? "";
      const noteReceiver = input.noteReceiver ?? (input.noteSender ?? "");

      // 5. Insert double-entry coin_ledger records
      if (totalCoin > 0) {
        await tx.insert(coin_ledger).values([
          {
            txid,
            event_type: "gift_send",
            actor_uid: actorUid,
            actor_idreg: senderIdreg,
            user_uid: actorUid,
            user_idreg: senderIdreg,
            counterparty_uid: targetUid,
            counterparty_idreg: receiverIdreg,
            amount: -totalCoin,
            before_balance: senderBefore,
            after_balance: senderAfter,
            gift_file: cleanGiftFile,
            note: noteSender,
            ip: String(input.senderIp || ""),
            created_at: now,
          },
          {
            txid,
            event_type: "gift_receive",
            actor_uid: actorUid,
            actor_idreg: senderIdreg,
            user_uid: targetUid,
            user_idreg: receiverIdreg,
            counterparty_uid: actorUid,
            counterparty_idreg: senderIdreg,
            amount: receiverCoin,
            before_balance: receiverBefore,
            after_balance: receiverAfter,
            gift_file: cleanGiftFile,
            note: noteReceiver,
            ip: String(input.senderIp || ""),
            created_at: now,
          },
        ]);
      }

      // 6. Master wallet deposit (strictly locked after users)
      if (platformFee > 0) {
        await tx
          .insert(site_master_wallet)
          .values({
            site_id: SITE_MASTER_WALLET_SITE_ID,
            balance_coins: 0,
            reserved_coins: 0,
            status: "active",
            created_at: now,
            updated_at: now,
          })
          .onConflictDoNothing();

        const mwRes = await tx.execute(
          sql`SELECT balance_coins FROM site_master_wallet WHERE site_id = ${SITE_MASTER_WALLET_SITE_ID} FOR UPDATE`,
        );
        const mwBefore = Math.max(
          0,
          Number((mwRes.rows[0] as { balance_coins: number | string } | undefined)?.balance_coins || 0),
        );
        const mwAfter = mwBefore + platformFee;

        await tx
          .update(site_master_wallet)
          .set({ balance_coins: mwAfter, updated_at: now })
          .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID));

        await tx.insert(site_master_wallet_ledger).values({
          txid,
          site_id: SITE_MASTER_WALLET_SITE_ID,
          event_type: "gift_fee",
          amount: platformFee,
          before_balance: mwBefore,
          after_balance: mwAfter,
          actor_type: "user",
          actor_id: actorUid,
          counterparty_type: "user",
          counterparty_id: targetUid,
          note: `Gift ${cleanGiftFile} x${quantity}`,
          reference_table: "gift_notifications",
          reference_id: 0,
          created_at: now,
        });
      }

      if (hostingFee > 0) {
        await tx
          .insert(hosting_owner_wallet)
          .values({
            id: 1,
            balance_coins: 0,
            status: "active",
            created_at: now,
            updated_at: now,
          })
          .onConflictDoNothing();

        const ownerWalletRes = await tx.execute(
          sql`SELECT balance_coins FROM hosting_owner_wallet WHERE id = 1 FOR UPDATE`,
        );
        const ownerBefore = Math.max(
          0,
          Number(
            (ownerWalletRes.rows[0] as { balance_coins: number | string } | undefined)
              ?.balance_coins || 0,
          ),
        );
        const ownerAfter = ownerBefore + hostingFee;
        await tx
          .update(hosting_owner_wallet)
          .set({ balance_coins: ownerAfter, updated_at: now })
          .where(eq(hosting_owner_wallet.id, 1));
        await tx.insert(hosting_owner_wallet_ledger).values({
          txid,
          event_type: "gift_hosting_fee",
          amount: hostingFee,
          before_balance: ownerBefore,
          after_balance: ownerAfter,
          reference_table: "gift_notifications",
          reference_id: 0,
          note: `Gift ${cleanGiftFile} x${quantity}`,
          created_at: now,
        });
      }

      // 7. Insert gift_notifications
      const isOnline = Boolean(input.isOnlineTarget);
      await tx.insert(gift_notifications).values({
        txid,
        to_uid: targetUid,
        to_idreg: receiverIdreg,
        from_uid: actorUid,
        from_idreg: senderIdreg,
        from_topic: String(senderRow.topic || senderRow.username || ""),
        gift_file: cleanGiftFile,
        coin: receiverCoin,
        note: noteReceiver,
        is_read: isOnline,
        created_at: now,
        read_at: isOnline ? now : 0,
      });

      const transferResult: UnifiedGiftTransferResult = {
        ok: true as const,
        txid,
        senderAfter,
        senderBefore,
        receiverAfter,
        receiverBefore,
        receiverGiftsAfter: nextGiftsCount,
        quantity,
        totalCoin,
        receiverCoin,
        platformFee,
        hostingFee,
        senderUid: actorUid,
        senderIdreg,
        receiverUid: targetUid,
        receiverIdreg,
      };

      // 8. If idempotencyContext is provided, mark record completed in the SAME ACID transaction
      if (input.idempotencyContext) {
        const { userUid, idempotencyKey, ownerToken, responseJsonBuilder } = input.idempotencyContext;
        const payloadToStore = responseJsonBuilder ? responseJsonBuilder(transferResult) : transferResult;
        const responseJson = JSON.stringify(payloadToStore);

        const updateRes = await tx.execute(
          sql`UPDATE idempotency_records
              SET status = 'completed',
                  txid = ${txid},
                  response_json = ${responseJson},
                  updated_at = ${now}
              WHERE user_uid = ${userUid}
                AND idempotency_key = ${idempotencyKey}
                AND owner_token = ${ownerToken}
                AND status = 'pending'`
        );

        if (Number(updateRes.rowCount || 0) === 0) {
          throw new UnifiedEconomyError(
            "IDEMPOTENCY_LOST_OWNERSHIP",
            "تعذر تأكيد اكتمال العملية لفقدان ملكية الحجز لصالح طلب أحدث"
          );
        }
      }

      return transferResult;
    });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "40P01") {
      throw new UnifiedEconomyError(
        "DEADLOCK_DETECTED",
        "حدث تعارض متزامن أثناء معالجة العملية، يرجى إعادة المحاولة",
        true,
      );
    }
    if (pgCode === "55P03") {
      throw new UnifiedEconomyError(
        "LOCK_TIMEOUT",
        "تعذر الحصول على قفل المورد بسبب الازدحام المتزامن، يرجى إعادة المحاولة",
        true,
      );
    }
    throw err;
  }
}
