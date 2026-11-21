import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  cuts,
  desc,
  eq,
  getDb,
  resolveLiveKitRuntimeConfig,
  rooms,
  storie,
  storieview,
  top10wall,
  users,
} from "@newchat/db";
import {
  DEFAULT_RTC_ICE_SERVERS,
  LOGIN_ONLINE_PREVIEW_LIMIT,
  normalizeGiftCategories,
  normalizeGiftsGit,
  normalizeMicProviderSetting,
  normalizeRoomBadgesCatalog,
  normalizeRoomMessageMode,
  normalizeSiteBadgesCatalog,
  normalizeSiteSettingShape,
  parseRoomOwnerMeta,
  filterActiveStorySlides,
  sortOnlineSnapshots,
  type OnlineUserSnapshot,
} from "@newchat/shared";
import { apiConfig } from "../config.js";
import {
  getEntrySlides,
  getHostSettingRow,
  getOnlineUserCount,
  getOnlineUsersSnapshotList,
  getOwnerRow,
  getPowersList,
  getRedisJsonCached,
  getRoomCountsMap,
  getSiteRow,
  safeJsonParse,
} from "../lib/runtime.js";

const DEFAULT_SITE_SCRIPT_JSON = {
  settscr: "",
  setthead: "",
  settdescription:
    "شات سفاري هوست - أفضل دردشة عربية كتابية وصوتية، تواصل مع أصدقاء جدد من جميع أنحاء الوطن العربي في غرف دردشة آمنة وممتعة.",
  settkeywords: "شات, دردشة, سفاري هوست, شات عربي, دردشة صوتية, تعارف, أصدقاء عربي, شات الجوال",
  name: "شات سفاري هوست",
  title: "شات سفاري هوست",
};

function readSiteScriptFile(scriptNameRaw: unknown): Record<string, unknown> {
  const safeName = path.basename(String(scriptNameRaw || "").trim());
  if (!safeName) {
    return { ...DEFAULT_SITE_SCRIPT_JSON };
  }
  const uploadRoot = path.resolve(apiConfig.uploadDir);
  const fullPath = path.resolve(uploadRoot, safeName);
  if (!fullPath.startsWith(uploadRoot + path.sep) || !fs.existsSync(fullPath)) {
    return { ...DEFAULT_SITE_SCRIPT_JSON };
  }
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
    return { ...DEFAULT_SITE_SCRIPT_JSON, ...parsed };
  } catch {
    return { ...DEFAULT_SITE_SCRIPT_JSON };
  }
}

