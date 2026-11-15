import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import {
  getDb,
  getRedis,
  publishBusEvent,
  REDIS_KEYS,
  type CatalogScope,
  owner,
  settings,
  powers,
  hosts,
  site,
  bsb,
  band,
  stats,
  users,
  eq,
  desc,
  sql,
} from "@newchat/db";
import {
  normalizeShowPowers,
  normalizeSiteSettingShape,
  sanitizePublicPresenceRecord,
  type PowerRole,
  type SiteSettingShape,
} from "@newchat/shared";
import { apiConfig } from "../config.js";

const SECRET_COINS_SESS_PREFIX = "newchat:secret_coins:sess:";
const DDOS_STRICT_KEY = "newchat:ddos:strict";
const DDOS_METRICS_KEY = "newchat:ddos:metrics";
const DDOS_ACTIONS_KEY = "newchat:ddos:actions";
const DDOS_WINDOW_MS = 10_000;
const DDOS_NORMAL_CFG = { httpLimit: 260, blockMs: 3 * 60 * 1000 };
const DDOS_STRICT_CFG = { httpLimit: 90, blockMs: 10 * 60 * 1000 };

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
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

export function normalizeForwardedClientIp(raw: unknown): string {
  const first = String(raw || "")
    .split(",")[0]
    ?.trim() || "";
  if (!first) return "";
  let cleaned = first.replace(/^\[([^\]]+)\](:\d+)?$/, "$1");
  cleaned = cleaned.replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, "$1");
  if (cleaned.startsWith("::ffff:")) {
    cleaned = cleaned.slice(7);
  }
  return cleaned.slice(0, 128);
}

export function getRequestRealIp(req: FastifyRequest): string {
  if (!apiConfig.trustProxyEnabled) {
    // Never trust client-supplied headers when not behind a controlled proxy.
    return normalizeForwardedClientIp(req.ip) || "127.0.0.1";
  }
  const headers = req.headers || {};
  const cf = headers["cf-connecting-ip"];
  const realIp = headers["x-real-ip"];
  const xff = headers["x-forwarded-for"];
  return (
    normalizeForwardedClientIp(
      (Array.isArray(cf) ? cf[0] : cf) ||
        (Array.isArray(realIp) ? realIp[0] : realIp) ||
        (Array.isArray(xff) ? xff[0] : xff) ||
        req.ip ||
        "",
    ) || "127.0.0.1"
  );
}

export function normalizeCountryCode(raw: unknown): string {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned.length >= 2 ? cleaned.slice(0, 2) : "--";
}

export function getRequestCountry(req: FastifyRequest): string {
  if (!apiConfig.trustProxyEnabled) {
    return "--";
  }
  const headers = req.headers || {};
  const val =
    headers["cf-ipcountry"] ||
    headers["x-country-code"] ||
    headers["x-vercel-ip-country"] ||
    headers["x-appengine-country"] ||
    "";
  return normalizeCountryCode(Array.isArray(val) ? val[0] : val);
}

