import crypto from "node:crypto";
import { getDb } from "./client.js";
import {
  users,
  coin_ledger,
  gift_notifications,
  site_master_wallet,
  site_master_wallet_ledger,
} from "./schema/index.js";
import { eq, or, asc, sql } from "drizzle-orm";

export const SITE_MASTER_WALLET_SITE_ID = 1;
export const GIFT_PLATFORM_FEE_PERCENT = 40;

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
  platformFeePercent?: number;
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
  if (!Number.isFinite(rawQuantity) || !Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > 1000) {
    throw new UnifiedEconomyError("INVALID_QUANTITY", "كمية الهدية غير صالحة");
  }
  const quantity = rawQuantity;

  const rawUnitCoin = Number(input.unitCoin);
  if (!Number.isFinite(rawUnitCoin) || !Number.isInteger(rawUnitCoin) || rawUnitCoin < 1) {
    throw new UnifiedEconomyError("INVALID_GIFT_PRICE", "سعر الهدية غير صالح");
  }
  const unitCoin = rawUnitCoin;

  const feePercent =
    typeof input.platformFeePercent === "number" && Number.isFinite(input.platformFeePercent)
      ? Math.max(0, Math.min(100, input.platformFeePercent))
      : GIFT_PLATFORM_FEE_PERCENT;

  const totalCoin = unitCoin * quantity;
  const platformFee = Math.floor((totalCoin * feePercent) / 100);
  const receiverCoin = Math.max(0, totalCoin - platformFee);
  const txid = input.txid ? String(input.txid).trim() : makeCoinTxId("gift");

  // Deterministic topological order for locking users (avoids deadlocks between concurrent transfers)
  const orderedIds = senderIdreg <= receiverIdreg ? [senderIdreg, receiverIdreg] : [receiverIdreg, senderIdreg];

  const { db } = getDb();
  try {
    return await db.transaction(async (tx) => {
      // 0. Set transaction-local lock timeout (2500ms) to prevent infinite lock waits
      await tx.execute(sql`SET LOCAL lock_timeout = '2500ms'`);

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

      // 4. Update balances and receiver icon / count
      await tx
        .update(users)
        .set({ coins: senderAfter })
        .where(eq(users.idreg, senderIdreg));

      await tx
        .update(users)
        .set({
          coins: receiverAfter,
          gifts_received_count: nextGiftsCount,
          gift_ico: `/gifts_git/${cleanGiftFile}`,
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
