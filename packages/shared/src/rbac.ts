import {
  DEFAULT_EVALUATION_AWARD_CONFIG,
  DEFAULT_POWER_NON,
  DEFAULT_POWERS,
  HOSTING_SECTION_KEYS,
} from "./constants.js";
import type {
  AutoPromotionRule,
  EvaluationAwardActionKey,
  EvaluationAwardRule,
  EvaluationAwardSettings,
  GiftDefinition,
  HostingSectionAccess,
  HostingSectionKey,
  LiveRoomConfig,
  LiveRoomGiftGoal,
  MicProviderMode,
  OnlineUserSnapshot,
  PowerRole,
  RoomBadge,
  RoomOwnerAssignment,
  RoomOwnerBadge,
  RoomOwnerMeta,
  SiteBadge,
  SiteSettingShape,
} from "./types.js";

function toInt(value: unknown, fallback = 0): number {
  const num = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(num) ? num : fallback;
}

function toFlag(value: unknown): number {
  return Number(value || 0) ? 1 : 0;
}

export function normalizePowerShape(powerEntry: Partial<PowerRole> | null | undefined): PowerRole {
  const source = powerEntry && typeof powerEntry === "object" ? powerEntry : {};
  const autoEnabled = toFlag(
    source.auto_enabled !== undefined && source.auto_enabled !== null
      ? source.auto_enabled
      : source.auto_promote,
  );
  return {
    ...DEFAULT_POWER_NON,
    ...source,
    rank: toInt(source.rank, 0),
    name: String(source.name || ""),
    ico: String(source.ico || ""),
    bootedit: toFlag(source.bootedit),
    brbbot: toFlag(source.brbbot),
    micprovideredit: toFlag(source.micprovideredit),
    delbc: toFlag(source.delbc),
    alert: toFlag(source.alert),
    mynick: toFlag(source.mynick),
    unick: toFlag(source.unick),
    ban: toFlag(source.ban),
    forcepm: toFlag(source.forcepm),
    roomowner: toFlag(source.roomowner),
    createroom: toFlag(source.createroom),
    can_create_voice_room: toFlag(source.can_create_voice_room),
    edituser: toFlag(source.edituser),
    setpower: toFlag(source.setpower),
    history: toFlag(source.history),
    cp: toFlag(source.cp),
    stealth: toFlag(source.stealth),
    owner: toFlag(source.owner),
    meiut: toFlag(source.meiut),
    loveu: toFlag(source.loveu),
    ulike: toFlag(source.ulike),
    flter: toFlag(source.flter),
    subs: toFlag(source.subs),
    shrt: toFlag(source.shrt),
    msgs: toFlag(source.msgs),
    grupes: toFlag(source.grupes),
    delmsg: toFlag(source.delmsg),
    delpic: toFlag(source.delpic),
    hostcleanup: toFlag(source.hostcleanup),
    hostcontrols: toFlag(source.hostcontrols),
    hostsettings: toFlag(source.hostsettings),
    hostdomains: toFlag(source.hostdomains),
    evaluationpoints: toFlag(source.evaluationpoints),
    auto_enabled: autoEnabled,
    auto_promote: autoEnabled,
    auto_points: Math.max(0, toInt(source.auto_points, 0)),
  };
}

export function normalizeShowPowers(list: unknown): PowerRole[] {
  let rawList: unknown[] = [];
  if (Array.isArray(list)) {
    rawList = list;
  } else if (typeof list === "string" && list.trim()) {
    try {
      const parsed = JSON.parse(list);
      if (Array.isArray(parsed)) rawList = parsed;
    } catch {
      rawList = [];
    }
  }
  if (!rawList.length) {
    return DEFAULT_POWERS.map((entry) => normalizePowerShape(entry));
  }
  return rawList.map((entry) =>
    normalizePowerShape(
      entry && typeof entry === "object" ? (entry as Partial<PowerRole>) : {},
    ),
  );
}

