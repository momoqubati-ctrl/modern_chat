import crypto from "node:crypto";
import { getDb } from "./client.js";
import { idempotency_records, type IdempotencyRecord } from "./schema/index.js";
import { eq, and, sql } from "drizzle-orm";
import {
  executeUnifiedGiftTransfer,
  UnifiedEconomyError,
  isUnifiedEconomyError,
  type UnifiedGiftTransferInput,
  type UnifiedGiftTransferResult,
} from "./economyEngine.js";

export const DEFAULT_IDEMPOTENCY_LEASE_MS = 5000;
export const DEFAULT_IDEMPOTENCY_WAIT_MS = 2500;
export const IDEMPOTENCY_POLL_INTERVAL_MS = 200;

export class IdempotencyError extends Error {
  code: string;
  statusCode: number;
  retryAfterMs?: number;

  constructor(code: string, message: string, statusCode = 400, retryAfterMs?: number) {
    super(message);
    this.name = "IdempotencyError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}

export function isIdempotencyError(err: unknown, code?: string): err is IdempotencyError {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; code?: unknown };
  if (e.name !== "IdempotencyError" && typeof e.code !== "string") return false;
  return code ? e.code === code : true;
}

export interface CanonicalPayloadInput {
  userUid: string;
  sourceType: string;
  targetId: string | number;
  giftFile: string;
  quantity: number;
  unitCoin: number;
}

/**
 * Builds a deterministic canonical SHA-256 hash of the transaction parameters.
 * Any difference in recipient, gift, quantity, or locked price will result in a different hash.
 */
export function buildCanonicalPayloadHash(data: CanonicalPayloadInput): string {
  const cleanGiftFile = String(data.giftFile || "")
    .replace(/^\/?gifts_git\//, "")
    .trim();
  const raw = `v1|u:${String(data.userUid).trim()}|s:${String(data.sourceType).trim()}|t:${String(
    data.targetId,
  ).trim()}|g:${cleanGiftFile}|q:${Number(data.quantity || 1)}|p:${Number(data.unitCoin || 0)}`;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export interface BeginLeaseInput {
  userUid: string;
  idempotencyKey: string;
  sourceType: string;
  payloadHash: string;
  lockedUnitCoin: number;
  leaseDurationMs?: number;
}

export type BeginLeaseResult =
  | { status: "acquired"; ownerToken: string; leaseExpiresAt: number; lockedUnitCoin: number }
  | { status: "completed"; responseJson: string; txid: string }
  | { status: "in_progress"; retryAfterMs: number }
  | { status: "payload_mismatch"; reason: string };

/**
 * Atomically acquires or claims an idempotency lease.
 * Safe against race conditions using PostgreSQL ON CONFLICT DO UPDATE ... RETURNING.
 * Freezes unitCoin permanently in locked_unit_coin on initial insert; never re-prices in DO UPDATE.
 */
export async function beginIdempotencyLease(input: BeginLeaseInput): Promise<BeginLeaseResult> {
  const userUid = String(input.userUid || "").trim();
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  const sourceType = String(input.sourceType || "feed_post").trim();
  const payloadHash = String(input.payloadHash || "").trim();
  const lockedUnitCoin = Number(input.lockedUnitCoin);

  if (!userUid || !idempotencyKey) {
    throw new IdempotencyError("INVALID_IDEMPOTENCY_KEY", "معرف العملية أو المستخدم مفقود", 400);
  }

  if (!Number.isFinite(lockedUnitCoin) || !Number.isInteger(lockedUnitCoin) || lockedUnitCoin < 1) {
    throw new IdempotencyError("INVALID_LOCKED_PRICE", "سعر العملية المراد تثبيته غير صالح", 400);
  }

  const leaseDurationMs = Math.max(1000, input.leaseDurationMs || DEFAULT_IDEMPOTENCY_LEASE_MS);
  const now = Date.now();
  const leaseExpiresAt = now + leaseDurationMs;
  const ownerToken = crypto.randomBytes(24).toString("hex");

  const { db } = getDb();

  // Atomic insert or claim expired/failed lease. Notice locked_unit_coin is NOT updated on conflict.
  const res = await db.execute(sql`
    INSERT INTO idempotency_records (
      user_uid,
      idempotency_key,
      source_type,
      payload_hash,
      status,
      owner_token,
      lease_expires_at,
      locked_unit_coin,
      created_at,
      updated_at
    ) VALUES (
      ${userUid},
      ${idempotencyKey},
      ${sourceType},
      ${payloadHash},
      'pending',
      ${ownerToken},
      ${leaseExpiresAt},
      ${lockedUnitCoin},
      ${now},
      ${now}
    )
    ON CONFLICT (user_uid, idempotency_key) DO UPDATE
      SET owner_token = EXCLUDED.owner_token,
          lease_expires_at = EXCLUDED.lease_expires_at,
          updated_at = EXCLUDED.updated_at,
          status = 'pending',
          error_message = NULL
      WHERE idempotency_records.payload_hash = EXCLUDED.payload_hash
        AND (
          idempotency_records.status = 'failed'
          OR (idempotency_records.status = 'pending' AND idempotency_records.lease_expires_at < ${now})
        )
    RETURNING user_uid, idempotency_key, payload_hash, status, owner_token, lease_expires_at, locked_unit_coin, txid, response_json
  `);

  if (res.rows && res.rows.length > 0) {
    const row = res.rows[0] as {
      owner_token: string;
      lease_expires_at: number | string;
      locked_unit_coin: number | string;
    };
    return {
      status: "acquired",
      ownerToken: row.owner_token,
      leaseExpiresAt: Number(row.lease_expires_at),
      lockedUnitCoin: Number(row.locked_unit_coin),
    };
  }

  // Row was not inserted or updated. Read existing record to determine exact state.
  const existing = await getIdempotencyRecord(userUid, idempotencyKey);
  if (!existing) {
    // Deleted concurrently, re-attempt lease once
    return beginIdempotencyLease(input);
  }

  if (existing.payload_hash !== payloadHash) {
    return {
      status: "payload_mismatch",
      reason: "تم استخدام مفتاح التحقق مسبقاً مع معطيات مختلفة للطلب أو تغير سعر الهدية",
    };
  }

  if (existing.status === "completed") {
    return {
      status: "completed",
      responseJson: existing.response_json || "{}",
      txid: existing.txid || "",
    };
  }

  // Record is pending and lease is still valid
  const remainingMs = Math.max(0, Number(existing.lease_expires_at) - Date.now());
  return {
    status: "in_progress",
    retryAfterMs: Math.max(100, remainingMs),
  };
}

/**
 * Safely marks an idempotency record as failed after transaction rollback.
 * Conditioned strictly on owner_token and status = 'pending' to prevent old zombie workers
 * from mutating a record that was re-assigned or completed by another worker.
 */
export async function markIdempotencyFailed(params: {
  userUid: string;
  idempotencyKey: string;
  ownerToken: string;
  errorMessage: string;
}): Promise<boolean> {
  const { db } = getDb();
  const now = Date.now();
  const safeMessage = String(params.errorMessage || "Unknown error").slice(0, 500);

  const res = await db.execute(sql`
    UPDATE idempotency_records
    SET status = 'failed',
        error_message = ${safeMessage},
        updated_at = ${now}
    WHERE user_uid = ${params.userUid}
      AND idempotency_key = ${params.idempotencyKey}
      AND owner_token = ${params.ownerToken}
      AND status = 'pending'
  `);

  return Number(res.rowCount || 0) > 0;
}

/**
 * Fetches an idempotency record by (user_uid, idempotency_key).
 */
export async function getIdempotencyRecord(
  userUid: string,
  idempotencyKey: string,
): Promise<IdempotencyRecord | null> {
  const { db } = getDb();
  const rows = await db
    .select()
    .from(idempotency_records)
    .where(
      and(
        eq(idempotency_records.user_uid, userUid),
        eq(idempotency_records.idempotency_key, idempotencyKey),
      ),
    )
    .limit(1);

  return rows[0] || null;
}

export interface WaitForInFlightInput {
  userUid: string;
  idempotencyKey: string;
  payloadHash: string;
  maxWaitMs?: number;
  pollIntervalMs?: number;
}

export type WaitForInFlightResult =
  | { status: "completed"; responseJson: string; txid: string }
  | { status: "failed_or_expired" }
  | { status: "timed_out"; retryAfterMs: number }
  | { status: "payload_mismatch" };

/**
 * Bounded wait polling loop for concurrent requests waiting on an active lease.
 */
export async function waitForInFlightIdempotency(
  params: WaitForInFlightInput,
): Promise<WaitForInFlightResult> {
  const maxWaitMs = Math.max(500, params.maxWaitMs || DEFAULT_IDEMPOTENCY_WAIT_MS);
  const interval = Math.max(50, params.pollIntervalMs || IDEMPOTENCY_POLL_INTERVAL_MS);
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, interval));
    const rec = await getIdempotencyRecord(params.userUid, params.idempotencyKey);
    if (!rec) {
      return { status: "failed_or_expired" };
    }
    if (rec.payload_hash !== params.payloadHash) {
      return { status: "payload_mismatch" };
    }
    if (rec.status === "completed") {
      return {
        status: "completed",
        responseJson: rec.response_json || "{}",
        txid: rec.txid || "",
      };
    }
    if (rec.status === "failed") {
      return { status: "failed_or_expired" };
    }
    if (rec.status === "pending" && Number(rec.lease_expires_at) < Date.now()) {
      return { status: "failed_or_expired" };
    }
  }

