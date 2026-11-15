import { bots, desc, eq, getDb, REDIS_KEYS, getRedis } from "@newchat/db";
import { sanitizeHtmlText, stringGen } from "@newchat/shared";
import type { Server } from "socket.io";
import type { PresenceDirectory } from "./presenceDirectory.js";
import type { CatalogStore } from "./catalogStore.js";
import type { GatewaySession } from "../types/gateway.js";

interface BotTimerHandles {
  initial: NodeJS.Timeout;
  repeat: NodeJS.Timeout | null;
}

export class TalkingBotCoordinator {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly presenceDirectory: PresenceDirectory;
  private talkActive = false;
  private talkMessage = "منورين";
  private talkIntervalMs = 5000;
  private readonly botTimers = new Map<string, BotTimerHandles>();

  constructor(io: Server, catalogStore: CatalogStore, presenceDirectory: PresenceDirectory) {
    this.io = io;
    this.catalogStore = catalogStore;
    this.presenceDirectory = presenceDirectory;
  }

  buildBotSession(row: typeof bots.$inferSelect): GatewaySession {
    const room = row.room || this.catalogStore.getDefaultRoomId();
    const id = String(row.id || `bot_${row.idreg}`);
    return {
      id,
      idreg: row.idreg,
      lid: `bot_${id}`,
      uid: id,
      username: id,
      topic: String(row.topic || "بوت"),
      pic: String(row.pic || "pic.png"),
      pich: "pich.png",
      msg: String(row.msg || "(عضو جديد)"),
      power: String(row.power || ""),
      rank: String(row.power || ""),
      bg: "#FFFFFF",
      gcol: "#FFFFFF",
      ucol: "#000000",
      mcol: "#000000",
      stat: Number(row.stat ?? 0),
      offline: false,
      co: String(row.country || "sa"),
      ico: "",
      gift_ico: "",
      documents: false,
      documentationc: false,
      yp: "",
      them: "",
      cover: "",
      site_badge_id: "",
      site_badge: "",
      roomid: room || null,
      islogin: "بوت",
      rep: 0,
      coin: 0,
      coins: 0,
      evaluation: 0,
      wall_post_likes: 0,
      gifts_received_count: 0,
      busy: false,
      alerts: false,
      nopm: false,
      nonot: false,
      nopmcall: false,
      nopmvideocall: false,
      token: "",
      ip: String(row.ip || "127.0.0.1"),
      fp: `bot_${id}`,
      location: String(row.country || "sa"),
      refr: "bot",
      joinedAt: Date.now(),
      joinuser: Date.now(),
      last_eval_login_day: "",
      auto_power: "",
      eval_awards: {},
      loginG: false,
      stealth: false,
      muted: false,
      ismuted: false,
      meta_ts: Date.now(),
    };
  }

  async enterBot(botId: string): Promise<boolean> {
    const { db } = getDb();
    const rows = await db.select().from(bots).where(eq(bots.id, botId)).limit(1);
    const bot = rows[0];
    if (!bot) return false;
    const sess = this.buildBotSession(bot);
    await this.presenceDirectory.registerSession(null, sess);
    return true;
  }

  async exitBot(botId: string): Promise<boolean> {
    const removed = await this.presenceDirectory.removeSession(botId, { emitLeave: true });
    return Boolean(removed);
  }

  async enterAllBots(): Promise<number> {
    const { db } = getDb();
    const rows = await db.select().from(bots);
    let entered = 0;
    for (const row of rows) {
      if (!row.id) continue;
      const existing = await this.presenceDirectory.getDistributedSession(row.id);
      if (existing) continue;
      const sess = this.buildBotSession(row);
      await this.presenceDirectory.registerSession(null, sess);
      entered += 1;
    }
    return entered;
  }

  async exitAllBots(): Promise<number> {
    const { db } = getDb();
    const rows = await db.select().from(bots);
    let exited = 0;
    for (const row of rows) {
      if (!row.id) continue;
      const removed = await this.presenceDirectory.removeSession(row.id, { emitLeave: true });
      if (removed) exited += 1;
    }
    try {
      await getRedis().del(REDIS_KEYS.presenceVirtual);
    } catch {
      // ignore
    }
    return exited;
  }

  async seedTalkingBots(params: {
    count?: number;
    prefix?: string;
    room?: string;
    country?: string;
    message?: string;
    power?: string;
  }): Promise<number> {
    const count = Math.max(1, Math.min(200, Number(params.count || 100)));
    const prefix = String(params.prefix || "صادق").trim();
    const room = String(params.room || this.catalogStore.getDefaultRoomId()).trim();
    const country = String(params.country || "kw").trim();
    const message = String(params.message || "مرحبا بكم").trim();
    const power = String(params.power || "").trim();

    const { db } = getDb();
    const values: Array<typeof bots.$inferInsert> = [];
    for (let i = 1; i <= count; i += 1) {
      const id = `bot_${stringGen(14)}`;
      values.push({
        id,
        topic: `${prefix} ${i}`,
        msg: message,
        pic: "pic.png",
        power,
        country,
        room,
        ip: `10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
        stat: 0,
      });
    }
    await db.insert(bots).values(values);
    return values.length;
  }

  sendBotRoomMessage(botSession: GatewaySession, text: string): void {
    const roomId = botSession.roomid || this.catalogStore.getDefaultRoomId();
    const limit = this.catalogStore.getLimits().lengthMsgRoom;
    const safeMsg = this.catalogStore.replaceShortcuts(sanitizeHtmlText(text.slice(0, limit)));
    this.io.to(roomId).emit("msg", {
      cmd: "msg",
      data: {
        bg: botSession.bg,
        mi: stringGen(12),
        mcol: botSession.mcol,
        uid: botSession.id,
        msg: safeMsg,
        pic: botSession.pic,
        topic: sanitizeHtmlText(botSession.topic),
        ucol: botSession.ucol,
        roomid: roomId,
        time: Date.now(),
      },
    });
  }

  async startTalkLoop(messageText?: string, intervalMs?: number): Promise<void> {
    this.stopTalkLoop();
    this.talkActive = true;
    this.talkMessage = String(messageText || "منورين").trim() || "منورين";
    this.talkIntervalMs = Math.max(1500, Number(intervalMs || 5000) || 5000);

    const { db } = getDb();
    const rows = await db.select().from(bots).orderBy(desc(bots.idreg)).limit(200);
    if (!this.talkActive || !rows.length) return;

    rows.forEach((row, index) => {
      if (!row.id) return;
      const botSession = this.buildBotSession(row);
      const handles: BotTimerHandles = {
        initial: setTimeout(() => {
          if (!this.talkActive) return;
          this.sendBotRoomMessage(botSession, this.talkMessage);
          handles.repeat = setInterval(() => {
            if (!this.talkActive) return;
            this.sendBotRoomMessage(botSession, this.talkMessage);
          }, this.talkIntervalMs);
          if (typeof handles.repeat.unref === "function") handles.repeat.unref();
        }, index * 1000),
        repeat: null,
      };
      if (typeof handles.initial.unref === "function") handles.initial.unref();
      this.botTimers.set(row.id, handles);
    });
  }

  stopTalkLoop(): void {
    this.talkActive = false;
    for (const handles of this.botTimers.values()) {
      clearTimeout(handles.initial);
      if (handles.repeat) clearInterval(handles.repeat);
    }
    this.botTimers.clear();
  }
}
