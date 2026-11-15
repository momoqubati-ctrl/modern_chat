import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  extractLiveKitPublicMeta,
  getDb,
  getRedis,
  mergeLiveKitCredsIntoSite,
  publishBusEvent,
  REDIS_KEYS,
  stripSensitiveSiteFields,
  type CatalogScope,
  and,
  band,
  bars,
  bots,
  bsb,
  cuts,
  desc,
  eq,
  histletter,
  hosts,
  intromsg,
  logs,
  names,
  notext,
  or,
  owner,
  powers,
  rooms,
  settings,
  site,
  sql,
  stats,
  storie,
  storieview,
  sub,
  users,
} from "@newchat/db";
import {
  DEFAULT_POWERS,
  DEFAULT_POWER_NON,
  MIC_SLOT_COUNT,
  canAccessAnyHostingSection,
  canAccessHostingSection,
  canEditMicProvider,
  canManageEvaluationPoints,
  getHostingSectionAccess,
  getPowerDefinitionByName,
  getSystemRoomOwner,
  isLegacyHostingSuperPower,
  myOptionDone,
  myOptionHistory,
  normalizeEvaluationAwardSettings,
  normalizeGiftCategories,
  normalizeGiftsGit,
  normalizeMicProviderSetting,
  normalizeRoomBadgesCatalog,
  normalizeRoomMessageMode,
  normalizeRoomOwnerAssignment,
  normalizeRoomOwnerBadge,
  normalizeShowPowers,
  normalizeSiteBadgesCatalog,
  normalizeSiteSettingShape,
  parseRoomOwnerMeta,
  sanitizeHtmlText,
  sanitizePublicPresenceRecord,
  verAdminPanel,
  verPower,
  verRoomsOwner,
} from "@newchat/shared";
import { apiConfig } from "../config.js";
import { ensureBotLoadTestRooms, runTalkingBotsSeed } from "../lib/botSeed.js";
import { hashPasswordSync } from "../lib/password.js";
import {
  broadcastCmd,
  ddosBlockIp,
  ddosSetStrictMode,
  ddosSnapshot,
  ddosUnblockIp,
  emitBotChatControl,
  emitDirectUid,
  emitRoomCmd,
  emitSessionEv,
  emitTopupAdminNotification,
  emitTopupUserNotification,
  extractRequestParams,
  extractRequestToken,
  getBandList,
  getBsbRow,
  getEntrySlides,
  getOnlineUsersSnapshotList,
  getRawOnlinePresenceRecords,
  getOwnerRow,
  getPowersList,
  getRequestCountry,
  getRequestRealIp,
  getRoomCountsMap,
  getSettingsRow,
  getSiteRow,
  invalidateCatalogScopes,
  normalizeCountryCode,
  normalizeForwardedClientIp,
  removeEntrySlideFile,
  resolveUserActorByToken,
  safeJsonParse,
  savestate,
  applyCoinsToOnlineUser,
} from "../lib/runtime.js";
import {
  adjustSiteMasterWalletAtomic,
  approveTopupOrderAtomic,
  buildWalletActorLabel,
  createAgentWithWalletAtomic,
  getAgentWalletDashboardSnapshot,
  isEconomyError,
  rejectTopupOrderAtomic,
  saveCoinPackageAtomic,
  transferSiteMasterWalletToAgentAtomic,
  updateAgentCommissionAtomic,
  updateAgentStatusAtomic,
  updateCoinPackageStatusAtomic,
} from "../services/economy.js";

const DEFAULT_SITE_SCRIPT_JSON = {
  settscr: "",
  setthead: "",
  settdescription: "",
  settkeywords: "",
  name: "",
};

const CACHE_LAST_WARMUP_KEY = "newchat:cache:last_warmup_at";
const CACHE_LAST_PURGE_KEY = "newchat:cache:last_purge_at";
const MAX_POWER_COUNT = 100;

function parseJsonObjectParam(raw: unknown): Record<string, any> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = safeJsonParse<unknown>(raw, null);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  }
  return null;
}

function redactUserRow(u: typeof users.$inferSelect) {
  const { password: _password, ...safe } = u;
  return safe;
}

function validateIpAddress(ip: string): boolean {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    ip,
  );
}

function addDaysMsString(daysRaw: unknown): string {
  const days = Number(daysRaw);
  const safeDays = Number.isFinite(days) ? days : 0;
  return String(Math.floor(Date.now() + safeDays * 24 * 60 * 60 * 1000));
}

function normalizePositiveInt(
  raw: unknown,
  fallback: number,
  minVal: number,
  maxVal: number,
): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(minVal, Math.min(maxVal, n));
}

function sanitizeBotLoadTestText(raw: unknown, fallback: string, maxLen: number): string {
  const cleaned = String(raw ?? fallback ?? "")
    .replace(/</g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
  return cleaned || fallback;
}

async function resolveTargetUser(idInput: unknown) {
  const raw = String(idInput || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^#/, "");
  const { db } = getDb();
  if (/^\d+$/.test(cleaned)) {
    const numId = Number.parseInt(cleaned, 10);
    if (Number.isFinite(numId) && numId > 0) {
      const byIdreg = await db.select().from(users).where(eq(users.idreg, numId)).limit(1);
      if (byIdreg[0]) return byIdreg[0];
    }
  }
  const byAlt = await db
    .select()
    .from(users)
    .where(or(eq(users.username, cleaned), eq(users.uid, raw), eq(users.id, raw)))
    .limit(1);
  return byAlt[0] ?? null;
}

async function ensureRoomRowById(roomIdRaw: unknown) {
  const roomId = String(roomIdRaw || "").trim();
  if (!roomId) return null;
  const { db } = getDb();
  const rows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  return rows[0] ?? null;
}

function formatRoomForEmit(room: typeof rooms.$inferSelect) {
  let micLocks: Record<string, boolean> = {};
  const parsedStage = safeJsonParse<Record<string, unknown>>(room.stage_state, {});
  for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
    micLocks[String(i)] = parsedStage[String(i)] !== undefined ? Boolean(parsedStage[String(i)]) : true;
  }
  return {
    id: room.id || String(room.idroom),
    idroom: room.idroom,
    topic: room.topic || "",
    delete: Boolean(room.deleted),
    deleted: Boolean(room.deleted),
    needpass: Boolean(room.needpass),
    owner: room.owner || "",
    pic: room.pic || "room.png",
    broadcast: Boolean(room.broadcast),
    user: room.user || "",
    rmli: room.rmli ?? 0,
    about: room.about || "",
    welcome: room.welcome || "",
    max: room.max ?? 0,
    color: room.color || "#000000",
    mic: room.mic ?? 0,
    stage_count: room.stage_count ?? MIC_SLOT_COUNT,
    stage_state: room.stage_state || "{}",
    micLocks,
    room_owner_meta: room.room_owner_meta || "",
    message_mode: normalizeRoomMessageMode(room.message_mode),
  };
}

async function patchOnlineUserSnapshotByUidOrId(
  target: { uid?: string | null; id?: string | null; idreg?: number },
  patch: Record<string, unknown>,
) {
  try {
    const redis = getRedis();
    const all = await redis.hgetall("newchat:presence:users");
    const targetUid = String(target.uid || "").trim();
    const targetId = String(target.id || "").trim();
    const targetIdregHash = target.idreg ? `#${target.idreg}` : "";

    for (const [sockId, raw] of Object.entries(all)) {
      const parsed = safeJsonParse<Record<string, unknown> | null>(raw, null);
      if (!parsed) continue;
      const matches =
        (targetUid && String(parsed.uid || "") === targetUid) ||
        (targetId && (sockId === targetId || String(parsed.id || "") === targetId)) ||
        (targetIdregHash && String(parsed.idreg || "") === targetIdregHash);
      if (!matches) continue;
      const updated = {
        ...parsed,
        ...patch,
        meta_ts: Date.now(),
      };
      await redis.hset("newchat:presence:users", sockId, JSON.stringify(updated));
      const pub = sanitizePublicPresenceRecord(updated);
      if (pub) {
        await broadcastCmd("u^", pub);
      }
    }
  } catch {
    // non-fatal redis presence patch
  }
}

function buildBotPresencePayload(botRow: typeof bots.$inferSelect) {
  const roomId = String(botRow.room || "").trim() || null;
  const topic = sanitizeHtmlText(String(botRow.topic || ""));
  return {
    id: String(botRow.id || ""),
    uid: String(botRow.id || ""),
    lid: "",
    idreg: "",
    co: String(botRow.country || "kw"),
    topic,
    username: topic,
    pic: String(botRow.pic || "pic.png"),
    pich: "",
    power: String(botRow.power || ""),
    rank: String(botRow.power || ""),
    islogin: "بوت",
    bg: "#FFFFFF",
    gcol: "#FFFFFF",
    ucol: "#000000",
    mcol: "#000000",
    stat: Number(botRow.stat ?? 0) || 0,
    offline: false,
    yp: "",
    ico: "",
    them: "",
    cover: "",
    documents: false,
    documentationc: false,
    gift_ico: "",
    msg: sanitizeHtmlText(String(botRow.msg || "(عضو جديد)")),
    busy: false,
    alerts: false,
    nopmcall: false,
    nopmvideocall: false,
    rep: 0,
    wall_post_likes: 0,
    gifts_received_count: 0,
    coin: 0,
    evaluation: 0,
    site_badge_id: "",
    site_badge: "",
    ip: String(botRow.ip || "127.0.0.1"),
    roomid: roomId,
    meta_ts: Date.now(),
  };
}

async function recalcAndBroadcastRoomCounts() {
  try {
    const redis = getRedis();
    const online = await getOnlineUsersSnapshotList();
    const counts: Record<string, number> = {};
    for (const u of online) {
      if (u.s || u.offline || Number(u.stat || 0) === 3) continue;
      const roomId = String(u.roomid || "").trim();
      if (!roomId) continue;
      counts[roomId] = (counts[roomId] || 0) + 1;
    }
    const existingKeys = await redis.hkeys("newchat:presence:rooms");
    if (existingKeys.length) {
      await redis.del("newchat:presence:rooms");
    }
    if (Object.keys(counts).length) {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(counts)) {
        flat[k] = String(v);
      }
      await redis.hset("newchat:presence:rooms", flat);
    }
    await broadcastCmd("rooms_counts", { ver: Date.now(), ts: Date.now(), counts });
  } catch {
    // non-fatal room count sync
  }
}

async function handleSetPowerCommand(
  actor: typeof users.$inferSelect,
  powersList: ReturnType<typeof normalizeShowPowers>,
  params: Record<string, unknown>,
  actorIp: string,
  checkChatmasterSpecial: boolean,
) {
  const actorDef = getPowerDefinitionByName(powersList, actor.power);
  if (!actorDef?.setpower) {
    return { err: true, msg: "لا تملك صلاحية" };
  }

  const nextPower = String(params.power ?? "");
  if (
    checkChatmasterSpecial &&
    nextPower === "chatmaster" &&
    actor.power !== "Hide" &&
    actor.power !== "ispower"
  ) {
    return { err: true, msg: "هذه الترقية خاصة" };
  }

  const targetUser = await resolveTargetUser(params.id);
  if (!targetUser) {
    return { err: false, msg: "تم ترقية هذا الزائر بنجاح" };
  }

  if (
    !verPower(powersList, { to: actor.power, me: targetUser.power }) ||
    !verPower(powersList, { to: actor.power, me: nextPower })
  ) {
    return { err: true, msg: "لا يمكنك التعديل على من هوا اعلى منك رتبة" };
  }

  const { db } = getDb();
  const idStr = String(targetUser.idreg);

  await db
    .update(users)
    .set({ power: nextPower })
    .where(eq(users.idreg, targetUser.idreg));

  const existingSub = await db
    .select()
    .from(sub)
    .where(eq(sub.iduser, idStr))
    .limit(1);

  const daysStr = String(params.days ?? "0");
  const nowStr = String(Date.now());
  const finishStr = addDaysMsString(daysStr);

  if (existingSub[0]) {
    await db
      .update(sub)
      .set({
        sub: nextPower,
        timestart: nowStr,
        timefinish: finishStr,
        timeis: daysStr,
      })
      .where(eq(sub.iduser, idStr));
  } else {
    await db.insert(sub).values({
      iduser: idStr,
      sub: nextPower,
      topic: targetUser.username,
      topic1: targetUser.topic,
      timestart: nowStr,
      timefinish: finishStr,
      timeis: daysStr,
    });
  }

  const powerObj = getPowerDefinitionByName(powersList, nextPower) || DEFAULT_POWER_NON;
  if (targetUser.uid) {
    await emitDirectUid(targetUser.uid, "power", powerObj);
  }
  await patchOnlineUserSnapshotByUidOrId(targetUser, {
    power: sanitizeHtmlText(nextPower),
    rank: sanitizeHtmlText(nextPower),
  });

  await savestate({
    state: !existingSub[0] && nextPower ? "ترقية حساب" : "تعديل صلاحية",
    topic: actor.topic,
    topic1: `[${nextPower}] ${targetUser.topic}`,
    room: "",
    ip: actorIp,
    time: Date.now(),
  });

  if (!nextPower) {
    return { err: false, msg: "تم تنزيل رتبة المستخدم" };
  }
  return { err: false, msg: "تم ترقية هذا المستخدم بنجاح" };
}