export function getPowerDefinitionByName(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): PowerRole | null {
  const safeName = String(powerName || "");
  if (!safeName || !Array.isArray(powers)) {
    return null;
  }
  for (let i = 0; i < powers.length; i += 1) {
    if (String(powers[i]?.name || "") === safeName) {
      return powers[i]!;
    }
  }
  return null;
}

export function getPowerRankValue(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): number {
  const def = getPowerDefinitionByName(powers, powerName);
  return def ? toInt(def.rank, 0) : 0;
}

export function verPower(
  powers: readonly PowerRole[],
  data: { me?: string | null; to?: string | null },
): boolean {
  const targetName = String(data.me || "");
  const actorName = String(data.to || "");
  if (targetName === "") {
    return true;
  }
  const targetDef = getPowerDefinitionByName(powers, targetName);
  const actorDef = getPowerDefinitionByName(powers, actorName);
  if (targetDef && actorDef) {
    return toInt(actorDef.rank, 0) >= toInt(targetDef.rank, 0);
  }
  return true;
}

export function canActOnRank(
  powers: readonly PowerRole[],
  actorPower: string | null | undefined,
  targetPower: string | null | undefined,
): boolean {
  return verPower(powers, { me: targetPower || "", to: actorPower || "" });
}

export function canManageSiteBadges(
  role: PowerRole | null | undefined,
): boolean {
  return Boolean(
    role &&
      (Number(role.edituser || 0) > 0 ||
        Number(role.setpower || 0) > 0 ||
        Number(role.owner || 0) > 0),
  );
}

export function verAdminPanel(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(def && Number(def.cp || 0));
}

export function verRoomsOwner(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(def && Number(def.grupes || 0));
}

export function verStealthPanel(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(def && Number(def.stealth || 0));
}

export function verOwner(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(def && Number(def.owner || 0));
}

export function canCreateVoiceRoom(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  if (isLegacyHostingSuperPower(powerName)) {
    return true;
  }
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(
    def &&
    (Number(def.owner || 0) ||
      Number(def.cp || 0) ||
      Number(def.can_create_voice_room || 0))
  );
}

export function myOptionAlert(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): number {
  const def = getPowerDefinitionByName(powers, powerName);
  return def && Number(def.alert || 0) ? 1 : 0;
}

export function myOptionPm(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): number {
  const def = getPowerDefinitionByName(powers, powerName);
  return def && Number(def.forcepm || 0) ? 1 : 0;
}

export function myOptionHistory(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): number {
  const def = getPowerDefinitionByName(powers, powerName);
  return def && Number(def.history || 0) ? 1 : 0;
}

export function myOptionDone(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): number {
  const def = getPowerDefinitionByName(powers, powerName);
  return def ? toInt(def.rank, 0) : 0;
}

export function canEditMicProvider(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(def && Number(def.micprovideredit || 0));
}

export function isLegacyHostingSuperPower(powerName: string | null | undefined): boolean {
  return powerName === "chatmaster" || powerName === "Hide" || powerName === "ispower";
}

export function canManageEvaluationPoints(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  if (isLegacyHostingSuperPower(powerName)) {
    return true;
  }
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(def && (Number(def.owner || 0) || Number(def.evaluationpoints || 0)));
}

export function getHostingSectionAccess(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): HostingSectionAccess {
  const access: HostingSectionAccess = {
    hostcleanup: false,
    hostcontrols: false,
    hostsettings: false,
    hostdomains: false,
  };
  if (isLegacyHostingSuperPower(powerName)) {
    for (const key of HOSTING_SECTION_KEYS) {
      access[key] = true;
    }
    return access;
  }
  const def = getPowerDefinitionByName(powers, powerName);
  if (!def) {
    return access;
  }
  for (const key of HOSTING_SECTION_KEYS) {
    access[key] = !!Number(def[key] || 0);
  }
  return access;
}

export function canAccessHostingSection(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
  sectionKey: HostingSectionKey,
): boolean {
  if (isLegacyHostingSuperPower(powerName)) {
    return true;
  }
  const def = getPowerDefinitionByName(powers, powerName);
  return !!(def && Number(def[sectionKey] || 0));
}