function getOptimizedVisualPath(fileNameRaw: unknown, kind: "logo" | "banner", format: "jpg" | "webp"): string {
  const base = path.basename(String(fileNameRaw || "").trim());
  if (!base) return "";
  const ext = path.extname(base).toLowerCase();
  if (![".gif", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return `/site/${base}`;
  }
  return `/site/${base}.${kind}.${format}`;
}

async function readRoomsSnapshot() {
  const cachedRooms = await getRedisJsonCached("newchat:cache:rooms", 10, async () => {
    const { db } = getDb();
    const list = await db.select().from(rooms);
    return list.map((r) => ({
      id: r.id || String(r.idroom),
      idroom: r.idroom,
      topic: r.topic || "غرفة عامة",
      about: r.about || "",
      pic: r.pic || "pic.png",
      welcome: r.welcome || "",
      owner: r.owner || "#1",
      needpass: Boolean(r.needpass),
      broadcast: Boolean(r.broadcast),
      deleted: Boolean(r.deleted),
      delete: Boolean(r.deleted),
      color: r.color || "#000000",
      max: r.max ?? 0,
      rmli: r.rmli ?? 0,
      mic: r.mic ?? 0,
      stage_count: r.stage_count ?? 5,
      stage_state: safeJsonParse<Record<string, unknown>>(r.stage_state, {}),
      message_mode: normalizeRoomMessageMode(r.message_mode),
      room_owner_meta: parseRoomOwnerMeta(r.room_owner_meta),
    }));
  });

  const roomsCounts = await getRoomCountsMap();
  return { rooms: cachedRooms, roomsCounts };
}

async function readBootstrapStaticConfig(hostname: string) {
  const hostClean = String(hostname || "").trim().toLowerCase() || "default";
  return getRedisJsonCached(`newchat:cache:bootstrap:${hostClean}`, 15, async () => {
    const hostSetting = await getHostSettingRow(hostname);
    const settingId = Number(hostSetting?.id || 1);
    const [siteRow, ownerRow, cutRows] = await Promise.all([
      getSiteRow(settingId),
      getOwnerRow(),
      getDb()
        .db.select({ text1: cuts.text1, text2: cuts.text2 })
        .from(cuts)
        .limit(500),
    ]);

    const rawSiteJson = safeJsonParse<Record<string, unknown>>(hostSetting?.site, {});
    const siteSettings = normalizeSiteSettingShape(rawSiteJson);
    const liveKitRuntime = resolveLiveKitRuntimeConfig(rawSiteJson, {
      wsUrl: apiConfig.livekitWsUrl,
      apiKey: apiConfig.livekitApiKey,
      apiSecret: apiConfig.livekitApiSecret,
      nodeEnv: apiConfig.nodeEnv,
    });
    const scriptObj = readSiteScriptFile(siteSettings.siteScript);
    const walllikes = safeJsonParse<Record<string, unknown>>(siteSettings.walllikes, {});
    const giftsGit = normalizeGiftsGit(hostSetting?.gifts_git);
    const giftCategories = normalizeGiftCategories(hostSetting?.gift_categories, giftsGit);
    const roomBadges = normalizeRoomBadgesCatalog(hostSetting?.room_badges);
    const siteBadges = normalizeSiteBadgesCatalog(hostSetting?.site_badges);
    const sicos = safeJsonParse<string[]>(hostSetting?.sico, []);
    const dro3 = safeJsonParse<string[]>(hostSetting?.dro3, []);
    const emos = safeJsonParse<string[]>(hostSetting?.emo, []);
    const them = safeJsonParse<string[]>(hostSetting?.them, []);
    const cover = safeJsonParse<string[]>(hostSetting?.cover, []);

    const bannerFile = String(siteRow?.banner || "banner.png").trim() || "banner.png";
    const logoFile = String(siteRow?.logo || "logo.png").trim() || "logo.png";

    return {
      site: {
        settingId,
        name: String(scriptObj.name || DEFAULT_SITE_SCRIPT_JSON.name),
        title: String(scriptObj.title || scriptObj.name || DEFAULT_SITE_SCRIPT_JSON.title),
        description: String(scriptObj.settdescription || DEFAULT_SITE_SCRIPT_JSON.settdescription),
        keywords: String(scriptObj.settkeywords || DEFAULT_SITE_SCRIPT_JSON.settkeywords),
        head: String(scriptObj.setthead || ""),
        script: String(scriptObj.settscr || ""),
        banner: `/site/${bannerFile}`,
        bannerOptimized: getOptimizedVisualPath(bannerFile, "banner", "jpg"),
        bannerWebp: getOptimizedVisualPath(bannerFile, "banner", "webp"),
        logo: `/site/${logoFile}`,
        logoOptimized: getOptimizedVisualPath(logoFile, "logo", "jpg"),
        logoWebp: getOptimizedVisualPath(logoFile, "logo", "webp"),
        allowg: siteSettings.allowg !== false,
        allowreg: siteSettings.allowreg !== false,
        micProvider: normalizeMicProviderSetting(siteSettings.micprovider),
        roomMessageTheme: siteSettings.roomMessageTheme,
        evaluationAwards: siteSettings.evaluation_awards,
        colors: {
          hicolor: String(siteSettings.background || "FFF6F0"),
          bgcolor: String(siteSettings.bg || "0A6E8C"),
          btcolor: String(siteSettings.buttons || "203D69"),
        },
        walllikes,
        wallminutes: Number(siteSettings.wallminutes ?? 0) || 0,
        bclikes: Number(siteSettings.bclikes ?? 10) || 10,
        msgst: Number(siteSettings.msgst ?? 5) || 5,
        pmlikes: Number(siteSettings.pmlikes ?? 2000) || 2000,
        miclikes: Number(siteSettings.miclikes ?? 5000) || 5000,
        notlikes: Number(siteSettings.notlikes ?? 7000) || 7000,
        fileslikes: Number(siteSettings.fileslikes ?? 90000) || 90000,
        ifbanner: Boolean(ownerRow?.isbanner),
        radio: String(ownerRow?.Tv || ""),
        tv: String(ownerRow?.Tv || ""),
        bars: ownerRow?.bars !== false,
        offline: Boolean(ownerRow?.offline),
        rc: ownerRow?.rc !== false,
        cooment: Boolean(ownerRow?.cooment),
        vpn: Boolean(ownerRow?.Vpn),
        maxRep: Number(ownerRow?.MaxRep ?? 3) || 3,
        defaultRoom: String(ownerRow?.room || ""),
        entrySlides: getEntrySlides(),
        sicos: Array.isArray(sicos) ? sicos : [],
        dro3: Array.isArray(dro3) ? dro3 : [],
        emos: Array.isArray(emos) ? emos : [],
        them: Array.isArray(them) ? them : [],
        cover: Array.isArray(cover) ? cover : [],
        roomBadges,
        siteBadges,
        giftsGit,
        giftCategories,
        liveKitWsUrl: liveKitRuntime.wsUrl || "",
        rtcIceServers: DEFAULT_RTC_ICE_SERVERS,
      },
      shortcuts: cutRows.map((c) => ({
        text1: String(c.text1 || ""),
        text2: String(c.text2 || ""),
      })),
    };
  });
}

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/getonline", async (_req, reply) => {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    try {
      const [onlineAll, onlineCount, powersList] = await Promise.all([
        getOnlineUsersSnapshotList(),
        getOnlineUserCount(),
        getPowersList(),
      ]);
      const visibleOnline = sortOnlineSnapshots(
        onlineAll.filter((u) => !u.s) as unknown as OnlineUserSnapshot[],
        powersList,
      ).slice(0, LOGIN_ONLINE_PREVIEW_LIMIT);
      return {
        powers: powersList,
        online: visibleOnline,
        onlineCount,
        ts: Date.now(),
      };
    } catch {
      return reply.code(500).send({ powers: [], online: [], onlineCount: 0, err: true });
    }
  });

  app.get("/bootstrap", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const [onlineAll, onlineCount, powersList, roomsSnap, staticBoot] = await Promise.all([
        getOnlineUsersSnapshotList(),
        getOnlineUserCount(),
        getPowersList(),
        readRoomsSnapshot(),
        readBootstrapStaticConfig(req.hostname),
      ]);
      const visibleOnline = sortOnlineSnapshots(
        onlineAll.filter((u) => !u.s) as unknown as OnlineUserSnapshot[],
        powersList,
      ).slice(0, LOGIN_ONLINE_PREVIEW_LIMIT);

      return {
        onlineCount,
        online: visibleOnline,
        powers: powersList,
        rooms: roomsSnap.rooms,
        roomsCounts: roomsSnap.roomsCounts,
        shortcuts: staticBoot.shortcuts,
        site: staticBoot.site,
        ts: Date.now(),
      };
    } catch {
      return {
        onlineCount: 0,
        online: [],
        powers: [],
        rooms: [],
        roomsCounts: {},
        shortcuts: [],
        site: null,
        ts: Date.now(),
      };
    }
  });

  app.get("/rooms", async () => {
    const { rooms: roomList, roomsCounts } = await readRoomsSnapshot();
    return { err: false, rooms: roomList, roomsCounts };
  });

  app.get("/micprovider.nd", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const row = await getHostSettingRow(req.hostname);
      const siteData = safeJsonParse<Record<string, unknown>>(row?.site, {});
      return { micProvider: normalizeMicProviderSetting(siteData.micprovider) };
    } catch {
      return { micProvider: "LIVEKIT" };
    }
  });

  app.get("/room_badges", async (req) => {
    try {
      const row = await getHostSettingRow(req.hostname);
      return { err: false, data: normalizeRoomBadgesCatalog(row?.room_badges) };
    } catch {
      return { err: true, data: [] };
    }
  });

  app.get("/site_badges", async (req) => {
    try {
      const row = await getHostSettingRow(req.hostname);
      return { err: false, data: normalizeSiteBadgesCatalog(row?.site_badges) };
    } catch {
      return { err: true, data: [] };
    }
  });

  app.get("/top10", async () => {
    return getRedisJsonCached("newchat:api:top10", 60, async () => {
      const { db } = getDb();
      return db
        .select({
          idreg: users.idreg,
          uid: users.uid,
          lid: users.lid,
          topic: users.topic,
          pic: users.pic,
          rep: users.rep,
          evaluation: users.evaluation,
          ico: users.ico,
          power: users.power,
          bg: users.bg,
          ucol: users.ucol,
        })
        .from(users)
        .orderBy(desc(users.evaluation), desc(users.rep))
        .limit(10);
    });
  });

  app.get("/top10wall", async () => {
    return getRedisJsonCached("newchat:api:top10wall", 60, async () => {
      const { db } = getDb();
      return db.select().from(top10wall).orderBy(desc(top10wall.id)).limit(50);
    });
  });

  app.get("/top10walld", async (req) => {
    const query = req.query as { lid?: string };
    const lid = String(query.lid || "").trim();
    if (!lid) return [];
    const { db } = getDb();
    return db.select().from(top10wall).where(eq(top10wall.uid, lid)).limit(50);
  });

  app.get("/storieswall", async () => {
    return getRedisJsonCached("newchat:api:storieswall", 20, async () => {
      const { db } = getDb();
      const rows = await db.select().from(storie).orderBy(desc(storie.id));
      return rows
        .flatMap((row) => {
          const items = safeJsonParse<Array<Record<string, unknown>>>(row.item, []);
          const baseItems =
            items.length > 0
              ? items
              : row.link
                ? [{ id: `legacy_${row.id}`, type: "image", src: String(row.link), length: 6, time: row.lastUpdated }]
                : [];
          const activeItems = filterActiveStorySlides(baseItems, row.lastUpdated);
          if (activeItems.length === 0) return [];
          return [
            {
              ...row,
              item: JSON.stringify(activeItems),
            },
          ];
        })
        .slice(0, 50);
    });
  });

  app.get("/stor10", async () => {
    return getRedisJsonCached("newchat:api:stor10", 30, async () => {
      const { db } = getDb();
      return db.select().from(storieview).orderBy(desc(storieview.id)).limit(10);
    });
  });
}
