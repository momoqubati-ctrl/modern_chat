import { create } from "zustand";
import {
  type BroadcastWallPost,
  type CarromPublicState,
  type CarromShotInput,
  type CompetitionBotKind,
  type GiftDefinition,
  type LudoPublicState,
  type OnlineUserSnapshot,
  type PowerRole,
  type RoomCompetitionState,
  type RoomMessagePayload,
  type RoomSnapshot,
  type StoryCommentRecord,
  type StoryLikeRecord,
  type UserNoteRecord,
  type NoteCommentRecord,
  type PublishNotePayload,
  sortOnlineSnapshots,
} from "@newchat/shared";
import { type BootstrapSiteConfig, NewChatApiClient } from "../apiClient.js";
import { NewChatSocketClient } from "../socketClient.js";

export interface NoticeItem {
  id: string;
  msg: string;
  topic?: string;
  sound?: string;
  force?: number;
  ts: number;
}

export interface PrivateMessageEntry {
  from: string;
  to?: string;
  uid?: string;
  topic: string;
  msg: string;
  ts: number;
  pic?: string;
  file?: string;
  fileType?: string;
  self?: boolean;
  /** True once the peer has opened the thread (read receipt ✓✓). */
  seen?: boolean;
  ucol?: string;
  bg?: string;
}

export interface MailItem {
  id: number;
  from_uid: string;
  from_username: string;
  from_topic: string;
  from_pic: string;
  from_verified?: boolean;
  to_uid: string;
  to_username: string;
  to_topic: string;
  to_pic: string;
  to_verified?: boolean;
  body: string;
  is_read: boolean;
  created_at: number;
  read_at: number;
}

export interface PmCallState {
  status: "idle" | "outgoing" | "incoming" | "active";
  callId: string;
  peerId: string;
  peerTopic: string;
  peerPic: string;
  callType: "audio" | "video";
  isCaller: boolean;
}

export interface SiteMetaFlags {
  tv: string;
  pool: boolean;
  reply: boolean;
  love: boolean;
  maxRep: number;
  cooment: boolean;
}

export interface FollowInfoSnapshot {
  uid: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface RoomInvitePayload {
  roomid: string;
  roomTopic: string;
  byTopic: string;
  pass?: string;
}

export interface ChatState {
  apiUrl: string;
  gatewayUrl: string;
  connected: boolean;
  connecting: boolean;
  isAuthenticated: boolean;
  sessionToken: string | null;
  pendingDeepLinkRoomId: string;
  lastAuthError: string | null;
  roomInvite: RoomInvitePayload | null;
  me: OnlineUserSnapshot | null;
  myPowerRole: PowerRole | null;
  currentRoomId: string;
  onlineCount: number;
  onlineMap: Record<string, OnlineUserSnapshot>;
  onlineIds: string[];
  rooms: RoomSnapshot[];
  roomsCounts: Record<string, number>;
  powers: PowerRole[];
  gifts: GiftDefinition[];
  giftCategories: Array<Record<string, unknown>>;
  sicos: string[];
  emos: string[];
  dro3: string[];
  themes: string[];
  covers: string[];
  roomBadges: Array<Record<string, unknown>>;
  siteBadges: Array<Record<string, unknown>>;
  shortcuts: Array<{ text1: string; text2: string }>;
  site: BootstrapSiteConfig | null;
  siteFlags: SiteMetaFlags;
  messages: RoomMessagePayload[];
  wallPosts: BroadcastWallPost[];
  stories: Array<Record<string, unknown>>;
  storyViewersMap: Record<string, Array<Record<string, unknown>>>;
  storyLikersMap: Record<string, StoryLikeRecord[]>;
  storyCommentsMap: Record<string, StoryCommentRecord[]>;
  notes: UserNoteRecord[];
  noteCommentsMap: Record<string, NoteCommentRecord[]>;
  followInfoMap: Record<string, FollowInfoSnapshot>;
  typingUsers: Record<string, string>;
  /** Private-chat typing indicators (kept OUT of the room bar), keyed by peer socket id + stable uid. */
  pmTypingUsers: Record<string, string>;
  stageState: Record<string, unknown>;
  listenersCount: number;
  speakingUsers: Record<string, boolean>;
  lastStageSignal: Record<string, unknown> | null;
  carromState: CarromPublicState | null;
  carromPreviewState: Record<string, unknown> | null;
  lastCarromShotFx: Record<string, unknown> | null;
  ludoState: LudoPublicState | null;
  lastLudoEventFx: Record<string, unknown> | null;
  competitionState: RoomCompetitionState | null;
  pmThreads: Record<string, PrivateMessageEntry[]>;
  /** Per-thread read cursor (thread key → ts of last read message). Unread = incoming with ts > cursor. */
  pmReadState: Record<string, number>;
  activePmTargetId: string | null;
  unreadMailCount: number;
  mailInbox: MailItem[];
  mailSent: MailItem[];
  mailSearchResults: Array<{ uid: string; username: string; topic: string; pic: string }>;
  visitorsCount: number;
  visitorsList: Array<Record<string, unknown>>;
  callState: PmCallState;
  lastCallSignal: Record<string, unknown> | null;
  youtubeResults: Array<Record<string, unknown>>;
  lastTikTokResult: Record<string, unknown> | null;
  lastGiftFx: Record<string, unknown> | null;
  notices: NoticeItem[];

