import {
  band,
  bsb,
  cuts,
  desc,
  getDb,
  getRedis,
  hosts,
  intromsg,
  notext,
  owner,
  powers,
  REDIS_KEYS,
  rooms,
  settings,
  site,
  type CatalogScope,
} from "@newchat/db";
import {
  EktisarReplacer,
  compileEktisarRules,
  getPowerDefinitionByName,
  matchesProhibitedWord,
  normalizeGiftCategories,
  normalizeGiftsGit,
  normalizeRoomBadgesCatalog,
  normalizeRoomMessageMode,
  normalizeShowPowers,
  normalizeSiteBadgesCatalog,
  normalizeSiteSettingShape,
  parseRoomOwnerMeta,
  type GiftDefinition,
  type PowerRole,
  type RoomBadge,
  type SiteBadge,
  type SiteSettingShape,
} from "@newchat/shared";
import { gatewayConfig } from "../config.js";
import { safeJsonParse } from "../lib/socketUtils.js";
import { FilterService, getFilterService } from "./filterService.js";
import { ShortcutService, getShortcutService } from "./shortcutService.js";
import type {
  BanRuleRow,
  GatewayOwnerState,
  GatewayRoomRecord,
  ProhibitedWordRule,
  WallLimitsConfig,
} from "../types/gateway.js";

const DEFAULT_WALL_LIMITS: WallLimitsConfig = {
  lengthMsgRoom: 1000,
  lengthMsgBar: 1000,
  lengthMsgPm: 250,
  lengthUserReg: 35,
  likeTopicEdit: 0,
  likeUpPic: 0,
  bclikes: 0,
  pmlikes: 0,
  miclikes: 0,
  fileslikes: 0,
  wallminutes: 0,
  allowreg: true,
  evaluationAutoPromotionEnabled: true,
  welcomeMessage: "",
};

export interface IntroWelcomeRow {
  id: number;
  category: string;
  adresse: string;
  msg: string;
}

export class CatalogStore {
  private powersList: PowerRole[] = normalizeShowPowers([]);
  private roomsMap = new Map<string, GatewayRoomRecord>();
  private roomsList: GatewayRoomRecord[] = [];
  private siteSetting: SiteSettingShape = normalizeSiteSettingShape({});
  private wallLimits: WallLimitsConfig = { ...DEFAULT_WALL_LIMITS };
  private giftsList: GiftDefinition[] = [];
  private giftsByFile = new Map<string, GiftDefinition>();
  private giftCategories: string[] = ["افتراضي"];
  private emos: unknown[] = [];
  private sicos: string[] = [];
  private dro3s: string[] = [];
  private themes: string[] = [];
  private covers: string[] = [];
  private roomBadges: RoomBadge[] = [];
  private siteBadges: SiteBadge[] = [];
  private ownerState: GatewayOwnerState = {
    bars: true,
    offline: false,
    cooment: false,
    isbanner: false,
    rc: true,
    vpn: false,
    tv: "",
    maxRep: 3,
    room: gatewayConfig.defaultRoomId,
    datafinish: Date.now() + 365 * 24 * 60 * 60 * 1000,
    updatedAt: 0,
    guestList: [],
    visitorList: [],
  };
  private siteBanner = "";
  private siteLogo = "";
  private hostMap = new Map<string, number>();
  private banRules: BanRuleRow[] = [];
  private prohibitedWords: ProhibitedWordRule[] = [];
  private bannedSystems = new Set<string>();
  private bannedBrowsers = new Set<string>();
  private ektisarReplacer = new EktisarReplacer(1000);
  private filterService: FilterService = getFilterService();
  private shortcutService: ShortcutService = getShortcutService();
  private introMessages: IntroWelcomeRow[] = [];
  private initialized = false;

  isInitialized(): boolean {
    return this.initialized;
  }

  getFilterService(): FilterService {
    return this.filterService;
  }

  getShortcutService(): ShortcutService {
    return this.shortcutService;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.refreshScopes(["all"]);
    this.initialized = true;
  }

  async refreshScopes(scopes: readonly CatalogScope[]): Promise<void> {
    const scopeSet = new Set(scopes);
    const all = scopeSet.has("all");
    const tasks: Array<Promise<void>> = [];

    if (all || scopeSet.has("powers")) tasks.push(this.loadPowers());
    if (all || scopeSet.has("rooms")) tasks.push(this.loadRooms());
    if (all || scopeSet.has("settings") || scopeSet.has("gifts") || scopeSet.has("site")) {
      tasks.push(this.loadSettingsAndSite());
    }
    if (all || scopeSet.has("owner")) tasks.push(this.loadOwner());
    if (all || scopeSet.has("hosts")) tasks.push(this.loadHosts());
    if (all || scopeSet.has("cuts")) tasks.push(this.loadCuts());
    if (all || scopeSet.has("notext")) tasks.push(this.loadNotext());
    if (all || scopeSet.has("bans")) tasks.push(this.loadBans());
    if (all || scopeSet.has("bsb")) tasks.push(this.loadBsb());
    if (all) tasks.push(this.loadIntroMessages());

    await Promise.all(tasks);
  }