export function constantTimeStringEquals(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (!left.length || left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function isSecretCoinsKeyValid(providedKey: unknown): boolean {
  if (!apiConfig.secretCoinsEnabled) return false;
  return constantTimeStringEquals(String(providedKey || "").trim(), apiConfig.secretCoinsKey);
}

const BRUTE_FORCE_WINDOW_SEC = 5 * 60;
const BRUTE_FORCE_MAX = 10;

export async function consumeBruteForceSlot(
  scope: string,
  key: string,
): Promise<{ blocked: boolean; retryAfterSec: number }> {
  try {
    const redis = getRedis();
    const fullKey = `newchat:auth:bf:${scope}:${key}`;
    const count = await redis.incr(fullKey);
    if (count === 1) {
      await redis.expire(fullKey, BRUTE_FORCE_WINDOW_SEC);
    }
    if (count > BRUTE_FORCE_MAX) {
      const ttl = await redis.ttl(fullKey);
      return { blocked: true, retryAfterSec: Math.max(30, ttl) };
    }
    return { blocked: false, retryAfterSec: 0 };
  } catch {
    return { blocked: false, retryAfterSec: 0 };
  }
}

export async function clearBruteForceSlot(scope: string, key: string): Promise<void> {
  try {
    await getRedis().del(`newchat:auth:bf:${scope}:${key}`);
  } catch {
    // ignore
  }
}

export function isSecretCoinsOwnerCredentialValid(
  usernameInput: unknown,
  passwordInput: unknown,
): boolean {
  const u = String(usernameInput || "").trim().toLowerCase();
  const p = String(passwordInput || "");
  if (!u || !p) return false;

  const candidates: Array<{ user: string; pass: string }> = [
    { user: apiConfig.ownerUsername.toLowerCase(), pass: apiConfig.ownerPassword },
    { user: apiConfig.owner2Username.toLowerCase(), pass: apiConfig.owner2Password },
    { user: apiConfig.systemUsername.toLowerCase(), pass: apiConfig.systemPassword },
    { user: apiConfig.systemUsername2.toLowerCase(), pass: apiConfig.systemPassword2 },
  ];

  return candidates.some(
    (item) =>
      Boolean(item.user && item.pass) &&
      constantTimeStringEquals(u, item.user) &&
      constantTimeStringEquals(p, item.pass),
  );
}

export interface SecretCoinsSessionRecord {
  sid: string;
  expiresAt: number;
  actor: {
    topic: string;
    username: string;
    ip: string;
    power: string;
    uid?: string;
    idreg?: number;
  };
}

export async function createSecretCoinsSession(
  actor: SecretCoinsSessionRecord["actor"],
): Promise<SecretCoinsSessionRecord> {
  const sid = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + apiConfig.secretCoinsSessionTtlMs;
  const record: SecretCoinsSessionRecord = { sid, expiresAt, actor };
  const redis = getRedis();
  await redis.set(
    SECRET_COINS_SESS_PREFIX + sid,
    JSON.stringify(record),
    "PX",
    apiConfig.secretCoinsSessionTtlMs,
  );
  return record;
}

export async function getValidSecretCoinsSession(
  sidRaw: unknown,
): Promise<SecretCoinsSessionRecord | null> {
  const sid = String(sidRaw || "").trim();
  if (!sid || !/^[a-f0-9]{24,96}$/i.test(sid)) return null;
  const redis = getRedis();
  const raw = await redis.get(SECRET_COINS_SESS_PREFIX + sid);
  if (!raw) return null;
  const parsed = safeJsonParse<SecretCoinsSessionRecord | null>(raw, null);
  if (!parsed || !parsed.sid || Number(parsed.expiresAt || 0) <= Date.now()) {
    await redis.del(SECRET_COINS_SESS_PREFIX + sid).catch(() => 0);
    return null;
  }
  parsed.expiresAt = Date.now() + apiConfig.secretCoinsSessionTtlMs;
  await redis.set(
    SECRET_COINS_SESS_PREFIX + sid,
    JSON.stringify(parsed),
    "PX",
    apiConfig.secretCoinsSessionTtlMs,
  );
  return parsed;
}

export async function deleteSecretCoinsSession(sidRaw: unknown): Promise<void> {
  const sid = String(sidRaw || "").trim();
  if (!sid) return;
  await getRedis()
    .del(SECRET_COINS_SESS_PREFIX + sid)
    .catch(() => 0);
}

export interface AgentPanelActor {
  id: number;
  code: string;
  name: string;
  username: string;
  country_code: string;
  city: string;
  phone: string;
  status: string;
  commission_type: string;
  commission_value: number;
  can_receive_orders: boolean;
}

export function buildAgentPanelSession(actor: AgentPanelActor): {
  sid: string;
  expiresAt: number;
  agent: AgentPanelActor;
} {
  const expiresAt = Date.now() + apiConfig.agentPanelSessionTtlMs;
  const payload = {
    agentId: actor.id,
    username: actor.username,
    exp: expiresAt,
    nonce: crypto.randomBytes(6).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", apiConfig.agentPanelSessionSecret)
    .update(encoded)
    .digest("base64url");
  return {
    sid: `${encoded}.${sig}`,
    expiresAt,
    agent: actor,
  };
}

export function verifyAgentPanelToken(sidRaw: unknown): {
  agentId: number;
  username: string;
  exp: number;
} | null {
  const sid = String(sidRaw || "").trim();
  if (!sid || !sid.includes(".")) return null;
  const parts = sid.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", apiConfig.agentPanelSessionSecret)
    .update(encoded)
    .digest("base64url");

  if (!constantTimeStringEquals(providedSig, expectedSig)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      agentId?: number;
      username?: string;
      exp?: number;
    };
    const agentId = Number(decoded.agentId || 0);
    const exp = Number(decoded.exp || 0);
    if (!Number.isFinite(agentId) || agentId <= 0 || exp <= Date.now()) {
      return null;
    }
    return {
      agentId,
      username: String(decoded.username || ""),
      exp,
    };
  } catch {
    return null;
  }
}

export async function clearRedisIdempotentKey(key: string): Promise<void> {
  if (!key) return;
  await getRedis()
    .del(REDIS_KEYS.idempotencyPrefix + key)
    .catch(() => 0);
}

// -------- Cached Catalogs & Invalidations --------

export async function getRedisJsonCached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    const redis = getRedis();
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    const fresh = await loader();
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
    return fresh;
  } catch {
    return loader();
  }
}