  const current = await getIdempotencyRecord(params.userUid, params.idempotencyKey);
  const remainingMs = current ? Math.max(0, Number(current.lease_expires_at) - Date.now()) : 500;
  return { status: "timed_out", retryAfterMs: Math.max(100, remainingMs) };
}

export interface ExecuteWithIdempotencyInput extends Omit<UnifiedGiftTransferInput, "txid"> {
  userUid: string;
  idempotencyKey: string;
  sourceType: "room" | "feed_post" | "admin" | "api";
  targetId: string | number;
  leaseDurationMs?: number;
  maxWaitMs?: number;
}

export interface ExecuteWithIdempotencyResult {
  ok: true;
  cached: boolean;
  data: UnifiedGiftTransferResult;
}

/**
 * Executes a gift transfer protected by the Idempotency Engine.
 * Guarantees:
 * 1. Single ACID transaction coupling coin transfer and idempotency record completion.
 * 2. In-transaction lease, ownership, and frozen price verification before any coin deduction.
 * 3. Prevention of duplicate transfers upon network failure or concurrent retry.
 * 4. Automatic cached response return for duplicate completed requests.
 * 5. Complete price drift immunity: uses frozen price across lease retries regardless of catalog changes.
 * 6. Non-destructive lock timeout handling: 55P03 preserves lease ownership.
 */
