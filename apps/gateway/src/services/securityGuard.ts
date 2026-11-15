import {
  COUNTRY_VPN_LIST,
  BROWSER_LIST,
  PLATFORM_LIST,
  sanitizeHtmlText,
} from "@newchat/shared";
import {
  band,
  getDb,
  getRedis,
  histletter,
  logs,
  names,
  owner,
  REDIS_KEYS,
  sql,
  stats,
  takeRedisRateSlot,
  eq,
} from "@newchat/db";
import type { Server, Socket } from "socket.io";
import { gatewayConfig } from "../config.js";
import { emitNotice, safeJsonParse } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { BanRuleRow, GatewaySession } from "../types/gateway.js";

export interface BanCheckResult {
  blocked: boolean;
  reason?: string;
  matchedRule?: BanRuleRow;
}

export class SecurityGuard {
  private readonly catalogStore: CatalogStore;
  private getSessionFn?: (socketId: string) => GatewaySession | undefined;
  private findStaffByPowerFn?: () => GatewaySession[];

  constructor(catalogStore: CatalogStore) {
    this.catalogStore = catalogStore;
  }

  bindPresenceCallbacks(opts: {
    getSession: (socketId: string) => GatewaySession | undefined;
    findStaffWithBootEdit: () => GatewaySession[];
  }): void {
    this.getSessionFn = opts.getSession;
    this.findStaffByPowerFn = opts.findStaffWithBootEdit;
  }

  async consumeRateSlot(
    bucket: string,
    limit: number,
    windowMs: number,
  ): Promise<{ ok: boolean; retryAfterMs: number }> {
    const res = await takeRedisRateSlot(bucket, limit, windowMs).catch(() => ({
      ok: true,
      retryAfterMs: 0,
    }));
    return { ok: res.ok, retryAfterMs: res.retryAfterMs };
  }