export async function getPowersList(): Promise<PowerRole[]> {
  return getRedisJsonCached("newchat:cache:powers", 30, async () => {
    const { db } = getDb();
    const rows = await db.select().from(powers).limit(1);
    return normalizeShowPowers(rows[0]?.powers);
  });
}

export async function getSettingsRow(settingId = 1) {
  const { db } = getDb();
  const rows = await db.select().from(settings).where(eq(settings.id, settingId)).limit(1);
  if (rows[0]) return rows[0];
  const fallback = await db.select().from(settings).limit(1);
  return fallback[0] ?? null;
}

export async function getSiteSettingParsed(settingId = 1): Promise<SiteSettingShape> {
  const row = await getSettingsRow(settingId);
  return normalizeSiteSettingShape(safeJsonParse(row?.site, {}));
}

export async function getHostList() {
  return getRedisJsonCached("newchat:cache:hosts", 30, async () => {
    const { db } = getDb();
    return db.select().from(hosts).limit(200);
  });
}

export async function getOwnerRow() {
  return getRedisJsonCached("newchat:cache:owner", 15, async () => {
    const { db } = getDb();
    const rows = await db.select().from(owner).where(eq(owner.id, 1)).limit(1);
    if (rows[0]) return rows[0];
    const fallback = await db.select().from(owner).limit(1);
    return fallback[0] ?? null;
  });
}

export async function getSiteRow(siteId = 1) {
  const { db } = getDb();
  const byIds = await db.select().from(site).where(eq(site.ids, siteId)).limit(1);
  if (byIds[0]) return byIds[0];
  const byId = await db.select().from(site).where(eq(site.id, siteId)).limit(1);
  if (byId[0]) return byId[0];
  const fallback = await db.select().from(site).limit(1);
  return fallback[0] ?? null;
}

export async function getBsbRow() {
  return getRedisJsonCached("newchat:cache:bsb", 20, async () => {
    const { db } = getDb();
    const rows = await db.select().from(bsb).where(eq(bsb.id, 1)).limit(1);
    if (rows[0]) return rows[0];
    const fallback = await db.select().from(bsb).limit(1);
    return fallback[0] ?? null;
  });
}

export async function getBandList() {
  return getRedisJsonCached("newchat:cache:bands", 15, async () => {
    const { db } = getDb();
    return db.select().from(band).orderBy(desc(band.id)).limit(1000);
  });
}

