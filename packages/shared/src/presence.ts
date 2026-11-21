import type { OnlineUserSnapshot } from "./types.js";

/**
 * Strict allowlist projection of a live presence record.
 *
 * Presence records in Redis hold the full GatewaySession, including the
 * session token, IP address and device fingerprint. Anything crossing a
 * public/egress boundary (HTTP endpoints, socket broadcasts) must go
 * through this sanitizer so credentials and network metadata never
 * reach clients.
 */
export function sanitizePublicPresenceRecord(
  record: Record<string, unknown> | null | undefined,
): OnlineUserSnapshot | null {
  if (!record || !record.id) return null;
  const str = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));
  const num = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = (v: unknown): boolean => Boolean(v);
  const optStr = (v: unknown): string | undefined => {
    const s = str(v).trim();
    return s ? s : undefined;
  };
  return {
    id: str(record.id),
    idreg: record.idreg == null ? undefined : (record.idreg as number | string),
    lid: optStr(record.lid),
    uid: optStr(record.uid),
    username: optStr(record.username),
    topic: str(record.topic),
    pic: str(record.pic) || "pic.png",
    pich: optStr(record.pich),
    msg: str(record.msg),
    power: str(record.power),
    rank: str(record.rank) || str(record.power),
    bg: str(record.bg) || "#FFFFFF",
    gcol: str(record.gcol) || "#FFFFFF",
    ucol: str(record.ucol) || "#000000",
    mcol: str(record.mcol) || "#000000",
    stat: num(record.stat),
    offline: bool(record.offline),
    co: record.co && record.co !== "--" ? str(record.co) : "YE",
    ico: optStr(record.ico),
    gift_ico: optStr(record.gift_ico),
    documents: bool(record.documents || record.documentationc),
    documentationc: bool(record.documentationc || record.documents),
    yp: optStr(record.yp),
    them: optStr(record.them),
    cover: optStr(record.cover),
    site_badge_id: record.site_badge_id == null ? undefined : str(record.site_badge_id),
    site_badge: (record.site_badge ?? "") as OnlineUserSnapshot["site_badge"],
    roomid: record.roomid == null ? null : str(record.roomid),
    islogin: str(record.islogin) || "زائر",
    rep: Math.max(0, num(record.rep)),
    coin: Math.max(0, num(record.coin ?? record.coins)),
    coins: Math.max(0, num(record.coins ?? record.coin)),
    evaluation: Math.max(0, num(record.evaluation)),
    wall_post_likes: Math.max(0, num(record.wall_post_likes)),
    gifts_received_count: Math.max(0, num(record.gifts_received_count)),
    busy: bool(record.busy),
    alerts: bool(record.alerts),
    nopm: bool(record.nopm),
    nonot: bool(record.nonot),
    nopmcall: bool(record.nopmcall),
    nopmvideocall: bool(record.nopmvideocall),
    meiut: bool(record.ismuted || record.muted),
    muted: bool(record.muted || record.ismuted),
    s: (record.s != null ? record.s : record.stealth ? 1 : null) as OnlineUserSnapshot["s"],
    meta_ts: num(record.meta_ts) || Date.now(),
  };
}