  getApiClient: () => NewChatApiClient;
  getSocketClient: () => NewChatSocketClient | null;
  initialize: (opts: { apiUrl: string; gatewayUrl: string; token?: string | null; initialRoomId?: string }) => Promise<void>;
  disconnect: () => void;
  clearAuthError: () => void;
  clearRoomInvite: () => void;
  setActivePmTarget: (targetSocketId: string | null) => void;
  requestPresenceSync: (includeAll?: boolean) => void;
  fetchRoomHistory: (roomId?: string) => void;
  loginGuest: (username: string, extras?: { pic?: string; roomid?: string }) => void;
  loginMember: (username: string, password: string, extras?: { roomid?: string }) => void;
  registerMember: (username: string, password: string, extras?: { topic?: string }) => void;
  loginMemberHttp: (username: string, password: string) => Promise<void>;
  registerMemberHttp: (username: string, password: string, topic?: string) => Promise<void>;
  joinRoom: (roomId: string, pwd?: string) => void;
  leaveRoom: () => void;
  resumeRoom: (roomId?: string, pwd?: string) => void;
  createRoom: (payload: {
    topic: string;
    about: string;
    welcome: string;
    max?: number;
    mic?: number;
    micLocks?: Record<string, 0 | 1>;
    message_mode?: string;
    pass?: string;
    color?: string;
    like?: number;
    rmli?: number;
    delete?: boolean;
    broadcast?: boolean;
    pic?: string;
    ownerBadgeId?: string;
    ownerBadge?: Record<string, unknown>;
    stage_count?: number;
    is_live_audio?: boolean;
    room_type?: string;
    join_mode?: "free" | "request";
    gift_goal?: Record<string, unknown>;
    pinned_notice?: string;
    hourly_rank?: string;
  }) => void;
  updateLiveSettings: (payload: {
    roomId: string;
    topic?: string;
    join_mode?: "free" | "request";
    chat_locked?: boolean;
    gift_goal?: Record<string, unknown>;
  }) => void;
  editRoom: (payload: {
    id: string;
    topic?: string;
    about?: string;
    welcome?: string;
    max?: number;
    mic?: number;
    micLocks?: Record<string, 0 | 1>;
    message_mode?: string;
    pass?: string;
    color?: string;
    like?: number;
    rmli?: number;
    pic?: string;
    broadcast?: boolean;
    ownerTargetUser?: string;
    ownerBadgeId?: string;
    ownerBadge?: Record<string, unknown>;
  }) => void;
  deleteRoom: (roomId: string) => void;
  sendRoomMessage: (
    msg: string,
    replyOrOpts?: Record<string, unknown> | { reply?: Record<string, unknown> | null; file?: string; fileType?: string } | null,
  ) => void;
  likeRoomMessage: (mi: string) => void;
  deleteRoomMessage: (mi: string) => void;
  sendTyping: (isTyping: boolean, targetId?: string) => void;
  sendWallPost: (msg: string, opts?: { link?: string; pic?: string; card?: boolean }) => void;
  deleteWallPost: (bid: string) => void;
  commentWallPost: (bid: string, msg: string, replyToCid?: string) => void;
  likeWallPost: (bid: string, state?: 1 | 2) => void;
  sendPrivateMessage: (
    targetSocketId: string,
    msg: string,
    opts?: { file?: string; fileType?: string; variant?: "pmsg" | "pm" | "ppmsg" },
  ) => void;
  /** Notifies the peer (server → peer) that this thread is open & read. */
  markPmThreadRead: (targetSocketId: string) => void;
  sendPublicAnnouncement: (msg: string, hideSender?: boolean) => void;
  sendVoiceNote: (audioBase64OrDataUrl: string, mime: string, targetSocketId?: string) => void;
  sendGift: (targetSocketId: string, giftFile: string) => void;
  sendModerationAction: (
    subCmd: "like" | "not" | "meiut" | "kick" | "ban" | "delpic" | "rinvite" | "roomkick" | "gift_icon",
    payload: Record<string, unknown>,
  ) => void;
  unick: (targetSocketId: string, topic: string) => void;
  setLikes: (targetSocketId: string, likes: number) => void;
  setStatusMessage: (msg: string, targetSocketId?: string) => void;
  setSiteBadge: (badgeId: string, targetSocketId?: string) => void;
  setUserStat: (stat: number) => void;
  saveProfile: (patch: {
    topic?: string;
    msg?: string;
    bg?: string;
    ucol?: string;
    mcol?: string;
    gcol?: string;
    yp?: string;
    pic?: string;
  }) => void;
  setAvatar: (imgOrPath: string, isSecondary?: boolean, clear?: boolean) => void;
  changePassword: (oldpass: string, newpass: string) => void;
  setCosmetic: (kind: "bnr" | "uthem" | "ucover" | "udro3", val: string | null, targetSocketId?: string) => void;
  toggleBusy: () => void;
  toggleNoPm: () => void;
  toggleNoNot: () => void;
  toggleAlerts: () => void;
  toggleStealthLogin: (on?: boolean) => void;
  toggleCallPrivacy: (kind: "audio" | "video", enabled: boolean) => void;
  followUser: (uidOrSocketId: string, isSocketId?: boolean) => void;
  unfollowUser: (uidOrSocketId: string, isSocketId?: boolean) => void;
  getFollowInfo: (uidOrSocketId: string, isSocketId?: boolean) => void;
  emitMicAction: (
    cmd: "broadcasting" | "remic" | "micro" | "lock-slot" | "unlock-slot" | "listener-ready" | "speaking" | string,
    data: Record<string, unknown>,
  ) => void;
  setUserSpeakingLocal: (socketId: string, speaking: boolean) => void;
  carromManage: (action: "sit" | "stand" | "start" | "reset" | "stop" | "leave" | "join", seat?: number) => void;
  carromJoin: () => void;
  carromLeave: () => void;
  carromSync: () => void;
  carromPreview: (aim: { offset?: number; angle?: number; power?: number }) => void;
  carromShot: (shot: CarromShotInput) => void;
  ludoManage: (
    action: "sit" | "stand" | "start" | "reset" | "stop" | "add_bot" | "remove_bot",
    seat?: number,
  ) => void;
  ludoJoin: (seat?: number) => void;
  ludoLeave: () => void;
  ludoSync: () => void;
  ludoRoll: () => void;
  ludoMove: (tokenId: string) => void;
  controlCompetitionBot: (
    cmd:
      | "botbrb"
      | "enterbot"
      | "enterbotall"
      | "exitbotall"
      | "startbotchat"
      | "stopbotchat"
      | "addbots"
      | "deltbot"
      | "sendmsgbot",
    payload: Record<string, unknown> & {
      op?: "start" | "stop" | "scores";
      targetType?: "room" | "wall";
      targetId?: string;
      roomId?: string;
      kind?: CompetitionBotKind;
      action?: string;
      enabled?: boolean;
    },
  ) => void;
  requestCall: (targetSocketId: string, callType?: "audio" | "video") => void;
  acceptCall: () => void;
  rejectCall: (reason?: string) => void;
  endCall: (reason?: string) => void;
  sendCallSignal: (signalPayload: Record<string, unknown>) => void;
  searchMailUsers: (query: string) => void;
  loadMailBoxes: () => void;
  sendMail: (toUid: string, body: string) => void;
  markMailRead: (id: number) => void;
  fetchStories: () => void;
  publishStory: (
    linkOrPayload:
      | string
      | {
          link?: string;
          src?: string;
          mediaUrl?: string;
          type?: "image" | "video" | "text" | "audio" | string;
          length?: number;
          duration?: number;
          caption?: string;
          text?: string;
          bgColor?: string;
          textColor?: string;
        },
    type?: "image" | "video" | "text" | "audio" | string,
    length?: number,
  ) => void;
  deleteStory: (opts: { id?: number; sid?: string; itemId?: string }) => void;
  markStoryViewed: (storyOwnerSid: string, itemIdx?: number, itemId?: string) => void;
  getStoryViewers: (storyOwnerSid: string, itemId?: string, itemIdx?: number) => void;
  toggleStoryLike: (storySid: string, itemId: string) => void;
  fetchStoryLikers: (storySid: string, itemId: string) => void;
  fetchStoryComments: (storySid: string, itemId: string, sort?: "newest" | "top" | "oldest") => void;
  addStoryComment: (
    storySid: string,
    itemId: string,
    body: string,
    parentCid?: string,
    replyToTopic?: string,
  ) => void;
  toggleStoryCommentLike: (storySid: string, itemId: string, commentCid: string) => void;
  deleteStoryComment: (storySid: string, itemId: string, commentCid: string) => void;
  fetchNotes: () => void;
  publishNote: (payload: PublishNotePayload) => void;
  toggleNoteLike: (noteNid: string) => void;
  fetchNoteComments: (noteNid: string) => void;
  addNoteComment: (
    noteNid: string,
    body: string,
    parentCid?: string,
    replyToTopic?: string,
  ) => void;
  toggleNoteCommentLike: (noteNid: string, commentCid: string) => void;
  deleteNoteComment: (noteNid: string, commentCid: string) => void;
  deleteNote: (noteNid: string) => void;
  recordProfileVisit: (ownerUid: string) => void;
  fetchProfileVisitors: () => void;
  markProfileVisitsSeen: () => void;
  searchYoutube: (query: string, mode?: "videos" | "shorts") => void;
  resolveTikTok: (url: string, requestId?: string) => void;
  dismissNotice: (id: string) => void;
  pushNotice: (msg: string, opts?: { topic?: string; sound?: string; force?: number }) => void;
  logout: () => void;
}

const MAX_ROOM_MESSAGES = 300;
const SESSION_TOKEN_STORAGE_KEY = "newchat_session_token";
const TYPING_EXPIRY_MS = 4000;

const IDLE_CALL_STATE: PmCallState = {
  status: "idle",
  callId: "",
  peerId: "",
  peerTopic: "",
  peerPic: "",
  callType: "audio",
  isCaller: false,
};

let socketClient: NewChatSocketClient | null = null;
let apiClient: NewChatApiClient | null = null;
const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const stageSignalListeners = new Set<(payload: Record<string, unknown>) => void>();

/**
 * Resolves a PM thread key to the peer's CURRENT identity.
 * Accepts either the peer's stable uid (survives reconnects) or a live socket id,
 * and returns the peer's active socket id so the gateway can route to them.
 */
function resolvePeerTarget(
  key: string,
  onlineMap: Record<string, { id: string; uid?: string; lid?: string; topic?: string; pic?: string }>,
): { socketId: string; uid: string; user?: { topic?: string; pic?: string } } | null {
  if (!key) return null;
  const direct = onlineMap[key];
  if (direct?.id) {
    return { socketId: direct.id, uid: direct.uid || direct.lid || direct.id, user: direct };
  }
  for (const u of Object.values(onlineMap)) {
    if (u && (u.uid === key || u.id === key || u.lid === key)) {
      return { socketId: u.id, uid: u.uid || u.lid || u.id, user: u };
    }
  }
  return null;
}

function omitMapKeys(map: Record<string, string>, keys: string[]): Record<string, string> {
  const next = { ...map };
  for (const k of keys) delete next[k];
  return next;
}

export function subscribeStageSignals(
  listener: (payload: Record<string, unknown>) => void,
): () => void {
  stageSignalListeners.add(listener);
  return () => {
    stageSignalListeners.delete(listener);
  };
}

function loadPersistedSessionToken(): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const val = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      return val && val.trim() ? val.trim() : null;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function persistSessionToken(token: string | null): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      if (token && token.trim()) {
        window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token.trim());
      } else {
        window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
}

function resolveMessageSortTime(m: RoomMessagePayload): number {
  return Number(m.time || m._sts || m._cts || m._srt || 0);
}

function pushLimitedMessages(
  prev: RoomMessagePayload[],
  incoming: RoomMessagePayload | RoomMessagePayload[],
): RoomMessagePayload[] {
  const isSingle = !Array.isArray(incoming);
  const arr = isSingle ? [incoming] : incoming;
  const fallbackNow = Date.now();
  const seenKeys = new Set(prev.map((m) => m.mi || m.id || m._cid).filter(Boolean));
  const merged = [...prev];
  for (const rawItem of arr) {
    const item =
      isSingle && !resolveMessageSortTime(rawItem)
        ? { ...rawItem, time: fallbackNow }
        : rawItem;
    const key = item.mi || item.id || item._cid;
    if (key && seenKeys.has(key)) continue;
    if (key) seenKeys.add(key);
    merged.push(item);
  }
  merged.sort((a, b) => resolveMessageSortTime(a) - resolveMessageSortTime(b));
  return merged.length > MAX_ROOM_MESSAGES ? merged.slice(merged.length - MAX_ROOM_MESSAGES) : merged;
}

/** Index of the optimistic copy (local-fast mode) that a server echo confirms. */
function findPendingIndex(list: RoomMessagePayload[], cid: string): number {
  if (!cid) return -1;
  return list.findIndex((m) => m._cid === cid && m._pending === true);
}

/**
 * Swaps optimistic copies for their authoritative server echoes (same `_cid`),
 * so local-fast mode shows exactly ONE bubble per message — instantly, then
 * with real server ids/time. No-op unless a pending copy exists.
 */
function reconcilePendingEchoes(
  prev: RoomMessagePayload[],
  incoming: RoomMessagePayload[],
): RoomMessagePayload[] {
  let out = prev;
  for (const item of incoming) {
    const cid = item._cid ? String(item._cid) : "";
    const idx = findPendingIndex(out, cid);
    if (idx < 0) continue;
    if (out === prev) out = prev.slice();
    out[idx] = { ...item, _pending: false };
  }
  return out;
}

function parseLikesArray(rawLikes: unknown): string[] {
  if (Array.isArray(rawLikes)) {
    return rawLikes.map((x) => String(x));
  }
  if (typeof rawLikes === "string" && rawLikes.trim()) {
    try {
      const parsed = JSON.parse(rawLikes);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x));
      }
    } catch {
      // ignore malformed likes JSON
    }
  }
  return [];
}