  private async loadPowers(): Promise<void> {
    try {
      const { db } = getDb();
      const rows = await db.select().from(powers).limit(1);
      this.powersList = normalizeShowPowers(rows[0]?.powers);
    } catch {
      this.powersList = normalizeShowPowers([]);
    }
  }

  private async loadRooms(): Promise<void> {
    try {
      const { db } = getDb();
      const rows = await db.select().from(rooms);
      const nextMap = new Map<string, GatewayRoomRecord>();
      const nextList: GatewayRoomRecord[] = [];
      for (const r of rows) {
        const roomId = String(r.id || r.idroom);
        const mapped: GatewayRoomRecord = {
          id: roomId,
          idroom: r.idroom,
          topic: r.topic || "الغرفة العامة",
          about: r.about || "",
          pic: r.pic || "pic.png",
          welcome: r.welcome || "",
          owner: r.owner || "#1",
          needpass: Boolean(r.needpass),
          broadcast: Boolean(r.broadcast),
          deleted: Boolean(r.deleted),
          color: r.color || "#000000",
          max: Math.max(0, Number(r.max ?? 0)),
          rmli: Math.max(0, Number(r.rmli ?? 0)),
          mic: Math.max(0, Number(r.mic ?? 5)),
          stage_count: Math.max(0, Number(r.stage_count ?? r.mic ?? 5)),
          stage_state: safeJsonParse<Record<string, unknown>>(r.stage_state, {}),
          message_mode: normalizeRoomMessageMode(r.message_mode),
          room_owner_meta: parseRoomOwnerMeta(r.room_owner_meta),
          pass: r.pass || "",
          user: r.user || "",
        };
        nextMap.set(roomId, mapped);
        nextList.push(mapped);
      }
      this.roomsMap = nextMap;
      this.roomsList = nextList;
    } catch (err) {
      console.error("[CatalogStore] loadRooms failed:", err);
    }
  }

  private async loadSettingsAndSite(): Promise<void> {
    try {
      const { db } = getDb();
      const [settingRows, siteRows] = await Promise.all([
        db.select().from(settings).limit(1),
        db.select().from(site).limit(1),
      ]);
      const row = settingRows[0];
      if (row) {
        const rawSite = safeJsonParse<Record<string, unknown>>(row.site, {});
        this.siteSetting = normalizeSiteSettingShape(rawSite);
        const rawLimits = safeJsonParse<Record<string, unknown>>(rawSite.walllikes, rawSite);
        this.wallLimits = {
          lengthMsgRoom: Math.max(0, Number(rawLimits.lengthMsgRoom ?? rawSite.lengthMsgRoom ?? 1000) || 1000),
          lengthMsgBar: Math.max(0, Number(rawLimits.lengthMsgBar ?? rawSite.lengthMsgBar ?? 1000) || 1000),
          lengthMsgPm: Math.max(0, Number(rawLimits.lengthMsgPm ?? rawSite.lengthMsgPm ?? 250) || 250),
          lengthUserReg: Math.max(4, Number(rawLimits.lengthUserReg ?? rawSite.lengthUserReg ?? 35) || 35),
          likeTopicEdit: Math.max(0, Number(rawLimits.likeTopicEdit ?? rawSite.likeTopicEdit ?? 0) || 0),
          likeUpPic: Math.max(0, Number(rawLimits.likeUpPic ?? rawSite.likeUpPic ?? 0) || 0),
          bclikes: Math.max(0, Number(rawLimits.bclikes ?? rawSite.bclikes ?? 0) || 0),
          pmlikes: Math.max(0, Number(rawLimits.pmlikes ?? rawSite.pmlikes ?? 0) || 0),
          miclikes: Math.max(0, Number(rawLimits.miclikes ?? rawSite.miclikes ?? 0) || 0),
          fileslikes: Math.max(0, Number(rawLimits.fileslikes ?? rawSite.fileslikes ?? 0) || 0),
          wallminutes: Math.max(0, Number(rawLimits.wallminutes ?? rawSite.wallminutes ?? 0) || 0),
          allowreg: rawSite.allowreg !== false && rawSite.allowreg !== 0,
          evaluationAutoPromotionEnabled:
            rawSite.evaluation_auto_promotion !== false && rawSite.evaluation_auto_promotion !== 0,
          welcomeMessage: String(rawSite.welcome || ""),
        };

        this.giftsList = normalizeGiftsGit(row.gifts_git);
        this.giftsByFile = new Map(this.giftsList.map((g) => [g.file, g]));
        this.giftCategories = normalizeGiftCategories(row.gift_categories, this.giftsList);
        this.emos = safeJsonParse<unknown[]>(row.emo, []);
        this.sicos = safeJsonParse<string[]>(row.sico, []);
        this.dro3s = safeJsonParse<string[]>(row.dro3, []);
        this.themes = safeJsonParse<string[]>(row.them, []);
        this.covers = safeJsonParse<string[]>(row.cover, []);
        this.roomBadges = normalizeRoomBadgesCatalog(row.room_badges);
        this.siteBadges = normalizeSiteBadgesCatalog(row.site_badges);
      }

      const siteRow = siteRows[0];
      if (siteRow) {
        this.siteBanner = siteRow.banner || "";
        this.siteLogo = siteRow.logo || "";
      }
    } catch (err) {
      console.error("[CatalogStore] loadSettingsAndSite failed:", err);
    }
  }

