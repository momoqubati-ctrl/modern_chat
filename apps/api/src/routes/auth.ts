import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { and, desc, eq, getDb, getRedis, logs, names, sql, users } from "@newchat/db";
import {
  COUNTRY_VPN_LIST,
  NO_NAMES,
  memberLoginSchema,
  normalizeSiteSettingShape,
  registerSchema,
  sanitizeHtmlText,
} from "@newchat/shared";
import { apiConfig } from "../config.js";
import { hashPasswordSync, needsPasswordRehash, verifyPasswordAsync } from "../lib/password.js";
import {
  extractRequestToken,
  getBandList,
  getBsbRow,
  getHostSettingRow,
  getOwnerRow,
  getRequestCountry,
  getRequestRealIp,
  resolveUserActorByToken,
  safeJsonParse,
} from "../lib/runtime.js";

const ACCESS_TTL_SEC = 12 * 60 * 60;
const RESUME_TTL_SEC = 30 * 24 * 60 * 60;
const LOGIN_FAIL_WINDOW_SEC = 5 * 60;
const LOGIN_FAIL_MAX = 15;

function randomId(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

function buildMemberAuthTokens(user: typeof users.$inferSelect) {
  const nowMs = Date.now();
  const basePayload = {
    aud: "chat",
    sub: user.uid || String(user.idreg),
    uid: String(user.uid || ""),
    idreg: user.idreg,
    lid: String(user.lid || ""),
    username: user.username,
    power: user.power || "",
    rank: user.power || "",
    ver: String(user.token || "").slice(0, 24),
  };

  const accessToken = jwt.sign({ ...basePayload, typ: "access" }, apiConfig.jwtSecret, {
    expiresIn: ACCESS_TTL_SEC,
  });
  const resumeToken = jwt.sign({ ...basePayload, typ: "resume" }, apiConfig.jwtSecret, {
    expiresIn: RESUME_TTL_SEC,
  });

  return {
    type: "Bearer" as const,
    accessToken,
    resumeToken,
    accessExpiresAt: nowMs + ACCESS_TTL_SEC * 1000,
    resumeExpiresAt: nowMs + RESUME_TTL_SEC * 1000,
  };
}

function redactUser(user: typeof users.$inferSelect) {
  return {
    idreg: user.idreg,
    uid: user.uid,
    lid: user.lid,
    id: user.id,
    username: user.username,
    topic: user.topic,
    pic: user.pic,
    pich: user.pich,
    msg: user.msg || "",
    power: user.power || "",
    rank: user.power || "",
    bg: user.bg || "#FFFFFF",
    ucol: user.ucol || "#000000",
    mcol: user.mcol || "#000000",
    gcol: user.gcol || "#FFFFFF",
    ico: user.ico || "",
    gift_ico: user.gift_ico || "",
    them: user.them || "",
    cover: user.cover || "",
    youtub: user.youtub || "",
    yp: user.youtub || "",
    rep: Math.max(0, Number(user.rep ?? 0)),
    coins: Math.max(0, Number(user.coins ?? 0)),
    coin: Math.max(0, Number(user.coins ?? 0)),
    evaluation: Math.max(0, Number(user.evaluation ?? 0)),
    point: Math.max(0, Number(user.evaluation ?? 0)),
    wall_post_likes: Math.max(0, Number(user.wall_post_likes ?? 0)),
    gifts_received_count: Math.max(0, Number(user.gifts_received_count ?? 0)),
    documentationc: Number(user.documentationc || 0) === 1,
    documents: Number(user.documentationc || 0) === 1,
    loginG: Boolean(user.loginG),
    muted: Boolean(user.muted),
    busy: Boolean(user.busy),
    nopm: Boolean(user.busy),
    alerts: Boolean(user.alerts),
    nopmcall: Boolean(user.nopmcall),
    nopmvideocall: Boolean(user.nopmvideocall),
    site_badge_id: user.site_badge_id || "",
    site_badge: user.site_badge || "",
    auto_power: user.auto_power || "",
    joinuser: user.joinuser || "",
    lastssen: user.lastssen || "",
  };
}

interface ClientUaMeta {
  plt: string;
  browser: string;
}

function detectClientUaMeta(req: FastifyRequest, explicitFp = ""): ClientUaMeta {
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  const fp = String(explicitFp || "").toLowerCase();
  const source = `${ua} ${fp}`;

  let plt = "";
  if (source.includes("windows phone")) plt = "windows phone";
  else if (source.includes("android")) plt = "android";
  else if (/iphone|ipad|ipod|\bios\b/.test(source)) plt = "ios";
  else if (source.includes("win")) plt = "windows";
  else if (source.includes("macintosh") || source.includes("mac os") || source.includes("mac")) {
    plt = "mac";
  } else if (source.includes("linux")) plt = "linux";

  let browser = "";
  if (source.includes("samsungbrowser") || source.includes("samsung browser")) {
    browser = "samsung browser";
  } else if (/\bwv\b|webview/.test(source)) {
    browser = "webview";
  } else if (source.includes("edg/") || source.includes("edge")) {
    browser = "edge";
  } else if (source.includes("opr/") || source.includes("opera")) {
    browser = "opera";
  } else if (source.includes("firefox") || source.includes("fxios")) {
    browser = "firefox";
  } else if (source.includes("msie") || source.includes("trident") || source.includes("internet explorer")) {
    browser = "internet explorer";
  } else if (source.includes("chrome") || source.includes("crios")) {
    browser = "chrome";
  } else if (source.includes("safari")) {
    browser = "safari";
  }

  return { plt, browser };
}

async function upsertSecurityLog(entry: {
  state: string;
  topic: string;
  username: string;
  ip: string;
  code: string;
  device: string;
  isin: string;
  time: number | string;
}): Promise<void> {
  try {
    const { db } = getDb();
    const stateStr = String(entry.state || "").slice(0, 250);
    const topicStr = String(entry.topic || "").slice(0, 250);
    const usernameStr = String(entry.username || "").slice(0, 250);
    const ipStr = String(entry.ip || "").slice(0, 250);
    const timeStr = String(entry.time ?? Date.now());
    const deviceStr = String(entry.device || "web").slice(0, 250);

    const existing = await db
      .select({ id: logs.id })
      .from(logs)
      .where(
        and(
          eq(logs.ip, ipStr),
          eq(logs.state, stateStr),
          eq(logs.topic, topicStr),
          eq(logs.username, usernameStr),
        ),
      )
      .orderBy(desc(logs.id))
      .limit(1);

    if (existing[0]) {
      await db
        .update(logs)
        .set({ time: timeStr, device: deviceStr })
        .where(eq(logs.id, existing[0].id));
      return;
    }

    await db.insert(logs).values({
      state: stateStr,
      topic: topicStr,
      username: usernameStr,
      ip: ipStr,
      code: String(entry.code || "--").slice(0, 250),
      device: deviceStr,
      isin: String(entry.isin || "*").slice(0, 250),
      time: timeStr,
    });

    await db.execute(sql`
      DELETE FROM logs
      WHERE id < (
        SELECT id FROM logs ORDER BY id DESC LIMIT 1 OFFSET 150
      )
    `);
  } catch {
    // Non-fatal audit log
  }
}

async function recordUserNameHistory(entry: {
  iduser: string;
  fp: string;
  ip: string;
  topic: string;
  username: string;
}): Promise<void> {
  try {
    const { db } = getDb();
    const existing = await db
      .select({ id: names.id })
      .from(names)
      .where(
        and(
          eq(names.ip, entry.ip),
          eq(names.fp, entry.fp),
          eq(names.topic, entry.topic),
          eq(names.username, entry.username),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      await db.insert(names).values({
        iduser: entry.iduser.slice(0, 250),
        fp: entry.fp.slice(0, 250),
        ip: entry.ip.slice(0, 250),
        topic: entry.topic.slice(0, 250),
        username: entry.username.slice(0, 250),
      });
    }
  } catch {
    // Non-fatal history write
  }
}

interface BanCheckResult {
  blocked: boolean;
  code?: "vpn" | "banduser";
  stateTag?: string;
  matchedValue?: string;
  message?: string;
}

async function checkAccessBans(params: {
  ip: string;
  fp: string;
  country: string;
  username: string;
  uaMeta: ClientUaMeta;
  isVerified: boolean;
}): Promise<BanCheckResult> {
  if (params.isVerified) {
    return { blocked: false };
  }

  const [ownerRow, bandList, bsbRow] = await Promise.all([
    getOwnerRow(),
    getBandList(),
    getBsbRow(),
  ]);

  if (
    ownerRow?.Vpn &&
    params.country &&
    params.country !== "--" &&
    COUNTRY_VPN_LIST.includes(params.country.toUpperCase())
  ) {
    return {
      blocked: true,
      code: "vpn",
      stateTag: "VPN",
      message: "الدخول عبر شبكة VPN محظور",
    };
  }

  const lowerUser = params.username.trim().toLowerCase();
  const fpStr = params.fp.trim();
  const ipStr = params.ip.trim();
  const upperCountry = params.country.trim().toUpperCase();

  for (const row of bandList) {
    const devBand = String(row.device_band || "").trim();
    if (devBand && fpStr && fpStr.includes(devBand)) {
      return {
        blocked: true,
        code: "banduser",
        stateTag: "جهاز",
        matchedValue: devBand,
        message: "عذراً، هذا الجهاز محظور",
      };
    }

    const ipBand = String(row.ip_band || "").trim();
    if (ipBand && ipStr && (ipStr === ipBand || ipStr.includes(ipBand))) {
      return {
        blocked: true,
        code: "banduser",
        stateTag: "اي بي",
        matchedValue: ipBand,
        message: "عذراً، عنوان الشبكة محظور",
      };
    }

    const acctBand = String(row.decoderDans || "").trim().toLowerCase();
    if (acctBand && lowerUser && acctBand === lowerUser) {
      return {
        blocked: true,
        code: "banduser",
        stateTag: "حساب",
        matchedValue: acctBand,
        message: "عذراً، هذا الحساب محظور",
      };
    }

    const countryBand = String(row.country_band || "").trim().toUpperCase();
    if (countryBand && upperCountry && upperCountry !== "--" && countryBand === upperCountry) {
      return {
        blocked: true,
        code: "banduser",
        stateTag: "دولة",
        matchedValue: countryBand,
        message: "عذراً، الدخول من هذه الدولة محظور",
      };
    }
  }

  if (bsbRow) {
    const systems = safeJsonParse<Record<string, boolean>>(bsbRow.systems, {});
    const browsers = safeJsonParse<Record<string, boolean>>(bsbRow.browsers, {});
    const { plt, browser } = params.uaMeta;

    if (
      (systems.system1 && (plt === "windows" || plt === "win")) ||
      (systems.system2 && plt === "linux") ||
      (systems.system3 && plt === "android") ||
      (systems.system4 && plt === "ios") ||
      (systems.system5 && plt === "windows phone") ||
      (systems.system6 && plt === "mac")
    ) {
      return {
        blocked: true,
        code: "banduser",
        stateTag: "نظام",
        message: "عذراً، نظام التشغيل محظور مؤقتاً",
      };
    }

    if (
      (browsers.browser1 && browser === "chrome") ||
      (browsers.browser2 && browser === "firefox") ||
      (browsers.browser3 && browser === "safari") ||
      (browsers.browser4 && browser === "opera") ||
      (browsers.browser5 && browser === "internet explorer") ||
      (browsers.browser6 && browser === "edge") ||
      (browsers.browser7 && browser === "webview") ||
      (browsers.browser8 && browser === "samsung browser")
    ) {
      return {
        blocked: true,
        code: "banduser",
        stateTag: "متصفح",
        message: "عذراً، هذا المتصفح محظور مؤقتاً",
      };
    }
  }

  return { blocked: false };
}

function isLoopbackIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  return clean === "127.0.0.1" || clean === "::1" || clean === "localhost" || clean === "::ffff:127.0.0.1";
}

async function consumeLoginFailSlot(key: string): Promise<{ blocked: boolean; retryAfterSec: number }> {
  try {
    const redis = getRedis();
    const failKey = `newchat:auth:fail:${key}`;
    const count = await redis.incr(failKey);
    if (count === 1) {
      await redis.expire(failKey, LOGIN_FAIL_WINDOW_SEC);
    }
    if (count > LOGIN_FAIL_MAX) {
      const ttl = await redis.ttl(failKey);
      return { blocked: true, retryAfterSec: Math.max(30, ttl) };
    }
    return { blocked: false, retryAfterSec: 0 };
  } catch {
    return { blocked: false, retryAfterSec: 0 };
  }
}

async function clearLoginFailSlot(key: string): Promise<void> {
  try {
    await getRedis().del(`newchat:auth:fail:${key}`);
  } catch {
    // ignore
  }
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = memberLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: parsed.error.issues[0]?.message || "الرجاء التأكد من بيانات الدخول",
      });
    }

    const rawTrimmed = parsed.data.username.trim();
    const username = rawTrimmed.toLowerCase();
    const clientIp = getRequestRealIp(req);
    const clientCountry = getRequestCountry(req);
    const clientFp = String(parsed.data.fp || "").trim() || "web-v2";
    const failSlotKey = `${clientIp}:${username}`;

    try {
      const redis = getRedis();
      const existingFails = Number((await redis.get(`newchat:auth:fail:${failSlotKey}`)) || 0);
      if (existingFails >= LOGIN_FAIL_MAX) {
        return reply.code(429).send({
          ok: false,
          code: "rate_limited",
          message: "محاولات دخول خاطئة متكررة، يرجى المحاولة بعد دقائق",
        });
      }
    } catch {
      // Redis optional fallback
    }

    const { db } = getDb();
    let rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!rows[0] && rawTrimmed !== username) {
      rows = await db.select().from(users).where(eq(users.username, rawTrimmed)).limit(1);
    }
    const user = rows[0];

    if (!user) {
      await consumeLoginFailSlot(failSlotKey);
      return reply.code(401).send({ ok: false, message: "إسم المستخدم غير صحيح" });
    }

    const valid = await verifyPasswordAsync(parsed.data.password, user.password);
    if (!valid) {
      const failState = await consumeLoginFailSlot(failSlotKey);
      await upsertSecurityLog({
        state: "محاوله تخمين رقم سري",
        topic: rawTrimmed,
        username: user.username,
        ip: clientIp,
        code: clientCountry,
        device: clientFp,
        isin: parsed.data.refr || "web",
        time: Date.now(),
      });
      if (failState.blocked) {
        reply.header("Retry-After", String(failState.retryAfterSec));
        return reply.code(429).send({
          ok: false,
          code: "rate_limited",
          message: "تم تجاوز الحد المسموح لمحاولات الدخول",
        });
      }
      return reply.code(401).send({ ok: false, message: "كلمة المرور غير صحيحة" });
    }

    const isVerified = Number(user.documentationc || 0) === 1;
    const uaMeta = detectClientUaMeta(req, clientFp);
    const banStatus = await checkAccessBans({
      ip: clientIp,
      fp: clientFp,
      country: clientCountry,
      username: user.username,
      uaMeta,
      isVerified,
    });

    if (banStatus.blocked) {
      const logState =
        banStatus.code === "vpn"
          ? "عضو|محظور|VPN"
          : `محظور|عضو|${banStatus.stateTag || "حساب"}`;
      await upsertSecurityLog({
        state: logState,
        topic: user.topic.slice(0, 40),
        username: user.username.slice(0, 40),
        ip: banStatus.stateTag === "اي بي" && banStatus.matchedValue ? banStatus.matchedValue : clientIp,
        code: clientCountry,
        device: banStatus.stateTag === "جهاز" && banStatus.matchedValue ? banStatus.matchedValue : clientFp,
        isin: parsed.data.refr || "web",
        time: Date.now(),
      });
      return reply.code(403).send({
        ok: false,
        code: banStatus.code,
        message: banStatus.message || "عذراً، هذا الحساب محظور",
      });
    }

    await clearLoginFailSlot(failSlotKey);

    const nowMs = Date.now();
    const updatePatch: Partial<typeof users.$inferInsert> = {
      lastssen: String(nowMs),
      ip: clientIp,
      fp: clientFp,
    };
    if (needsPasswordRehash(user.password)) {
      updatePatch.password = hashPasswordSync(parsed.data.password);
    }
    await db.update(users).set(updatePatch).where(eq(users.idreg, user.idreg));

    await Promise.all([
      upsertSecurityLog({
        state: "دخول عضو",
        topic: user.topic.slice(0, 40),
        username: user.username,
        ip: clientIp,
        code: clientCountry,
        device: clientFp,
        isin: parsed.data.refr || "web",
        time: nowMs,
      }),
      recordUserNameHistory({
        iduser: String(user.idreg),
        fp: clientFp,
        ip: clientIp,
        topic: user.topic,
        username: user.username,
      }),
    ]);

    const authTokens = buildMemberAuthTokens(user);
    return {
      ok: true,
      accessToken: authTokens.accessToken,
      resumeToken: authTokens.resumeToken,
      auth: authTokens,
      sessionToken: user.token,
      user: redactUser({ ...user, ip: clientIp, fp: clientFp, lastssen: String(nowMs) }),
    };
  });

  app.post("/api/auth/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        message: parsed.error.issues[0]?.message || "الرجاء التأكد من بيانات التسجيل",
      });
    }

    const hostRow = await getHostSettingRow(req.hostname);
    const siteSettings = normalizeSiteSettingShape(safeJsonParse(hostRow?.site, {}));
    if (siteSettings.allowreg === false) {
      return reply.code(403).send({
        ok: false,
        code: "reg_disabled",
        message: "تم تعطيل تسجيل العضويات مؤقتاً .. حاول لاحقاً",
      });
    }

    const walllikes = safeJsonParse<Record<string, unknown>>(siteSettings.walllikes, {});
    const maxRegLen = Math.max(12, Number.parseInt(String(walllikes.lengthUserReg || 100), 10) || 100);
    const rawTrimmed = parsed.data.username.trim();
    const username = rawTrimmed.toLowerCase();

    if (rawTrimmed.length > maxRegLen) {
      return reply.code(400).send({
        ok: false,
        message: `اسم المستخدم طويل جداً يجب أن لا يزيد الاسم عن ${maxRegLen} حرف`,
      });
    }

    if (!Number.isNaN(Number(rawTrimmed))) {
      return reply.code(400).send({ ok: false, message: "الرجاء التأكد من الاسم" });
    }

    const prohibitedFound = NO_NAMES.some((w) => rawTrimmed.toLowerCase().includes(w.toLowerCase()));
    if (prohibitedFound) {
      return reply.code(400).send({ ok: false, message: "هذا الاسم ممنوع" });
    }

    const clientIp = getRequestRealIp(req);
    const clientCountry = getRequestCountry(req);
    const clientFp = String(parsed.data.fp || "").trim() || "web-v2";
    const uaMeta = detectClientUaMeta(req, clientFp);

    const banStatus = await checkAccessBans({
      ip: clientIp,
      fp: clientFp,
      country: clientCountry,
      username,
      uaMeta,
      isVerified: false,
    });
    if (banStatus.blocked) {
      await upsertSecurityLog({
        state:
          banStatus.code === "vpn"
            ? "تسجيل|محظور|VPN"
            : `محظور|تسجيل|${banStatus.stateTag || "جهاز"}`,
        topic: rawTrimmed.slice(0, 20),
        username: rawTrimmed.slice(0, 20),
        ip: banStatus.stateTag === "اي بي" && banStatus.matchedValue ? banStatus.matchedValue : clientIp,
        code: clientCountry,
        device: banStatus.stateTag === "جهاز" && banStatus.matchedValue ? banStatus.matchedValue : clientFp,
        isin: "*",
        time: Date.now(),
      });
      return reply.code(403).send({
        ok: false,
        code: banStatus.code,
        message: banStatus.message || "التسجيل محظور حالياً",
      });
    }

    const { db } = getDb();

    if (!isLoopbackIp(clientIp)) {
      const ipCountRows = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.ip, clientIp));
      if (Number(ipCountRows[0]?.cnt || 0) > 5) {
        return reply.code(429).send({
          ok: false,
          code: "ip_reg_limit",
          message: "أنت مسجل من قبل",
        });
      }
    }

    const existing = await db
      .select({ idreg: users.idreg })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (existing[0]) {
      return reply.code(409).send({ ok: false, message: "هذا الإسم مسجل من قبل" });
    }

    const uid = randomId(22);
    const lid = randomId(31);
    const token = randomId(64);
    const passwordHash = hashPasswordSync(parsed.data.password);
    const nowStr = String(Date.now());
    const displayTopic = sanitizeHtmlText((parsed.data.topic || rawTrimmed).trim().slice(0, 60));

    const [created] = await db
      .insert(users)
      .values({
        topic: displayTopic,
        username,
        password: passwordHash,
        token,
        uid,
        lid,
        ip: clientIp,
        fp: clientFp,
        documentationc: 0,
        joinuser: nowStr,
        lastssen: nowStr,
        msg: "(عضو جديد)",
        pic: "pic.png",
        pich: "pich.png",
        bg: "#FFFFFF",
        ucol: "#000000",
        mcol: "#000000",
        gcol: "#FFFFFF",
      })
      .returning();

    if (!created) {
      return reply.code(500).send({ ok: false, message: "تعذر إنشاء الحساب" });
    }

    await upsertSecurityLog({
      state: "تسجيل|عضوية",
      topic: displayTopic,
      username,
      ip: clientIp,
      code: clientCountry,
      device: clientFp,
      isin: "*",
      time: nowStr,
    });

    const authTokens = buildMemberAuthTokens(created);
    return reply.code(201).send({
      ok: true,
      accessToken: authTokens.accessToken,
      resumeToken: authTokens.resumeToken,
      auth: authTokens,
      sessionToken: created.token,
      user: redactUser(created),
    });
  });

  app.get("/api/auth/me", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const token = extractRequestToken(req);
    if (!token) {
      return reply.code(401).send({ ok: false, message: "غير مصرح" });
    }
    const user = await resolveUserActorByToken(token);
    if (!user) {
      return reply.code(401).send({ ok: false, message: "الجلسة منتهية أو غير صالحة" });
    }
    return {
      ok: true,
      user: redactUser(user),
    };
  });

  app.post("/api/auth/refresh", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const body = req.body && typeof req.body === "object" ? (req.body as { resumeToken?: string; token?: string }) : {};
    const rawToken = String(body.resumeToken || body.token || extractRequestToken(req) || "").trim();
    if (!rawToken) {
      return reply.code(401).send({ ok: false, message: "رمز التحديث مطلوب" });
    }

    if (rawToken.includes(".")) {
      try {
        const payload = jwt.verify(rawToken, apiConfig.jwtSecret) as {
          idreg?: number;
          sub?: string;
          ver?: string;
        };
        const user = await resolveUserActorByToken(rawToken);
        if (!user) {
          return reply.code(401).send({ ok: false, message: "المستخدم غير موجود" });
        }
        if (payload.ver && String(user.token || "").slice(0, 24) !== String(payload.ver)) {
          return reply.code(401).send({ ok: false, message: "تم إبطال الجلسة" });
        }
        const authTokens = buildMemberAuthTokens(user);
        return {
          ok: true,
          accessToken: authTokens.accessToken,
          resumeToken: authTokens.resumeToken,
          auth: authTokens,
          sessionToken: user.token,
          user: redactUser(user),
        };
      } catch {
        return reply.code(401).send({ ok: false, message: "رمز التحديث غير صالح أو منتهي" });
      }
    }

    const legacyUser = await resolveUserActorByToken(rawToken);
    if (!legacyUser) {
      return reply.code(401).send({ ok: false, message: "الجلسة غير صالحة" });
    }
    const authTokens = buildMemberAuthTokens(legacyUser);
    return {
      ok: true,
      accessToken: authTokens.accessToken,
      resumeToken: authTokens.resumeToken,
      auth: authTokens,
      sessionToken: legacyUser.token,
      user: redactUser(legacyUser),
    };
  });
}