function applyPresenceList(
  list: OnlineUserSnapshot[],
  prevMe: OnlineUserSnapshot | null,
  mySocketId: string,
  powers: readonly PowerRole[] = [],
): {
  onlineMap: Record<string, OnlineUserSnapshot>;
  onlineIds: string[];
  onlineCount: number;
  me: OnlineUserSnapshot | null;
} {
  const sorted = sortOnlineSnapshots(list, powers);
  const map: Record<string, OnlineUserSnapshot> = {};
  const ids: string[] = [];
  let meSnapshot = prevMe;
  for (const u of sorted) {
    if (!u?.id) continue;
    map[u.id] = u;
    ids.push(u.id);
    if (mySocketId && u.id === mySocketId) {
      meSnapshot = u;
    }
  }
  return {
    onlineMap: map,
    onlineIds: ids,
    onlineCount: ids.length,
    me: meSnapshot,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  apiUrl: "",
  gatewayUrl: "",
  connected: false,
  connecting: false,
  isAuthenticated: false,
  sessionToken: null,
  pendingDeepLinkRoomId: "",
  lastAuthError: null,
  roomInvite: null,
  me: null,
  myPowerRole: null,
  currentRoomId: "",
  onlineCount: 0,
  onlineMap: {},
  onlineIds: [],
  rooms: [],
  roomsCounts: {},
  powers: [],
  gifts: [],
  giftCategories: [],
  sicos: [],
  emos: [],
  dro3: [],
  themes: [],
  covers: [],
  roomBadges: [],
  siteBadges: [],
  shortcuts: [],
  site: null,
  siteFlags: {
    tv: "",
    pool: false,
    reply: true,
    love: false,
    maxRep: 3,
    cooment: false,
  },
  messages: [],
  wallPosts: [],
  stories: [],
  storyViewersMap: {},
  storyLikersMap: {},
  storyCommentsMap: {},
  notes: [],
  noteCommentsMap: {},
  followInfoMap: {},
  typingUsers: {},
  pmTypingUsers: {},
  stageState: {},
  listenersCount: 0,
  speakingUsers: {},
  lastStageSignal: null,
  carromState: null,
  carromPreviewState: null,
  lastCarromShotFx: null,
  ludoState: null,
  lastLudoEventFx: null,
  competitionState: null,
  pmThreads: {},
  pmReadState: {},
  activePmTargetId: null,
  unreadMailCount: 0,
  mailInbox: [],
  mailSent: [],
  mailSearchResults: [],
  visitorsCount: 0,
  visitorsList: [],
  callState: { ...IDLE_CALL_STATE },
  lastCallSignal: null,
  youtubeResults: [],
  lastTikTokResult: null,
  lastGiftFx: null,
  notices: [],

  getApiClient: () => {
    if (!apiClient) {
      apiClient = new NewChatApiClient(get().apiUrl);
    }
    return apiClient;
  },

  getSocketClient: () => socketClient,

  initialize: async ({ apiUrl, gatewayUrl, token, initialRoomId }) => {
    const resolvedToken = token !== undefined ? token : loadPersistedSessionToken();
    set({
      apiUrl,
      gatewayUrl,
      connecting: true,
      sessionToken: resolvedToken ?? null,
      pendingDeepLinkRoomId: initialRoomId ? String(initialRoomId).trim() : "",
    });
    apiClient = new NewChatApiClient(apiUrl);

    try {
      const boot = await apiClient.getBootstrap();
      const bootPowers = boot.powers || [];
      const sortedBootOnline = sortOnlineSnapshots(boot.online || [], bootPowers);
      const map: Record<string, OnlineUserSnapshot> = {};
      const ids: string[] = [];
      for (const u of sortedBootOnline) {
        if (u?.id) {
          map[u.id] = u;
          ids.push(u.id);
        }
      }
      set((s) => ({
        onlineCount: boot.onlineCount,
        onlineMap: map,
        onlineIds: ids,
        powers: bootPowers,
        rooms: boot.rooms,
        roomsCounts: boot.roomsCounts,
        shortcuts: boot.shortcuts ?? s.shortcuts,
        site: boot.site ?? s.site,
        sicos: boot.site?.sicos ?? s.sicos,
        emos: boot.site?.emos ?? s.emos,
        dro3: boot.site?.dro3 ?? s.dro3,
        themes: boot.site?.them ?? s.themes,
        covers: boot.site?.cover ?? s.covers,
        roomBadges: boot.site?.roomBadges ?? s.roomBadges,
        siteBadges: boot.site?.siteBadges ?? s.siteBadges,
        gifts: (boot.site?.giftsGit as unknown as GiftDefinition[]) ?? s.gifts,
        giftCategories: boot.site?.giftCategories ?? s.giftCategories,
      }));
    } catch {
      // Allow socket connection to continue even if HTTP bootstrap is warming up
    }

    if (socketClient) {
      socketClient.disconnect();
    }
    socketClient = new NewChatSocketClient();
    const raw = socketClient.connect(gatewayUrl);

    raw.on("connect", () => {
      set({ connected: true, connecting: false });
      const savedToken = get().sessionToken;
      const targetRoom = get().currentRoomId || get().pendingDeepLinkRoomId || undefined;
      if (savedToken) {
        socketClient?.reconnectWithToken(savedToken, targetRoom);
      }
    });

    raw.on("disconnect", () => {
      set({ connected: false, connecting: false });
    });

    socketClient.onCmd("ok", (data) => {
      const userObj = (data?.user && typeof data.user === "object" ? data.user : data) as OnlineUserSnapshot | null;
      const nextToken = String(data?.token || get().sessionToken || "").trim() || null;
      persistSessionToken(nextToken);
      set((s) => ({
        isAuthenticated: true,
        lastAuthError: null,
        sessionToken: nextToken,
        currentRoomId: data?.roomId || data?.roomid || s.currentRoomId,
        me: userObj?.id ? userObj : s.me,
      }));
    });

    socketClient.onCmd("sagin", (data) => {
      if (data?.msg === "ok") {
        const nextToken = String(data.ttoken || get().sessionToken || "").trim() || null;
        persistSessionToken(nextToken);
        set((s) => ({
          isAuthenticated: true,
          lastAuthError: null,
          sessionToken: nextToken,
          currentRoomId: data.room || s.currentRoomId,
        }));
      } else if (data?.msg) {
        set({ lastAuthError: String(data.msg) });
      }
    });

    socketClient.onCmd("nok", (data) => {
      const errMsg = String(data?.msg || data || "تعذر إتمام العملية");
      set({ lastAuthError: errMsg });
    });

    socketClient.onCmd("reauth_silent", () => {
      persistSessionToken(null);
      set({ isAuthenticated: false, sessionToken: null, me: null });
    });

    socketClient.onCmd("rc_room_state", (data) => {
      if (data?.roomid) {
        set({ currentRoomId: String(data.roomid) });
      }
    });

    socketClient.onCmd("not", (data) => {
      if (!data?.msg) return;
      get().pushNotice(String(data.msg), {
        topic: data.topic ? String(data.topic) : undefined,
        sound: data.sound ? String(data.sound) : undefined,
        force: data.force,
      });
    });

    socketClient.onCmd("alert", (data) => {
      const msg = typeof data === "string" ? data : String(data?.msg || "");
      if (!msg) return;
      get().pushNotice(msg, { force: 1 });
    });

    const handlePresenceArray = (list: unknown) => {
      if (!Array.isArray(list)) return;
      const mySocketId = socketClient?.id ?? "";
      set((s) => applyPresenceList(list as OnlineUserSnapshot[], s.me, mySocketId, s.powers));
    };
    socketClient.onCmd("ulist", handlePresenceArray);
    socketClient.onCmd("presence_sync", handlePresenceArray);

    socketClient.onCmd("u+", (u: OnlineUserSnapshot) => {
      if (!u?.id) return;
      set((s) => {
        const nextMap = { ...s.onlineMap, [u.id]: u };
        const sortedList = sortOnlineSnapshots(Object.values(nextMap), s.powers);
        const nextIds = sortedList.map((x) => x.id);
        const isMe = u.id === socketClient?.id;
        return {
          onlineMap: nextMap,
          onlineIds: nextIds,
          onlineCount: nextIds.length,
          me: isMe ? u : s.me,
          currentRoomId: isMe && u.roomid ? u.roomid : s.currentRoomId,
        };
      });
    });

    socketClient.onCmd("u^", (u: OnlineUserSnapshot) => {
      if (!u?.id) return;
      set((s) => {
        const prevUser = s.onlineMap[u.id];
        const nextUser = { ...prevUser, ...u };
        const nextMap = { ...s.onlineMap, [u.id]: nextUser };
        const isMe = u.id === socketClient?.id || (Boolean(s.me?.uid) && s.me?.uid === u.uid);
        const rankOrPointsChanged = !prevUser ||
          prevUser.power !== nextUser.power ||
          prevUser.rank !== nextUser.rank ||
          prevUser.evaluation !== nextUser.evaluation ||
          prevUser.topic !== nextUser.topic;
        const nextIds = rankOrPointsChanged
          ? sortOnlineSnapshots(Object.values(nextMap), s.powers).map((x) => x.id)
          : s.onlineIds;
        return {
          onlineMap: nextMap,
          onlineIds: nextIds,
          me: isMe ? nextUser : s.me,
        };
      });
    });

    socketClient.onCmd("u-", (id: string) => {
      if (!id) return;
      set((s) => {
        if (!s.onlineMap[id]) return s;
        const nextMap = { ...s.onlineMap };
        delete nextMap[id];
        const nextIds = s.onlineIds.filter((x) => x !== id);
        return {
          onlineMap: nextMap,
          onlineIds: nextIds,
          onlineCount: nextIds.length,
        };
      });
    });

    socketClient.onCmd("ur", (data: { id?: string; room?: string; roomid?: string }) => {
      const uid = data?.id;
      const room = data?.room ?? data?.roomid ?? "";
      if (!uid) return;
      set((s) => {
        const prevUser = s.onlineMap[uid];
        const updated = prevUser ? { ...prevUser, roomid: room } : prevUser;
        const isMe = uid === socketClient?.id;
        const switchedMyRoom = Boolean(isMe && room && room !== s.currentRoomId);
        return {
          onlineMap: prevUser && updated ? { ...s.onlineMap, [uid]: updated } : s.onlineMap,
          me: isMe && updated ? updated : s.me,
          currentRoomId: isMe ? room : s.currentRoomId,
          ...(switchedMyRoom
            ? {
                messages: [],
                typingUsers: {},
                stageState: {},
                listenersCount: 0,
                speakingUsers: {},
                carromState: null,
                ludoState: null,
                competitionState: null,
              }
            : {}),
        };
      });
    });

    socketClient.onCmd("rlist", (rooms: RoomSnapshot[]) => {
      if (Array.isArray(rooms)) set({ rooms });
    });
    socketClient.onCmd("r+", (room: RoomSnapshot) => {
      if (!room?.id) return;
      set((s) => ({ rooms: [...s.rooms.filter((r) => r.id !== room.id), room] }));
    });
    socketClient.onCmd("r-", (roomId: string) => {
      set((s) => ({ rooms: s.rooms.filter((r) => r.id !== roomId) }));
    });
    socketClient.onCmd("r^", (room: RoomSnapshot) => {
      if (!room?.id) return;
      set((s) => ({ rooms: s.rooms.map((r) => (r.id === room.id ? { ...r, ...room } : r)) }));
    });
    socketClient.onCmd("rjoin", (room: RoomSnapshot) => {
      if (!room?.id) return;
      set((s) => {
        const changedRoom = room.id !== s.currentRoomId;
        return {
          messages: changedRoom ? [] : s.messages,
          typingUsers: changedRoom ? {} : s.typingUsers,
          stageState: changedRoom ? {} : s.stageState,
          listenersCount: changedRoom ? 0 : s.listenersCount,
          speakingUsers: changedRoom ? {} : s.speakingUsers,
          carromState: changedRoom ? null : s.carromState,
          ludoState: changedRoom ? null : s.ludoState,
          competitionState: changedRoom ? null : s.competitionState,
          currentRoomId: room.id,
          rooms: s.rooms.some((r) => r.id === room.id)
            ? s.rooms.map((r) => (r.id === room.id ? { ...r, ...room } : r))
            : [...s.rooms, room],
        };
      });
    });
    socketClient.onCmd("rjoinad", (data) => {
      if (!data?.roomid) return;
      set({
        roomInvite: {
          roomid: String(data.roomid),
          roomTopic: String(data.roomTopic || "غرفة"),
          byTopic: String(data.byTopic || "عضو"),
          pass: data.pass ? String(data.pass) : "",
        },
      });
    });
    socketClient.onCmd("lavedon", (data) => {
      const msgText = data?.by
        ? `تم طردك من الغرفة بواسطة ${String(data.by)}`
        : "تم نقلك إلى الغرفة الرئيسية";
      get().pushNotice(msgText, { force: 1 });
    });
    socketClient.onCmd("rleave", () => {
      set({
        currentRoomId: "",
        stageState: {},
        listenersCount: 0,
        speakingUsers: {},
        carromState: null,
        ludoState: null,
        competitionState: null,
      });
    });
    socketClient.onCmd("room_resume", (data) => {
      if (data?.roomId || data?.roomid) {
        set({ currentRoomId: String(data.roomId || data.roomid) });
      }
    });
    socketClient.onCmd("rooms_counts", (data) => {
      const counts = data?.counts && typeof data.counts === "object" ? data.counts : data;
      if (counts && typeof counts === "object") {
        set({ roomsCounts: counts as Record<string, number> });
      }
    });

    socketClient.onCmd("powers", (powers: PowerRole[]) => {
      if (Array.isArray(powers)) set({ powers });
    });
    socketClient.onCmd("power", (role: PowerRole) => {
      if (role && typeof role === "object") set({ myPowerRole: role });
    });
    socketClient.onCmd("gifts_git", (data) => {
      if (data && typeof data === "object") {
        set({
          gifts: Array.isArray(data.gifts) ? data.gifts : [],
          giftCategories: Array.isArray(data.categories) ? data.categories : [],
        });
      }
    });
    socketClient.onCmd("sicos", (d) => Array.isArray(d) && set({ sicos: d }));
    socketClient.onCmd("emos", (d) => Array.isArray(d) && set({ emos: d }));
    socketClient.onCmd("dro3", (d) => Array.isArray(d) && set({ dro3: d }));
    socketClient.onCmd("them", (d) => Array.isArray(d) && set({ themes: d }));
    socketClient.onCmd("cover", (d) => Array.isArray(d) && set({ covers: d }));
    socketClient.onCmd("room_badges", (d) => Array.isArray(d) && set({ roomBadges: d }));
    socketClient.onCmd("site_badges", (d) => Array.isArray(d) && set({ siteBadges: d }));
    socketClient.onCmd("mic_provider", (data) => {
      if (!data || typeof data !== "object") return;
      const nextProvider = String((data as { micProvider?: unknown; provider?: unknown }).micProvider ?? (data as { provider?: unknown }).provider ?? "")
        .trim()
        .toUpperCase();
      const nextWsUrl =
        typeof (data as { liveKitWsUrl?: unknown }).liveKitWsUrl === "string"
          ? String((data as { liveKitWsUrl?: string }).liveKitWsUrl)
          : undefined;
      if (!nextProvider) return;
      set((s) => ({
        site: {
          ...(s.site ?? {}),
          micProvider: nextProvider,
          ...(nextWsUrl !== undefined ? { liveKitWsUrl: nextWsUrl } : {}),
        },
      }));
    });

    socketClient.onCmd("IsTv", (d) => {
      if (!d || typeof d !== "object") return;
      set((s) => ({
        siteFlags: {
          ...s.siteFlags,
          tv: String(d.tv || ""),
          pool: Boolean(d.pool),
          reply: d.reply !== undefined ? Boolean(d.reply) : s.siteFlags.reply,
          love: Boolean(d.love),
        },
      }));
    });
    socketClient.onCmd("Maxrep", (val) => {
      set((s) => ({ siteFlags: { ...s.siteFlags, maxRep: Number(val) || 3 } }));
    });
    socketClient.onCmd("coom", (val) => {
      set((s) => ({ siteFlags: { ...s.siteFlags, cooment: Boolean(val) } }));
    });

    socketClient.onCmd("gh", (data) => {
      const targetRoom = String(data?.roomid || "");
      const rows = Array.isArray(data?.messages) ? (data.messages as RoomMessagePayload[]) : [];
      if (!rows.length) return;
      if (targetRoom && targetRoom !== get().currentRoomId) return;
      set((s) => ({ messages: pushLimitedMessages(s.messages, rows) }));
    });
    socketClient.onCmd("msg", (payload: RoomMessagePayload) => {
      if (!payload) return;
      const msgRecord = payload as RoomMessagePayload & { actionType?: string };
      set((s) => {
        if (
          msgRecord.roomid &&
          s.currentRoomId &&
          msgRecord.roomid !== s.currentRoomId &&
          msgRecord.actionType !== "room_move"
        ) {
          return s;
        }
        // Local-fast mode: swap the optimistic bubble for the server echo.
        const reconciled = reconcilePendingEchoes(s.messages, [msgRecord]);
        if (reconciled !== s.messages) return { messages: reconciled };
        return { messages: pushLimitedMessages(s.messages, payload) };
      });
    });
    socketClient.onCmd("msg_batch", (batch: RoomMessagePayload[]) => {
      if (!Array.isArray(batch)) return;
      set((s) => {
        const filtered = batch.filter(
          (m) => !m?.roomid || !s.currentRoomId || m.roomid === s.currentRoomId,
        );
        if (!filtered.length) return s;
        const reconciled = reconcilePendingEchoes(s.messages, filtered);
        return { messages: pushLimitedMessages(reconciled, filtered) };
      });
    });
    socketClient.onCmd("delmsg", (mi: string) => {
      set((s) => ({
        messages: s.messages.filter((m) => (m.mi ?? m.id) !== mi),
      }));
    });
    socketClient.onCmd("likemsg", (data) => {
      const mi = String(data?.mi || "");
      const liker = String(data?.uid || data?.id || "");
      if (!mi || !liker) return;
      set((s) => ({
        messages: s.messages.map((m) => {
          if ((m.mi ?? m.id) !== mi) return m;
          const prevLikes = Array.isArray(m.likes) ? m.likes : [];
          if (prevLikes.includes(liker)) return m;
          return { ...m, likes: [...prevLikes, liker] };
        }),
      }));
    });

    socketClient.onCmd("bc", (post: BroadcastWallPost) => {
      if (!post) return;
      set((s) => ({
        wallPosts: [post, ...s.wallPosts.filter((p) => p.bid !== post.bid)].slice(0, 100),
      }));
    });
    socketClient.onCmd("bc^", (data) => {
      const bid = String(data?.bid || "");
      if (!bid) return;
      const likes = parseLikesArray(data?.likes);
      set((s) => ({
        wallPosts: s.wallPosts.map((p) => (p.bid === bid ? { ...p, likes } : p)),
      }));
    });
    const handleWallCommentUpdate = (data: any) => {
      const bid = String(data?.bid || "");
      if (!bid) return;
      set((s) => ({
        wallPosts: s.wallPosts.map((p) => {
          if (p.bid !== bid) return p;
          const nextComments = Array.isArray(data.bcc)
            ? data.bcc
            : data.comment
              ? [...p.bcc, data.comment]
              : p.bcc;
          return { ...p, bcc: nextComments };
        }),
      }));
    };
    socketClient.onCmd("bcco", handleWallCommentUpdate);
    socketClient.onCmd("bcco_reply", handleWallCommentUpdate);
    const removeWallPost = (bidOrData: unknown) => {
      const bid =
        typeof bidOrData === "string"
          ? bidOrData
          : String((bidOrData as { bid?: string; id?: string } | null)?.bid || (bidOrData as { id?: string } | null)?.id || "");
      if (!bid) return;
      set((s) => ({ wallPosts: s.wallPosts.filter((p) => p.bid !== bid) }));
    };
    socketClient.onCmd("delbc", removeWallPost);
    socketClient.onCmd("fildel", removeWallPost);

    const setStoriesList = (incoming: unknown, preservePersonalFlags = false) => {
      if (!Array.isArray(incoming)) return;
      if (!preservePersonalFlags) {
        set({ stories: incoming });
        return;
      }
      set((s) => {
        const prevItemFlags = new Map<string, { viewedByMe?: boolean; likedByMe?: boolean }>();
        for (const st of s.stories) {
          const sid = String(st.sid || "");
          const items = Array.isArray(st.item) ? (st.item as Array<Record<string, unknown>>) : [];
          for (const it of items) {
            const id = String(it.id || "");
            if (sid && id) {
              prevItemFlags.set(`${sid}::${id}`, {
                viewedByMe: Boolean(it.viewedByMe),
                likedByMe: Boolean(it.likedByMe),
              });
            }
          }
        }
        const merged = (incoming as Array<Record<string, unknown>>).map((st) => {
          const sid = String(st.sid || "");
          const items = Array.isArray(st.item) ? (st.item as Array<Record<string, unknown>>) : [];
          const nextItems = items.map((it) => {
            const id = String(it.id || "");
            const old = prevItemFlags.get(`${sid}::${id}`);
            if (!old) return it;
            return {
              ...it,
              viewedByMe: old.viewedByMe ?? Boolean(it.viewedByMe),
              likedByMe: old.likedByMe ?? Boolean(it.likedByMe),
            };
          });
          const hasUnviewed = nextItems.some((it) => !it.viewedByMe);
          return { ...st, item: nextItems, hasUnviewed, seen: !hasUnviewed };
        });
        return { stories: merged };
      });
    };
    socketClient.onCmd("stories", (data) => setStoriesList(data, true));
    socketClient.onCmd("stori", (data) => setStoriesList(data, false));

    socketClient.onCmd("rremstori", (data) => {
      const targetItemId = data?.itemId ? String(data.itemId) : "";
      set((s) => ({
        stories: s.stories
          .map((st) => {
            const matchesStory =
              (data?.id && Number(st.id) === Number(data.id)) ||
              (data?.sid && String(st.sid) === String(data.sid));
            if (!matchesStory) return st;
            if (!targetItemId) return null;
            const items = Array.isArray(st.item) ? (st.item as Array<Record<string, unknown>>) : [];
            const nextItems = items.filter((it) => String(it.id || "") !== targetItemId);
            if (nextItems.length === 0) return null;
            return { ...st, item: nextItems };
          })
          .filter(Boolean) as Array<Record<string, unknown>>,
      }));
    });

    socketClient.onCmd("sviw", (data) => {
      const sid = String(data?.sid || "");
      if (!sid) return;
      const viewers = Array.isArray(data?.viewers) ? data.viewers : [];
      const itemId = String(data?.itemId || "");
      const likers = Array.isArray(data?.likers) ? (data.likers as StoryLikeRecord[]) : null;
      set((s) => ({
        storyViewersMap: { ...s.storyViewersMap, [sid]: viewers },
        ...(likers && itemId
          ? { storyLikersMap: { ...s.storyLikersMap, [`${sid}::${itemId}`]: likers } }
          : {}),
      }));
    });

    socketClient.onCmd("story_viewed_update", (data) => {
      const sid = String(data?.sid || "");
      const itemIdx = Number(data?.itemIdx ?? -1);
      const itemId = String(data?.itemId || "");
      const viewerKey = String(data?.viewerKey || "");
      const viewsCount = Number(data?.viewsCount || 0);
      if (!sid) return;
      set((s) => {
        const myKey = String(s.me?.uid || s.me?.lid || "");
        const isMe = Boolean(myKey && viewerKey && myKey === viewerKey);
        return {
          stories: s.stories.map((st) => {
            if (String(st.sid || "") !== sid) return st;
            const items = Array.isArray(st.item) ? (st.item as Array<Record<string, unknown>>) : [];
            const nextItems = items.map((it, idx) => {
              const matched = (itemId && String(it.id || "") === itemId) || idx === itemIdx;
              if (!matched) return it;
              return {
                ...it,
                viewsCount,
                ...(isMe ? { viewedByMe: true } : {}),
              };
            });
            const hasUnviewed = nextItems.some((it) => !it.viewedByMe);
            return { ...st, item: nextItems, hasUnviewed, seen: !hasUnviewed };
          }),
        };
      });
    });

    socketClient.onCmd("story_likes_list", (data) => {
      const storySid = String(data?.storySid || "");
      const itemId = String(data?.itemId || "");
      if (!storySid || !itemId) return;
      const likers = Array.isArray(data?.likers) ? (data.likers as StoryLikeRecord[]) : [];
      set((s) => ({
        storyLikersMap: { ...s.storyLikersMap, [`${storySid}::${itemId}`]: likers },
      }));
    });

    socketClient.onCmd("story_like_updated", (data) => {
      const storySid = String(data?.storySid || "");
      const itemId = String(data?.itemId || "");
      const userUid = String(data?.userUid || "");
      const liked = Boolean(data?.liked);
      const likesCount = Math.max(0, Number(data?.likesCount || 0));
      if (!storySid || !itemId) return;
      const key = `${storySid}::${itemId}`;
      set((s) => {
        const isMe = Boolean(s.me?.uid && s.me.uid === userUid);
        const existingLikers = s.storyLikersMap[key];
        let nextLikers = existingLikers;
        if (existingLikers) {
          if (liked) {
            if (!existingLikers.some((l) => l.user_uid === userUid)) {
              nextLikers = [
                {
                  user_uid: userUid,
                  topic: String(data?.userTopic || ""),
                  photo: String(data?.userPic || "pic.png"),
                  created_at: Date.now(),
                },
                ...existingLikers,
              ];
            }
          } else {
            nextLikers = existingLikers.filter((l) => l.user_uid !== userUid);
          }
        }
        return {
          stories: s.stories.map((st) => {
            if (String(st.sid || "") !== storySid) return st;
            const items = Array.isArray(st.item) ? (st.item as Array<Record<string, unknown>>) : [];
            const nextItems = items.map((it) =>
              String(it.id || "") === itemId
                ? { ...it, likesCount, ...(isMe ? { likedByMe: liked } : {}) }
                : it,
            );
            return { ...st, item: nextItems };
          }),
          ...(nextLikers ? { storyLikersMap: { ...s.storyLikersMap, [key]: nextLikers } } : {}),
        };
      });
    });

    socketClient.onCmd("story_comments_list", (data) => {
      const storySid = String(data?.storySid || "");
      const itemId = String(data?.itemId || "");
      if (!storySid || !itemId) return;
      const comments = Array.isArray(data?.comments) ? (data.comments as StoryCommentRecord[]) : [];
      set((s) => ({
        storyCommentsMap: { ...s.storyCommentsMap, [`${storySid}::${itemId}`]: comments },
      }));
    });

    socketClient.onCmd("story_comment_added", (data) => {
      const storySid = String(data?.storySid || "");
      const itemId = String(data?.itemId || "");
      const comment = data?.comment as StoryCommentRecord | undefined;
      const commentsCount = Number(data?.commentsCount ?? -1);
      if (!storySid || !itemId || !comment?.cid) return;
      const key = `${storySid}::${itemId}`;
      set((s) => {
        const current = s.storyCommentsMap[key] || [];
        const exists = current.some((c) => c.cid === comment.cid);
        const nextList = exists ? current : [comment, ...current];
        return {
          storyCommentsMap: { ...s.storyCommentsMap, [key]: nextList },
          stories: s.stories.map((st) => {
            if (String(st.sid || "") !== storySid) return st;
            const items = Array.isArray(st.item) ? (st.item as Array<Record<string, unknown>>) : [];
            const nextItems = items.map((it) =>
              String(it.id || "") === itemId
                ? {
                    ...it,
                    commentsCount:
                      commentsCount >= 0 ? commentsCount : Math.max(0, Number(it.commentsCount || 0) + 1),
                  }
                : it,
            );
            return { ...st, item: nextItems };
          }),
        };
      });
    });

    // Dedicated Member Notes Socket Handlers (Separate from Stories)
    socketClient.onCmd("notes_list", (data) => {
      if (Array.isArray(data)) {
        set({ notes: data as UserNoteRecord[] });
      }
    });

    socketClient.onCmd("note_like_updated", (data) => {
      const noteNid = String(data?.noteNid || "");
      const likesCount = Number(data?.likesCount ?? 0);
      const liked = data?.liked !== undefined ? Boolean(data.liked) : undefined;
      if (!noteNid) return;
      set((s) => ({
        notes: s.notes.map((n) =>
          n.nid === noteNid
            ? { ...n, likesCount, ...(liked !== undefined ? { likedByMe: liked } : {}) }
            : n
        ),
      }));
    });

    socketClient.onCmd("note_comments_list", (data) => {
      const noteNid = String(data?.noteNid || "");
      const comments = Array.isArray(data?.comments) ? (data.comments as NoteCommentRecord[]) : [];
      if (!noteNid) return;
      set((s) => ({
        noteCommentsMap: { ...s.noteCommentsMap, [noteNid]: comments },
      }));
    });

    socketClient.onCmd("note_comment_added", (data) => {
      const noteNid = String(data?.noteNid || "");
      const comment = data?.comment as NoteCommentRecord;
      const commentsCount = Number(data?.commentsCount ?? 0);
      if (!noteNid) return;
      set((s) => {
        const existing = s.noteCommentsMap[noteNid] || [];
        const alreadyExists = comment && existing.some((c) => c.cid === comment.cid);
        const nextComments = alreadyExists
          ? existing
          : comment
          ? [...existing, comment]
          : existing;
        return {
          notes: s.notes.map((n) => (n.nid === noteNid ? { ...n, commentsCount } : n)),
          noteCommentsMap: {
            ...s.noteCommentsMap,
            [noteNid]: nextComments,
          },
        };
      });
    });

    socketClient.onCmd("note_comment_like_updated", (data) => {
      const noteNid = String(data?.noteNid || "");
      const commentCid = String(data?.commentCid || "");
      const likesCount = Number(data?.likesCount ?? 0);
      const liked = data?.liked !== undefined ? Boolean(data.liked) : undefined;
      if (!noteNid || !commentCid) return;
      set((s) => {
        const list = s.noteCommentsMap[noteNid];
        if (!list) return s;
        return {
          noteCommentsMap: {
            ...s.noteCommentsMap,
            [noteNid]: list.map((c) =>
              c.cid === commentCid
                ? {
                    ...c,
                    likesCount,
                    likes_count: likesCount,
                    ...(liked !== undefined ? { likedByMe: liked, liked_by_me: liked } : {}),
                  }
                : c
            ),
          },
        };
      });
    });

    socketClient.onCmd("note_comment_deleted", (data) => {
      const noteNid = String(data?.noteNid || "");
      const commentCid = String(data?.commentCid || "");
      const commentsCount = Number(data?.commentsCount ?? 0);
      if (!noteNid || !commentCid) return;
      const deletedCids = new Set<string>(
        Array.isArray(data?.deletedCids) ? data.deletedCids.map(String) : [commentCid],
      );
      set((s) => ({
        notes: s.notes.map((n) => (n.nid === noteNid ? { ...n, commentsCount } : n)),
        noteCommentsMap: {
          ...s.noteCommentsMap,
          [noteNid]: (s.noteCommentsMap[noteNid] || []).filter((c) => !deletedCids.has(c.cid)),
        },
      }));
    });

    socketClient.onCmd("note_deleted", (data) => {
      const noteNid = String(data?.noteNid || "");
      if (!noteNid) return;
      set((s) => ({
        notes: s.notes.filter((n) => n.nid !== noteNid),
      }));
    });

    socketClient.onCmd("story_comment_like_updated", (data) => {
      const storySid = String(data?.storySid || "");
      const itemId = String(data?.itemId || "");
      const commentCid = String(data?.commentCid || "");
      const userUid = String(data?.userUid || "");
      const liked = Boolean(data?.liked);
      const likesCount = Math.max(0, Number(data?.likesCount || 0));
      if (!storySid || !itemId || !commentCid) return;
      const key = `${storySid}::${itemId}`;
      set((s) => {
        const current = s.storyCommentsMap[key];
        if (!current) return s;
        const isMe = Boolean(s.me?.uid && s.me.uid === userUid);
        return {
          storyCommentsMap: {
            ...s.storyCommentsMap,
            [key]: current.map((c) =>
              c.cid === commentCid
                ? { ...c, likes_count: likesCount, ...(isMe ? { liked_by_me: liked } : {}) }
                : c,
            ),
          },
        };
      });
    });

    socketClient.onCmd("story_comment_deleted", (data) => {
      const storySid = String(data?.storySid || "");
      const itemId = String(data?.itemId || "");
      const deletedCids = new Set<string>(
        Array.isArray(data?.deletedCids) ? data.deletedCids.map(String) : [String(data?.commentCid || "")],
      );
      const commentsCount = Number(data?.commentsCount ?? -1);
      if (!storySid || !itemId) return;
      const key = `${storySid}::${itemId}`;
      set((s) => {
        const current = s.storyCommentsMap[key];
        return {
          ...(current
            ? {
                storyCommentsMap: {
                  ...s.storyCommentsMap,
                  [key]: current.filter((c) => !deletedCids.has(c.cid)),
                },
              }
            : {}),
          stories: s.stories.map((st) => {
            if (String(st.sid || "") !== storySid) return st;
            const items = Array.isArray(st.item) ? (st.item as Array<Record<string, unknown>>) : [];
            const nextItems = items.map((it) =>
              String(it.id || "") === itemId
                ? {
                    ...it,
                    commentsCount:
                      commentsCount >= 0 ? commentsCount : Math.max(0, Number(it.commentsCount || 0) - 1),
                  }
                : it,
            );
            return { ...st, item: nextItems };
          }),
        };
      });
    });

    const handleFollowSnapshot = (data: any) => {
      const uid = String(data?.uid || "");
      if (!uid) return;
      set((s) => ({
        followInfoMap: {
          ...s.followInfoMap,
          [uid]: {
            uid,
            followersCount: Math.max(0, Number(data?.followersCount || 0)),
            followingCount: Math.max(0, Number(data?.followingCount || 0)),
            isFollowing: Boolean(data?.isFollowing),
          },
        },
      }));
    };
    socketClient.onCmd("follow_info", handleFollowSnapshot);
    socketClient.onCmd("follow_updated", handleFollowSnapshot);
    socketClient.onCmd("savedone", (data) => {
      const pic = data?.pic ? String(data.pic) : "";
      if (!pic) return;
      const isSecondary = data?.cmd === "setpic2";
      set((s) => ({
        me: s.me ? { ...s.me, ...(isSecondary ? { pich: pic } : { pic }) } : s.me,
      }));
    });
    socketClient.onCmd("savepic", (data) => {
      if (data?.pic) {
        set((s) => ({ me: s.me ? { ...s.me, pic: String(data.pic) } : s.me }));
      }
    });
    socketClient.onCmd("savepic2", (data) => {
      if (data?.pic) {
        set((s) => ({ me: s.me ? { ...s.me, pich: String(data.pic) } : s.me }));
      }
    });
    socketClient.onCmd("isstates", (data) => {
      if (!data?.id) return;
      const uid = String(data.id);
      const stat = Number(data.stat ?? 0);
      set((s) => ({
        me: s.me && s.me.id === uid ? { ...s.me, stat } : s.me,
        onlineMap: s.onlineMap[uid] ? { ...s.onlineMap, [uid]: { ...s.onlineMap[uid]!, stat } } : s.onlineMap,
      }));
    });

    socketClient.onEvent("broadcasting", (payload: Record<string, unknown>) => {
      if (!payload || typeof payload !== "object") return;
      const bCmd = String(payload.cmd || "");
      if (bCmd === "all") {
        const nextData =
          payload.data && typeof payload.data === "object"
            ? (payload.data as Record<string, { id?: string; ev?: boolean }>)
            : {};
        const nextMuted =
          payload.mutedUsers && typeof payload.mutedUsers === "object"
            ? (payload.mutedUsers as Record<string, boolean>)
            : {};
        const activeIds = new Set(
          Object.values(nextData)
            .filter((slot) => Boolean(slot?.ev && slot?.id))
            .map((slot) => String(slot.id)),
        );
        set((s) => {
          const nextSpeaking: Record<string, boolean> = {};
          for (const [uid, isSpk] of Object.entries(s.speakingUsers)) {
            if (isSpk && activeIds.has(uid) && !nextMuted[uid]) {
              nextSpeaking[uid] = true;
            }
          }
          return {
            stageState: {
              roomid: payload.roomid,
              data: nextData,
              micCount: payload.micCount ?? 5,
              lockedSlots: payload.lockedSlots ?? {},
              mutedUsers: nextMuted,
            },
            speakingUsers: nextSpeaking,
          };
        });
      } else if (bCmd === "listeners-count") {
        set({ listenersCount: Math.max(0, Number(payload.count || 0)) });
      } else if (bCmd === "mic-state") {
        const uid = String(payload.user || "");
        if (!uid) return;
        const mutedVal = Boolean(payload.muted);
        set((s) => {
          const prevMuted =
            s.stageState.mutedUsers && typeof s.stageState.mutedUsers === "object"
              ? (s.stageState.mutedUsers as Record<string, boolean>)
              : {};
          return {
            stageState: {
              ...s.stageState,
              mutedUsers: { ...prevMuted, [uid]: mutedVal },
            },
            speakingUsers: mutedVal
              ? { ...s.speakingUsers, [uid]: false }
              : s.speakingUsers,
          };
        });
      } else if (bCmd === "speaking") {
        const uid = String(payload.user || "");
        if (uid) {
          set((s) => ({
            speakingUsers: { ...s.speakingUsers, [uid]: Boolean(payload.speaking) },
          }));
        }
      } else {
        if (bCmd === "rleave") {
          const uid = String(payload.user || "");
          if (uid) {
            set((s) => ({
              speakingUsers: { ...s.speakingUsers, [uid]: false },
              lastStageSignal: payload,
            }));
          } else {
            set({ lastStageSignal: payload });
          }
        } else {
          set({ lastStageSignal: payload });
        }
      }

      if (stageSignalListeners.size > 0) {
        stageSignalListeners.forEach((fn) => {
          try {
            fn(payload);
          } catch {
            // ignore isolated listener errors
          }
        });
      }
    });

    socketClient.onCmd("mic-state", (state) => {
      if (state && typeof state === "object") set({ stageState: state });
    });
    socketClient.onCmd("listeners-count", (count: number) => {
      set({ listenersCount: Number(count) || 0 });
    });

    socketClient.onCmd("carrom_state", (state: CarromPublicState) => {
      if (state && typeof state === "object") set({ carromState: state });
    });
    socketClient.onCmd("carrom_preview", (data) => {
      if (data && typeof data === "object") set({ carromPreviewState: data });
    });
    socketClient.onCmd("carrom_shot_fired", (data) => {
      if (data && typeof data === "object") {
        set((s) => ({
          lastCarromShotFx: data,
          carromState: data.state && typeof data.state === "object" ? (data.state as CarromPublicState) : s.carromState,
        }));
      }
    });
    socketClient.onCmd("carrom_notice", (data) => {
      if (data?.msg) get().pushNotice(String(data.msg), { topic: "الكيرم" });
    });
    socketClient.onCmd("ludo_state", (state: LudoPublicState) => {
      if (state && typeof state === "object") set({ ludoState: state });
    });
    socketClient.onCmd("ludo_event", (data) => {
      if (data && typeof data === "object") set({ lastLudoEventFx: { ...data, _ts: Date.now() } });
    });
    socketClient.onCmd("ludo_notice", (data) => {
      if (data?.msg) get().pushNotice(String(data.msg), { topic: "اللودو" });
    });
    socketClient.onCmd("room_competition_state", (state: RoomCompetitionState) => {
      if (state && typeof state === "object") set({ competitionState: state });
    });

    socketClient.onCmd("gift_room_fx", (data) => {
      if (data && typeof data === "object") set({ lastGiftFx: data });
    });

    const handleIncomingPm = (pm: any) => {
      // Key the thread by the peer's STABLE uid (falls back to socket id for
      // legacy payloads) so reconnects keep the same conversation.
      const peerUid = String(pm?.uid || pm?.id || pm?.from || "");
      if (!peerUid) return;
      set((s) => {
        const list = s.pmThreads[peerUid] ?? [];
        return {
          pmThreads: {
            ...s.pmThreads,
            [peerUid]: [
              ...list,
              {
                from: String(pm?.id || peerUid),
                uid: peerUid,
                to: pm.to ? String(pm.to) : undefined,
                topic: String(pm.topic || ""),
                msg: String(pm.msg || ""),
                ts: Number(pm.time || Date.now()),
                pic: pm.pic,
                file: pm.file,
                fileType: pm.fileType,
                self: false,
              },
            ].slice(-100),
          },
        };
      });
    };
    socketClient.onCmd("pmsg", handleIncomingPm);
    socketClient.onCmd("ppmsg", handleIncomingPm);

    // Read receipt: the peer opened the thread → our outgoing messages turn ✓✓
    socketClient.onCmd("pm_seen", (data) => {
      const readerId = String(data?.uid || data?.from || data?.id || "");
      if (!readerId) return;
      set((s) => {
        const list = s.pmThreads[readerId];
        if (!list || !list.some((m) => m.self && !m.seen)) return s;
        return {
          pmThreads: {
            ...s.pmThreads,
            [readerId]: list.map((m) => (m.self && !m.seen ? { ...m, seen: true } : m)),
          },
        };
      });
    });

    const handlePublicAnnouncement = (data: any) => {
      if (!data?.msg) return;
      get().pushNotice(String(data.msg), { topic: String(data.topic || "إعلان"), force: 1 });
    };
    socketClient.onCmd("pmsghide", handlePublicAnnouncement);
    socketClient.onCmd("ppmsghide", handlePublicAnnouncement);

    socketClient.onCmd("typing", (data) => {
      if (!data?.id) return;
      const tid = String(data.id);
      // Private-chat typing is routed to pmTypingUsers so it never leaks into
      // the room's typing bar; keyed by socket id AND stable uid when present.
      if (data.pm) {
        const uidKey = data.uid ? String(data.uid) : "";
        const keys = uidKey && uidKey !== tid ? [tid, uidKey] : [tid];
        for (const k of keys) {
          const prevTimer = typingExpiryTimers.get(k);
          if (prevTimer) clearTimeout(prevTimer);
          typingExpiryTimers.set(
            k,
            setTimeout(() => {
              typingExpiryTimers.delete(k);
              set((s) => ({
                typingUsers: omitMapKeys(s.typingUsers, [k]),
                pmTypingUsers: omitMapKeys(s.pmTypingUsers, [k]),
              }));
            }, TYPING_EXPIRY_MS),
          );
        }
        set((s) => {
          const next = { ...s.pmTypingUsers };
          for (const k of keys) next[k] = String(data.topic || "");
          return { pmTypingUsers: next };
        });
        return;
      }
      const prevTimer = typingExpiryTimers.get(tid);
      if (prevTimer) clearTimeout(prevTimer);
      typingExpiryTimers.set(
        tid,
        setTimeout(() => {
          typingExpiryTimers.delete(tid);
          set((s) => {
            if (!s.typingUsers[tid]) return s;
            const next = { ...s.typingUsers };
            delete next[tid];
            return { typingUsers: next };
          });
        }, TYPING_EXPIRY_MS),
      );
      set((s) => ({ typingUsers: { ...s.typingUsers, [tid]: String(data.topic || "") } }));
    });
    socketClient.onCmd("stopTyping", (data) => {
      if (!data?.id) return;
      const tid = String(data.id);
      const uidKey = data.uid ? String(data.uid) : "";
      const keys = data.pm && uidKey && uidKey !== tid ? [tid, uidKey] : [tid];
      for (const k of keys) {
        const prevTimer = typingExpiryTimers.get(k);
        if (prevTimer) {
          clearTimeout(prevTimer);
          typingExpiryTimers.delete(k);
        }
      }
      set((s) => ({
        typingUsers: omitMapKeys(s.typingUsers, keys),
        pmTypingUsers: omitMapKeys(s.pmTypingUsers, keys),
      }));
    });

    socketClient.onCmd("muted", (data) => {
      const isMuted = Boolean(data?.muted);
      set((s) => ({ me: s.me ? { ...s.me, muted: isMuted } : s.me }));
    });
    socketClient.onCmd("kicked", (data) => {
      persistSessionToken(null);
      get().pushNotice(String(data?.reason || "تم فصلك من الدردشة"), { force: 1 });
      set({ isAuthenticated: false, sessionToken: null, me: null, currentRoomId: "" });
    });
    socketClient.onCmd("coin_balance", (data) => {
      const coins = Number(data?.coins ?? data?.coin ?? 0);
      set((s) => ({
        me: s.me ? { ...s.me, coins, coin: coins } : s.me,
      }));
    });

    socketClient.onCmd("mail_unread_count", (data) => {
      set({ unreadMailCount: Math.max(0, Number(data?.count || 0)) });
    });
    socketClient.onCmd("mail_inbox_list", (rows) => {
      if (Array.isArray(rows)) set({ mailInbox: rows });
    });
    socketClient.onCmd("mail_sent_list", (rows) => {
      if (Array.isArray(rows)) set({ mailSent: rows });
    });
    socketClient.onCmd("mail_search_results", (rows) => {
      if (Array.isArray(rows)) set({ mailSearchResults: rows });
    });
    socketClient.onCmd("mail_error", (data) => {
      if (data?.msg) get().pushNotice(String(data.msg), { topic: "البريد", force: 1 });
    });
    socketClient.onCmd("mail_new_message", (msg: MailItem) => {
      if (!msg?.id) return;
      set((s) => ({
        mailInbox: [msg, ...s.mailInbox.filter((m) => m.id !== msg.id)],
        unreadMailCount: s.unreadMailCount + 1,
      }));
    });
    socketClient.onCmd("mail_sent_ok", (msg: MailItem) => {
      if (!msg?.id) return;
      set((s) => ({ mailSent: [msg, ...s.mailSent.filter((m) => m.id !== msg.id)] }));
    });
    socketClient.onCmd("mail_message_read", (data) => {
      const id = Number(data?.id || 0);
      if (!id) return;
      set((s) => ({
        mailInbox: s.mailInbox.map((m) => (m.id === id ? { ...m, is_read: true, read_at: Number(data.read_at || Date.now()) } : m)),
        unreadMailCount: Math.max(0, s.unreadMailCount - 1),
      }));
    });
    socketClient.onCmd("mail_read_receipt", (data) => {
      const id = Number(data?.id || 0);
      if (!id) return;
      set((s) => ({
        mailSent: s.mailSent.map((m) => (m.id === id ? { ...m, is_read: true, read_at: Number(data.read_at || Date.now()) } : m)),
      }));
    });

    socketClient.onCmd("profile_visit_new", () => {
      set((s) => ({ visitorsCount: s.visitorsCount + 1 }));
    });
    socketClient.onCmd("profile_visitors_count", (data) => {
      set({ visitorsCount: Math.max(0, Number(data?.count || 0)) });
    });
    socketClient.onCmd("profile_visitors_list", (rows) => {
      if (Array.isArray(rows)) set({ visitorsList: rows });
    });
    socketClient.onCmd("profile_visits_seen_ok", () => {
      set({ visitorsCount: 0 });
    });

    // Private Call lifecycle listeners
    socketClient.onCmd("call-request", (data) => {
      const peerId = String(data?.id || data?.from || "");
      if (!peerId) return;
      set({
        callState: {
          status: "incoming",
          callId: String(data.callId || ""),
          peerId,
          peerTopic: String(data.callerName || data.topic || "مستخدم"),
          peerPic: String(data.pic || "pic.png"),
          callType: String(data.callType || "") === "video" ? "video" : "audio",
          isCaller: false,
        },
      });
    });
    socketClient.onCmd("call-accepted", (data) => {
      set((s) => ({
        callState: {
          ...s.callState,
          status: "active",
          callId: String(data?.callId || s.callState.callId),
        },
      }));
    });
    const resetCallOnEnd = () => {
      set({ callState: { ...IDLE_CALL_STATE }, lastCallSignal: null });
    };
    socketClient.onCmd("call-rejected", resetCallOnEnd);
    socketClient.onCmd("calldeny", resetCallOnEnd);
    socketClient.onCmd("donecall", resetCallOnEnd);
    socketClient.onCmd("pm-call-signal", (data) => {
      if (data && typeof data === "object") set({ lastCallSignal: data });
    });

    socketClient.onCmd("youtube", (items) => {
      if (Array.isArray(items)) set({ youtubeResults: items });
    });
    socketClient.onCmd("youtube_search_results", (data) => {
      if (Array.isArray(data?.items)) set({ youtubeResults: data.items });
    });
    socketClient.onCmd("resolve_tiktok_result", (data) => {
      if (data && typeof data === "object") set({ lastTikTokResult: data });
    });
  },

  disconnect: () => {
    socketClient?.disconnect();
    set({
      connected: false,
      isAuthenticated: false,
      me: null,
      myPowerRole: null,
      callState: { ...IDLE_CALL_STATE },
    });
  },

  clearAuthError: () => set({ lastAuthError: null }),
  clearRoomInvite: () => set({ roomInvite: null }),
  setActivePmTarget: (targetSocketId) => set({ activePmTargetId: targetSocketId }),
  requestPresenceSync: (includeAll = false) => socketClient?.requestPresenceSync(includeAll),
  fetchRoomHistory: (roomId) => socketClient?.requestRoomHistory(roomId || get().currentRoomId),

  loginGuest: (username, extras) => {
    set({ lastAuthError: null });
    const roomid = extras?.roomid || get().pendingDeepLinkRoomId || undefined;
    socketClient?.loginGuest(username, { ...extras, ...(roomid ? { roomid } : {}) });
  },

  loginMember: (username, password, extras) => {
    set({ lastAuthError: null });
    const roomid = extras?.roomid || get().pendingDeepLinkRoomId || undefined;
    socketClient?.loginMember(username, password, { ...extras, ...(roomid ? { roomid } : {}) });
  },

  registerMember: (username, password, extras) => {
    set({ lastAuthError: null });
    socketClient?.registerMember(username, password, extras);
  },

  loginMemberHttp: async (username, password) => {
    const client = get().getApiClient();
    const res = await client.loginMember({ username: username.trim(), password, refr: "web" });
    if (res.sessionToken) {
      persistSessionToken(res.sessionToken);
      set({ sessionToken: res.sessionToken, lastAuthError: null });
      socketClient?.reconnectWithToken(res.sessionToken, get().currentRoomId || get().pendingDeepLinkRoomId || undefined);
    }
  },

  registerMemberHttp: async (username, password, topic) => {
    const client = get().getApiClient();
    const res = await client.registerMember({ username: username.trim(), password, topic, refr: "web" });
    if (res.sessionToken) {
      persistSessionToken(res.sessionToken);
      set({ sessionToken: res.sessionToken, lastAuthError: null });
      socketClient?.reconnectWithToken(res.sessionToken, get().currentRoomId || get().pendingDeepLinkRoomId || undefined);
    }
  },

  joinRoom: (roomId, pwd = "") => {
    socketClient?.joinRoom(roomId, pwd, get().currentRoomId);
  },

  leaveRoom: () => {
    socketClient?.leaveRoom();
  },

  resumeRoom: (roomId, pwd = "") => {
    socketClient?.resumeRoom(roomId, pwd);
  },

  createRoom: (payload) => {
    socketClient?.createRoom(payload);
  },

  updateLiveSettings: (payload) => {
    socketClient?.updateLiveSettings(payload);
  },

  editRoom: (payload) => {
    socketClient?.editRoom(payload);
  },

  deleteRoom: (roomId) => {
    socketClient?.deleteRoom(roomId);
  },

  sendRoomMessage: (msg, replyOrOpts = null) => {
    const trimmed = msg.trim();
    const opts =
      replyOrOpts && typeof replyOrOpts === "object" && ("file" in replyOrOpts || "reply" in replyOrOpts)
        ? (replyOrOpts as { reply?: Record<string, unknown> | null; file?: string; fileType?: string })
        : { reply: (replyOrOpts as Record<string, unknown> | null) ?? null };
    if (!trimmed && !opts.file) return;

    const state = get();
    const cid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Server path is ALWAYS the source of truth — broadcasting/order is untouched.
    socketClient?.sendRoomMessage(trimmed, { ...opts, cid });

    // "local" rooms only: show the bubble instantly; the server echo replaces it.
    const room = state.rooms.find((r) => r.id === state.currentRoomId);
    if (room?.message_mode !== "local") return;
    const me = state.me;
    if (!me || !state.currentRoomId) return;

    const optimistic = {
      _cid: cid,
      _pending: true,
      _cts: Date.now(),
      uid: me.uid || me.id,
      lid: me.lid,
      topic: me.topic,
      msg: trimmed,
      pic: me.pic,
      power: me.power,
      bg: me.bg,
      gcol: me.gcol,
      ucol: me.ucol,
      mcol: me.mcol,
      ico: me.ico,
      gift_ico: me.gift_ico,
      documents: Boolean(me.documents || me.documentationc),
      documentationc: Boolean(me.documentationc || me.documents),
      roomid: state.currentRoomId,
      time: Date.now(),
      likes: [],
      ...(opts.reply ? { reply: opts.reply } : {}),
      ...(opts.file ? { file: opts.file } : {}),
      ...(opts.fileType ? { fileType: opts.fileType } : {}),
    } as RoomMessagePayload;

    set((s) => ({ messages: pushLimitedMessages(s.messages, optimistic) }));

    // If the server never confirms it (blocked / muted / lost), drop the ghost.
    setTimeout(() => {
      set((s) => {
        const idx = findPendingIndex(s.messages, cid);
        if (idx < 0) return s;
        const next = s.messages.slice();
        next.splice(idx, 1);
        return { messages: next };
      });
    }, 12_000);
  },

  likeRoomMessage: (mi) => {
    socketClient?.likeRoomMessage(mi);
  },

  deleteRoomMessage: (mi) => {
    socketClient?.deleteRoomMessage(mi);
  },

  sendTyping: (isTyping, targetId) => {
    if (targetId) {
      const peer = resolvePeerTarget(targetId, get().onlineMap);
      if (!peer) return;
      socketClient?.setTyping(isTyping, undefined, peer.socketId);
      return;
    }
    socketClient?.setTyping(isTyping, get().currentRoomId, undefined);
  },

  sendWallPost: (msg, opts) => {
    const trimmed = msg.trim();
    if (!trimmed && !opts?.link && !opts?.pic) return;
    socketClient?.sendWallPost(trimmed, opts);
  },

  deleteWallPost: (bid) => {
    socketClient?.deleteWallPost(bid);
  },

  commentWallPost: (bid, msg, replyToCid) => {
    const trimmed = msg.trim();
    if (!trimmed) return;
    socketClient?.commentWallPost(bid, trimmed, replyToCid);
  },

  likeWallPost: (bid, state = 1) => {
    socketClient?.likeWallPost(bid, state);
  },

  sendPrivateMessage: (targetSocketId, msg, opts) => {
    const trimmed = msg.trim();
    if (!trimmed && !opts?.file) return;
    const me = get().me;
    const peer = resolvePeerTarget(targetSocketId, get().onlineMap);
    if (!peer) {
      get().pushNotice("المستخدم غير متصل بالانترنت في الوقت الحالي", { force: 1 });
      return;
    }
    socketClient?.sendPrivateMessage(peer.socketId, trimmed, opts);
    set((s) => {
      const list = s.pmThreads[peer.uid] ?? [];
      return {
        activePmTargetId: peer.uid,
        pmThreads: {
          ...s.pmThreads,
          [peer.uid]: [
            ...list,
            {
              from: me?.id || "me",
              to: peer.socketId,
              uid: peer.uid,
              topic: me?.topic || "أنا",
              msg: trimmed,
              ts: Date.now(),
              pic: me?.pic,
              file: opts?.file,
              fileType: opts?.fileType,
              self: true,
            },
          ].slice(-100),
        },
      };
    });
  },

  markPmThreadRead: (targetSocketId) => {
    if (!targetSocketId) return;
    // Record the local read cursor FIRST so the unread badge clears even when
    // the peer is currently offline (emit is skipped on unresolvable peers).
    const list = get().pmThreads[targetSocketId] || [];
    const lastTs = list.length ? list[list.length - 1].ts : 0;
    if (lastTs && lastTs > (get().pmReadState[targetSocketId] || 0)) {
      set((s) => ({ pmReadState: { ...s.pmReadState, [targetSocketId]: lastTs } }));
    }
    const peer = resolvePeerTarget(targetSocketId, get().onlineMap);
    if (!peer) return;
    socketClient?.emitCmd("pm_seen", { id: peer.socketId });
  },

  sendPublicAnnouncement: (msg, hideSender = false) => {
    const trimmed = msg.trim();
    if (!trimmed) return;
    socketClient?.sendPublicAnnouncement(trimmed, hideSender);
  },

  sendVoiceNote: (audioBase64OrDataUrl, mime, targetSocketId) => {
    let target = targetSocketId;
    if (target) {
      const peer = resolvePeerTarget(target, get().onlineMap);
      if (!peer) {
        get().pushNotice("المستخدم غير متصل بالانترنت في الوقت الحالي", { force: 1 });
        return;
      }
      target = peer.socketId;
    }
    socketClient?.sendVoiceNote(audioBase64OrDataUrl, mime, target);
  },

  sendGift: (targetSocketId, giftFile) => {
    socketClient?.sendGift(targetSocketId, giftFile);
  },

  sendModerationAction: (subCmd, payload) => {
    socketClient?.sendModerationAction(subCmd, payload);
  },

  unick: (targetSocketId, topic) => {
    socketClient?.unick(targetSocketId, topic);
  },

  setLikes: (targetSocketId, likes) => {
    socketClient?.setLikes(targetSocketId, likes);
  },

  setStatusMessage: (msg, targetSocketId) => {
    socketClient?.setStatusMessage(msg, targetSocketId);
  },

  setSiteBadge: (badgeId, targetSocketId) => {
    socketClient?.setSiteBadge(badgeId, targetSocketId);
  },

  setUserStat: (stat) => {
    socketClient?.setUserStat(stat);
  },

  saveProfile: (patch) => {
    socketClient?.saveProfile(patch);
  },

  setAvatar: (imgOrPath, isSecondary = false, clear = false) => {
    socketClient?.setAvatar(imgOrPath, isSecondary, clear);
  },

  changePassword: (oldpass, newpass) => {
    socketClient?.changePassword(oldpass, newpass);
  },

  setCosmetic: (kind, val, targetSocketId) => {
    socketClient?.setCosmetic(kind, val, targetSocketId);
    if (!targetSocketId) {
      const field = kind === "bnr" ? "ico" : kind === "uthem" ? "them" : kind === "udro3" ? "gift_ico" : "cover";
      const targetSubdir = kind === "bnr" ? "sico" : kind === "uthem" ? "them" : kind === "udro3" ? "dro3" : "cover";
      const normalizedVal = val
        ? (val.includes("/") ? val : `${targetSubdir}/${val}`)
        : "";
      set((s) => {
        if (!s.me) return s;
        const nextMe = { ...s.me, [field]: normalizedVal };
        return {
          me: nextMe,
          onlineMap: s.me.id
            ? { ...s.onlineMap, [s.me.id]: { ...(s.onlineMap[s.me.id] || s.me), [field]: normalizedVal } }
            : s.onlineMap,
        };
      });
    }
  },

  toggleBusy: () => socketClient?.toggleBusy(),
  toggleNoPm: () => socketClient?.toggleNoPm(),
  toggleNoNot: () => socketClient?.toggleNoNot(),
  toggleAlerts: () => socketClient?.toggleAlerts(),
  toggleStealthLogin: (on) => socketClient?.toggleStealthLogin(on),
  toggleCallPrivacy: (kind, enabled) => socketClient?.toggleCallPrivacy(kind, enabled),

  followUser: (uidOrSocketId, isSocketId = false) => socketClient?.followUser(uidOrSocketId, isSocketId),
  unfollowUser: (uidOrSocketId, isSocketId = false) => socketClient?.unfollowUser(uidOrSocketId, isSocketId),
  getFollowInfo: (uidOrSocketId, isSocketId = false) => socketClient?.getFollowInfo(uidOrSocketId, isSocketId),

  emitMicAction: (cmd, data) => socketClient?.emitMicAction(cmd, data),
  setUserSpeakingLocal: (socketId, speaking) => {
    if (!socketId) return;
    set((s) => {
      if (Boolean(s.speakingUsers[socketId]) === Boolean(speaking)) return s;
      return {
        speakingUsers: { ...s.speakingUsers, [socketId]: Boolean(speaking) },
      };
    });
  },

  carromManage: (action, seat) => socketClient?.carromManage(action, seat),
  carromJoin: () => socketClient?.carromJoin(),
  carromLeave: () => socketClient?.carromLeave(),
  carromSync: () => socketClient?.carromSync(),
  carromPreview: (aim) => socketClient?.carromPreview(aim),
  carromShot: (shot) => socketClient?.carromShot(shot),

  ludoManage: (action, seat) => socketClient?.ludoManage(action, seat),
  ludoJoin: (seat) => socketClient?.ludoJoin(seat),
  ludoLeave: () => socketClient?.ludoLeave(),
  ludoSync: () => socketClient?.ludoSync(),
  ludoRoll: () => socketClient?.ludoRoll(),
  ludoMove: (tokenId) => socketClient?.ludoMove(tokenId),

  controlCompetitionBot: (cmd, payload) => socketClient?.controlCompetitionBot(cmd, payload),

  requestCall: (targetSocketId, callType = "audio") => {
    const resolved = resolvePeerTarget(targetSocketId, get().onlineMap);
    const peer = resolved?.user ?? get().onlineMap[targetSocketId];
    const dialId = resolved?.socketId ?? targetSocketId;
    set({
      callState: {
        status: "outgoing",
        callId: `call_${Date.now()}`,
        peerId: dialId,
        peerTopic: peer?.topic || "مستخدم",
        peerPic: peer?.pic || "pic.png",
        callType,
        isCaller: true,
      },
    });
    socketClient?.requestCall(dialId, callType, get().me?.topic);
  },

  acceptCall: () => {
    const call = get().callState;
    if (!call.peerId) return;
    socketClient?.acceptCall(call.peerId, call.callId, call.callType);
  },

  rejectCall: (reason = "rejected") => {
    const call = get().callState;
    if (call.peerId) socketClient?.rejectCall(call.peerId, call.callId, reason);
    set({ callState: { ...IDLE_CALL_STATE }, lastCallSignal: null });
  },

  endCall: (reason = "ended") => {
    const call = get().callState;
    if (call.peerId) socketClient?.endCall(call.peerId, call.callId, reason);
    set({ callState: { ...IDLE_CALL_STATE }, lastCallSignal: null });
  },

  sendCallSignal: (signalPayload) => {
    const peerId = get().callState.peerId;
    if (peerId) socketClient?.sendCallSignal(peerId, signalPayload);
  },

  searchMailUsers: (query) => socketClient?.searchMailUsers(query),
  loadMailBoxes: () => {
    socketClient?.getMailInbox();
    socketClient?.getMailSent();
  },
  sendMail: (toUid, body) => socketClient?.sendMail(toUid, body),
  markMailRead: (id) => socketClient?.markMailRead(id),

  fetchStories: () => socketClient?.fetchStories(),
  publishStory: (linkOrPayload, type = "image", length = 6) =>
    socketClient?.publishStory(linkOrPayload, type, length),
  deleteStory: (opts) => socketClient?.deleteStory(opts),
  markStoryViewed: (storyOwnerSid, itemIdx = 0, itemId = "") =>
    socketClient?.markStoryViewed(storyOwnerSid, itemIdx, itemId),
  getStoryViewers: (storyOwnerSid, itemId = "", itemIdx) =>
    socketClient?.getStoryViewers(storyOwnerSid, itemId, itemIdx),
  toggleStoryLike: (storySid, itemId) => socketClient?.toggleStoryLike(storySid, itemId),
  fetchStoryLikers: (storySid, itemId) => socketClient?.fetchStoryLikers(storySid, itemId),
  fetchStoryComments: (storySid, itemId, sort = "newest") =>
    socketClient?.fetchStoryComments(storySid, itemId, sort),
  addStoryComment: (storySid, itemId, body, parentCid = "", replyToTopic = "") =>
    socketClient?.addStoryComment(storySid, itemId, body, parentCid, replyToTopic),
  toggleStoryCommentLike: (storySid, itemId, commentCid) =>
    socketClient?.toggleStoryCommentLike(storySid, itemId, commentCid),
  deleteStoryComment: (storySid, itemId, commentCid) =>
    socketClient?.deleteStoryComment(storySid, itemId, commentCid),

  // Dedicated Member Notes actions (Separated from Stories)
  fetchNotes: () => socketClient?.fetchNotes(),
  publishNote: (payload) => socketClient?.publishNote(payload),
  toggleNoteLike: (noteNid) => socketClient?.toggleNoteLike(noteNid),
  fetchNoteComments: (noteNid) => socketClient?.fetchNoteComments(noteNid),
  addNoteComment: (noteNid, body, parentCid, replyToTopic) =>
    socketClient?.addNoteComment(noteNid, body, parentCid, replyToTopic),
  toggleNoteCommentLike: (noteNid, commentCid) =>
    socketClient?.toggleNoteCommentLike(noteNid, commentCid),
  deleteNoteComment: (noteNid, commentCid) =>
    socketClient?.deleteNoteComment(noteNid, commentCid),
  deleteNote: (noteNid) => socketClient?.deleteNote(noteNid),

  recordProfileVisit: (ownerUid) => socketClient?.recordProfileVisit(ownerUid),
  fetchProfileVisitors: () => {
    socketClient?.getProfileVisitors();
    socketClient?.getProfileVisitorsCount();
  },
  markProfileVisitsSeen: () => socketClient?.markProfileVisitsSeen(),

  searchYoutube: (query, mode = "videos") => socketClient?.searchYoutube(query, mode),
  resolveTikTok: (url, requestId) => socketClient?.resolveTikTok(url, requestId),

  dismissNotice: (id) => {
    set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
  },

  pushNotice: (msg, opts) => {
    const item: NoticeItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      msg,
      topic: opts?.topic,
      sound: opts?.sound,
      force: opts?.force,
      ts: Date.now(),
    };
    set((s) => ({ notices: [...s.notices.slice(-4), item] }));
  },

  logout: () => {
    persistSessionToken(null);
    socketClient?.logout();
    set({
      isAuthenticated: false,
      sessionToken: null,
      me: null,
      myPowerRole: null,
      currentRoomId: "",
      messages: [],
      roomInvite: null,
      activePmTargetId: null,
      callState: { ...IDLE_CALL_STATE },
    });
  },
}));