export async function executeWithIdempotency(
  input: ExecuteWithIdempotencyInput,
): Promise<ExecuteWithIdempotencyResult> {
  const userUid = String(input.userUid || "").trim();
  const idempotencyKey = String(input.idempotencyKey || "").trim();

  if (!userUid || !idempotencyKey) {
    throw new IdempotencyError("INVALID_IDEMPOTENCY_KEY", "معرف العملية أو المستخدم مفقود", 400);
  }

  // 1. Determine authoritative price (Strict Price Drift Protection):
  // If record already exists in DB, we MUST adopt its frozen locked_unit_coin rather than any new catalog price.
  const existingRecord = await getIdempotencyRecord(userUid, idempotencyKey);
  let effectiveUnitCoin: number;

  if (existingRecord) {
    if (existingRecord.status === "completed") {
      try {
        const parsed = JSON.parse(existingRecord.response_json || "{}") as UnifiedGiftTransferResult;
        return { ok: true, cached: true, data: parsed };
      } catch {
        throw new IdempotencyError(
          "INVALID_CACHED_RESPONSE",
          "تعذر استرجاع الاستجابة المحفوظة للعملية المكتملة",
          500,
        );
      }
    }

    const lockedPrice = Number(existingRecord.locked_unit_coin);
    if (!Number.isFinite(lockedPrice) || !Number.isInteger(lockedPrice) || lockedPrice < 1) {
      throw new IdempotencyError("INVALID_LOCKED_PRICE", "تعذر استعادة السعر المثبت للعملية بأمان", 500);
    }
    effectiveUnitCoin = lockedPrice;
  } else {
    // Initial creation: use server-validated unitCoin passed from caller's catalog lookup
    const rawPrice = Number(input.unitCoin);
    if (!Number.isFinite(rawPrice) || !Number.isInteger(rawPrice) || rawPrice < 1) {
      throw new IdempotencyError("INVALID_GIFT_PRICE", "سعر الهدية المحدد غير صالح", 400);
    }
    effectiveUnitCoin = rawPrice;
  }

  // 2. Calculate canonical payload hash incorporating frozen price
  const payloadHash = buildCanonicalPayloadHash({
    userUid,
    sourceType: input.sourceType,
    targetId: input.targetId,
    giftFile: input.giftFile,
    quantity: input.quantity ?? 1,
    unitCoin: effectiveUnitCoin,
  });

  // 3. Attempt to acquire lease with frozen price
  let leaseRes = await beginIdempotencyLease({
    userUid,
    idempotencyKey,
    sourceType: input.sourceType,
    payloadHash,
    lockedUnitCoin: effectiveUnitCoin,
    leaseDurationMs: input.leaseDurationMs,
  });

  // 4. Handle payload mismatch (tampered parameters or key reuse with different payload)
  if (leaseRes.status === "payload_mismatch") {
    throw new IdempotencyError(
      "PAYLOAD_MISMATCH",
      "تم استخدام مفتاح التحقق مسبقاً مع معطيات مختلفة للطلب",
      422,
    );
  }

  // 5. Handle completed (return cached response)
  if (leaseRes.status === "completed") {
    try {
      const parsed = JSON.parse(leaseRes.responseJson) as UnifiedGiftTransferResult;
      return { ok: true, cached: true, data: parsed };
    } catch {
      throw new IdempotencyError(
        "INVALID_CACHED_RESPONSE",
        "تعذر استرجاع الاستجابة المحفوظة للعملية المكتملة",
        500,
      );
    }
  }

  // 6. Handle in-progress concurrent request (bounded wait)
  if (leaseRes.status === "in_progress") {
    const waitRes = await waitForInFlightIdempotency({
      userUid,
      idempotencyKey,
      payloadHash,
      maxWaitMs: input.maxWaitMs,
    });

    if (waitRes.status === "completed") {
      try {
        const parsed = JSON.parse(waitRes.responseJson) as UnifiedGiftTransferResult;
        return { ok: true, cached: true, data: parsed };
      } catch {
        throw new IdempotencyError(
          "INVALID_CACHED_RESPONSE",
          "تعذر استرجاع الاستجابة المحفوظة للعملية المكتملة",
          500,
        );
      }
    }

    if (waitRes.status === "payload_mismatch") {
      throw new IdempotencyError(
        "PAYLOAD_MISMATCH",
        "تم استخدام مفتاح التحقق مسبقاً مع معطيات مختلفة للطلب",
        422,
      );
    }

    if (waitRes.status === "failed_or_expired") {
      // Previous request failed or expired; re-attempt acquiring lease with frozen price
      leaseRes = await beginIdempotencyLease({
        userUid,
        idempotencyKey,
        sourceType: input.sourceType,
        payloadHash,
        lockedUnitCoin: effectiveUnitCoin,
        leaseDurationMs: input.leaseDurationMs,
      });

      if (leaseRes.status === "completed") {
        const parsed = JSON.parse(leaseRes.responseJson) as UnifiedGiftTransferResult;
        return { ok: true, cached: true, data: parsed };
      }

      if (leaseRes.status !== "acquired") {
        throw new IdempotencyError(
          "CONCURRENT_TRANSACTION_IN_PROGRESS",
          "العملية قيد المعالجة حالياً من قبل طلب آخر، يرجى الانتظار",
          409,
          leaseRes.status === "in_progress" ? leaseRes.retryAfterMs : 1000,
        );
      }
    } else {
      // Timed out while still in progress
      throw new IdempotencyError(
        "CONCURRENT_TRANSACTION_IN_PROGRESS",
        "العملية قيد المعالجة حالياً من قبل طلب آخر، يرجى الانتظار",
        409,
        waitRes.retryAfterMs,
      );
    }
  }

  if (leaseRes.status !== "acquired") {
    throw new IdempotencyError("UNEXPECTED_LEASE_STATE", "حالة غير متوقعة لمعاملة التحقق", 500);
  }

  const { ownerToken } = leaseRes;

  // 7. Execute financial transfer with single-ACID idempotencyContext and frozen unitCoin
  try {
    const transferResult = await executeUnifiedGiftTransfer({
      ...input,
      unitCoin: effectiveUnitCoin,
      idempotencyContext: {
        userUid,
        idempotencyKey,
        ownerToken,
        responseJsonBuilder: (res) => res as unknown as Record<string, unknown>,
      },
    });

    return {
      ok: true,
      cached: false,
      data: transferResult,
    };
  } catch (err: unknown) {
    const isLostOwnership = isUnifiedEconomyError(err, "IDEMPOTENCY_LOST_OWNERSHIP");
    const isLockTimeout = isUnifiedEconomyError(err, "LOCK_TIMEOUT");

    // Do NOT mark failed if worker lost ownership or if lock timeout occurred.
    // Retaining 'pending' status on lock timeout preserves lease ownership until lease expiry.
    if (!isLostOwnership && !isLockTimeout) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await markIdempotencyFailed({
        userUid,
        idempotencyKey,
        ownerToken,
        errorMessage: errMsg,
      }).catch(() => {
        // Suppress failure logging error to preserve root cause
      });
    }

    if (isLockTimeout) {
      throw new IdempotencyError(
        "LOCK_TIMEOUT",
        "العملية متوقفة مؤقتاً بسبب ازدحام الموارد، يرجى إعادة المحاولة",
        503,
        1000,
      );
    }

    throw err;
  }
}