  private async loadOwner(): Promise<void> {
    try {
      const { db } = getDb();
      const rows = await db.select().from(owner).limit(1);
      const row = rows[0];
      if (row) {
        const guestList = safeJsonParse<string[]>(row.Gust, []);
        const visitorList = safeJsonParse<string[]>(row.Vistor, []);
        this.ownerState = {
          bars: row.bars !== false,
          offline: Boolean(row.offline),
          cooment: Boolean(row.cooment),
          isbanner: Boolean(row.isbanner),
          rc: row.rc !== false,
          vpn: Boolean(row.Vpn),
          tv: String(row.Tv || ""),
          maxRep: Math.max(3, Math.min(100, Number(row.MaxRep ?? 3) || 3)),
          room: String(row.room || gatewayConfig.defaultRoomId),
          datafinish: row.datafinish ? row.datafinish.getTime() : Date.now() + 86_400_000,
          updatedAt: Date.now(),
          guestList: Array.isArray(guestList) ? guestList : [],
          visitorList: Array.isArray(visitorList) ? visitorList : [],
        };
        await getRedis()
          .set(REDIS_KEYS.ownerRuntime, JSON.stringify(this.ownerState))
          .catch(() => 0);
      }
    } catch (err) {
      console.error("[CatalogStore] loadOwner failed:", err);
    }
  }

  private async loadHosts(): Promise<void> {
    try {
      const { db } = getDb();
      const rows = await db.select().from(hosts).limit(200);
      const map = new Map<string, number>();
      for (const h of rows) {
        if (h.hostname) {
          map.set(h.hostname.trim().toLowerCase(), h.setting || 1);
        }
      }
      this.hostMap = map;
    } catch {
      // keep previous
    }
  }

  private async loadCuts(): Promise<void> {
    try {
      await this.shortcutService.warmShortcutCache();
      const cutsRules = this.shortcutService.getRules();
      const rules = compileEktisarRules(
        cutsRules.map((r) => ({ title: r.text1, msg: r.text2 })),
      );
      this.ektisarReplacer.setRules(rules);
    } catch {
      // keep previous
    }
  }

  private async loadNotext(): Promise<void> {
    try {
      await this.filterService.warmFilterCache();
      this.prohibitedWords = this.filterService.getRules().map((r) => ({
        id: r.id,
        type: r.type ?? null,
        path: r.path ?? null,
        v: r.v,
      }));
    } catch {
      // keep previous
    }
  }

  private async loadBans(): Promise<void> {
    try {
      const { db } = getDb();
      const rows = await db.select().from(band).orderBy(desc(band.id)).limit(2000);
      this.banRules = rows;
    } catch {
      // keep previous
    }
  }

  private async loadBsb(): Promise<void> {
    try {
      const { db } = getDb();
      const rows = await db.select().from(bsb).limit(1);
      const row = rows[0];
      const nextSys = new Set<string>();
      const nextBrowsers = new Set<string>();
      if (row?.systems) {
        for (const item of row.systems.split(",")) {
          const clean = item.trim().toLowerCase();
          if (clean) nextSys.add(clean);
        }
      }
      if (row?.browsers) {
        for (const item of row.browsers.split(",")) {
          const clean = item.trim().toLowerCase();
          if (clean) nextBrowsers.add(clean);
        }
      }
      this.bannedSystems = nextSys;
      this.bannedBrowsers = nextBrowsers;
    } catch {
      // keep previous
    }
  }