export async function invalidateCatalogScopes(scopes: CatalogScope[]): Promise<void> {
  const redis = getRedis();
  const keysToDelete: string[] = [];
  for (const scope of scopes) {
    if (scope === "powers" || scope === "all") keysToDelete.push("newchat:cache:powers");
    if (scope === "rooms" || scope === "all") keysToDelete.push("newchat:cache:rooms");
    if (scope === "hosts" || scope === "all") keysToDelete.push("newchat:cache:hosts");
    if (scope === "owner" || scope === "all") keysToDelete.push("newchat:cache:owner");
    if (scope === "bsb" || scope === "all") keysToDelete.push("newchat:cache:bsb");
    if (scope === "bans" || scope === "all") keysToDelete.push("newchat:cache:bands");
    if (
      scope === "powers" ||
      scope === "rooms" ||
      scope === "hosts" ||
      scope === "owner" ||
      scope === "settings" ||
      scope === "site" ||
      scope === "gifts" ||
      scope === "all"
    ) {
      keysToDelete.push("newchat:cache:bootstrap:default");
      try {
        const [settingKeys, bootstrapKeys] = await Promise.all([
          redis.keys("newchat:cache:settings:*"),
          redis.keys("newchat:cache:bootstrap:*"),
        ]);
        keysToDelete.push(...settingKeys, ...bootstrapKeys);
      } catch {
        // ignore pattern lookup issue
      }
    }
  }
  if (keysToDelete.length) {
    await redis.del(...new Set(keysToDelete)).catch(() => 0);
  }
  await publishBusEvent({
    type: "catalog_invalidate",
    scopes,
    updatedAt: Date.now(),
  }).catch(() => 0);
}

export function getEntrySlides(): string[] {
  const slidesDir = path.join(apiConfig.uploadDir, "entry_slides");
  const allowed = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
  try {
    if (!fs.existsSync(slidesDir)) return [];
    return fs
      .readdirSync(slidesDir)
      .filter((f) => allowed.has(path.extname(f).toLowerCase()) && !/\.jpg\.jpg$/i.test(f))
      .sort((a, b) => {
        try {
          return (
            fs.statSync(path.join(slidesDir, b)).mtimeMs -
            fs.statSync(path.join(slidesDir, a)).mtimeMs
          );
        } catch {
          return b.localeCompare(a);
        }
      })
      .slice(0, 12)
      .map((f) => `/entry_slides/${f}`);
  } catch {
    return [];
  }
}

export async function removeEntrySlideFile(fileInput: unknown): Promise<boolean> {
  const safeName = path.basename(String(fileInput || "").trim());
  if (!safeName || safeName === "." || safeName === "..") {
    return false;
  }
  const slidesDir = path.resolve(apiConfig.uploadDir, "entry_slides");
  const target = path.resolve(slidesDir, safeName);
  if (!target.startsWith(slidesDir + path.sep)) {
    return false;
  }
  try {
    if (!fs.existsSync(target)) {
      return false;
    }
    await fs.promises.unlink(target);
    await invalidateCatalogScopes(["site", "settings"]);
    return true;
  } catch {
    return false;
  }
}

export async function getHostSettingRow(hostname: string) {
  const hostClean = String(hostname || "").trim().toLowerCase();
  return getRedisJsonCached(`newchat:cache:settings:${hostClean || "default"}`, 30, async () => {
    const { db } = getDb();
    const hostList = await getHostList();
    const matched = hostList.find(
      (h) => h.hostname && hostClean && h.hostname.toLowerCase().includes(hostClean),
    );
    const settingId = matched?.setting || 1;
    const rows = await db.select().from(settings).where(eq(settings.id, settingId)).limit(1);
    if (rows[0]) return rows[0];
    const fallbackRows = await db.select().from(settings).limit(1);
    return fallbackRows[0] ?? null;
  });
}

export function extractRequestParams(req: FastifyRequest): Record<string, unknown> {
  const q = req.query && typeof req.query === "object" ? (req.query as Record<string, unknown>) : {};
  const b = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  return { ...q, ...b };
}

export function extractRequestToken(req: FastifyRequest): string {
  const params = extractRequestParams(req);
  const authHeader = String(req.headers.authorization || "").trim();
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  return String(params.token || bearer || "").trim();
}