export function canAccessAnyHostingSection(
  powers: readonly PowerRole[],
  powerName: string | null | undefined,
): boolean {
  const access = getHostingSectionAccess(powers, powerName);
  return HOSTING_SECTION_KEYS.some((key) => access[key]);
}

export function parseEvaluationAwardsJson(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function normalizeEvaluationAwardConfigEntry(
  key: EvaluationAwardActionKey,
  entry: unknown,
): EvaluationAwardRule {
  const fallback = DEFAULT_EVALUATION_AWARD_CONFIG[key];
  const source =
    entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
  return {
    points: Math.max(0, toInt(source.points ?? fallback.points, fallback.points)),
    cooldownMs: Math.max(
      0,
      toInt(source.cooldownMs ?? fallback.cooldownMs, fallback.cooldownMs),
    ),
    dailyLimit: Math.max(
      0,
      toInt(source.dailyLimit ?? fallback.dailyLimit, fallback.dailyLimit),
    ),
    minRoomMembers: Math.max(
      0,
      toInt(source.minRoomMembers ?? fallback.minRoomMembers, fallback.minRoomMembers),
    ),
    minLength: Math.max(
      0,
      toInt(source.minLength ?? fallback.minLength, fallback.minLength),
    ),
    requireDifferentMember:
      source.requireDifferentMember !== undefined
        ? source.requireDifferentMember !== false
        : fallback.requireDifferentMember,
  };
}

export function normalizeEvaluationAwardSettings(settings: unknown): EvaluationAwardSettings {
  const source =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};
  const actionSource =
    source.actions && typeof source.actions === "object"
      ? (source.actions as Record<string, unknown>)
      : source;
  const actions = {} as Record<EvaluationAwardActionKey, EvaluationAwardRule>;
  const keys = Object.keys(DEFAULT_EVALUATION_AWARD_CONFIG) as EvaluationAwardActionKey[];
  for (const key of keys) {
    actions[key] = normalizeEvaluationAwardConfigEntry(key, actionSource[key]);
  }
  return {
    enabled: source.enabled !== false,
    actions,
  };
}

export function getAutoPromotionRequiredPoints(power: PowerRole | null | undefined): number {
  if (!power) {
    return 0;
  }
  const explicitPoints = toInt(power.auto_points, 0);
  return explicitPoints > 0 ? explicitPoints : 0;
}

export function isAutoPromotionEligiblePower(power: PowerRole | null | undefined): boolean {
  if (!power || !power.name) {
    return false;
  }
  if (!Number(power.auto_enabled || power.auto_promote || 0)) {
    return false;
  }
  return getAutoPromotionRequiredPoints(power) > 0;
}

export function getAutoPromotionRules(
  powers: readonly PowerRole[],
  autoPromotionEnabled = true,
): AutoPromotionRule[] {
  if (!autoPromotionEnabled || !Array.isArray(powers)) {
    return [];
  }
  return powers
    .filter((power) => isAutoPromotionEligiblePower(power))
    .map((power) => ({
      power,
      points: getAutoPromotionRequiredPoints(power),
      rank: Math.max(0, toInt(power.rank, 0)),
    }))
    .sort((a, b) => (a.points !== b.points ? a.points - b.points : a.rank - b.rank));
}

export function getAutoPromotionTarget(
  powers: readonly PowerRole[],
  points: number,
  autoPromotionEnabled = true,
): AutoPromotionRule | null {
  const safePoints = Math.max(0, toInt(points, 0));
  const rules = getAutoPromotionRules(powers, autoPromotionEnabled);
  let target: AutoPromotionRule | null = null;
  for (const rule of rules) {
    if (safePoints >= rule.points) {
      target = rule;
    }
  }
  return target;
}

export function normalizeRoomOwnerBadge(value: unknown): RoomOwnerBadge {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const bgType = String(source.bg_type || source.bgType || "")
    .trim()
    .toLowerCase();
  return {
    name: String(source.name || "").trim(),
    bg: String(source.bg || "").trim(),
    icon: String(source.icon || "").trim(),
    bg_type: bgType === "animated" ? "animated" : "static",
  };
}