  async isIpDdosBlocked(ip: string): Promise<boolean> {
    if (!gatewayConfig.ddosEnabled || !ip) return false;
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

  async checkSocketFlood(socketId: string, ip: string): Promise<boolean> {
    if (!gatewayConfig.ddosEnabled) return true;
    if (await this.isIpDdosBlocked(ip)) return false;

    const bucket = `gw:msg:${ip}:${socketId}`;
    const res = await this.consumeRateSlot(
      bucket,
      gatewayConfig.ddosSocketLimit,
      gatewayConfig.ddosWindowMs,
    );
    return res.ok;
  }

  validateClientEnvironment(plt: string, browser: string): { valid: boolean; reason?: string } {
    const cleanBrowser = browser.toLowerCase().replace(/^mobile\s+/, "").trim();
    const cleanPlt = plt.toLowerCase().trim();

    if (!BROWSER_LIST.some((b) => b.toLowerCase() === cleanBrowser)) {
      return { valid: false, reason: "الرجاء المحاولة بمتصفح أخر" };
    }
    if (!PLATFORM_LIST.some((p) => p.toLowerCase() === cleanPlt)) {
      return { valid: false, reason: "الرجاء المحاولة بنظام تشغيل أخر" };
    }
    if (this.catalogStore.isBrowserBlocked(browser)) {
      return { valid: false, reason: `${browser} هذا المتصفح محظور في هذا التطبيق` };
    }
    if (this.catalogStore.isSystemBlocked(plt)) {
      return { valid: false, reason: `${plt} نظامك محظور في هذا التطبيق` };
    }
    return { valid: true };
  }

  checkBan(params: {
    ip: string;
    fp: string;
    countryCode: string;
    username?: string;
    topic?: string;
  }): BanCheckResult {
    const rules = this.catalogStore.getBanRules();
    const ip = String(params.ip || "").trim();
    const fp = String(params.fp || "").trim();
    const country = String(params.countryCode || "").trim().toUpperCase();

    for (const rule of rules) {
      if (rule.device_band && fp && rule.device_band === fp) {
        return { blocked: true, reason: "جهاز", matchedRule: rule };
      }
      if (rule.ip_band && ip) {
        if (rule.ip_band === ip || (rule.ip_band.endsWith("*") && ip.startsWith(rule.ip_band.slice(0, -1)))) {
          return { blocked: true, reason: "اي بي", matchedRule: rule };
        }
      }
      if (rule.country_band && country && country !== "--" && rule.country_band.toUpperCase() === country) {
        return { blocked: true, reason: "دولة", matchedRule: rule };
      }
      if (rule.decoderDans && params.username && rule.decoderDans === params.username) {
        return { blocked: true, reason: "عضوية", matchedRule: rule };
      }
    }

    if (
      this.catalogStore.getOwnerState().vpn &&
      country &&
      country !== "--" &&
      COUNTRY_VPN_LIST.includes(country)
    ) {
      return { blocked: true, reason: "VPN" };
    }

    return { blocked: false };
  }

  async addBanRule(params: {
    actorTopic: string;
    ip: string;
    fp: string;
    targetName: string;
    reason: string;
    countryCode?: string;
    dateLabel?: string;
  }): Promise<void> {
    try {
      const { db } = getDb();
      await db.insert(band).values({
        name_band: params.actorTopic.slice(0, 250),
        type: params.reason.slice(0, 250),
        deccode: params.targetName.slice(0, 250),
        decoderDans: params.targetName.slice(0, 250),
        device_band: params.fp.slice(0, 250),
        ip_band: params.ip.slice(0, 250),
        country_band: (params.countryCode || "").slice(0, 2),
        date: params.dateLabel || String(Date.now()),
      });
      await this.catalogStore.refreshScopes(["bans"]);
    } catch (err) {
      console.error("[SecurityGuard] addBanRule failed:", err);
    }
  }

  async recordLoginAttempt(entry: {
    state: string;
    topic: string;
    username: string;
    ip: string;
    code: string;
    device: string;
    isin: string;
  }): Promise<void> {
    try {
      const { db } = getDb();
      await db.insert(logs).values({
        state: entry.state.slice(0, 250),
        topic: entry.topic.slice(0, 250),
        username: entry.username.slice(0, 250),
        ip: entry.ip.slice(0, 250),
        code: entry.code.slice(0, 250),
        device: entry.device.slice(0, 250),
        isin: entry.isin.slice(0, 250),
        time: String(Date.now()),
      });
    } catch {
      // non-fatal audit log
    }
  }

  async recordAlias(entry: {
    iduser: string;
    fp: string;
    ip: string;
    topic: string;
    username: string;
  }): Promise<void> {
    try {
      const { db } = getDb();
      await db.insert(names).values({
        iduser: entry.iduser.slice(0, 250),
        fp: entry.fp.slice(0, 250),
        ip: entry.ip.slice(0, 250),
        topic: entry.topic.slice(0, 250),
        username: entry.username.slice(0, 250),
      });
    } catch {
      // non-fatal audit
    }
  }

  async recordModerationStat(entry: {
    state: string;
    topic?: string;
    targetTopic?: string;
    room?: string;
    ip?: string;
  }): Promise<void> {
    try {
      const { db } = getDb();
      await db.insert(stats).values({
        state: String(entry.state || "").slice(0, 250),
        topic: String(entry.topic || "").slice(0, 250),
        username: String(entry.targetTopic || "").slice(0, 250),
        room: String(entry.room || "").slice(0, 250),
        ip: String(entry.ip || "").slice(0, 250),
        time: String(Date.now()),
      });

      await db.execute(sql`
        DELETE FROM stats
        WHERE id < (
          SELECT id FROM stats ORDER BY id DESC LIMIT 1 OFFSET 500
        )
      `);
    } catch {
      // non-fatal
    }
  }

  async recordGuestDevice(fp: string): Promise<void> {
    if (!fp) return;
    try {
      const { db } = getDb();
      const rows = await db.select().from(owner).where(eq(owner.id, 1)).limit(1);
      const row = rows[0];
      if (!row) return;
      const list = safeJsonParse<string[]>(row.Gust, []);
      if (!list.includes(fp)) {
        list.push(fp);
        await db.update(owner).set({ Gust: JSON.stringify(list.slice(-2000)) }).where(eq(owner.id, 1));
      }
    } catch {
      // ignore
    }
  }

  async scanAndLogProhibitedText(
    io: Server,
    socket: Socket,
    text: string,
    meta: { source: string; target?: string },
  ): Promise<{ flagged: boolean; actionPath?: string }> {
    const session = this.getSessionFn?.(socket.id);
    if (!session || !text) return { flagged: false };

    const hit = this.catalogStore.scanProhibitedWords(text);
    if (!hit) return { flagged: false };

    const actionPath = String(hit.rule.path || "");
    const safeMsg = sanitizeHtmlText(text.slice(0, this.catalogStore.getLimits().lengthMsgRoom));

    if (actionPath === "bmsgs" || actionPath === "wmsgs") {
      const stateLabel = actionPath === "bmsgs" ? "ممنوعة" : "مراقبة";
      if (this.findStaffByPowerFn) {
        const staffSockets = this.findStaffByPowerFn();
        for (const staff of staffSockets) {
          io.to(staff.id).emit("msg", {
            cmd: "not",
            data: {
              topic: stateLabel,
              force: 1,
              msg: this.catalogStore.replaceShortcuts(safeMsg),
              user: socket.id,
            },
          });
        }
      }

      try {
        const { db } = getDb();
        await db.insert(histletter).values({
          ip: session.ip,
          msg: safeMsg.slice(0, 250),
          topic: (session.topic || session.username).slice(0, 250),
          v: String(hit.matchedWord || "").slice(0, 250),
          path: actionPath.slice(0, 250),
          source: meta.source.slice(0, 250),
          target: (meta.target || "").slice(0, 250),
          time: String(Date.now()),
        });

        await db.execute(sql`
          DELETE FROM histletter
          WHERE id < (
            SELECT id FROM histletter ORDER BY id DESC LIMIT 1 OFFSET 35
          )
        `);
      } catch {
        // non-fatal
      }
    }

    return { flagged: true, actionPath };
  }

  async autoBanFlooder(io: Server, socket: Socket, session: GatewaySession): Promise<void> {
    if (session.kicked) return;
    session.kicked = true;
    await this.addBanRule({
      actorTopic: "النظام",
      ip: session.ip,
      fp: session.fp,
      targetName: session.username || session.topic,
      reason: "التخريب",
    });

    emitNotice(socket, "تم حظرك من الدردشة");
    if (session.roomid) {
      io.to(session.roomid).emit("msg", {
        cmd: "msg",
        data: {
          bg: "none",
          class: "hmsg",
          topic: sanitizeHtmlText(session.topic),
          msg: "( الحظر الألي )",
          roomid: session.roomid,
          pic: session.pic,
          uid: "",
          actionType: "auto_ban",
        },
      });
    }
    socket.emit("msg", { cmd: "kicked", data: { reason: "التخريب" } });
    setTimeout(() => {
      socket.disconnect(true);
    }, 350);
  }
}