export async function resolveUserActorByToken(tokenRaw: unknown) {
  const token = String(tokenRaw || "").trim();
  if (!token) return null;
  const { db } = getDb();

  // Support modern JWT access tokens issued by /api/auth/login or /api/auth/register
  if (token.includes(".")) {
    try {
      const payload = jwt.verify(token, apiConfig.jwtSecret) as {
        idreg?: number;
        sub?: string;
        username?: string;
        ver?: string;
      };
      const actorByClaim = async (rows: (typeof users.$inferSelect)[]) => {
        const user = rows[0];
        if (!user) return null;
        // Session binding: JWTs carry a "ver" slice of the current session token.
        // A password change / token rotation invalidates previously issued JWTs.
        const currentVer = String(user.token || "").slice(0, 24);
        if (!payload.ver || payload.ver !== currentVer) {
          return null;
        }
        return user;
      };
      if (payload?.idreg && Number.isFinite(Number(payload.idreg))) {
        const byIdreg = await db
          .select()
          .from(users)
          .where(eq(users.idreg, Number(payload.idreg)))
          .limit(1);
        const user = await actorByClaim(byIdreg);
        if (user) return user;
      }
      if (payload?.sub) {
        const byUid = await db
          .select()
          .from(users)
          .where(eq(users.uid, String(payload.sub)))
          .limit(1);
        const user = await actorByClaim(byUid);
        if (user) return user;
      }
      return null;
    } catch {
      // Fallback to direct session token lookup
    }
  }

  const byToken = await db.select().from(users).where(eq(users.token, token)).limit(1);
  return byToken[0] ?? null;
}

/**
 * Raw presence records (full GatewaySession incl. token/ip/fp).
 * Internal use only — never return these from HTTP routes or broadcasts.
 */
export async function getRawOnlinePresenceRecords(): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await getRedis().hvals("newchat:presence:users");
    const list: Array<Record<string, unknown>> = [];
    for (const item of raw) {
      const parsed = safeJsonParse<Record<string, unknown> | null>(item, null);
      if (parsed && parsed.id) {
        list.push(parsed);
      }
    }
    return list;
  } catch {
    return [];
  }
}

export async function getOnlineUsersSnapshotList(): Promise<Array<Record<string, unknown>>> {
  const raw = await getRawOnlinePresenceRecords();
  const list: Array<Record<string, unknown>> = [];
  for (const parsed of raw) {
    const pub = sanitizePublicPresenceRecord(parsed);
    if (pub) list.push(pub as unknown as Record<string, unknown>);
  }
  return list;
}

export async function getOnlineUserCount(): Promise<number> {
  try {
    return await getRedis().hlen("newchat:presence:users");
  } catch {
    return 0;
  }
}

export async function getRoomCountsMap(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const raw = await getRedis().hgetall("newchat:presence:rooms");
    for (const [k, v] of Object.entries(raw)) {
      counts[k] = Math.max(0, Number.parseInt(v, 10) || 0);
    }
  } catch {
    // ignore
  }
  return counts;
}

export async function savestate(entry: {
  state: string;
  topic?: string;
  topic1?: string;
  room?: string;
  ip?: string;
  time?: number | string;
}): Promise<void> {
  try {
    const { db } = getDb();
    await db.insert(stats).values({
      state: String(entry.state || "").slice(0, 255),
      topic: String(entry.topic || "").slice(0, 255),
      username: String(entry.topic1 || "").slice(0, 255),
      room: String(entry.room || "").slice(0, 255),
      ip: String(entry.ip || "").slice(0, 255),
      time: String(entry.time ?? Date.now()),
    });

    // Keep latest 500 stats records cleanly via indexed id cutoff (fast & constant time)
    await db.execute(sql`
      DELETE FROM stats
      WHERE id < (
        SELECT id FROM stats ORDER BY id DESC LIMIT 1 OFFSET 500
      )
    `);
  } catch {
    // non-fatal audit log
  }
}

// -------- Real-Time Bus Emitters (API -> Gateway) --------

export async function broadcastCmd(cmd: string, data: unknown): Promise<void> {
  await publishBusEvent({ type: "socket_broadcast", cmd, data }).catch(() => 0);
}

export async function emitDirectUid(uid: string, cmd: string, data: unknown): Promise<void> {
  if (!uid) return;
  await publishBusEvent({ type: "socket_direct_uid", uid, cmd, data }).catch(() => 0);
}

export async function emitRoomCmd(roomId: string, cmd: string, data: unknown): Promise<void> {
  if (!roomId) return;
  await publishBusEvent({ type: "socket_room_emit", roomId, cmd, data }).catch(() => 0);
}