export function normalizeRoomOwnerAssignment(value: unknown): RoomOwnerAssignment | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value as Record<string, unknown>;
  const userRaw = String(source.userId || source.ownerId || "").trim();
  if (!userRaw) {
    return null;
  }
  const userId = "#" + userRaw.replace(/^#/, "");
  return {
    userId,
    userUser: String(source.userUser || source.ownerUser || "").trim(),
    userTopic: String(source.userTopic || source.ownerTopic || "").trim(),
    badge_id: String(source.badge_id || "").trim(),
    badge: normalizeRoomOwnerBadge(source.badge || {}),
  };
}

export function normalizeLiveRoomConfig(raw: unknown): LiveRoomConfig {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const is_live_audio = Boolean(obj.is_live_audio);
  const join_mode = obj.join_mode === "request" ? "request" : "free";
  const chat_locked = Boolean(obj.chat_locked);
  let gift_goal: LiveRoomGiftGoal | undefined = undefined;
  if (obj.gift_goal && typeof obj.gift_goal === "object") {
    const gg = obj.gift_goal as Record<string, unknown>;
    gift_goal = {
      giftId: String(gg.giftId || ""),
      giftFile: gg.giftFile ? String(gg.giftFile) : undefined,
      giftName: String(gg.giftName || "وردة"),
      giftIcon: String(gg.giftIcon || "🌹"),
      giftCoin: Number(gg.giftCoin || 1),
      targetCount: Math.max(1, Number(gg.targetCount || 100)),
      currentCount: Math.max(0, Number(gg.currentCount || 0)),
      endsAt: Number(gg.endsAt || 0) || undefined,
    };
  }
  const likes_count =
    typeof obj.likes_count === "number"
      ? Math.max(0, obj.likes_count)
      : typeof obj.likes_count === "string" && obj.likes_count !== ""
        ? Math.max(0, Number(obj.likes_count) || 0)
        : undefined;

  return {
    is_live_audio,
    join_mode,
    chat_locked,
    gift_goal,
    pinned_notice:
      typeof obj.pinned_notice === "string" ? obj.pinned_notice : undefined,
    hourly_rank:
      typeof obj.hourly_rank === "string" ? obj.hourly_rank : undefined,
    likes_count,
  };
}

export function parseRoomOwnerMeta(value: unknown): RoomOwnerMeta {
  let source: unknown = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }
  const obj =
    source && typeof source === "object" ? (source as Record<string, unknown>) : {};
  const ownerIdRaw = String(obj.ownerId || "").trim();
  const ownerId = ownerIdRaw ? "#" + ownerIdRaw.replace(/^#/, "") : "#1";
  const ownerUser = String(obj.ownerUser || (ownerId === "#1" ? "system" : "")).trim();
  const ownerTopic = String(obj.ownerTopic || (ownerId === "#1" ? "System" : "")).trim();
  const assignments: RoomOwnerAssignment[] = [];
  if (Array.isArray(obj.assignments)) {
    for (const entry of obj.assignments) {
      const norm = normalizeRoomOwnerAssignment(entry);
      if (norm) assignments.push(norm);
    }
  }
  const live_config = obj.live_config
    ? normalizeLiveRoomConfig(obj.live_config)
    : undefined;
  return {
    ownerId,
    ownerUser,
    ownerTopic,
    badge_id: String(obj.badge_id || "").trim(),
    badge: normalizeRoomOwnerBadge(obj.badge || {}),
    assignments,
    live_config,
  };
}

export function upsertRoomOwnerAssignment(
  metaObj: RoomOwnerMeta,
  assignment: RoomOwnerAssignment | null,
): RoomOwnerMeta {
  if (!metaObj || !assignment) {
    return metaObj;
  }
  if (!Array.isArray(metaObj.assignments)) {
    metaObj.assignments = [];
  }
  const targetId = String(assignment.userId || "").trim();
  if (!targetId || targetId === "#1") {
    return metaObj;
  }
  const idx = metaObj.assignments.findIndex(
    (x) => x && String(x.userId || "").trim() === targetId,
  );
  if (idx === -1) {
    metaObj.assignments.push(assignment);
  } else {
    metaObj.assignments[idx] = assignment;
  }
  return metaObj;
}

