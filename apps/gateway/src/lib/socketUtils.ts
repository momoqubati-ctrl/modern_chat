import crypto from "node:crypto";
import path from "node:path";
import type { Socket } from "socket.io";
import type { OnlineUserSnapshot, RoomSnapshot } from "@newchat/shared";
import type { DeviceQueryFingerprint, GatewayRoomRecord, GatewaySession } from "../types/gateway.js";

const GEO_CACHE_MAX = 4096;
const GEO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const geoLookupCache = new Map<string, { code: string; expiresAt: number }>();

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

export function normalizeClientIp(raw: unknown): string {
  const first =
    String(raw || "")
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

export function getSocketClientIp(socket: Socket): string {
  const headers = (socket.handshake?.headers || {}) as Record<string, string | string[] | undefined>;
  const cf = headers["cf-connecting-ip"];
  const realIp = headers["x-real-ip"];
  const xff = headers["x-forwarded-for"];
  const raw =
    (Array.isArray(cf) ? cf[0] : cf) ||
    (Array.isArray(realIp) ? realIp[0] : realIp) ||
    (Array.isArray(xff) ? xff[0] : xff) ||
    socket.handshake?.address ||
    "";
  return normalizeClientIp(raw) || "127.0.0.1";
}

export function isLocalOrPrivateIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (!clean) return true;
  if (clean === "::1" || clean === "127.0.0.1" || clean === "localhost") return true;
  if (clean.startsWith("10.") || clean.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)) return true;
  return false;
}

export function normalizeCountryCode(raw: unknown): string {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned.length >= 2 ? cleaned.slice(0, 2) : "--";
}

let cachedOutboundServerCountry: { code: string; expiresAt: number } | null = null;