export async function emitSessionEv(opts: {
  uid?: string;
  socketId?: string;
  script: string;
  disconnect?: boolean;
}): Promise<void> {
  await publishBusEvent({
    type: "session_ev",
    uid: opts.uid,
    socketId: opts.socketId,
    script: opts.script,
    disconnect: Boolean(opts.disconnect),
  }).catch(() => 0);
}

export async function applyCoinsToOnlineUser(
  userRow: { uid?: string | null; id?: string | null } | null | undefined,
  nextCoins: number,
): Promise<void> {
  const uid = String(userRow?.uid || "").trim();
  const coins = Math.max(0, Math.floor(Number(nextCoins) || 0));
  if (!uid) return;
  await publishBusEvent({ type: "coin_balance", uid, coins }).catch(() => 0);
  await emitDirectUid(uid, "coin_balance", { coins, coin: coins });
}

export async function emitTopupUserNotification(
  userRow: { uid?: string | null } | null | undefined,
  message: string,
  nextCoins: number | null,
): Promise<void> {
  const uid = String(userRow?.uid || "").trim();
  if (!uid) return;
  await emitDirectUid(uid, "not", {
    topic: "شحن الكوينز",
    force: 1,
    msg: message,
    user: "",
  });
  if (nextCoins !== null && Number.isFinite(nextCoins)) {
    const coins = Math.max(0, Math.floor(nextCoins));
    await publishBusEvent({ type: "coin_balance", uid, coins }).catch(() => 0);
    await emitDirectUid(uid, "coin_balance", { coins, coin: coins });
  }
}

export async function emitTopupAdminNotification(payload: Record<string, unknown>): Promise<void> {
  await publishBusEvent({ type: "topup_admin", payload }).catch(() => 0);
}

export async function emitBotChatControl(opts: {
  action: "start" | "stop";
  message?: string;
  intervalMs?: number;
  messagesPerTick?: number;
}): Promise<void> {
  await publishBusEvent({
    type: "bot_chat_control",
    action: opts.action,
    message: opts.message,
    intervalMs: opts.intervalMs,
    messagesPerTick: opts.messagesPerTick,
  }).catch(() => 0);
}

// -------- Redis-Backed DDoS Guard --------