  private async loadIntroMessages(): Promise<void> {
    try {
      const { db } = getDb();
      const rows = await db.select().from(intromsg);
      this.introMessages = rows.map((r) => ({
        id: r.id,
        category: String(r.category || ""),
        adresse: String(r.adresse || ""),
        msg: String(r.msg || ""),
      }));
    } catch {
      // keep previous
    }
  }

  // -------- Public Read Accessors --------

  getPowers(): PowerRole[] {
    return this.powersList;
  }

  getPowerRole(name: string | null | undefined): PowerRole | null {
    return getPowerDefinitionByName(this.powersList, name);
  }

  getRooms(): GatewayRoomRecord[] {
    return this.roomsList;
  }

  getRoomById(roomId: string | null | undefined): GatewayRoomRecord | null {
    if (!roomId) return null;
    return this.roomsMap.get(String(roomId).trim()) ?? null;
  }

  upsertRoomLocal(room: GatewayRoomRecord): void {
    this.roomsMap.set(room.id, room);
    const idx = this.roomsList.findIndex((r) => r.id === room.id);
    if (idx === -1) {
      this.roomsList.push(room);
    } else {
      this.roomsList[idx] = room;
    }
  }

  removeRoomLocal(roomId: string): void {
    this.roomsMap.delete(roomId);
    this.roomsList = this.roomsList.filter((r) => r.id !== roomId);
  }

  getDefaultRoomId(): string {
    const preferred = this.ownerState.room || gatewayConfig.defaultRoomId;
    if (this.roomsMap.has(preferred)) {
      return preferred;
    }
    return this.roomsList[0]?.id || preferred;
  }

  getSiteSetting(): SiteSettingShape {
    return this.siteSetting;
  }

  getLimits(): WallLimitsConfig {
    return this.wallLimits;
  }

  getOwnerState(): GatewayOwnerState {
    return this.ownerState;
  }

  getGifts(): GiftDefinition[] {
    return this.giftsList;
  }

  getGiftByFile(file: string): GiftDefinition | null {
    return this.giftsByFile.get(String(file || "").trim()) ?? null;
  }

  getGiftCategories(): string[] {
    return this.giftCategories;
  }

  getEmos(): unknown[] {
    return this.emos;
  }

  getSicos(): string[] {
    return this.sicos;
  }

  getDro3s(): string[] {
    return this.dro3s;
  }

  getThemes(): string[] {
    return this.themes;
  }

  getCovers(): string[] {
    return this.covers;
  }

  getSiteBadges(): SiteBadge[] {
    return this.siteBadges;
  }

  getSiteBadgeById(id: string | null | undefined): SiteBadge | null {
    if (!id) return null;
    return this.siteBadges.find((b) => b.id === id) ?? null;
  }

  getRoomBadges(): RoomBadge[] {
    return this.roomBadges;
  }

  getRoomBadgeById(id: string | null | undefined): RoomBadge | null {
    if (!id) return null;
    return this.roomBadges.find((b) => b.id === id) ?? null;
  }

  getIntroWelcomeMessages(category = "w"): IntroWelcomeRow[] {
    return this.introMessages.filter((m) => m.category === category);
  }

  getSiteBanner(): string {
    return this.siteBanner;
  }

  getBanRules(): BanRuleRow[] {
    return this.banRules;
  }

  getProhibitedWordRules(): ProhibitedWordRule[] {
    return this.prohibitedWords;
  }

  replaceShortcuts(text: string): string {
    return this.shortcutService.replaceShortcuts(text);
  }

  scanProhibitedWords(input: string): { matchedWord: string; rule: ProhibitedWordRule } | null {
    const hit = this.filterService.scanProhibitedWords(input);
    if (!hit) return null;
    return {
      matchedWord: hit.matchedWord,
      rule: {
        id: hit.rule.id,
        type: hit.rule.type ?? "word",
        path: hit.rule.path ?? "bmsgs",
        v: hit.rule.v ?? hit.matchedWord,
      },
    };
  }

  isSystemBlocked(plt: string): boolean {
    return this.bannedSystems.has(plt.trim().toLowerCase());
  }

  isBrowserBlocked(browser: string): boolean {
    const clean = browser.trim().toLowerCase().replace(/^mobile\s+/, "");
    return this.bannedBrowsers.has(clean) || this.bannedBrowsers.has(browser.trim().toLowerCase());
  }

  isSiteExpired(): boolean {
    const finishMs = Number(this.ownerState.datafinish || 0);
    return finishMs > 0 && Date.now() > finishMs;
  }

  getHostCount(): number {
    return this.hostMap.size;
  }
}