export function getSystemRoomOwner(): { owner: string; meta: string } {
  return {
    owner: "#1",
    meta: JSON.stringify({
      ownerId: "#1",
      ownerUser: "system",
      ownerTopic: "System",
      badge_id: "",
      badge: { name: "", bg: "", icon: "", bg_type: "static" },
      assignments: [],
    }),
  };
}

export function normalizeRoomBadgesCatalog(rawValue: unknown): RoomBadge[] {
  let source = rawValue;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  if (!Array.isArray(source)) {
    return [];
  }
  const out: RoomBadge[] = [];
  source.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const obj = item as Record<string, unknown>;
    const id = String(obj.id || "badge_" + index).trim();
    const name = String(obj.name || "").trim();
    const bg = String(obj.bg || "").trim();
    const icon = String(obj.icon || "").trim();
    const bgType = String(obj.bg_type || obj.bgType || "")
      .trim()
      .toLowerCase();
    if (!id || !name) return;
    out.push({
      id,
      name,
      bg,
      icon,
      bg_type: bgType === "animated" ? "animated" : "static",
    });
  });
  return out;
}

export function normalizeSiteBadgesCatalog(rawValue: unknown): SiteBadge[] {
  let source = rawValue;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  if (!Array.isArray(source)) {
    return [];
  }
  const out: SiteBadge[] = [];
  source.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const obj = item as Record<string, unknown>;
    const id = String(obj.id || "sbadge_" + index).trim();
    const name = String(obj.name || "").trim();
    const bg = String(obj.bg || "").trim();
    const icon = String(obj.icon || "").trim();
    const bgType = String(obj.bg_type || obj.bgType || "")
      .trim()
      .toLowerCase();
    if (!id || !name) return;
    out.push({
      id,
      name,
      bg,
      icon,
      bg_type: bgType === "animated" ? "animated" : "static",
    });
  });
  return out;
}

export function normalizeGiftsGit(rawValue: unknown): GiftDefinition[] {
  let source = rawValue;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  if (!Array.isArray(source)) {
    return [];
  }
  const out: GiftDefinition[] = [];
  source.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const obj = item as Record<string, unknown>;
    const file = String(obj.file || obj.image || "").trim();
    if (!file) return;
    const coin = Math.max(1, toInt(obj.coin, 1));
    const id = String(obj.id || "giftgit_" + index + "_" + Date.now()).trim();
    const derivedName = file
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
    const name = String(
      obj.name || obj.title || derivedName || "هدية " + (index + 1),
    ).trim();
    const category =
      String(obj.category || obj.section || obj.group || "افتراضي").trim() ||
      "افتراضي";
    out.push({ id, file, coin, name, category });
  });
  return out;
}

export function normalizeGiftCategories(
  rawValue: unknown,
  fallbackGifts: readonly GiftDefinition[] = [],
): string[] {
  let source = rawValue;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  if (!Array.isArray(source)) {
    source = [];
  }
  const out: string[] = [];
  for (const item of source as unknown[]) {
    const name = String(item == null ? "" : item).trim();
    if (name && !out.includes(name)) {
      out.push(name);
    }
  }
  for (const gift of fallbackGifts) {
    const category = String(gift?.category || "").trim();
    if (category && !out.includes(category)) {
      out.push(category);
    }
  }
  if (!out.includes("افتراضي")) {
    out.unshift("افتراضي");
  }
  return out;
}

export function normalizeMicProviderSetting(value: unknown): MicProviderMode {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (raw === "LIVEKIT") {
    return "LIVEKIT";
  }
  if (raw === "JITSI" || raw === "JISTI") {
    return "JITSI";
  }
  return "WEBRTC";
}

export function normalizeRoomMessageThemeSetting(value: unknown): "classic" | "bubble" {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  return raw === "bubble" ? "bubble" : "classic";
}