export async function ddosGetStrictMode(): Promise<boolean> {
  try {
    return (await getRedis().get(DDOS_STRICT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function ddosSetStrictMode(strict: boolean, by: string): Promise<void> {
  const redis = getRedis();
  await redis.set(DDOS_STRICT_KEY, strict ? "1" : "0");
  await ddosPushAction("mode_change", { strictMode: strict, by });
}

export async function ddosPushAction(
  type: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    const redis = getRedis();
    const row = JSON.stringify({ type, at: Date.now(), ...meta });
    const tx = redis.multi();
    tx.lpush(DDOS_ACTIONS_KEY, row);
    tx.ltrim(DDOS_ACTIONS_KEY, 0, 49);
    await tx.exec();
  } catch {
    // ignore telemetry error
  }
}

export async function ddosIsBlockedIp(ip: string): Promise<boolean> {
  if (!ip) return false;
  try {
    const raw = await getRedis().hget(REDIS_KEYS.ddosBlocked, ip);
    if (!raw) return false;
    const parsed = safeJsonParse<{ until?: number }>(raw, {});
    if (Number(parsed.until || 0) <= Date.now()) {
      await getRedis().hdel(REDIS_KEYS.ddosBlocked, ip).catch(() => 0);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function ddosBlockIp(
  ip: string,
  reason: string,
  durationMs: number,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!ip) return;
  const safeDuration = Math.max(60_000, durationMs);
  const entry = {
    ip,
    reason,
    blockedAt: Date.now(),
    until: Date.now() + safeDuration,
    durationMs: safeDuration,
    ...extra,
  };
  const redis = getRedis();
  await redis.hset(REDIS_KEYS.ddosBlocked, ip, JSON.stringify(entry));
  await redis.hincrby(DDOS_METRICS_KEY, "httpBlocked", 1).catch(() => 0);
  await ddosPushAction("block_ip", { ip, reason, durationMs: safeDuration, ...extra });
}

export async function ddosUnblockIp(ip: string): Promise<void> {
  if (!ip) return;
  await getRedis().hdel(REDIS_KEYS.ddosBlocked, ip).catch(() => 0);
  await ddosPushAction("unblock_ip", { ip });
}

export async function ddosConsumeRequest(
  ip: string,
  pathName: string,
  country: string,
): Promise<{ allowed: boolean; statusCode: number; retryAfterMs: number; message: string }> {
  if (!apiConfig.ddosEnabled) {
    return { allowed: true, statusCode: 200, retryAfterMs: 0, message: "" };
  }
  const safeIp = ip || "unknown";
  if (await ddosIsBlockedIp(safeIp)) {
    await getRedis().hincrby(DDOS_METRICS_KEY, "httpBlocked", 1).catch(() => 0);
    return {
      allowed: false,
      statusCode: 429,
      retryAfterMs: 60_000,
      message: "Too many requests from this IP",
    };
  }

  const strict = await ddosGetStrictMode();
  const mode = strict ? DDOS_STRICT_CFG : DDOS_NORMAL_CFG;
  let limit = mode.httpLimit;
  const lower = pathName.toLowerCase();
  if (lower.startsWith("/socket.io/") || lower.startsWith("/cp/cp.nd") || lower.startsWith("/cp.nd")) {
    limit = Math.max(20, Math.floor(limit * 0.6));
  }

  const redis = getRedis();
  const bucketKey = `${REDIS_KEYS.ddosCounterPrefix}${safeIp}`;
  const tx = redis.multi();
  tx.incr(bucketKey);
  tx.pttl(bucketKey);
  const res = await tx.exec();
  const count = Number(res?.[0]?.[1] ?? 1);
  let pttl = Number(res?.[1]?.[1] ?? -1);
  if (pttl < 0) {
    await redis.pexpire(bucketKey, DDOS_WINDOW_MS);
    pttl = DDOS_WINDOW_MS;
  }

  if (count > limit) {
    await redis.hincrby(DDOS_METRICS_KEY, "httpLimited", 1).catch(() => 0);
    if (count > limit + Math.max(10, Math.floor(limit * 0.15))) {
      await ddosBlockIp(safeIp, "http_flood", mode.blockMs, { country });
    }
    return {
      allowed: false,
      statusCode: 429,
      retryAfterMs: Math.max(200, pttl),
      message: "Rate limit exceeded",
    };
  }

  await redis.hincrby(DDOS_METRICS_KEY, "httpAccepted", 1).catch(() => 0);
  return { allowed: true, statusCode: 200, retryAfterMs: 0, message: "" };
}

export async function ddosSnapshot() {
  const redis = getRedis();
  const [strictRaw, metricsRaw, blockedRaw, actionsRaw] = await Promise.all([
    redis.get(DDOS_STRICT_KEY).catch(() => "0"),
    redis.hgetall(DDOS_METRICS_KEY).catch(() => ({} as Record<string, string>)),
    redis.hgetall(REDIS_KEYS.ddosBlocked).catch(() => ({} as Record<string, string>)),
    redis.lrange(DDOS_ACTIONS_KEY, 0, 29).catch(() => [] as string[]),
  ]);

  const now = Date.now();
  const blocked: Array<Record<string, unknown>> = [];
  const expiredIps: string[] = [];
  for (const [ip, raw] of Object.entries(blockedRaw)) {
    const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
    if (Number(parsed.until || 0) <= now) {
      expiredIps.push(ip);
    } else {
      blocked.push(parsed);
    }
  }
  if (expiredIps.length) {
    await redis.hdel(REDIS_KEYS.ddosBlocked, ...expiredIps).catch(() => 0);
  }

  return {
    enabled: apiConfig.ddosEnabled,
    strictMode: strictRaw === "1",
    mode: strictRaw === "1" ? DDOS_STRICT_CFG : DDOS_NORMAL_CFG,
    metrics: {
      httpAccepted: Number(metricsRaw.httpAccepted || 0),
      httpLimited: Number(metricsRaw.httpLimited || 0),
      httpBlocked: Number(metricsRaw.httpBlocked || 0),
    },
    blockedCount: blocked.length,
    blocked,
    actions: actionsRaw.map((a) => safeJsonParse<Record<string, unknown>>(a, {})),
  };
}