async function handleCpCommand(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  reply.header("Cache-Control", "no-store");
  const params = extractRequestParams(req);
  const cmd = String(params.cmd || "").trim();
  const token = extractRequestToken(req);

  if (!token) {
    return reply.code(401).send({ err: true, msg: "مطلوب تسجيل دخول للإدارة" });
  }

  const data = await resolveUserActorByToken(token);
  const powersList = await getPowersList();
  if (!data || !verAdminPanel(powersList, data.power)) {
    return { err: true, msg: "لا تمتلك صلاحيات" };
  }

  const actorDef = getPowerDefinitionByName(powersList, data.power);
  const actorPower = String(data.power || "");
  const actorIp = getRequestRealIp(req) || data.ip || "127.0.0.1";
  const isOwner = Boolean(actorDef?.owner);
  const isSuperPower = isLegacyHostingSuperPower(actorPower);
  const { db } = getDb();

  switch (cmd) {
    // -------- DDoS Guard --------
    case "ddos_status": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      return { err: false, data: await ddosSnapshot() };
    }
    case "ddos_mode": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const modeVal = String(params.mode || "").trim().toLowerCase();
      let strictMode: boolean;
      if (modeVal === "strict" || modeVal === "on" || modeVal === "1") {
        strictMode = true;
      } else if (modeVal === "normal" || modeVal === "off" || modeVal === "0") {
        strictMode = false;
      } else {
        return { err: true, msg: "قيمة الوضع غير صالحة" };
      }
      await ddosSetStrictMode(strictMode, data.username || data.topic || "");
      await savestate({
        state: "تعديل وضع حماية الدوز",
        topic: data.topic,
        topic1: strictMode ? "STRICT" : "NORMAL",
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم تحديث وضع الحماية", data: await ddosSnapshot() };
    }
    case "ddos_block_ip": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const targetIp = normalizeForwardedClientIp(params.ip || "");
      if (!targetIp) return { err: true, msg: "IP غير صالح" };
      const durationMs = Math.max(60_000, Number.parseInt(String(params.duration_ms || "0"), 10) || 180_000);
      const targetCountry = normalizeCountryCode(params.country || getRequestCountry(req));
      await ddosBlockIp(targetIp, "manual_admin", durationMs, { country: targetCountry });
      await savestate({
        state: "حظر IP يدوي",
        topic: data.topic,
        topic1: targetIp,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم حظر الـ IP", data: await ddosSnapshot() };
    }
    case "ddos_unblock_ip": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const targetIp = normalizeForwardedClientIp(params.ip || "");
      if (!targetIp) return { err: true, msg: "IP غير صالح" };
      await ddosUnblockIp(targetIp);
      await savestate({
        state: "فك حظر IP",
        topic: data.topic,
        topic1: targetIp,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم فك حظر الـ IP", data: await ddosSnapshot() };
    }

    // -------- Agents, Master Wallet, Topup Packages & Orders --------
    case "agent_wallet_dashboard": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      try {
        return { err: false, data: await getAgentWalletDashboardSnapshot() };
      } catch {
        return { err: true, msg: "تعذر تحميل بيانات الشحن" };
      }
    }
    case "master_wallet_adjust": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const result = await adjustSiteMasterWalletAtomic(
          data,
          params.amount,
          params.direction,
          params.note,
        );
        await savestate({
          state: params.direction === "subtract" ? "خصم من الرصيد الرئيسي" : "إضافة إلى الرصيد الرئيسي",
          topic: data.topic,
          topic1: `${Number(params.amount || 0)} coin`,
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return {
          err: false,
          msg: params.direction === "subtract" ? "تم خصم الرصيد بنجاح" : "تمت إضافة الرصيد بنجاح",
          data: result,
        };
      } catch (err) {
        if (isEconomyError(err, "MASTER_WALLET_INSUFFICIENT")) {
          return { err: true, msg: "رصيد المحفظة الرئيسية غير كاف" };
        }
        if (isEconomyError(err, "MASTER_AMOUNT_REQUIRED")) {
          return { err: true, msg: "كمية الرصيد غير صالحة" };
        }
        return { err: true, msg: "تعذر تعديل الرصيد الرئيسي" };
      }
    }
    case "agent_wallet_create": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const payload = parseJsonObjectParam(params.data);
      if (!payload) return { err: true, msg: "بيانات الوكيل غير صالحة" };
      try {
        const agentRow = await createAgentWithWalletAtomic(data, payload);
        await savestate({
          state: "إضافة وكيل شحن",
          topic: data.topic,
          topic1: String(agentRow?.name || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم إنشاء الوكيل بنجاح", data: agentRow };
      } catch (err) {
        if (isEconomyError(err, "AGENT_NAME_REQUIRED")) return { err: true, msg: "اسم الوكيل مطلوب" };
        if (isEconomyError(err, "AGENT_USERNAME_INVALID")) return { err: true, msg: "اسم مستخدم الوكيل غير صالح" };
        if (isEconomyError(err, "AGENT_PASSWORD_INVALID")) {
          return { err: true, msg: "كلمة مرور الوكيل يجب أن تكون 4 أحرف على الأقل" };
        }
        if (isEconomyError(err, "AGENT_USERNAME_EXISTS")) return { err: true, msg: "اسم مستخدم الوكيل مستخدم بالفعل" };
        return { err: true, msg: "تعذر إنشاء الوكيل" };
      }
    }
    case "agent_wallet_commission_save": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const agentRow = await updateAgentCommissionAtomic(
          data,
          params.id,
          params.commission_type,
          params.commission_value,
        );
        await savestate({
          state: "تعديل عمولة وكيل",
          topic: data.topic,
          topic1: String(agentRow?.name || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم تحديث عمولة الوكيل", data: agentRow };
      } catch (err) {
        if (isEconomyError(err, "AGENT_NOT_FOUND")) return { err: true, msg: "الوكيل غير موجود" };
        return { err: true, msg: "تعذر تحديث عمولة الوكيل" };
      }
    }
    case "agent_wallet_toggle": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const agentRow = await updateAgentStatusAtomic(data, params.id, params.status);
        await savestate({
          state: "تغيير حالة وكيل شحن",
          topic: data.topic,
          topic1: String(agentRow?.name || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم تحديث حالة الوكيل", data: agentRow };
      } catch (err) {
        if (isEconomyError(err, "AGENT_NOT_FOUND")) return { err: true, msg: "الوكيل غير موجود" };
        return { err: true, msg: "تعذر تحديث حالة الوكيل" };
      }
    }
    case "owner_agent_transfer": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const payload = parseJsonObjectParam(params.data);
      if (!payload) return { err: true, msg: "بيانات التحويل غير صالحة" };
      try {
        const result = await transferSiteMasterWalletToAgentAtomic(data, payload);
        await savestate({
          state: "تحويل رصيد إلى وكيل",
          topic: data.topic,
          topic1: `${result.agentName} / ${Number(payload.coins_amount || 0)} coin`,
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم تحويل الرصيد إلى الوكيل", data: result };
      } catch (err) {
        if (isEconomyError(err, "MASTER_WALLET_INSUFFICIENT")) return { err: true, msg: "رصيد المحفظة الرئيسية غير كاف" };
        if (isEconomyError(err, "AGENT_NOT_FOUND")) return { err: true, msg: "الوكيل غير موجود" };
        if (isEconomyError(err, "TRANSFER_AMOUNT_REQUIRED")) return { err: true, msg: "كمية التحويل غير صالحة" };
        return { err: true, msg: "تعذر تحويل الرصيد إلى الوكيل" };
      }
    }
    case "topup_package_save": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const payload = parseJsonObjectParam(params.data);
      if (!payload) return { err: true, msg: "بيانات الباقة غير صالحة" };
      try {
        const pkg = await saveCoinPackageAtomic(data, payload);
        await savestate({
          state: payload.id ? "تعديل باقة شحن" : "إضافة باقة شحن",
          topic: data.topic,
          topic1: String(pkg?.title || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم حفظ الباقة بنجاح", data: pkg };
      } catch (err) {
        if (isEconomyError(err, "TOPUP_PACKAGE_TITLE_REQUIRED")) return { err: true, msg: "اسم الباقة مطلوب" };
        if (isEconomyError(err, "TOPUP_PACKAGE_COINS_REQUIRED")) return { err: true, msg: "عدد الكوينز غير صالح" };
        if (isEconomyError(err, "TOPUP_PACKAGE_NOT_FOUND")) return { err: true, msg: "الباقة غير موجودة" };
        return { err: true, msg: "تعذر حفظ الباقة" };
      }
    }
    case "topup_package_toggle": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const pkg = await updateCoinPackageStatusAtomic(data, params.id, params.active);
        await savestate({
          state: pkg?.is_active ? "تفعيل باقة شحن" : "إيقاف باقة شحن",
          topic: data.topic,
          topic1: String(pkg?.title || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم تحديث حالة الباقة", data: pkg };
      } catch (err) {
        if (isEconomyError(err, "TOPUP_PACKAGE_NOT_FOUND")) return { err: true, msg: "الباقة غير موجودة" };
        return { err: true, msg: "تعذر تحديث حالة الباقة" };
      }
    }
    case "topup_order_approve": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const result = await approveTopupOrderAtomic(
          { ...data, ip: actorIp },
          params.id,
          params.note,
        );
        await applyCoinsToOnlineUser(result.userRow, result.userAfter);
        await emitTopupUserNotification(
          result.userRow,
          `تم اعتماد طلب الشحن رقم ${String(result.order?.order_no || "")}`,
          result.userAfter,
        );
        if (result.order) {
          await emitTopupAdminNotification({
            ...result.order,
            event_type: "approved",
            old_status: "pending",
            new_status: "approved",
            actor_type: "owner",
            actor_id: buildWalletActorLabel(data),
            note: result.order.processed_note || "",
            created_at: result.order.processed_at || Date.now(),
            order_status: result.order.status,
          });
        }
        await savestate({
          state: "اعتماد طلب شحن",
          topic: data.topic,
          topic1: String(result.order?.order_no || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم اعتماد طلب الشحن", data: result.order };
      } catch (err) {
        if (isEconomyError(err, "TOPUP_ORDER_NOT_FOUND")) return { err: true, msg: "طلب الشحن غير موجود" };
        if (isEconomyError(err, "TOPUP_ORDER_NOT_PENDING")) return { err: true, msg: "طلب الشحن لم يعد بانتظار الاعتماد" };
        if (isEconomyError(err, "AGENT_WALLET_INSUFFICIENT")) return { err: true, msg: "رصيد الوكيل غير كاف لاعتماد هذا الطلب" };
        if (isEconomyError(err, "MASTER_WALLET_INSUFFICIENT")) {
          return { err: true, msg: "رصيد محفظة الشات غير كاف لإيداع عمولة هذا الطلب" };
        }
        if (isEconomyError(err, "TOPUP_USER_NOT_FOUND")) return { err: true, msg: "المستخدم المرتبط بالطلب غير موجود" };
        return { err: true, msg: "تعذر اعتماد طلب الشحن" };
      }
    }
    case "topup_order_reject": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const result = await rejectTopupOrderAtomic(data, params.id, params.reason);
        await emitTopupUserNotification(
          result.userRow,
          `تم رفض طلب الشحن رقم ${String(result.order?.order_no || "")}${
            result.order?.reject_reason ? ` | ${result.order.reject_reason}` : ""
          }`,
          null,
        );
        if (result.order) {
          await emitTopupAdminNotification({
            ...result.order,
            event_type: "rejected",
            old_status: "pending",
            new_status: "rejected",
            actor_type: "owner",
            actor_id: buildWalletActorLabel(data),
            note: result.order.reject_reason || result.order.processed_note || "",
            created_at: result.order.processed_at || Date.now(),
            order_status: result.order.status,
          });
        }
        await savestate({
          state: "رفض طلب شحن",
          topic: data.topic,
          topic1: String(result.order?.order_no || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم رفض طلب الشحن", data: result.order };
      } catch (err) {
        if (isEconomyError(err, "TOPUP_ORDER_NOT_FOUND")) return { err: true, msg: "طلب الشحن غير موجود" };
        if (isEconomyError(err, "TOPUP_ORDER_NOT_PENDING")) return { err: true, msg: "طلب الشحن لم يعد بانتظار الاعتماد" };
        return { err: true, msg: "تعذر رفض طلب الشحن" };
      }
    }

    // -------- Icons, Gifts, Slides, Badges --------
    case "addico": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const tar = String(params.tar || "").trim();
      const pid = path.basename(String(params.pid || "").trim());
      if (!tar || !pid) return { err: true, msg: "بيانات غير صالحة" };

      if (tar === "logo" || tar === "banner") {
        const hs = Number.parseInt(String(params.hs || "1"), 10) || 1;
        await db
          .update(site)
          .set(tar === "logo" ? { logo: pid } : { banner: pid })
          .where(or(eq(site.ids, hs), eq(site.id, hs)));
        await invalidateCatalogScopes(["site", "settings"]);
        return { err: false, msg: `${tar}/${pid}` };
      }

      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };

      const sicos = safeJsonParse<string[]>(stg.sico, []);
      const them3 = safeJsonParse<string[]>(stg.them, []);
      const cover3 = safeJsonParse<string[]>(stg.cover, []);
      const dro3s = safeJsonParse<string[]>(stg.dro3, []);
      const emos = safeJsonParse<string[]>(stg.emo, []);

      if (tar === "sico") {
        sicos.push(pid);
        await db.update(settings).set({ sico: JSON.stringify(sicos) }).where(eq(settings.id, stg.id));
        await broadcastCmd("sicos", sicos);
        await savestate({ state: "إظافة بنر", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
      } else if (tar === "them") {
        them3.push(pid);
        await db.update(settings).set({ them: JSON.stringify(them3) }).where(eq(settings.id, stg.id));
        await broadcastCmd("sicos", sicos);
        await broadcastCmd("them", them3);
        await broadcastCmd("cover", cover3);
        await broadcastCmd("dro3", dro3s);
        await savestate({ state: "إظافة ثيم", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
      } else if (tar === "cover") {
        cover3.push(pid);
        await db.update(settings).set({ cover: JSON.stringify(cover3) }).where(eq(settings.id, stg.id));
        await broadcastCmd("sicos", sicos);
        await broadcastCmd("them", them3);
        await broadcastCmd("cover", cover3);
        await broadcastCmd("dro3", dro3s);
        await savestate({ state: "إظافة اطار للصورة", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
      } else if (tar === "dro3") {
        dro3s.push(pid);
        await db.update(settings).set({ dro3: JSON.stringify(dro3s) }).where(eq(settings.id, stg.id));
        await broadcastCmd("sicos", sicos);
        await broadcastCmd("dro3", dro3s);
        await broadcastCmd("them", them3);
        await broadcastCmd("cover", cover3);
        await savestate({ state: "إظافة هدية", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
      } else if (tar === "emo") {
        emos.push(pid);
        await db.update(settings).set({ emo: JSON.stringify(emos) }).where(eq(settings.id, stg.id));
        await broadcastCmd("emos", emos);
        await savestate({ state: "إظافة فيس", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
      }

      await invalidateCatalogScopes(["site", "settings", "gifts"]);
      return { err: false, msg: `${tar}/${pid}` };
    }
    case "del_ico": {
      if (!isOwner && !isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const pid = String(params.pid || "").trim();
      const parts = pid.split("/").filter(Boolean);
      const folder = String(parts[0] || "").trim();
      const fileName = path.basename(String(parts[1] || "").trim());
      if (!["sico", "dro3", "them", "cover", "emo"].includes(folder) || !fileName) {
        return { err: true, msg: "بيانات غير صالحة" };
      }

      const folderDir = path.resolve(apiConfig.uploadDir, folder);
      const targetPath = path.resolve(folderDir, fileName);
      if (targetPath.startsWith(folderDir + path.sep) && fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath).catch(() => null);
      }

      const stg = await getSettingsRow(1);
      if (stg) {
        if (folder === "sico") {
          const arr = safeJsonParse<string[]>(stg.sico, []).filter((x) => x !== fileName);
          await db.update(settings).set({ sico: JSON.stringify(arr) }).where(eq(settings.id, stg.id));
          await broadcastCmd("sicos", arr);
          await savestate({ state: "مسح بنر | ايقونه", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
        } else if (folder === "dro3") {
          const arr = safeJsonParse<string[]>(stg.dro3, []).filter((x) => x !== fileName);
          await db.update(settings).set({ dro3: JSON.stringify(arr) }).where(eq(settings.id, stg.id));
          await broadcastCmd("dro3", arr);
          await savestate({ state: "مسح هدية | ايقونه", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
        } else if (folder === "them") {
          const arr = safeJsonParse<string[]>(stg.them, []).filter((x) => x !== fileName);
          await db.update(settings).set({ them: JSON.stringify(arr) }).where(eq(settings.id, stg.id));
          await broadcastCmd("them", arr);
          await savestate({ state: "مسح ثيم | ايقونه", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
        } else if (folder === "cover") {
          const arr = safeJsonParse<string[]>(stg.cover, []).filter((x) => x !== fileName);
          await db.update(settings).set({ cover: JSON.stringify(arr) }).where(eq(settings.id, stg.id));
          await broadcastCmd("cover", arr);
          await savestate({ state: "مسح اطار صورة | ايقونه", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
        } else if (folder === "emo") {
          const arr = safeJsonParse<string[]>(stg.emo, []).filter((x) => x !== fileName);
          await db.update(settings).set({ emo: JSON.stringify(arr) }).where(eq(settings.id, stg.id));
          await broadcastCmd("emos", arr);
          await savestate({ state: "مسح فيس | ايقونه", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
        }
        await invalidateCatalogScopes(["site", "settings", "gifts"]);
      }

      return { err: false, msg: pid };
    }
    case "sico": {
      const stg = await getSettingsRow(1);
      return safeJsonParse<string[]>(stg?.sico, []);
    }
    case "entry_slide_get": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const slides = getEntrySlides();
      return { err: false, data: { exists: slides.length > 0, slides } };
    }
    case "entry_slide_del": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const fileName = String(params.file || "").trim();
      if (!fileName) return { err: true, msg: "اسم الصورة مطلوب" };
      const removed = await removeEntrySlideFile(fileName);
      if (!removed) return { err: true, msg: "الصورة غير موجودة أو تعذر حذفها" };
      await savestate({
        state: "حذف صورة وضع الابتوب",
        topic: data.topic,
        topic1: fileName,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم حذف الصورة" };
    }
    case "gifts_git_get": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const stg = await getSettingsRow(1);
      const gifts = normalizeGiftsGit(stg?.gifts_git);
      const categories = normalizeGiftCategories(stg?.gift_categories, gifts);
      return { err: false, msg: { gifts, categories } };
    }
    case "gift_category_add": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const category = String(params.category || "").trim();
      if (!category) return { err: true, msg: "اسم القسم مطلوب" };
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const gifts = normalizeGiftsGit(stg.gifts_git);
      const categoriesRaw = normalizeGiftCategories(stg.gift_categories, gifts);
      if (!categoriesRaw.includes(category)) categoriesRaw.push(category);
      const categories = normalizeGiftCategories(categoriesRaw, gifts);
      await db
        .update(settings)
        .set({ gift_categories: JSON.stringify(categories) })
        .where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["gifts", "settings"]);
      await broadcastCmd("gifts_git", { gifts, categories });
      return { err: false, msg: categories };
    }
    case "gift_category_del": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const category = String(params.category || "").trim();
      if (!category) return { err: true, msg: "القسم غير صالح" };
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const gifts = normalizeGiftsGit(stg.gifts_git);
      if (gifts.some((g) => String(g.category || "").trim() === category)) {
        return { err: true, msg: "لا يمكن حذف القسم لأنه مستخدم داخل الهدايا" };
      }
      const nextCats = normalizeGiftCategories(
        normalizeGiftCategories(stg.gift_categories, gifts).filter((c) => c.trim() !== category),
        gifts,
      );
      await db
        .update(settings)
        .set({ gift_categories: JSON.stringify(nextCats) })
        .where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["gifts", "settings"]);
      await broadcastCmd("gifts_git", { gifts, categories: nextCats });
      return { err: false, msg: nextCats };
    }
    case "gift_git_add": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const file = path.basename(String(params.pid || "").trim());
      if (!file) return { err: true, msg: "ملف الهدية مطلوب" };
      const coin = Math.max(1, Number.parseInt(String(params.coin || "1"), 10) || 1);
      const name =
        String(params.name || "").trim() ||
        file.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() ||
        "هدية";
      const category = String(params.category || params.section || "").trim() || "افتراضي";
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };

      const giftItem = {
        id: `${crypto.randomBytes(4).toString("hex")}${Date.now()}`,
        file,
        coin,
        name,
        category,
      };
      const gifts = normalizeGiftsGit([giftItem, ...normalizeGiftsGit(stg.gifts_git)]);
      const categories = normalizeGiftCategories(stg.gift_categories, gifts);
      await db
        .update(settings)
        .set({
          gifts_git: JSON.stringify(gifts),
          gift_categories: JSON.stringify(categories),
        })
        .where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["gifts", "settings"]);
      await broadcastCmd("gifts_git", { gifts, categories });
      await savestate({ state: "إضافة هدية git", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
      return { err: false, msg: giftItem };
    }
    case "gift_git_del": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const id = String(params.id || "").trim();
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const current = normalizeGiftsGit(stg.gifts_git);
      const idx = current.findIndex((g) => String(g.id || "") === id);
      if (idx === -1) return { err: true, msg: "العنصر غير موجود" };
      const [removed] = current.splice(idx, 1);
      const gifts = normalizeGiftsGit(current);
      const categories = normalizeGiftCategories(stg.gift_categories, gifts);
      if (removed?.file) {
        const giftsDir = path.resolve(apiConfig.uploadDir, "gifts_git");
        const target = path.resolve(giftsDir, path.basename(removed.file));
        if (target.startsWith(giftsDir + path.sep) && fs.existsSync(target)) {
          await fs.promises.unlink(target).catch(() => null);
        }
      }
      await db
        .update(settings)
        .set({
          gifts_git: JSON.stringify(gifts),
          gift_categories: JSON.stringify(categories),
        })
        .where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["gifts", "settings"]);
      await broadcastCmd("gifts_git", { gifts, categories });
      await savestate({ state: "حذف هدية git", topic: data.topic, topic1: data.username, room: "", ip: actorIp, time: Date.now() });
      return { err: false, msg: removed };
    }
    case "gift_git_coin":
    case "gift_git_update": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const id = String(params.id || "").trim();
      const coin = Math.max(1, Number.parseInt(String(params.coin || "1"), 10) || 1);
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const current = normalizeGiftsGit(stg.gifts_git);
      const idx = current.findIndex((g) => String(g.id || "") === id);
      if (idx === -1) return { err: true, msg: "العنصر غير موجود" };
      current[idx]!.coin = coin;
      if (cmd === "gift_git_update") {
        const name = String(params.name || "").trim();
        const category = String(params.category || params.section || "").trim();
        current[idx]!.name = name || current[idx]!.name || "هدية";
        current[idx]!.category = category || current[idx]!.category || "افتراضي";
      }
      const gifts = normalizeGiftsGit(current);
      const categories = normalizeGiftCategories(stg.gift_categories, gifts);
      await db
        .update(settings)
        .set({
          gifts_git: JSON.stringify(gifts),
          gift_categories: JSON.stringify(categories),
        })
        .where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["gifts", "settings"]);
      await broadcastCmd("gifts_git", { gifts, categories });
      await savestate({
        state: cmd === "gift_git_update" ? "تعديل بيانات هدية git" : "تعديل coin هدية git",
        topic: data.topic,
        topic1: data.username,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: gifts[idx] };
    }

    // -------- Users, Likes, Passwords, Subs, Powers, Verification --------
    case "likes": {
      if (!actorDef?.ulike) return { err: true, msg: "لا تملك صلاحية" };
      const repValue = Math.max(0, Number.parseInt(String(params.rep || "0"), 10) || 0);
      if (repValue > Number.MAX_SAFE_INTEGER) {
        return { err: true, msg: "الحد الاقصى للايكات 9007199254740991" };
      }
      const targetUser = await resolveTargetUser(params.id);
      if (!targetUser) return { err: true, msg: "المستخدم غير موجود" };
      if (!verPower(powersList, { to: actorPower, me: targetUser.power })) {
        return { err: true, msg: "لا يمكنك التعديل على من هوا اعلى منك رتبة" };
      }
      await db.update(users).set({ rep: repValue }).where(eq(users.idreg, targetUser.idreg));
      await patchOnlineUserSnapshotByUidOrId(targetUser, { rep: repValue });
      await savestate({
        state: "تعديل لايكات",
        topic: data.topic,
        topic1: targetUser.topic,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم تعديل اللايكات" };
    }
    case "pwd": {
      if (!actorDef?.mynick) return { err: true, msg: "لا تملك صلاحية" };
      const nextPwd = String(params.pwd || "");
      if (nextPwd.length < 4) return { err: true, msg: "الرجاء التاكد من كلمة المرور" };
      const targetUser = await resolveTargetUser(params.id);
      if (!targetUser) return { err: true, msg: "المستخدم غير موجود" };
      if (!verPower(powersList, { to: actorPower, me: targetUser.power })) {
        return { err: true, msg: "لا يمكنك التعديل على من هوا اعلى منك رتبة" };
      }
      await db
        .update(users)
        .set({
          password: hashPasswordSync(nextPwd),
          // Rotate the session token so any existing JWT / legacy session
          // becomes invalid immediately after the password change.
          token: crypto.randomBytes(32).toString("hex"),
        })
        .where(eq(users.idreg, targetUser.idreg));
      if (targetUser.uid) {
        await emitDirectUid(targetUser.uid, "alert", "تم تغير كلمه سر لخاصه بك");
      }
      await savestate({
        state: "تعديل كلمة السر",
        topic: data.topic,
        topic1: targetUser.topic,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم تعديل كلمة السر" };
    }
    case "subs": {
      if (!actorDef?.subs) return { err: true, msg: "لا تملك صلاحية" };
      const [subRows, userRows] = await Promise.all([
        db.select().from(sub).orderBy(desc(sub.id)).limit(500),
        db.select().from(users).orderBy(desc(users.idreg)).limit(500),
      ]);
      return {
        data: subRows,
        powers: powersList,
        users: userRows.map(redactUserRow),
      };
    }
    case "setpower": {
      return handleSetPowerCommand(data, powersList, params, actorIp, false);
    }
    case "dellogin": {
      if (!actorDef?.edituser) return { err: true, msg: "لا تملك صلاحية" };
      const targetUser = await resolveTargetUser(params.id);
      if (!targetUser) return { err: true, msg: "المستخدم غير موجود" };
      if (!verPower(powersList, { to: actorPower, me: targetUser.power })) {
        return { err: true, msg: "لا يمكنك التعديل على من هوا اعلى منك رتبة" };
      }
      if (targetUser.idreg === data.idreg) {
        return { err: true, msg: "لا يمكنك حذف حسابك الحالي" };
      }

      const onlineList = await getOnlineUsersSnapshotList();
      const onlineMatches = onlineList.filter(
        (u) =>
          (targetUser.uid && String(u.uid || "") === targetUser.uid) ||
          (targetUser.id && String(u.id || "") === targetUser.id),
      );
      for (const u of onlineMatches) {
        const roomId = String(u.roomid || "").trim();
        if (roomId) {
          await emitRoomCmd(roomId, "msg", {
            bg: targetUser.bg,
            class: "hmsg",
            id: String(u.id || targetUser.id || ""),
            uid: String(u.id || targetUser.id || ""),
            topic: targetUser.topic,
            msg: "(  تم حذف العضوية )",
            roomid: roomId,
            pic: targetUser.pic,
          });
        }
        await emitSessionEv({
          uid: targetUser.uid || undefined,
          socketId: String(u.id || ""),
          script: 'window.onbeforeunload = null; location.href="/";',
          disconnect: true,
        });
      }

      await db.delete(users).where(eq(users.idreg, targetUser.idreg));
      await db.delete(sub).where(eq(sub.iduser, String(targetUser.idreg)));
      await savestate({
        state: "حذف عضويه",
        topic: data.topic,
        topic1: targetUser.topic,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم حذف العضوية" };
    }
    case "documentation": {
      if (!actorDef?.edituser) return { err: true, msg: "لا تملك صلاحية" };
      const targetUser = await resolveTargetUser(params.id);
      if (!targetUser) return { err: true, msg: "المستخدم غير موجود" };
      if (!verPower(powersList, { to: actorPower, me: targetUser.power })) {
        return { err: true, msg: "لا يمكنك التعديل على من هوا اعلى منك رتبة" };
      }
      const dlg = parseJsonObjectParam(params.documentation);
      if (!dlg) return { err: true, msg: "بيانات غير صالحة" };
      const nextDocInt = dlg.documentation ? 1 : 0;
      const nextLoginG = Boolean(dlg.loginG);

      if (Number(targetUser.documentationc || 0) !== nextDocInt) {
        await savestate({
          state: targetUser.documentationc ? "إلغاء توثيق عضويه" : "توثيق عضويه",
          topic: data.topic,
          topic1: targetUser.topic,
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
      }
      if (Boolean(targetUser.loginG) !== nextLoginG) {
        await savestate({
          state: targetUser.loginG ? "إلغاء العضوية المميزه" : "عضويه مميزه",
          topic: data.topic,
          topic1: targetUser.topic,
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
      }

      await db
        .update(users)
        .set({ documentationc: nextDocInt, loginG: nextLoginG })
        .where(eq(users.idreg, targetUser.idreg));

      await patchOnlineUserSnapshotByUidOrId(targetUser, {
        documents: Boolean(nextDocInt),
        documentationc: Boolean(nextDocInt),
        loginG: nextLoginG,
      });

      if (targetUser.uid) {
        if (nextDocInt === 1 && !nextLoginG) {
          await emitDirectUid(targetUser.uid, "alert", "تم توثيق عضويتك");
        } else if (nextDocInt === 1 && nextLoginG) {
          await emitDirectUid(targetUser.uid, "alert", "تم توثيقك و إعطائك دخول مميز");
        } else if (nextDocInt === 0 && nextLoginG) {
          await emitDirectUid(targetUser.uid, "alert", "تم اعطائك الدخول المميز");
        }
      }

      return { err: false, msg: "تم التعديل بنجاح" };
    }
    case "chkeduser": {
      if (!actorDef?.edituser) return { err: true, msg: "لا تملك صلاحية" };
      const targetUser = await resolveTargetUser(params.id);
      if (!targetUser) return { err: true, msg: "المستخدم غير موجود" };
      await db.update(users).set({ documentationc: 1 }).where(eq(users.idreg, targetUser.idreg));
      await patchOnlineUserSnapshotByUidOrId(targetUser, {
        documents: true,
        documentationc: true,
      });
      await savestate({
        state: "توثيق عضويه",
        topic: data.topic,
        topic1: targetUser.topic,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم التعديل بنجاح" };
    }
    case "delloginDay": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const minDays = Math.max(1, Number(params.d || 0));
      const allUsers = await db.select().from(users);
      const now = Date.now();
      const staleIds: number[] = [];
      for (const u of allUsers) {
        if (!u.lastssen) continue;
        if (u.power === "ispower" || u.power === "Hide" || u.power === "chatmaster") continue;
        const diffDays = Math.ceil(Math.abs(now - Number(u.lastssen)) / (1000 * 60 * 60 * 24));
        if (diffDays >= minDays) {
          staleIds.push(u.idreg);
        }
      }
      if (!staleIds.length) {
        return { err: false, msg: `لا يوجد عضويات لديهم اكثر من ${params.d} يوم` };
      }
      await db.delete(users).where(sql`${users.idreg} = ANY(${staleIds})`);
      await savestate({
        state: "حذف عضويات",
        topic: data.username,
        topic1: String(params.d || ""),
        room: "",
        ip: actorIp,
        time: now,
      });
      return {
        err: false,
        msg: `تم حذف العضويات التي لم تسجل دخولها للموقع خلال ${params.d} يوم الماضية`,
      };
    }

    // -------- Bans & System/Browser Restrictions --------
    case "unban": {
      if (!actorDef?.ban) return { err: true, msg: "لا تملك صلاحية" };
      const unbanId = Number.parseInt(String(params.id || "").trim(), 10);
      if (!Number.isFinite(unbanId) || unbanId < 1) {
        return { err: true, msg: "معرف السجل غير صالح" };
      }
      const existing = await db.select().from(band).where(eq(band.id, unbanId)).limit(1);
      const banRow = existing[0];
      if (!banRow) return { err: true, msg: "سجل الحظر غير موجود" };
      await savestate({
        state: "فك حظر",
        topic: data.username,
        topic1: banRow.name_band || "",
        room: banRow.device_band || banRow.ip_band || banRow.country_band || "",
        ip: actorIp,
        time: Date.now(),
      });
      await db.delete(band).where(eq(band.id, unbanId));
      await invalidateCatalogScopes(["bans"]);
      return { err: false, msg: "تم فك الحظر بنجاح", id: String(unbanId) };
    }
    case "ban": {
      if (!actorDef?.ban) return { err: true, msg: "لا تملك صلاحية" };
      const rawType = String(params.type || "");
      const bsbRow = await getBsbRow();
      const system1 = safeJsonParse<Record<string, unknown>>(bsbRow?.systems, {});
      const browser1 = safeJsonParse<Record<string, unknown>>(bsbRow?.browsers, {});

      if (rawType.includes("browser9")) {
        const nextBrowsers = parseJsonObjectParam(rawType) || {};
        if (bsbRow) {
          await db.update(bsb).set({ browsers: JSON.stringify(nextBrowsers) }).where(eq(bsb.id, bsbRow.id));
        } else {
          await db.insert(bsb).values({ systems: JSON.stringify(system1), browsers: JSON.stringify(nextBrowsers) });
        }
        await invalidateCatalogScopes(["bsb"]);
        await savestate({
          state: "تعديل حظر ",
          topic: data.username,
          topic1: "تعديل حظر المتصفحات",
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { system1, browser1: nextBrowsers };
      }

      if (rawType.includes("system7")) {
        const nextSystems = parseJsonObjectParam(rawType) || {};
        if (bsbRow) {
          await db.update(bsb).set({ systems: JSON.stringify(nextSystems) }).where(eq(bsb.id, bsbRow.id));
        } else {
          await db.insert(bsb).values({ systems: JSON.stringify(nextSystems), browsers: JSON.stringify(browser1) });
        }
        await invalidateCatalogScopes(["bsb"]);
        await savestate({
          state: "تعديل حظر ",
          topic: data.username,
          topic1: "تعديل حظر الأنظمه",
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { system1: nextSystems, browser1 };
      }

      const trimmed = rawType.trim();
      const matchedUserRows = await db
        .select({ idreg: users.idreg, username: users.username })
        .from(users)
        .where(eq(users.username, trimmed.toLowerCase()))
        .limit(1);

      const nowStr = String(Date.now());
      let nameBand = "اضافه حظر";
      let decoderDans = "";
      let ipBand = "";
      let countryBand = "";
      let deviceBand = "";

      if (matchedUserRows[0]) {
        nameBand = "حظر حساب";
        decoderDans = trimmed;
      } else if (validateIpAddress(trimmed) || (trimmed.includes(".") && !Number.isNaN(Number(trimmed.replace(/\./g, ""))))) {
        nameBand = "حظر اي بي";
        ipBand = trimmed;
      } else if (trimmed.length === 2) {
        nameBand = "حظر دولة";
        countryBand = trimmed.toUpperCase();
      } else {
        deviceBand = trimmed;
      }

      const dupConditions = [
        decoderDans ? eq(band.decoderDans, decoderDans) : undefined,
        ipBand ? eq(band.ip_band, ipBand) : undefined,
        countryBand ? eq(band.country_band, countryBand) : undefined,
        deviceBand ? eq(band.device_band, deviceBand) : undefined,
      ].filter((c): c is NonNullable<typeof c> => Boolean(c));

      const exists = dupConditions.length
        ? await db.select().from(band).where(or(...dupConditions)).limit(1)
        : [];
      if (!exists[0]) {
        await db.insert(band).values({
          country_band: countryBand.slice(0, 2),
          name_band: data.username,
          type: "لا يوجد سبب",
          decoderDans,
          device_band: deviceBand,
          ip_band: ipBand,
          date: nowStr,
        });
        await savestate({
          state: nameBand,
          topic: data.username,
          topic1: data.username,
          room: deviceBand || ipBand || countryBand || decoderDans,
          ip: actorIp,
          time: Date.now(),
        });
        await invalidateCatalogScopes(["bans"]);
      }

      return {
        country_band: countryBand,
        user: data.username,
        topic: data.username,
        name_band: matchedUserRows[0] ? "اضافه حظر" : nameBand,
        type: "لا يوجد سبب",
        decoderDans,
        date: Number(nowStr),
        ip_band: ipBand,
        device_band: deviceBand,
      };
    }
    case "bansU": {
      if (!actorDef?.ban) return { err: true, msg: "لا تملك صلاحية" };
      return getBandList();
    }
    case "bans": {
      if (!actorDef?.ban) return { err: true, msg: "لا تملك صلاحية" };
      const bsbRow = await getBsbRow();
      return {
        system1: safeJsonParse<Record<string, unknown>>(bsbRow?.systems, {}),
        browser1: safeJsonParse<Record<string, unknown>>(bsbRow?.browsers, {}),
      };
    }

    // -------- Powers / Roles Management --------
    case "powers_del": {
      if (!actorDef?.setpower) return { err: true, msg: "لا تملك صلاحية" };
      const name = String(params.name || "");
      if (name === "chatmaster" || name === "Hide" || name === "ispower" || !name) {
        return { err: true, msg: "لا يمكنك حذف هذه الصلاحية" };
      }
      if (!verPower(powersList, { to: actorPower, me: name })) {
        return { err: false, msg: "لا يمكنك التعديل على هذه الصلاحية" };
      }
      const nextList = normalizeShowPowers(powersList.filter((p) => p.name !== name));
      await db.update(users).set({ power: "" }).where(eq(users.power, name));

      const pRows = await db.select().from(powers).limit(1);
      if (pRows[0]) {
        await db.update(powers).set({ powers: JSON.stringify(nextList) }).where(eq(powers.id, pRows[0].id));
      } else {
        await db.insert(powers).values({ powers: JSON.stringify(nextList) });
      }
      await invalidateCatalogScopes(["powers"]);
      await broadcastCmd("powers", nextList);
      await savestate({
        state: "حذف صلاحية",
        topic: data.topic,
        topic1: data.topic,
        room: name,
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم حذف الصلاحية" };
    }
    case "powers_save": {
      if (myOptionDone(powersList, actorPower) < 50 || !actorDef?.setpower) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      if (!String(params.name || "")) {
        return { err: false, msg: "لا يمكنك التعديل على هذه الصلاحية" };
      }
      const submitted = parseJsonObjectParam(params.power);
      if (!submitted) {
        return { err: true, msg: "الرجاء التاكد من الصلاحية" };
      }
      if (
        Number(submitted.auto_enabled || submitted.auto_promote || 0) &&
        !(Number.parseInt(String(submitted.auto_points || "0"), 10) > 0)
      ) {
        return { err: true, msg: "حدد نقاط الترقية الآلية أولاً أو أغلق خيار الترقية الآلية" };
      }
      const submittedName = String(submitted.name || "");
      if (!Number.isNaN(Number(submittedName))) {
        return { err: false, msg: "الرجاء التاكد من اسم الصلاحية" };
      }
      const submittedRank = Number(submitted.rank || 0);
      if (!submittedName.trim() || !submittedRank) {
        return { err: false, msg: "الرجاء التاكد من  الصلاحية" };
      }

      const existingIdx = powersList.findIndex((p) => p.name === submittedName);
      if (existingIdx === -1) {
        if (powersList.length >= MAX_POWER_COUNT) {
          return { err: true, msg: "تم إنشاء الحد الاقصى من الصلاحيات" };
        }
        if (submittedRank > actorDef.rank) {
          return { err: false, msg: "لا يمكنك انشاء صلاحية اعلى منك" };
        }
        const nextList = normalizeShowPowers([...powersList, submitted]);
        const pRows = await db.select().from(powers).limit(1);
        if (pRows[0]) {
          await db.update(powers).set({ powers: JSON.stringify(nextList) }).where(eq(powers.id, pRows[0].id));
        } else {
          await db.insert(powers).values({ powers: JSON.stringify(nextList) });
        }
        await invalidateCatalogScopes(["powers"]);
        await broadcastCmd("powers", nextList);
        await savestate({
          state: "إنشاء صلاحية",
          topic: data.topic,
          topic1: data.topic,
          room: submittedName,
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, msg: "تم إنشاء صلاحية" };
      }

      if (!verPower(powersList, { to: actorPower, me: submittedName })) {
        return { err: true, msg: "noRank" };
      }
      if (submittedRank > actorDef.rank) {
        return { err: true, msg: "noRank" };
      }
      const nextRaw = powersList.filter((_, idx) => idx !== existingIdx);
      nextRaw.push(submitted as (typeof powersList)[number]);
      const nextList = normalizeShowPowers(nextRaw);
      const pRows = await db.select().from(powers).limit(1);
      if (pRows[0]) {
        await db.update(powers).set({ powers: JSON.stringify(nextList) }).where(eq(powers.id, pRows[0].id));
      } else {
        await db.insert(powers).values({ powers: JSON.stringify(nextList) });
      }
      await invalidateCatalogScopes(["powers"]);
      await broadcastCmd("powers", nextList);
      await savestate({
        state: "تعديل مجموعة ",
        topic: data.topic,
        topic1: data.topic,
        room: submittedName,
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم تعديل المجموعة " };
    }
    case "powers": {
      if (!actorDef?.setpower) return { err: true, msg: "لا تمتلك صلاحيات" };
      return powersList.length ? powersList : DEFAULT_POWERS;
    }

    // -------- Capability / Section Probes --------
    case "IsStartap":
      return { msg: Boolean(actorDef?.setpower) };
    case "IsStarta":
      return { msg: isOwner };
    case "IsStart":
      return {
        msg: canAccessAnyHostingSection(powersList, actorPower),
        sections: getHostingSectionAccess(powersList, actorPower),
      };
    case "IsStartEvaluationPoints":
      return { msg: canManageEvaluationPoints(powersList, actorPower) };
    case "IsStartMicProvider":
      return { msg: canEditMicProvider(powersList, actorPower) || isOwner };

    // -------- Evaluation Points Config --------
    case "evaluation_points_get": {
      if (!canManageEvaluationPoints(powersList, actorPower)) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const stg = await getSettingsRow(1);
      const siteData = normalizeSiteSettingShape(safeJsonParse(stg?.site, {}));
      return { err: false, data: siteData.evaluation_awards };
    }
    case "evaluation_points_save": {
      if (!canManageEvaluationPoints(powersList, actorPower)) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const parsedPayload = parseJsonObjectParam(params.data);
      if (!parsedPayload) return { err: true, msg: "بيانات احتساب النقاط غير صالحة" };
      const nextSettings = normalizeEvaluationAwardSettings(parsedPayload);
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة إعدادات الموقع" };
      const siteData = normalizeSiteSettingShape(safeJsonParse(stg.site, {}));
      siteData.evaluation_awards = nextSettings;
      await db.update(settings).set({ site: JSON.stringify(siteData) }).where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["settings", "site"]);
      await savestate({
        state: "احتساب النقاط",
        topic: data.username,
        topic1: "حفظ",
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تم حفظ إعدادات احتساب النقاط", data: nextSettings };
    }

    // -------- Hosting / Domain / Site Settings --------
    case "socketIo": {
      if (!canAccessHostingSection(powersList, actorPower, "hostcleanup")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      await invalidateCatalogScopes(["all"]);
      await getRedis().set(CACHE_LAST_PURGE_KEY, String(Date.now())).catch(() => null);
      await savestate({
        state: "إعادة تشغيل",
        topic: data.username,
        topic1: data.topic,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return { err: false, msg: "تمت إعادة تهيئة الجلسات والكاش" };
    }
    case "removedmoin": {
      if (!canAccessHostingSection(powersList, actorPower, "hostdomains")) {
        return { err: true, data: "ليس لديك صلاحية" };
      }
      const hostId = Number.parseInt(String(params.event || "0"), 10);
      if (!hostId || hostId === 1) {
        return { err: true, data: "لا يمكنك حذف الدومين الاصلي" };
      }
      const existing = await db.select().from(hosts).where(eq(hosts.id, hostId)).limit(1);
      const settingId = existing[0]?.setting || hostId;
      await db.delete(hosts).where(eq(hosts.id, hostId));
      await db.delete(settings).where(eq(settings.id, settingId));
      await db.delete(site).where(or(eq(site.ids, settingId), eq(site.id, hostId)));
      await invalidateCatalogScopes(["hosts", "settings", "site"]);
      return { err: false, data: "تم مسح الدومين" };
    }
    case "tfinish": {
      if (!canAccessHostingSection(powersList, actorPower, "hostdomains")) {
        return { err: true, data: "ليس لديك صلاحية" };
      }
      const rawDate = String(params.event || "").trim();
      const parsedDate = Number.isFinite(Number(rawDate))
        ? new Date(Number(rawDate))
        : new Date(rawDate);
      const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      await db.update(owner).set({ datafinish: safeDate }).where(eq(owner.id, 1));
      await invalidateCatalogScopes(["owner"]);
      return { err: false, data: "تم تعديل الاشتراك" };
    }
    case "adddmoin": {
      if (!canAccessHostingSection(powersList, actorPower, "hostdomains")) {
        return { err: true, data: "ليس لديك صلاحية" };
      }
      const hostnameVal = String(params.event || "").trim();
      if (!hostnameVal) return { err: true, data: "اسم الدومين مطلوب" };
      const defaultSitePayload = {
        allowg: true,
        allowreg: true,
        micprovider: "LIVEKIT",
        roomMessageTheme: "classic",
        background: "#e4e4e4",
        bg: "#f5f5f5",
        buttons: "#246eb9",
        code: 8747,
        fileslikes: 90000,
        id: 1,
        msgst: 5,
        notlikes: 7000,
        pmlikes: 2000,
        miclikes: 5000,
        name: "",
        siteScript: "",
        title: "NewChat",
        sitedescription: "",
        sitekeywords: "",
        bclikes: 10,
        walllikes: JSON.stringify({
          lengthMsgBc: 250,
          lengthMsgPm: 250,
          lengthMsgRoom: 250,
          lengthUserG: 100,
          lengthUserReg: 100,
          likeMsgRoom: 8,
          likeTopicEdit: 100,
          likeUpImgBc: 500,
          likeUpPic: 10,
        }),
        wallminutes: 0,
      };
      const [createdSetting] = await db
        .insert(settings)
        .values({
          site: JSON.stringify(defaultSitePayload),
          dro3: "[]",
          sico: "[]",
          emo: "[]",
          them: "[]",
          cover: "[]",
        })
        .returning();
      if (createdSetting) {
        await db.insert(hosts).values({ hostname: hostnameVal, setting: createdSetting.id });
        await db.insert(site).values({ host: hostnameVal, ids: createdSetting.id, banner: "banner.jpg", logo: "logo.png" });
      }
      await invalidateCatalogScopes(["hosts", "settings", "site"]);
      return { err: false, data: "تم إظافة دومين" };
    }
    case "addtv": {
      if (!canAccessHostingSection(powersList, actorPower, "hostsettings")) {
        return { err: true, data: "ليس لديك صلاحية" };
      }
      const tvVal = String(params.event || "").trim();
      await db.update(owner).set({ Tv: tvVal }).where(eq(owner.id, 1));
      await invalidateCatalogScopes(["owner"]);
      await broadcastCmd("IsTv", tvVal);
      return { err: false, data: "تم إظافة راديو" };
    }
    case "addrep": {
      if (!canAccessHostingSection(powersList, actorPower, "hostsettings")) {
        return { err: true, data: "ليس لديك صلاحية" };
      }
      const maxVal = Number.parseInt(String(params.event || "0"), 10);
      if (maxVal > 3 && maxVal < 100) {
        await db.update(owner).set({ MaxRep: maxVal }).where(eq(owner.id, 1));
        await invalidateCatalogScopes(["owner"]);
        await broadcastCmd("Maxrep", maxVal);
        return { err: false, data: "تم التعديل بنجاح" };
      }
      return { err: false, data: "يجب ان يكون الرقم بين 3 و  100" };
    }
    case "delfpc": {
      const evt = String(params.event || "").trim();
      if (evt === "vpns") {
        if (!actorDef?.ban) return { err: false, data: "لا تملك صلاحية" };
        const own = await getOwnerRow();
        const nextVpn = !own?.Vpn;
        await db.update(owner).set({ Vpn: nextVpn }).where(eq(owner.id, own?.id || 1));
        await invalidateCatalogScopes(["owner"]);
        await savestate({
          state: nextVpn ? "VPN تفعيل حظر " : "VPN الغاء حظر ",
          topic: data.username,
          topic1: data.topic,
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
        return { err: false, data: "" };
      }

      const sectionMap: Record<string, "hostcleanup" | "hostcontrols" | "hostsettings"> = {
        fps: "hostcleanup",
        actions: "hostcleanup",
        filter: "hostcleanup",
        names: "hostcleanup",
        filesClear: "hostcleanup",
        bars: "hostcleanup",
        strdel: "hostcleanup",
        purgecache: "hostcleanup",
        warmcache: "hostcleanup",
        ficbar: "hostcontrols",
        fixuser: "hostcontrols",
        rc: "hostcontrols",
        coom: "hostcontrols",
        mbnr: "hostcontrols",
        backup: "hostsettings",
        import: "hostsettings",
      };
      const reqSection = sectionMap[evt];
      if (!reqSection) return { err: true, msg: "عملية غير معروفة" };
      if (!canAccessHostingSection(powersList, actorPower, reqSection)) {
        return { err: true, msg: "لا تملك صلاحية" };
      }

      if (evt === "fps") {
        await db.delete(logs);
        await savestate({ state: "حذف سجل الدخول", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "تم مسح جميع سجلات الدخول" };
      }
      if (evt === "strdel") {
        await db.delete(storie);
        await db.delete(storieview);
        await savestate({ state: "حذف جميع القصص", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "تم حذف جميع القصص" };
      }
      if (evt === "mbnr") {
        const own = await getOwnerRow();
        const nextVal = !own?.isbanner;
        await db.update(owner).set({ isbanner: nextVal }).where(eq(owner.id, own?.id || 1));
        await invalidateCatalogScopes(["owner"]);
        await savestate({ state: nextVal ? "تفعيل البنر" : "ايقاف البنر", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "", state: nextVal, control: "mbnr" };
      }
      if (evt === "rc") {
        const own = await getOwnerRow();
        const nextVal = !own?.rc;
        await db.update(owner).set({ rc: nextVal }).where(eq(owner.id, own?.id || 1));
        await invalidateCatalogScopes(["owner"]);
        await savestate({ state: nextVal ? "تفعيل إعادة الاتصال" : "ايقاف إعادة الاتصال", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "", state: nextVal, control: "rc" };
      }
      if (evt === "coom") {
        const own = await getOwnerRow();
        const nextVal = !own?.cooment;
        await db.update(owner).set({ cooment: nextVal }).where(eq(owner.id, own?.id || 1));
        await invalidateCatalogScopes(["owner"]);
        await broadcastCmd("coom", nextVal);
        await savestate({ state: nextVal ? "تفعيل تعليقات الجدار" : "الغاء تفعيل تعليقات الجدار", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "", state: nextVal, control: "coom" };
      }
      if (evt === "names") {
        await db.delete(names);
        await invalidateCatalogScopes(["names"]);
        await savestate({ state: "حذف كشف الاسماء", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "تم مسح سجل كشف الاسماء" };
      }
      if (evt === "filter") {
        await db.delete(histletter);
        await savestate({ state: "حذف الفيلتر", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "تم مسح جميع الفيلتر" };
      }
      if (evt === "filesClear") {
        const sendDir = path.resolve(apiConfig.uploadDir, "sendfile");
        if (fs.existsSync(sendDir)) {
          const entries = await fs.promises.readdir(sendDir);
          await Promise.all(
            entries.map(async (entry) => {
              const target = path.resolve(sendDir, entry);
              if (target.startsWith(sendDir + path.sep)) {
                await fs.promises.rm(target, { recursive: true, force: true }).catch(() => null);
              }
            }),
          );
        }
        await savestate({ state: "حذف ملفات الحائط و الخاص", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "تم حذف جميع ملفات الخاص و الحائط" };
      }
      if (evt === "fixuser") {
        const own = await getOwnerRow();
        const nextVal = !own?.offline;
        await db.update(owner).set({ offline: nextVal }).where(eq(owner.id, own?.id || 1));
        await invalidateCatalogScopes(["owner"]);
        await savestate({ state: nextVal ? "تثبيت العضويات" : "الغاء تثبيت العضويات", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "", state: nextVal, control: "fixuser" };
      }
      if (evt === "ficbar") {
        const own = await getOwnerRow();
        const nextVal = !own?.bars;
        await db.update(owner).set({ bars: nextVal }).where(eq(owner.id, own?.id || 1));
        await invalidateCatalogScopes(["owner"]);
        await savestate({ state: nextVal ? "تثبيت الحائط" : "الغاء تثبيت الحائط", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "", state: nextVal, control: "ficbar" };
      }
      if (evt === "bars") {
        await db.delete(bars);
        await broadcastCmd("fildel", {});
        await savestate({ state: "حذف الحائط", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "تم مسح الحائط" };
      }
      if (evt === "purgecache") {
        const now = Date.now();
        await invalidateCatalogScopes(["all"]);
        await getRedis().set(CACHE_LAST_PURGE_KEY, String(now)).catch(() => null);
        await getRedis().set(CACHE_LAST_WARMUP_KEY, String(now)).catch(() => null);
        await savestate({ state: "مسح كاش الموقع", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: now });
        return { err: false, data: "تم مسح كاش الموقع الداخلي وبدأت إعادة بنائه" };
      }
      if (evt === "warmcache") {
        const now = Date.now();
        await Promise.all([getPowersList(), getOwnerRow(), getBsbRow()]);
        await getRedis().set(CACHE_LAST_WARMUP_KEY, String(now)).catch(() => null);
        await savestate({ state: "إعادة بناء كاش الموقع", topic: data.username, topic1: "1", room: "", ip: actorIp, time: now });
        return { err: false, data: "تمت إعادة بناء كاش الموقع" };
      }
      if (evt === "actions") {
        await db.delete(stats);
        await savestate({ state: "حذف سجل الحالات", topic: data.username, topic1: data.topic, room: "", ip: actorIp, time: Date.now() });
        return { err: false, data: "تم مسح جميع سجلات الحالات" };
      }
      if (evt === "backup" || evt === "import") {
        return {
          err: false,
          data: "النسخ الاحتياطي التلقائي مُدار عبر PostgreSQL pg_dump على مستوى الخادم",
        };
      }
      return { err: true, msg: "عملية غير معروفة" };
    }
    case "sitesave": {
      if (!isSuperPower && !isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const dominId = Number.parseInt(String(params.domin || "1"), 10) || 1;
      const stg = await getSettingsRow(dominId);
      if (!stg) return { err: true, msg: "تعذر قراءة إعدادات الموقع" };
      const nextPatch = parseJsonObjectParam(params.data);
      if (!nextPatch) return { err: true, msg: "بيانات إعدادات غير صالحة" };

      const rawPatch = { ...nextPatch };
      delete rawPatch.livekitCreds;

      const currentSite = normalizeSiteSettingShape(safeJsonParse(stg.site, {}));
      const merged = normalizeSiteSettingShape({
        ...currentSite,
        ...rawPatch,
        micprovider: normalizeMicProviderSetting(rawPatch.micprovider || currentSite.micprovider),
      });
      await db.update(settings).set({ site: JSON.stringify(merged) }).where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["site", "settings", "gifts"]);
      await savestate({ state: "إعدادت الموقع", topic: data.username, topic1: "حفظ", room: "", ip: actorIp, time: Date.now() });
      return { err: false, msg: true };
    }
    case "micproviderget": {
      if (!canEditMicProvider(powersList, actorPower) && !isOwner) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const dominId = Number.parseInt(String(params.domin || "1"), 10) || 1;
      const stg = await getSettingsRow(dominId);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const rawSite = safeJsonParse<Record<string, unknown>>(stg.site, {});
      const siteData = normalizeSiteSettingShape(rawSite);
      const livekitMeta = extractLiveKitPublicMeta(rawSite, {
        wsUrl: apiConfig.livekitWsUrl,
        apiKey: apiConfig.livekitApiKey,
        apiSecret: apiConfig.livekitApiSecret,
        nodeEnv: apiConfig.nodeEnv,
      });
      return {
        err: false,
        data: {
          micprovider: normalizeMicProviderSetting(siteData.micprovider),
          availableProviders: ["WEBRTC", "LIVEKIT", "JITSI"],
          livekit: livekitMeta,
        },
      };
    }
    case "micprovidersave": {
      if (!canEditMicProvider(powersList, actorPower) && !isOwner) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const dominId = Number.parseInt(String(params.domin || "1"), 10) || 1;
      const stg = await getSettingsRow(dominId);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      let siteData: Record<string, unknown> = normalizeSiteSettingShape(safeJsonParse(stg.site, {}));

      if (params.provider !== undefined && String(params.provider).trim() !== "") {
        siteData.micprovider = normalizeMicProviderSetting(params.provider);
      }

      const lkInput = parseJsonObjectParam(params.livekit) ?? {};
      const wsUrlParam =
        params.livekitWsUrl ?? params.wsUrl ?? lkInput.wsUrl;
      const apiKeyParam =
        params.livekitApiKey ?? params.apiKey ?? lkInput.apiKey;
      const apiSecretParam =
        params.livekitApiSecret ?? params.apiSecret ?? lkInput.apiSecret;
      const clearFlag =
        params.clearLivekit === true ||
        params.clearLivekit === "1" ||
        params.clearLivekit === "true" ||
        lkInput.clear === true;

      if (
        clearFlag ||
        wsUrlParam !== undefined ||
        apiKeyParam !== undefined ||
        apiSecretParam !== undefined
      ) {
        const mergedCreds = mergeLiveKitCredsIntoSite(
          siteData,
          {
            wsUrl: wsUrlParam !== undefined ? String(wsUrlParam) : undefined,
            apiKey: apiKeyParam !== undefined ? String(apiKeyParam) : undefined,
            apiSecret: apiSecretParam !== undefined ? String(apiSecretParam) : undefined,
            clear: clearFlag,
          },
          apiConfig.nodeEnv,
        );
        if (!mergedCreds.ok) {
          return { err: true, msg: mergedCreds.msg };
        }
        siteData = mergedCreds.nextSite;
      }

      const normalizedProvider = normalizeMicProviderSetting(siteData.micprovider);
      siteData.micprovider = normalizedProvider;

      await db.update(settings).set({ site: JSON.stringify(siteData) }).where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["site", "settings"]);
      await savestate({
        state: "مزود المايكات",
        topic: data.username,
        topic1: normalizedProvider,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      const livekitMeta = extractLiveKitPublicMeta(siteData, {
        wsUrl: apiConfig.livekitWsUrl,
        apiKey: apiConfig.livekitApiKey,
        apiSecret: apiConfig.livekitApiSecret,
        nodeEnv: apiConfig.nodeEnv,
      });
      return {
        err: false,
        msg: "تم حفظ إعدادات مزود الصوت والمايكات",
        data: {
          micprovider: normalizedProvider,
          availableProviders: ["WEBRTC", "LIVEKIT", "JITSI"],
          livekit: livekitMeta,
        },
      };
    }

    // -------- Login Logs / Users / Actions / Filters / Shortcuts / Intro Msgs --------
    case "fps": {
      if (!myOptionHistory(powersList, actorPower)) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const q = String(params.q || "").trim();
      if (!q) {
        return db.select().from(logs).orderBy(desc(logs.id)).limit(250);
      }
      const pattern = `%${q}%`;
      return db
        .select()
        .from(logs)
        .where(
          or(
            sql`${logs.state} ILIKE ${pattern}`,
            sql`${logs.ip} ILIKE ${pattern}`,
            sql`${logs.device} ILIKE ${pattern}`,
            sql`${logs.topic} ILIKE ${pattern}`,
            sql`${logs.username} ILIKE ${pattern}`,
            sql`${logs.code} ILIKE ${pattern}`,
          ),
        )
        .orderBy(desc(logs.id))
        .limit(250);
    }
    case "logins": {
      if (!actorDef?.edituser) return { err: true, msg: "لا تملك صلاحية" };
      const q = String(params.q || "").trim();
      if (!q) {
        const rows = await db.select().from(users).orderBy(desc(users.idreg)).limit(250);
        return rows.map(redactUserRow);
      }
      const pattern = `%${q}%`;
      const rows = await db
        .select()
        .from(users)
        .where(
          or(
            sql`${users.ip} ILIKE ${pattern}`,
            sql`${users.fp} ILIKE ${pattern}`,
            sql`${users.topic} ILIKE ${pattern}`,
            sql`${users.username} ILIKE ${pattern}`,
          ),
        )
        .orderBy(desc(users.idreg))
        .limit(250);
      return rows.map(redactUserRow);
    }
    case "actions": {
      if (!myOptionHistory(powersList, actorPower)) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      return db.select().from(stats).orderBy(desc(stats.id)).limit(300);
    }
    case "fltr": {
      if (!actorDef?.flter) return { err: true, msg: "لا تملك صلاحية" };
      return db.select().from(notext).orderBy(desc(notext.id)).limit(500);
    }
    case "fltrdel": {
      if (!actorDef?.flter) return { err: true, msg: "لا تملك صلاحية" };
      const id = Number.parseInt(String(params.id || "0"), 10);
      if (id > 0) {
        await db.delete(notext).where(eq(notext.id, id));
        await invalidateCatalogScopes(["notext"]);
        await savestate({
          state: "مسح فلتر",
          topic: data.username,
          topic1: String(params.v || ""),
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
      }
      return { err: false };
    }
    case "fltrit": {
      if (!actorDef?.flter) return { err: true, msg: "لا تملك صلاحية" };
      const rawV = String(params.v || "");
      const rawPath = String(params.path || "");
      if (rawV.includes("*")) return { err: true, msg: "محرف غير مسموح" };
      const isfulter =
        rawPath === "bmsgs"
          ? "إضافة كلمة ممنوعه الى الفلتر"
          : rawPath === "amsgs"
            ? "إضافة كلمة مسموحة الى الفلتر"
            : rawPath === "wmsgs"
              ? "إضافة كلمة مراقبه الى الفلتر"
              : "";
      const [inserted] = await db
        .insert(notext)
        .values({
          type: isfulter,
          path: sanitizeHtmlText(rawPath),
          v: sanitizeHtmlText(rawV),
        })
        .returning();
      await invalidateCatalogScopes(["notext"]);
      await savestate({
        state: "إظافة فلتر",
        topic: data.username,
        topic1: rawV,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return inserted || { err: true };
    }
    case "fltred": {
      if (!actorDef?.flter) return { err: true, msg: "لا تملك صلاحية" };
      return db.select().from(histletter).orderBy(desc(histletter.id)).limit(300);
    }
    case "shrt": {
      if (!actorDef?.shrt) return { err: true, msg: "لا تملك صلاحية" };
      return db.select().from(cuts).orderBy(desc(cuts.id)).limit(500);
    }
    case "shrtadd": {
      if (!actorDef?.shrt) return { err: true, msg: "لا تملك صلاحية" };
      const nameVal = String(params.name || "");
      const valueVal = String(params.value || "");
      const [inserted] = await db
        .insert(cuts)
        .values({
          text1: sanitizeHtmlText(nameVal),
          text2: sanitizeHtmlText(valueVal),
        })
        .returning();
      await invalidateCatalogScopes(["cuts"]);
      await savestate({
        state: "إظافة إختصار",
        topic: data.username,
        topic1: nameVal,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return inserted || { err: true };
    }
    case "shrtdel": {
      if (!actorDef?.shrt) return { err: true, msg: "لا تملك صلاحية" };
      const id = Number.parseInt(String(params.id || "0"), 10);
      if (id > 0) {
        const existing = await db.select().from(cuts).where(eq(cuts.id, id)).limit(1);
        await db.delete(cuts).where(eq(cuts.id, id));
        await invalidateCatalogScopes(["cuts"]);
        if (existing[0]) {
          await savestate({
            state: "مسح إختصار",
            topic: data.username,
            topic1: existing[0].text1 || "",
            room: "",
            ip: actorIp,
            time: Date.now(),
          });
        }
      }
      return { err: false };
    }
    case "msgs": {
      if (!actorDef?.msgs) return { err: true, msg: "لا تملك صلاحية" };
      return db.select().from(intromsg).orderBy(desc(intromsg.id)).limit(300);
    }
    case "msgsit": {
      if (!actorDef?.msgs) return { err: true, msg: "لا تملك صلاحية" };
      const typeVal = String(params.type || "");
      const [inserted] = await db
        .insert(intromsg)
        .values({
          category: typeVal,
          adresse: sanitizeHtmlText(params.t || ""),
          msg: sanitizeHtmlText(params.m || ""),
        })
        .returning();
      await savestate({
        state: typeVal === "d" ? "إظافة رسالة يوميه" : "إظافة رسالة ترحيب",
        topic: data.topic,
        topic1: data.username,
        room: "",
        ip: actorIp,
        time: Date.now(),
      });
      return inserted || { err: true };
    }
    case "msgsdel": {
      if (!actorDef?.msgs) return { err: true, msg: "لا تملك صلاحية" };
      const id = Number.parseInt(String(params.id || "0"), 10);
      const typeVal = String(params.type || "");
      if (id > 0) {
        await db.delete(intromsg).where(eq(intromsg.id, id));
        await savestate({
          state: typeVal === "d" ? "مسح رسالة يوميه" : "مسح رسالة ترحيب",
          topic: data.topic,
          topic1: data.username,
          room: "",
          ip: actorIp,
          time: Date.now(),
        });
      }
      return { err: false };
    }

    // -------- Bots & Load Tests --------
    case "bots": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const botRows = await db.select().from(bots).orderBy(desc(bots.idreg));
      return { err: false, msg: botRows };
    }
    case "addbots": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const infobot = parseJsonObjectParam(params.db);
      if (!infobot) return { err: true, msg: "بيانات البوت غير صالحة" };
      const nameb = String(infobot.nameb || "").trim();
      const online = await getOnlineUsersSnapshotList();
      if (online.some((u) => String(u.topic || "") === nameb)) {
        return { err: true, msg: "اسم البوت موجود في الدردشة" };
      }
      const randIp = [
        10 + Math.floor(Math.random() * 89),
        10 + Math.floor(Math.random() * 240),
        10 + Math.floor(Math.random() * 240),
        10 + Math.floor(Math.random() * 89),
      ].join(".");
      await db.insert(bots).values({
        id: crypto.randomBytes(9).toString("hex"),
        ip: randIp,
        msg: String(infobot.msgbot || "(عضو جديد)").slice(0, 255),
        pic: String(infobot.urlpic || "pic.png").slice(0, 255),
        power: String(infobot.rankbot || "").slice(0, 255),
        country: String(infobot.countrybot || "tn").slice(0, 255),
        room: String(infobot.rommbot || "").slice(0, 255),
        stat: Number(infobot.statsbots || 0) || 0,
        topic: sanitizeHtmlText(nameb).slice(0, 255),
      });
      await invalidateCatalogScopes(["bots"]);
      return { err: false, msg: "تم انشاء بوت" };
    }
    case "deltbot": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const id = String(params.id || "").trim();
      if (!id) return { err: true, msg: "معرف البوت غير صالح" };
      const redis = getRedis();
      await redis.hdel("newchat:presence:users", id).catch(() => 0);
      await redis.hdel(REDIS_KEYS.presenceVirtual, id).catch(() => 0);
      await broadcastCmd("u-", id);
      await recalcAndBroadcastRoomCounts();
      await db.delete(bots).where(eq(bots.id, id));
      await invalidateCatalogScopes(["bots"]);
      return { err: false, msg: "تم حذف البوت" };
    }
    case "enterbot": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const id = String(params.id || "").trim();
      const rows = await db.select().from(bots).where(eq(bots.id, id)).limit(1);
      const botRow = rows[0];
      if (!botRow || !botRow.id) return { err: true, msg: "البوت غير موجود" };
      const redis = getRedis();
      const online = await getOnlineUsersSnapshotList();
      const isOnline = online.some(
        (u) => String(u.id || "") === botRow.id || String(u.topic || "") === String(botRow.topic || ""),
      );
      if (!isOnline) {
        const payload = buildBotPresencePayload(botRow);
        await redis.hset("newchat:presence:users", botRow.id, JSON.stringify(payload));
        await redis.hset(REDIS_KEYS.presenceVirtual, botRow.id, JSON.stringify(payload));
        await broadcastCmd("u+", payload);
        await recalcAndBroadcastRoomCounts();
        return { err: true, msg: "تم إدخال البوت بنجاح" };
      }
      await redis.hdel("newchat:presence:users", botRow.id).catch(() => 0);
      await redis.hdel(REDIS_KEYS.presenceVirtual, botRow.id).catch(() => 0);
      await broadcastCmd("u-", botRow.id);
      await recalcAndBroadcastRoomCounts();
      return { err: true, msg: "تم إخراج البوت" };
    }
    case "enterbotall": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const botRows = await db.select().from(bots);
      const redis = getRedis();
      const onlineIds = new Set((await getOnlineUsersSnapshotList()).map((u) => String(u.id || "")));
      let entered = 0;
      const toAdd: Record<string, string> = {};
      const payloads: Array<ReturnType<typeof buildBotPresencePayload>> = [];
      for (const b of botRows) {
        if (!b.id || onlineIds.has(b.id)) continue;
        const p = buildBotPresencePayload(b);
        toAdd[b.id] = JSON.stringify(p);
        payloads.push(p);
        entered += 1;
      }
      if (entered > 0) {
        await redis.hset("newchat:presence:users", toAdd);
        await redis.hset(REDIS_KEYS.presenceVirtual, toAdd);
        for (const p of payloads) {
          await broadcastCmd("u+", p);
        }
        await recalcAndBroadcastRoomCounts();
      }
      return { err: false, msg: `تم إدخال ${entered} بوت`, count: entered };
    }
    case "exitbotall": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const botRows = await db.select({ id: bots.id }).from(bots);
      const redis = getRedis();
      const onlineIds = new Set((await getOnlineUsersSnapshotList()).map((u) => String(u.id || "")));
      const targetIds = botRows.map((b) => String(b.id || "")).filter((id) => id && onlineIds.has(id));
      if (targetIds.length) {
        await redis.hdel("newchat:presence:users", ...targetIds).catch(() => 0);
        await redis.hdel(REDIS_KEYS.presenceVirtual, ...targetIds).catch(() => 0);
        for (const id of targetIds) {
          await broadcastCmd("u-", id);
        }
        await recalcAndBroadcastRoomCounts();
      }
      return { err: false, msg: `تم إخراج ${targetIds.length} بوت`, count: targetIds.length };
    }
    case "sendmsgbot": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const id = String(params.id || "").trim();
      const rawMsg = String(params.msg || "");
      if (!id || !rawMsg) return { err: true, msg: "بيانات غير صالحة" };
      const rawPresence = await getRedis().hget("newchat:presence:users", id);
      const botUser = safeJsonParse<Record<string, unknown> | null>(rawPresence, null);
      if (botUser && botUser.roomid) {
        await emitRoomCmd(String(botUser.roomid), "msg", {
          bg: botUser.bg || "#FFFFFF",
          mi: crypto.randomBytes(5).toString("hex"),
          mcol: botUser.mcol || "#000000",
          uid: String(botUser.id || id),
          msg: sanitizeHtmlText(rawMsg.slice(0, 250)),
          pic: botUser.pic || "pic.png",
          topic: sanitizeHtmlText(String(botUser.topic || "")),
          ucol: botUser.ucol || "#000000",
        });
      }
      return { err: false, msg: "" };
    }
    case "addbots100": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const result = await runTalkingBotsSeed({
          count: 100,
          source: "mohammed",
          prefix: String(params.prefix || "صادق"),
          room: String(params.room || "D8D8A9A9C00"),
          country: String(params.country || "kw"),
          status: params.status == null ? 0 : String(params.status),
          message: String(params.message || "مرحبا بكم"),
          power: String(params.power || ""),
        });
        return { err: false, msg: "تمت إضافة 100 وهمي ناطق", data: result };
      } catch (err) {
        return { err: true, msg: "فشل إضافة 100 وهمي ناطق", error: err instanceof Error ? err.message : "" };
      }
    }
    case "preparebotloadtest": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      try {
        const roomCount = normalizePositiveInt(params.rooms, 10, 1, 50);
        const botCount = normalizePositiveInt(params.count, 1600, 1, 5000);
        const roomPrefix = sanitizeBotLoadTestText(params.roomPrefix, "اختبار الوهمي", 60);
        const botPrefix = sanitizeBotLoadTestText(params.prefix, "صادق اختبار", 60);
        const country = sanitizeBotLoadTestText(params.country, "kw", 10);
        const status = normalizePositiveInt(params.status, 0, 0, 3);
        const power = sanitizeBotLoadTestText(params.power, "", 80);
        const message = sanitizeBotLoadTestText(params.message, "مرحبا بكم", 160);
        const roomsRes = await ensureBotLoadTestRooms({ roomCount, roomPrefix });
        const roomIds = roomsRes.rooms.map((r) => String(r.id || "")).filter(Boolean);
        if (!roomIds.length) throw new Error("no test rooms created");
        const result = await runTalkingBotsSeed({
          count: botCount,
          source: "mohammed",
          prefix: botPrefix,
          rooms: roomIds.join(","),
          country,
          status,
          message,
          power,
        });
        return {
          err: false,
          msg: "تم تجهيز اختبار الوهمي الناطق",
          rooms: roomIds,
          bots: botCount,
          data: result,
        };
      } catch (err) {
        return { err: true, msg: "فشل تجهيز اختبار الوهمي الناطق", error: err instanceof Error ? err.message : "" };
      }
    }
    case "startbotchat": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      const message = String(params.message || "منورين");
      const intervalMs = 5000;
      const rate = normalizePositiveInt(
        params.rate || process.env.BOT_TALK_MESSAGES_PER_SECOND,
        25,
        1,
        200,
      );
      await emitBotChatControl({
        action: "start",
        message,
        intervalMs,
        messagesPerTick: rate,
      });
      return {
        err: false,
        msg: "تم بدء الحديث",
        intervalMs,
        messagesPerSecond: rate,
      };
    }
    case "stopbotchat": {
      if (!isSuperPower) return { err: true, msg: "لا تملك صلاحية" };
      await emitBotChatControl({ action: "stop" });
      return { err: false, msg: "تم إنهاء الحديث" };
    }

    // -------- Dashboard / Status / Hosting Inspect --------
    case "hostingr": {
      const own = await getOwnerRow();
      return { err: true, msg: Boolean(own?.Vpn) };
    }
    case "dashboardstats": {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      const own = await getOwnerRow();
      const visitors = safeJsonParse<unknown[]>(own?.Vistor, []).length;
      const guests = safeJsonParse<unknown[]>(own?.Gust, []).length;
      return {
        err: false,
        users: Math.max(0, Number(count || 0) - 3),
        guests,
        visitors,
      };
    }
    case "cpme": {
      return {
        err: false,
        data: {
          username: String(data.username || ""),
          topic: String(data.topic || data.username || ""),
          power: String(data.power || ""),
          pic: String(data.pic || "pic.png"),
        },
      };
    }
    case "cplogout": {
      const nextToken = crypto.randomBytes(64).toString("hex");
      await db
        .update(users)
        .set({
          token: nextToken,
          lastssen: String(Date.now()),
          ip: actorIp,
        })
        .where(eq(users.idreg, data.idreg));
      return { err: false, msg: "ok" };
    }
    case "dashboardfull": {
      const [userCountRes, own, roomCountRes, banCountRes, actionsRows, introRows, hostRows, stg] =
        await Promise.all([
          db.select({ count: sql<number>`count(*)::int` }).from(users),
          getOwnerRow(),
          db.select({ count: sql<number>`count(*)::int` }).from(rooms),
          db.select({ count: sql<number>`count(*)::int` }).from(band),
          db.select().from(stats).orderBy(desc(stats.id)).limit(6),
          db.select().from(intromsg),
          db.select().from(hosts),
          getSettingsRow(1),
        ]);
      const redis = getRedis();
      const [warmupRaw, purgeRaw] = await Promise.all([
        redis.get(CACHE_LAST_WARMUP_KEY).catch(() => "0"),
        redis.get(CACHE_LAST_PURGE_KEY).catch(() => "0"),
      ]);
      const giftsList = normalizeGiftsGit(stg?.gifts_git);
      const guests = safeJsonParse<unknown[]>(own?.Gust, []).length;
      const visitors = safeJsonParse<unknown[]>(own?.Vistor, []).length;
      const finishTs = own?.datafinish ? new Date(own.datafinish).getTime() : Date.now();
      const diffDays = Math.ceil((finishTs - Date.now()) / (24 * 60 * 60 * 1000));
      const welcomeMsgs = introRows.filter((i) => i.category === "w").length;
      const dailyMsgs = introRows.filter((i) => i.category === "d").length;
      const recentActions = actionsRows
        .slice()
        .sort((a, b) => Number(b.time || 0) - Number(a.time || 0))
        .map((item) => ({
          state: String(item.state || ""),
          topic: String(item.topic || ""),
          topic1: String(item.username || ""),
          room: String(item.room || ""),
          time: Number(item.time || 0),
        }));

      return {
        err: false,
        stats: {
          users: Math.max(0, Number(userCountRes[0]?.count || 0) - 3),
          guests,
          visitors,
          rooms: Number(roomCountRes[0]?.count || 0),
          bans: Number(banCountRes[0]?.count || 0),
          gifts: giftsList.length,
          hosts: hostRows.length,
          welcomeMsgs,
          dailyMsgs,
        },
        status: {
          wallFixed: Boolean(own?.bars ?? true),
          usersFixed: Boolean(own?.offline),
          reconnect: Boolean(own?.rc),
          comments: Boolean(own?.cooment),
          banner: Boolean(own?.isbanner),
          maxRep: Number(own?.MaxRep || 0),
          radio: String(own?.Tv || ""),
          finish: own?.datafinish || "",
          finishDays: diffDays,
          finishWarning: diffDays <= 7 ? (diffDays < 0 ? "expired" : "soon") : "ok",
          backupExists: false,
          backupUpdatedAt: 0,
          cacheRenderItems: 0,
          cacheHtmlItems: 0,
          cacheLastWarmupAt: Number(warmupRaw || 0),
          cacheLastPurgeAt: Number(purgeRaw || 0),
        },
        recentActions,
      };
    }
    case "hostnames": {
      if (!canAccessHostingSection(powersList, actorPower, "hostdomains")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const hostList = await db.select().from(hosts).limit(200);
      return { err: true, msg: hostList, power: actorPower };
    }
    case "iscondb": {
      if (!canAccessHostingSection(powersList, actorPower, "hostdomains")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      return { err: true, msg: "تتم إدارة نسخ PostgreSQL الاحتياطية على مستوى النظام" };
    }
    case "rc": {
      if (!canAccessHostingSection(powersList, actorPower, "hostcontrols")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const own = await getOwnerRow();
      return { err: true, msg: Boolean(own?.rc) };
    }
    case "coom": {
      if (!canAccessHostingSection(powersList, actorPower, "hostcontrols")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const own = await getOwnerRow();
      return { err: true, msg: Boolean(own?.cooment) };
    }
    case "bnr": {
      if (!canAccessHostingSection(powersList, actorPower, "hostcontrols")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const own = await getOwnerRow();
      return { err: true, msg: Boolean(own?.isbanner) };
    }
    case "hostinge": {
      if (!canAccessHostingSection(powersList, actorPower, "hostcontrols")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const own = await getOwnerRow();
      return { err: true, msg: Boolean(own?.offline) };
    }
    case "maxrep": {
      const own = await getOwnerRow();
      return { err: true, msg: Number(own?.MaxRep || 3) };
    }
    case "tvtv": {
      if (!canAccessHostingSection(powersList, actorPower, "hostsettings")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const own = await getOwnerRow();
      return { err: true, msg: String(own?.Tv || "") };
    }
    case "mxpr": {
      if (!canAccessHostingSection(powersList, actorPower, "hostsettings")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const own = await getOwnerRow();
      return { err: true, msg: Number(own?.MaxRep || 3) };
    }
    case "databaseinfo": {
      if (!canAccessHostingSection(powersList, actorPower, "hostdomains")) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      return { err: true, msg: [] };
    }
    case "hosting": {
      if (!canAccessAnyHostingSection(powersList, actorPower)) {
        return { err: true, msg: "لا تملك صلاحية" };
      }
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      const own = await getOwnerRow();
      const visitors = safeJsonParse<unknown[]>(own?.Vistor, []).length;
      const guests = safeJsonParse<unknown[]>(own?.Gust, []).length;
      return {
        err: true,
        tf: own?.datafinish || "",
        msg: Boolean(own?.bars ?? true),
        u: Number(count || 0) - 3,
        g: guests,
        v: visitors,
        sections: getHostingSectionAccess(powersList, actorPower),
      };
    }

    // -------- Badges (Site & Room) --------
    case "room_badges": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const stg = await getSettingsRow(1);
      return { err: false, data: normalizeRoomBadgesCatalog(stg?.room_badges) };
    }
    case "site_badges": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const stg = await getSettingsRow(1);
      return { err: false, data: normalizeSiteBadgesCatalog(stg?.site_badges) };
    }
    case "site_badges_save": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const parsed = parseJsonObjectParam(params.data);
      if (!parsed) return { err: true, msg: "بيانات الشارة غير صالحة" };
      const badgeName = String(parsed.name || "").trim();
      if (!badgeName) return { err: true, msg: "اسم الشارة مطلوب" };
      const nextId = String(parsed.id || "").trim() || `sb_${Date.now()}`;
      const nextBadge = {
        id: nextId,
        name: badgeName,
        bg: String(parsed.bg || "").trim(),
        icon: String(parsed.icon || "").trim(),
        bg_type: (
          String(parsed.bg_type || parsed.bgType || "").trim().toLowerCase() === "animated"
            ? "animated"
            : "static"
        ) as "animated" | "static",
      };
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const list = normalizeSiteBadgesCatalog(stg.site_badges);
      const idx = list.findIndex((b) => String(b.id || "").trim() === nextId);
      if (idx === -1) list.push(nextBadge);
      else list[idx] = nextBadge;
      const saved = normalizeSiteBadgesCatalog(list);
      await db.update(settings).set({ site_badges: JSON.stringify(saved) }).where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["site", "settings"]);
      await broadcastCmd("site_badges", saved);
      return { err: false, msg: "تم حفظ الشارة", data: nextBadge };
    }
    case "site_badges_del": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const delId = String(params.id || "").trim();
      if (!delId) return { err: true, msg: "معرف الشارة غير صالح" };
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const next = normalizeSiteBadgesCatalog(stg.site_badges).filter((b) => String(b.id || "").trim() !== delId);
      await db.update(settings).set({ site_badges: JSON.stringify(next) }).where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["site", "settings"]);
      await broadcastCmd("site_badges", next);
      return { err: false, msg: "تم حذف الشارة" };
    }
    case "room_badges_save": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const parsed = parseJsonObjectParam(params.data);
      if (!parsed) return { err: true, msg: "بيانات الشارة غير صالحة" };
      const badgeName = String(parsed.name || "").trim();
      if (!badgeName) return { err: true, msg: "اسم الشارة مطلوب" };
      const nextId = String(parsed.id || "").trim() || `rb_${Date.now()}`;
      const nextBadge = {
        id: nextId,
        name: badgeName,
        bg: String(parsed.bg || "").trim(),
        icon: String(parsed.icon || "").trim(),
        bg_type: (
          String(parsed.bg_type || parsed.bgType || "").trim().toLowerCase() === "animated"
            ? "animated"
            : "static"
        ) as "animated" | "static",
      };
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const list = normalizeRoomBadgesCatalog(stg.room_badges);
      const idx = list.findIndex((b) => String(b.id || "").trim() === nextId);
      if (idx === -1) list.push(nextBadge);
      else list[idx] = nextBadge;
      const saved = normalizeRoomBadgesCatalog(list);
      await db.update(settings).set({ room_badges: JSON.stringify(saved) }).where(eq(settings.id, stg.id));

      // Propagate updated badge style to rooms referencing this badge_id
      const allRooms = await db.select().from(rooms);
      for (const room of allRooms) {
        if (!room.id) continue;
        const metaObj = parseRoomOwnerMeta(room.room_owner_meta || {});
        let changed = false;
        if (metaObj.badge_id && metaObj.badge_id === nextId) {
          metaObj.badge = normalizeRoomOwnerBadge(nextBadge);
          changed = true;
        }
        if (metaObj.assignments.length) {
          metaObj.assignments = metaObj.assignments
            .map((entry) => {
              const row = normalizeRoomOwnerAssignment(entry) || entry;
              if (!row || String(row.badge_id || "").trim() !== nextId) return row;
              row.badge = normalizeRoomOwnerBadge(nextBadge);
              changed = true;
              return row;
            })
            .filter(Boolean);
        }
        if (!changed) continue;
        metaObj.ownerId = `#${String(room.owner || "#1").replace(/^#/, "")}`;
        const metaStr = JSON.stringify(metaObj);
        await db.update(rooms).set({ room_owner_meta: metaStr }).where(eq(rooms.idroom, room.idroom));
        await broadcastCmd("r^", formatRoomForEmit({ ...room, room_owner_meta: metaStr }));
      }

      await invalidateCatalogScopes(["site", "settings", "rooms"]);
      await broadcastCmd("room_badges", saved);
      return { err: false, msg: "تم حفظ الشارة", data: nextBadge };
    }
    case "room_badges_del": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const delId = String(params.id || "").trim();
      if (!delId) return { err: true, msg: "معرف الشارة غير صالح" };
      const stg = await getSettingsRow(1);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };
      const next = normalizeRoomBadgesCatalog(stg.room_badges).filter((b) => String(b.id || "").trim() !== delId);
      await db.update(settings).set({ room_badges: JSON.stringify(next) }).where(eq(settings.id, stg.id));
      await invalidateCatalogScopes(["site", "settings", "rooms"]);
      await broadcastCmd("room_badges", next);
      return { err: false, msg: "تم حذف الشارة" };
    }

    // -------- Rooms Management --------
    case "rooms": {
      if (!actorDef?.roomowner) return { err: true, msg: "لا تملك صلاحية" };
      const [roomRows, countsMap] = await Promise.all([
        db.select().from(rooms).orderBy(desc(rooms.idroom)),
        getRoomCountsMap(),
      ]);
      const systemOwner = getSystemRoomOwner();
      return {
        err: false,
        data: countsMap,
        msg: roomRows.map((r) => ({
          ...r,
          delete: Boolean(r.deleted),
          room_owner_meta: r.room_owner_meta || systemOwner.meta,
        })),
      };
    }
    case "roompass": {
      if (!verRoomsOwner(powersList, actorPower)) return { err: true, msg: "لا تملك صلاحية" };
      const roomId = String(params.id || "").trim();
      const targetRoom = await ensureRoomRowById(roomId);
      if (!targetRoom) return { err: true, msg: "الغرفة غير موجودة" };
      await db.update(rooms).set({ pass: "", needpass: false }).where(eq(rooms.idroom, targetRoom.idroom));
      await invalidateCatalogScopes(["rooms"]);
      const updated = { ...targetRoom, pass: "", needpass: false };
      await broadcastCmd("r^", formatRoomForEmit(updated));
      await savestate({
        state: "مسح كلمة سر غرفة",
        topic: data.topic,
        topic1: data.username,
        ip: actorIp,
        room: targetRoom.topic || "",
        time: Date.now(),
      });
      return { err: false, msg: "تم مسح كلمة المرور" };
    }
    case "roomspicdel": {
      if (!verRoomsOwner(powersList, actorPower)) return { err: true, msg: "لا تملك صلاحية" };
      const roomId = String(params.id || "").trim();
      const targetRoom = await ensureRoomRowById(roomId);
      if (!targetRoom) return { err: true, msg: "الغرفة غير موجودة" };
      await db.update(rooms).set({ pic: "room.png" }).where(eq(rooms.idroom, targetRoom.idroom));
      await invalidateCatalogScopes(["rooms"]);
      const updated = { ...targetRoom, pic: "room.png" };
      await broadcastCmd("r^", formatRoomForEmit(updated));
      await savestate({
        state: "مسح صورة غرفة",
        topic: data.topic,
        topic1: data.username,
        ip: actorIp,
        room: targetRoom.topic || "",
        time: Date.now(),
      });
      return { err: false, msg: "" };
    }
    case "roomspic": {
      if (!verRoomsOwner(powersList, actorPower)) return { err: true, msg: "لا تملك صلاحية" };
      const roomId = String(params.id || "").trim();
      const picVal = path.basename(String(params.pic || "").trim()) || "room.png";
      const targetRoom = await ensureRoomRowById(roomId);
      if (!targetRoom) return { err: true, msg: "الغرفة غير موجودة" };
      await db.update(rooms).set({ pic: picVal }).where(eq(rooms.idroom, targetRoom.idroom));
      await invalidateCatalogScopes(["rooms"]);
      const updated = { ...targetRoom, pic: picVal };
      await broadcastCmd("r^", formatRoomForEmit(updated));
      await savestate({
        state: "تعديل صورة غرفة",
        topic: data.topic,
        topic1: data.username,
        ip: actorIp,
        room: targetRoom.topic || "",
        time: Date.now(),
      });
      return { err: false, msg: picVal };
    }
    case "roomsver": {
      if (!actorDef?.createroom) return { err: true, msg: "لا تملك صلاحية" };
      const roomId = String(params.id || "").trim();
      const targetRoom = await ensureRoomRowById(roomId);
      if (!targetRoom) return { err: true, msg: "الغرفة غير موجودة" };
      await db.update(owner).set({ room: roomId }).where(eq(owner.id, 1));
      await invalidateCatalogScopes(["owner"]);
      return { err: false, msg: "تم تحديد الغرفة بنجاح" };
    }
    case "roomsdel": {
      if (!verRoomsOwner(powersList, actorPower)) return { err: true, msg: "لا تملك صلاحية" };
      const roomId = String(params.id || "").trim();
      if (roomId === "D8D8A9A9C0") {
        return { err: true, msg: "لا يمكنك حذف هذه الغرفة" };
      }
      const targetRoom = await ensureRoomRowById(roomId);
      if (!targetRoom) return { err: true, msg: "الغرفة غير موجودة" };
      await savestate({
        state: "مسح غرفة",
        topic: data.topic,
        topic1: data.username,
        ip: actorIp,
        room: targetRoom.topic || "",
        time: Date.now(),
      });
      await db.delete(rooms).where(eq(rooms.idroom, targetRoom.idroom));
      await invalidateCatalogScopes(["rooms"]);
      await broadcastCmd("r-", roomId);
      await emitRoomCmd(roomId, "msg", {
        bg: data.bg,
        class: "hmsg",
        id: data.id || data.uid || "",
        topic: data.topic,
        msg: "( تم حذف الغرفة الحاليه )",
        roomid: roomId,
        pic: data.pic,
        uid: data.id || data.uid || "",
      });
      return { err: false, msg: "تم مسح الغرفة بنجاح" };
    }
    case "owner": {
      if (!isOwner) return { err: true, msg: "لا تملك صلاحية" };
      const dominId = Number.parseInt(String(params.domin || "1"), 10) || 1;
      const [stg, siteRow, own] = await Promise.all([
        getSettingsRow(dominId),
        getSiteRow(dominId),
        getOwnerRow(),
      ]);
      if (!stg) return { err: true, msg: "تعذر قراءة الإعدادات" };

      const siteJson = stripSensitiveSiteFields(safeJsonParse<Record<string, unknown>>(stg.site, {}));
      const sanitizedStg = {
        ...stg,
        site: JSON.stringify(siteJson),
      };
      const scriptFile = path.basename(String(siteJson.siteScript || "").trim());
      let scriptObj = { ...DEFAULT_SITE_SCRIPT_JSON } as Record<string, unknown>;
      if (scriptFile) {
        const scriptPath = path.resolve(apiConfig.uploadDir, scriptFile);
        if (scriptPath.startsWith(apiConfig.uploadDir + path.sep) && fs.existsSync(scriptPath)) {
          const rawScript = await fs.promises.readFile(scriptPath, "utf8").catch(() => "");
          const parsedScript = safeJsonParse<Record<string, unknown>>(rawScript, {});
          scriptObj = { ...DEFAULT_SITE_SCRIPT_JSON, ...parsedScript };
        }
      }

      return [
        sanitizedStg,
        {
          banner: siteRow?.banner || "",
          finish: own?.datafinish || "",
          logo: siteRow?.logo || "",
          name: scriptObj.name || "",
          title: scriptObj.title || "",
          settdescription: scriptObj.settdescription || "",
          settscr: scriptObj.settscr || "",
          setthead: scriptObj.setthead || "",
          settkeywords: scriptObj.settkeywords || "",
        },
      ];
    }

    default:
      return { err: false, cmd, status: "ok" };
  }
}

export async function registerCpRoutes(app: FastifyInstance) {
  app.get("/cp.nd", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const params = extractRequestParams(req);
    const cmd = String(params.cmd || "").trim();
    if (!cmd) {
      return { ok: true, service: "newchat-cp-v2" };
    }
    if (cmd !== "setpower") {
      return { err: true, msg: "cmd غير مدعوم" };
    }
    const token = extractRequestToken(req);
    if (!token) {
      return reply.code(401).send({ err: true, msg: "مطلوب تسجيل دخول للإدارة" });
    }
    const data = await resolveUserActorByToken(token);
    const powersList = await getPowersList();
    if (!data || !verAdminPanel(powersList, data.power)) {
      return { err: true, msg: "لا تمتلك صلاحيات" };
    }
    const actorIp = getRequestRealIp(req) || data.ip || "127.0.0.1";
    return handleSetPowerCommand(data, powersList, params, actorIp, true);
  });

  app.post("/cp.nd", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const params = extractRequestParams(req);
    const cmd = String(params.cmd || "").trim();
    if (!cmd) {
      return { ok: true, service: "newchat-cp-v2" };
    }
    if (cmd !== "setpower") {
      return { err: true, msg: "cmd غير مدعوم" };
    }
    const token = extractRequestToken(req);
    if (!token) {
      return reply.code(401).send({ err: true, msg: "مطلوب تسجيل دخول للإدارة" });
    }
    const data = await resolveUserActorByToken(token);
    const powersList = await getPowersList();
    if (!data || !verAdminPanel(powersList, data.power)) {
      return { err: true, msg: "لا تمتلك صلاحيات" };
    }
    const actorIp = getRequestRealIp(req) || data.ip || "127.0.0.1";
    return handleSetPowerCommand(data, powersList, params, actorIp, true);
  });

  app.get("/cp/cp.nd", handleCpCommand);
  app.post("/cp/cp.nd", handleCpCommand);

  app.get("/uh", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const params = extractRequestParams(req);
      const token = extractRequestToken(req);
      if (!token) return [];
      const actor = await resolveUserActorByToken(token);
      const powersList = await getPowersList();
      if (!actor || !myOptionHistory(powersList, actor.power)) {
        return [];
      }
      const targetSocketId = String(params.u2 || "").trim();
      if (!targetSocketId) return [];

      let targetIp = "";
      const online = await getRawOnlinePresenceRecords();
      const onlineMatch = online.find(
        (u) => String(u.id || "") === targetSocketId || String(u.uid || "") === targetSocketId,
      );
      if (onlineMatch?.ip) {
        targetIp = String(onlineMatch.ip).trim();
      } else {
        const { db } = getDb();
        const userRows = await db
          .select({ ip: users.ip })
          .from(users)
          .where(or(eq(users.id, targetSocketId), eq(users.uid, targetSocketId)))
          .limit(1);
        targetIp = String(userRows[0]?.ip || "").trim();
      }

      if (!targetIp) return [];
      const { db } = getDb();
      return db
        .select()
        .from(names)
        .where(eq(names.ip, targetIp))
        .orderBy(desc(names.id))
        .limit(200);
    } catch {
      return [];
    }
  });

  app.get("/cp.html", async (_req, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.code(403).send("<h4>لاتملك صلاحيآت</h4>");
  });

  app.get("/cp/token=:token", async (req, reply) => {
    try {
      const rawToken = String((req.params as { token?: string }).token || "").trim();
      const actor = await resolveUserActorByToken(rawToken);
      const powersList = await getPowersList();
      if (actor && verAdminPanel(powersList, actor.power)) {
        const legacyCpFile = path.join(apiConfig.publicDir, "cp.html");
        if (fs.existsSync(legacyCpFile)) {
          const html = await fs.promises.readFile(legacyCpFile, "utf8");
          reply.header("Content-Type", "text/html; charset=utf-8");
          return reply.send(html);
        }
        return reply.redirect(`/cp?token=${encodeURIComponent(rawToken)}`, 302);
      }
      reply.header("Content-Type", "text/html; charset=utf-8");
      return reply.code(403).send("<h4>لاتملك صلاحيآت</h4>");
    } catch {
      reply.header("Content-Type", "text/html; charset=utf-8");
      return reply.code(500).send("<h4>خطأ في الخادم</h4>");
    }
  });

  // Unused publishBusEvent import silencer check: ensure referenced or remove unused if none
  void publishBusEvent;
}