export function normalizeSiteSettingShape(siteSetting: unknown): SiteSettingShape {
  const source =
    siteSetting && typeof siteSetting === "object"
      ? ({ ...(siteSetting as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  return {
    ...source,
    micprovider: normalizeMicProviderSetting(source.micprovider),
    roomMessageTheme: normalizeRoomMessageThemeSetting(source.roomMessageTheme),
    evaluation_awards: normalizeEvaluationAwardSettings(source.evaluation_awards),
  };
}

export function comparePresencePriority(
  a: Partial<OnlineUserSnapshot> | null | undefined,
  b: Partial<OnlineUserSnapshot> | null | undefined,
): number {
  const score = (user: Partial<OnlineUserSnapshot> | null | undefined): number => {
    if (!user) return -999999;
    const stat = Number.parseInt(String(user.stat ?? 0), 10);
    const safeStat = Number.isFinite(stat) ? stat : 0;
    const roomid = user.roomid == null ? "" : String(user.roomid);
    const offline = user.offline === true || safeStat === 3;
    const live = offline ? 0 : 1;
    const inRoom = roomid ? 1 : 0;
    const metaTs = Math.max(0, toInt(user.meta_ts, 0));
    return live * 1_000_000_000 + inRoom * 1_000_000 + metaTs;
  };
  return score(a) - score(b);
}

export function isPresenceRegisteredUser(
  user: Partial<OnlineUserSnapshot> | null | undefined,
): boolean {
  if (!user) return false;
  const idreg = String(user.idreg || "").trim();
  return idreg !== "" && idreg !== "0" && idreg !== "#0";
}

export function getPresenceUserPoints(
  user: Partial<OnlineUserSnapshot> | null | undefined,
): number {
  if (!user) return 0;
  const pts = user.evaluation ?? (user as Record<string, unknown>).points;
  const val = Number(pts);
  return Number.isFinite(val) ? val : 0;
}

export function comparePresenceUsers(
  a: Partial<OnlineUserSnapshot> | null | undefined,
  b: Partial<OnlineUserSnapshot> | null | undefined,
  powers: readonly PowerRole[],
  currentRoomId?: string | null,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  if (currentRoomId) {
    const cleanRoomId = String(currentRoomId).trim();
    const isLive = (u: Partial<OnlineUserSnapshot>) => !u.offline && Number(u.stat ?? 0) !== 3 && u.s == null;
    const getGroup = (u: Partial<OnlineUserSnapshot>): number => {
      if (!isLive(u)) return 0;
      const uRoom = String(u.roomid || "").trim();
      if (cleanRoomId && uRoom === cleanRoomId) return 30;
      if (uRoom) return 20;
      return 10;
    };
    const groupA = getGroup(a);
    const groupB = getGroup(b);
    if (groupA !== groupB) {
      return groupB - groupA;
    }
  }

  const ar = getPowerRankValue(powers, a.power ?? a.rank);
  const br = getPowerRankValue(powers, b.power ?? b.rank);
  if (ar !== br) {
    return br - ar;
  }

  const ap = getPresenceUserPoints(a);
  const bp = getPresenceUserPoints(b);
  if (ap !== bp) {
    return bp - ap;
  }

  const aReg = isPresenceRegisteredUser(a) ? 1 : 0;
  const bReg = isPresenceRegisteredUser(b) ? 1 : 0;
  if (aReg !== bReg) {
    return bReg - aReg;
  }

  const at = String(a.topic || "");
  const bt = String(b.topic || "");
  const byTopic = at.localeCompare(bt, "ar");
  if (byTopic !== 0) {
    return byTopic;
  }

  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function sortOnlineSnapshots<T extends Partial<OnlineUserSnapshot>>(
  list: readonly T[],
  powers: readonly PowerRole[],
  currentRoomId?: string | null,
): T[] {
  const rows = Array.isArray(list) ? list.slice() : [];
  rows.sort((a, b) => comparePresenceUsers(a, b, powers, currentRoomId));
  return rows;
}