async function resolveOutboundServerCountry(): Promise<string> {
  if (cachedOutboundServerCountry && cachedOutboundServerCountry.expiresAt > Date.now()) {
    return cachedOutboundServerCountry.code;
  }
  try {
    const res = await fetch("https://get.geojs.io/v1/ip/country.json", {
      signal: AbortSignal.timeout(1800),
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const json = (await res.json()) as { country?: string; country_code?: string };
      const code = normalizeCountryCode(json?.country || json?.country_code || "--");
      if (code !== "--" && code !== "XX" && code !== "T1") {
        cachedOutboundServerCountry = { code, expiresAt: Date.now() + GEO_CACHE_TTL_MS };
        return code;
      }
    }
  } catch {
    // fallback
  }
  return "YE";
}

export async function resolveSocketCountryCode(socket: Socket, ip: string): Promise<string> {
  const headers = (socket.handshake?.headers || {}) as Record<string, string | string[] | undefined>;
  const query = (socket.handshake?.query || {}) as Record<string, unknown>;

  const headerCountry =
    headers["cf-ipcountry"] ||
    headers["x-country-code"] ||
    headers["x-vercel-ip-country"] ||
    headers["x-appengine-country"];
  const fromHeader = normalizeCountryCode(Array.isArray(headerCountry) ? headerCountry[0] : headerCountry);
  if (fromHeader !== "--" && fromHeader !== "XX" && fromHeader !== "T1") {
    return fromHeader;
  }

  const fromQuery = normalizeCountryCode(query.co || query.country || query.c);

  if (!ip || isLocalOrPrivateIp(ip)) {
    const serverCountry = await resolveOutboundServerCountry();
    if (serverCountry && serverCountry !== "--") {
      return serverCountry;
    }
    if (fromQuery !== "--" && fromQuery !== "XX" && fromQuery !== "T1") {
      return fromQuery;
    }
    return "YE";
  }

  const cached = geoLookupCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.code;
  }

  try {
    const res = await fetch(`https://get.geojs.io/v1/ip/country/${encodeURIComponent(ip)}.json`, {
      signal: AbortSignal.timeout(1800),
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const json = (await res.json()) as { country?: string; country_code?: string };
      const code = normalizeCountryCode(json?.country || json?.country_code || "--");
      if (code !== "--" && code !== "XX" && code !== "T1") {
        if (geoLookupCache.size >= GEO_CACHE_MAX) {
          const oldest = geoLookupCache.keys().next();
          if (!oldest.done) geoLookupCache.delete(oldest.value);
        }
        geoLookupCache.set(ip, { code, expiresAt: Date.now() + GEO_CACHE_TTL_MS });
        return code;
      }
    }
  } catch {
    // fallback below
  }

  if (fromQuery !== "--" && fromQuery !== "XX" && fromQuery !== "T1") {
    return fromQuery;
  }

  const serverCountry = await resolveOutboundServerCountry();
  return serverCountry && serverCountry !== "--" ? serverCountry : "YE";
}

export function extractDeviceFingerprint(socket: Socket): DeviceQueryFingerprint {
  const q = (socket.handshake?.query || {}) as Record<string, unknown>;
  const plt = String(q.plt || "web").trim().slice(0, 48);
  const wk = String(q.wk || "web").trim().slice(0, 48);
  const version = String(q.version || "1.0").trim().slice(0, 32);
  const browser = String(q.browser || "chrome").trim().slice(0, 64);
  const c = String(q.c || "0").trim().slice(0, 32);
  const raw = `${plt}.${version}.${wk}.${browser}.${c}`;
  return { plt, wk, version, browser, c, raw };
}

export function emitSocketCmd(
  socket: Pick<Socket, "emit">,
  cmd: string,
  data?: unknown,
): void {
  socket.emit("msg", data === undefined ? { cmd } : { cmd, data });
}

export function emitNotice(
  socket: Pick<Socket, "emit">,
  msg: string,
  opts?: { topic?: string; force?: 0 | 1; user?: string },
): void {
  emitSocketCmd(socket, "not", {
    topic: opts?.topic ?? "",
    force: opts?.force ?? 1,
    msg,
    user: opts?.user ?? "",
  });
}

export function emitAlert(socket: Pick<Socket, "emit">, msg: string): void {
  emitSocketCmd(socket, "alert", msg);
}

export function emitGatewayError(
  socket: Pick<Socket, "emit">,
  eventName: string,
  errorCode: string,
): void {
  emitSocketCmd(socket, "server_event_error", {
    event: eventName,
    code: errorCode,
  });
}

export function resolveContainedPath(baseDir: string, relativeUserPath: string): string | null {
  const cleaned = String(relativeUserPath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..")) {
    return null;
  }
  const baseResolved = path.resolve(baseDir);
  const target = path.resolve(baseResolved, cleaned);
  if (target !== baseResolved && !target.startsWith(baseResolved + path.sep)) {
    return null;
  }
  return target;
}

export function hasSuspiciousScriptToken(value: unknown): boolean {
  const text = String(value || "").toLowerCase();
  return (
    text.includes("<script") ||
    text.includes("javascript:") ||
    text.includes("onerror=") ||
    text.includes("onload=") ||
    text.includes("localstorage") ||
    text.includes("socket.") ||
    text.includes("eval(")
  );
}

export function sanitizePublicSnapshot(
  session: Partial<GatewaySession> | null | undefined,
): OnlineUserSnapshot | null {
  if (!session || !session.id) return null;
  return {
    id: String(session.id),
    idreg: session.idreg,
    lid: session.lid,
    uid: session.uid,
    username: session.username,
    topic: String(session.topic || ""),
    pic: String(session.pic || "pic.png"),
    pich: session.pich ? String(session.pich) : undefined,
    msg: String(session.msg || ""),
    power: String(session.power || ""),
    rank: String(session.rank || session.power || ""),
    bg: String(session.bg || "#FFFFFF"),
    gcol: String(session.gcol || "#FFFFFF"),
    ucol: String(session.ucol || "#000000"),
    mcol: String(session.mcol || "#000000"),
    stat: Number.isFinite(Number(session.stat)) ? Number(session.stat) : 0,
    offline: Boolean(session.offline),
    co: session.co && session.co !== "--" ? String(session.co) : "YE",
    ico: session.ico ? String(session.ico) : undefined,
    gift_ico: session.gift_ico ? String(session.gift_ico) : undefined,
    documents: Boolean(session.documents || session.documentationc),
    documentationc: Boolean(session.documentationc || session.documents),
    yp: session.yp ? String(session.yp) : undefined,
    them: session.them ? String(session.them) : undefined,
    cover: session.cover ? String(session.cover) : undefined,
    site_badge_id: session.site_badge_id ? String(session.site_badge_id) : "",
    site_badge: session.site_badge ?? "",
    roomid: session.roomid ?? null,
    islogin: session.islogin || "زائر",
    rep: Math.max(0, Number(session.rep || 0)),
    coin: Math.max(0, Number(session.coin ?? session.coins ?? 0)),
    coins: Math.max(0, Number(session.coins ?? session.coin ?? 0)),
    evaluation: Math.max(0, Number(session.evaluation || 0)),
    wall_post_likes: Math.max(0, Number(session.wall_post_likes || 0)),
    gifts_received_count: Math.max(0, Number(session.gifts_received_count || 0)),
    busy: Boolean(session.busy),
    alerts: Boolean(session.alerts),
    nopm: Boolean(session.nopm),
    nonot: Boolean(session.nonot),
    nopmcall: Boolean(session.nopmcall),
    nopmvideocall: Boolean(session.nopmvideocall),
    meiut: Boolean(session.ismuted || session.muted),
    muted: Boolean(session.muted || session.ismuted),
    s: session.s ?? null,
    meta_ts: Number(session.meta_ts || Date.now()),
  };
}

export function sanitizePublicRoom(room: GatewayRoomRecord, onlineCount = 0): RoomSnapshot {
  return {
    id: room.id,
    idroom: room.idroom,
    topic: room.topic,
    about: room.about,
    pic: room.pic,
    welcome: room.welcome,
    owner: room.owner,
    needpass: Boolean(room.needpass),
    broadcast: Boolean(room.broadcast),
    deleted: Boolean(room.deleted),
    color: room.color,
    max: room.max,
    rmli: room.rmli,
    mic: room.mic,
    stage_count: room.stage_count,
    stage_state: room.stage_state,
    message_mode: room.message_mode,
    room_owner_meta: room.room_owner_meta,
    onlineCount,
    live_config: (room.room_owner_meta as any)?.live_config,
    is_live_audio: Boolean((room.room_owner_meta as any)?.live_config?.is_live_audio),
    join_mode: (room.room_owner_meta as any)?.live_config?.join_mode || "free",
  };
}

export function randomTokenHex(bytes = 20): string {
  return crypto.randomBytes(bytes).toString("hex");
}
