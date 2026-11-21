import { io, type Socket } from "socket.io-client";
import msgpackParser from "socket.io-msgpack-parser";
import type {
  CarromShotInput,
  CompetitionBotKind,
  IncomingCmd,
  OutgoingCmd,
  PublishNotePayload,
  SocketEventName,
  SocketMsgEnvelope,
} from "@newchat/shared";

export type MsgCommandHandler = (payload: any, envelope: SocketMsgEnvelope) => void;
export type RawSocketEventHandler = (payload: any) => void;

export interface SocketConnectOptions {
  query?: Record<string, string>;
  auth?: Record<string, unknown>;
}

/**
 * Detects normalized operating system matching gateway `PLATFORM_LIST`.
 */
export function detectClientPlatform(): string {
  if (typeof navigator === "undefined") {
    const p = (globalThis as { process?: { platform?: string } }).process?.platform ?? "";
    if (p === "darwin") return "mac os";
    if (p === "linux") return "linux";
    return "windows";
  }
  const source = `${navigator.userAgent || ""} ${navigator.platform || ""}`.toLowerCase();
  if (source.includes("windows phone")) return "windows phone";
  if (source.includes("android")) return "android";
  if (/iphone|ipad|ipod|\bios\b/.test(source)) return "ios";
  if (source.includes("win")) return "windows";
  if (source.includes("macintosh") || source.includes("mac os") || source.includes("mac")) {
    return "mac os";
  }
  if (source.includes("cros")) return "chromium os";
  if (source.includes("linux") || source.includes("x11")) return "linux";
  return "windows";
}

/**
 * Detects normalized browser matching gateway `BROWSER_LIST`.
 */
export function detectClientBrowser(): string {
  if (typeof navigator === "undefined") return "Chrome";
  const ua = String(navigator.userAgent || "").toLowerCase();
  if (ua.includes("samsungbrowser") || ua.includes("samsung browser")) return "Samsung browser";
  if (/\bwv\b/.test(ua) || ua.includes("webview")) return "Chrome WebView";
  if (ua.includes("edg/") || ua.includes("edge")) return "edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "opera";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (ua.includes("msie") || ua.includes("trident") || ua.includes("internet explorer")) {
    return "internet explorer";
  }
  if (ua.includes("chrome") || ua.includes("crios")) return "chrome";
  if (ua.includes("safari")) return "safari";
  return "chrome";
}

const DEVICE_FP_STORAGE_KEY = "newchat_device_fp";

/**
 * Generates or restores a stable persistent client device fingerprint matching legacy `fp`.
 */
export function getOrCreateDeviceFingerprint(): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const existing = window.localStorage.getItem(DEVICE_FP_STORAGE_KEY);
      if (existing && existing.trim().length >= 8) {
        return existing.trim();
      }
      const next =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replace(/-/g, "")
          : `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(DEVICE_FP_STORAGE_KEY, next);
      return next;
    }
  } catch {
    // ignore storage failures in private modes
  }
  return `fp_${detectClientPlatform().replace(/\s+/g, "_")}`;
}

export class NewChatSocketClient {
  private socket: Socket | null = null;
  private cmdHandlers = new Map<string, Set<MsgCommandHandler>>();
  private rawEventHandlers = new Map<string, Set<RawSocketEventHandler>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  connect(gatewayUrl: string, queryOrOpts?: Record<string, string> | SocketConnectOptions): Socket {
    if (this.socket) {
      this.socket.disconnect();
    }

    const isOptsObj =
      queryOrOpts &&
      typeof queryOrOpts === "object" &&
      ("query" in queryOrOpts || "auth" in queryOrOpts);
    const opts = isOptsObj ? (queryOrOpts as SocketConnectOptions) : { query: queryOrOpts as Record<string, string> | undefined };

    const defaultQuery: Record<string, string> = {
      plt: detectClientPlatform(),
      wk: "modern",
      version: "2.0.0",
      browser: detectClientBrowser(),
      c: "SA",
      ...(opts.query ?? {}),
    };

    const s = io(gatewayUrl, {
      parser: msgpackParser,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 20000,
      query: defaultQuery,
      ...(opts.auth ? { auth: opts.auth } : {}),
    });

    s.on("msg", (envelope: SocketMsgEnvelope) => {
      if (!envelope || typeof envelope !== "object" || !envelope.cmd) return;
      const handlers = this.cmdHandlers.get(String(envelope.cmd));
      if (handlers) {
        handlers.forEach((fn) => fn(envelope.data, envelope));
      }
      const wildcard = this.cmdHandlers.get("*");
      if (wildcard) {
        wildcard.forEach((fn) => fn(envelope.data, envelope));
      }
    });

    const knownEvents: string[] = [
      "broadcasting",
      "remic",
      "isstates",
      "gh",
      "sviw",
      "stor",
    ];
    for (const evName of knownEvents) {
      s.on(evName, (payload: unknown) => {
        const set = this.rawEventHandlers.get(evName);
        if (set) {
          set.forEach((fn) => fn(payload));
        }
      });
    }

    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (s.connected) {
        s.emit("__ping", Date.now());
      }
    }, 25_000);

    this.socket = s;
    return s;
  }

  get raw(): Socket | null {
    return this.socket;
  }

  get connected(): boolean {
    return Boolean(this.socket?.connected);
  }

  get id(): string {
    return this.socket?.id ?? "";
  }

  emitCmd<T = unknown>(cmd: IncomingCmd | string, data?: T): void {
    this.socket?.emit("msg", { cmd, data: data ?? {} });
  }

  emitEvent<T = unknown>(event: SocketEventName | string, payload?: T): void {
    this.socket?.emit(event, payload);
  }

  onCmd(cmd: OutgoingCmd | "*" | string, handler: MsgCommandHandler): () => void {
    const key = String(cmd);
    let set = this.cmdHandlers.get(key);
    if (!set) {
      set = new Set();
      this.cmdHandlers.set(key, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  onEvent(event: string, handler: RawSocketEventHandler): () => void {
    let set = this.rawEventHandlers.get(event);
    if (!set) {
      set = new Set();
      this.rawEventHandlers.set(event, set);
      this.socket?.on(event, (payload: unknown) => {
        this.rawEventHandlers.get(event)?.forEach((fn) => fn(payload));
      });
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  // -------- Auth & Presence Helpers --------
  loginGuest(username: string, extras?: { pic?: string; fp?: string; roomid?: string; refr?: string }): void {
    this.emitCmd("g", {
      username: username.trim(),
      refr: "web",
      ...extras,
      fp: extras?.fp || getOrCreateDeviceFingerprint(),
    });
  }

  loginMember(username: string, password: string, extras?: { fp?: string; roomid?: string; refr?: string; stealth?: boolean }): void {
    this.emitCmd("sagin", {
      username: username.trim(),
      password,
      refr: "web",
      ...extras,
      fp: extras?.fp || getOrCreateDeviceFingerprint(),
    });
  }

  registerMember(
    username: string,
    password: string,
    extras?: { topic?: string; fp?: string; refr?: string },
  ): void {
    this.emitCmd("reg", {
      username: username.trim(),
      password,
      refr: "web",
      ...extras,
      fp: extras?.fp || getOrCreateDeviceFingerprint(),
    });
  }

  reconnectWithToken(token: string, roomid?: string): void {
    this.emitEvent("rc", { token, ...(roomid ? { roomid } : {}) });
  }

  requestPresenceSync(includeAll = false): void {
    this.emitEvent(includeAll ? "sync_presence_all" : "sync_presence", {});
  }

  requestRoomHistory(roomid?: string): void {
    this.emitEvent("gh", roomid ? { roomid } : {});
  }

  setUserStat(stat: number): void {
    this.emitEvent("isstates", { stat });
  }

  logout(): void {
    this.emitCmd("logout", {});
  }

  reportVisibility(hidden: boolean): void {
    this.emitEvent("page_visibility", { hidden, state: hidden ? "hidden" : "visible" });
  }

  reportLifecycleExit(reason = "unloading"): void {
    this.emitEvent("page_visibility", { hidden: true, state: reason });
  }

  // -------- Rooms Helpers --------
  joinRoom(roomId: string, pwd = "", currentRoomId = ""): void {
    this.emitCmd("rjoin", { id: roomId, pwd, ...(currentRoomId ? { mr: currentRoomId } : {}) });
  }

  leaveRoom(): void {
    this.emitCmd("rleave", {});
  }

  resumeRoom(roomId?: string, pwd = ""): void {
    this.emitCmd("room_resume", { ...(roomId ? { roomId } : {}), ...(pwd ? { pwd } : {}) });
  }

  createRoom(payload: {
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
  }): void {
    this.emitCmd("r+", payload);
  }

  updateLiveSettings(payload: {
    roomId: string;
    topic?: string;
    join_mode?: "free" | "request";
    chat_locked?: boolean;
    gift_goal?: Record<string, unknown>;
  }): void {
    this.emitCmd("live-settings", payload);
  }

  editRoom(payload: {
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
  }): void {
    this.emitCmd("r^", payload);
  }

  deleteRoom(roomId: string): void {
    this.emitCmd("r-", { id: roomId });
  }

  // -------- Messaging, Wall & Media Uploads Helpers --------
  sendRoomMessage(
    msg: string,
    opts?: {
      reply?: Record<string, unknown> | null;
      file?: string;
      fileType?: string;
      roomid?: string;
      /** Client id shared with the optimistic local copy (local-fast room mode). */
      cid?: string;
    },
  ): void {
    this.emitCmd("msg", {
      msg,
      ...(opts?.reply ? { reply: opts.reply } : {}),
      ...(opts?.file ? { file: opts.file } : {}),
      ...(opts?.fileType ? { fileType: opts.fileType } : {}),
      ...(opts?.roomid ? { roomid: opts.roomid } : {}),
      _cid: opts?.cid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      _cts: Date.now(),
    });
  }

  likeRoomMessage(mi: string): void {
    this.emitCmd("likemsg", { mi });
  }

  deleteRoomMessage(mi: string): void {
    this.emitCmd("delmsg", { mi });
  }

  setTyping(isTyping: boolean, roomid?: string, targetId?: string): void {
    this.emitEvent(
      isTyping ? "typing" : "stopTyping",
      targetId ? { to: targetId } : roomid ? { room: roomid } : {},
    );
  }

  sendWallPost(msg: string, opts?: { link?: string; pic?: string; card?: boolean }): void {
    this.emitCmd(opts?.card || opts?.link ? "bc2" : "bc", {
      msg,
      ...(opts?.link ? { link: opts.link } : {}),
      ...(opts?.pic ? { pic: opts.pic } : {}),
    });
  }

  deleteWallPost(bid: string): void {
    this.emitCmd("delbc", { bid });
  }

  commentWallPost(bid: string, msg: string, replyToCid?: string): void {
    this.emitCmd(replyToCid ? "sco_reply" : "sco", {
      bid,
      msg,
      ...(replyToCid ? { replyToCid } : {}),
    });
  }

  likeWallPost(bid: string, state: 1 | 2 = 1): void {
    this.emitCmd("likebc", { bid, state });
  }

  sendPrivateMessage(
    targetSocketId: string,
    msg: string,
    opts?: { file?: string; fileType?: string; variant?: "pmsg" | "pm" | "ppmsg" },
  ): void {
    this.emitCmd(opts?.variant ?? "pmsg", {
      id: targetSocketId,
      msg,
      ...(opts?.file ? { file: opts.file } : {}),
      ...(opts?.fileType ? { fileType: opts.fileType } : {}),
    });
  }

  sendPublicAnnouncement(msg: string, hideSender = false): void {
    this.emitCmd(hideSender ? "ppmsghide" : "pmsghide", { msg });
  }

  sendVoiceNote(audioBase64OrDataUrl: string, mime: string, targetSocketId?: string): void {
    this.emitCmd("sendVoice", {
      audio: audioBase64OrDataUrl,
      mime,
      ...(targetSocketId ? { to: targetSocketId } : {}),
    });
  }

  // -------- Profile, Social, Mail, Stories & Visitors --------
  saveProfile(patch: {
    topic?: string;
    msg?: string;
    bg?: string;
    ucol?: string;
    mcol?: string;
    gcol?: string;
    yp?: string;
    pic?: string;
  }): void {
    this.emitCmd("setprofile", patch);
  }

  setAvatar(imgOrPath: string, isSecondary = false, clear = false): void {
    this.emitCmd(isSecondary ? "setpic2" : "setpic", { img: imgOrPath, clear });
  }

  changePassword(oldpass: string, newpass: string): void {
    this.emitCmd("chpass", { oldpass, newpass });
  }

  toggleAlerts(): void {
    this.emitCmd("alerts", {});
  }

  toggleBusy(): void {
    this.emitCmd("busy", {});
  }

  toggleNoPm(): void {
    this.emitCmd("nopm", {});
  }

  toggleNoNot(): void {
    this.emitCmd("nonot", {});
  }

  toggleStealthLogin(on?: boolean): void {
    this.emitCmd("setpoweron", on !== undefined ? { on } : {});
  }

  toggleCallPrivacy(kind: "audio" | "video", enabled: boolean): void {
    this.emitCmd(kind === "video" ? "pm-video-call-toggle" : "pm-call-toggle", { enabled });
  }

  setCosmetic(kind: "bnr" | "uthem" | "ucover" | "udro3", val: string | null, targetSocketId?: string): void {
    const cmd = val ? kind : `${kind}-`;
    this.emitCmd(cmd, {
      ...(val ? { val } : {}),
      ...(targetSocketId ? { id: targetSocketId, u2: targetSocketId } : {}),
    });
  }

  unick(targetSocketId: string, topic: string): void {
    this.emitCmd("unick", { id: targetSocketId, topic });
  }

  setLikes(targetSocketId: string, likes: number): void {
    this.emitCmd("setLikes", { id: targetSocketId, likes });
  }

  setStatusMessage(msg: string, targetSocketId?: string): void {
    this.emitCmd("setMsg", { msg, ...(targetSocketId ? { id: targetSocketId } : {}) });
  }

  setSiteBadge(badgeId: string, targetSocketId?: string): void {
    this.emitCmd("setSiteBadge", { badgeId, ...(targetSocketId ? { id: targetSocketId } : {}) });
  }

  followUser(uidOrSocketId: string, isSocketId = false): void {
    this.emitCmd("follow_user", isSocketId ? { id: uidOrSocketId } : { uid: uidOrSocketId });
  }

  unfollowUser(uidOrSocketId: string, isSocketId = false): void {
    this.emitCmd("unfollow_user", isSocketId ? { id: uidOrSocketId } : { uid: uidOrSocketId });
  }

  getFollowInfo(uidOrSocketId: string, isSocketId = false): void {
    this.emitCmd("get_follow_info", isSocketId ? { id: uidOrSocketId } : { uid: uidOrSocketId });
  }

  searchMailUsers(query: string): void {
    this.emitCmd("mail_search_users", { q: query });
  }

  getMailInbox(): void {
    this.emitCmd("mail_inbox", {});
  }

  getMailSent(): void {
    this.emitCmd("mail_sent", {});
  }

  sendMail(toUid: string, body: string): void {
    this.emitCmd("mail_send", { to_uid: toUid, body });
  }

  markMailRead(id: number): void {
    this.emitCmd("mail_mark_read", { id });
  }

  fetchStories(): void {
    this.emitEvent("stor", {});
  }

  publishStory(
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
    type: "image" | "video" | "text" | "audio" | string = "image",
    length = 6,
  ): void {
    if (typeof linkOrPayload === "string") {
      this.emitCmd("stori", { link: linkOrPayload, type, length });
    } else {
      this.emitCmd("stori", linkOrPayload);
    }
  }

  markStoryViewed(storyOwnerSid: string, itemIdx = 0, itemId = ""): void {
    this.emitEvent("storvi", { idsto: storyOwnerSid, item: itemIdx, ...(itemId ? { itemId } : {}) });
  }

  getStoryViewers(storyOwnerSid: string, itemId = "", itemIdx?: number): void {
    this.emitEvent("sviw", {
      sid: storyOwnerSid,
      ...(itemId ? { itemId } : {}),
      ...(itemIdx !== undefined ? { item: itemIdx } : {}),
    });
  }

  deleteStory(opts: { id?: number; sid?: string; itemId?: string }): void {
    this.emitEvent("remstorv", opts);
  }

  toggleStoryLike(storySid: string, itemId: string): void {
    this.emitCmd("story_like_toggle", { storySid, itemId });
  }

  fetchStoryLikers(storySid: string, itemId: string): void {
    this.emitCmd("story_likes_get", { storySid, itemId });
  }

  fetchStoryComments(
    storySid: string,
    itemId: string,
    sort: "newest" | "top" | "oldest" = "newest",
  ): void {
    this.emitCmd("story_comments_get", { storySid, itemId, sort });
  }

  addStoryComment(
    storySid: string,
    itemId: string,
    body: string,
    parentCid = "",
    replyToTopic = "",
  ): void {
    this.emitCmd("story_comment_add", {
      storySid,
      itemId,
      body,
      ...(parentCid ? { parentCid } : {}),
      ...(replyToTopic ? { replyToTopic } : {}),
    });
  }

  toggleStoryCommentLike(storySid: string, itemId: string, commentCid: string): void {
    this.emitCmd("story_comment_like", { storySid, itemId, commentCid });
  }

  deleteStoryComment(storySid: string, itemId: string, commentCid: string): void {
    this.emitCmd("story_comment_delete", { storySid, itemId, commentCid });
  }

  // ---------- Dedicated Member Notes (Separated from Stories) ----------

  fetchNotes(): void {
    this.emitCmd("notes_get", {});
  }

  publishNote(payload: PublishNotePayload): void {
    this.emitCmd("note_publish", payload);
  }

  toggleNoteLike(noteNid: string): void {
    this.emitCmd("note_like_toggle", { noteNid });
  }

  fetchNoteComments(noteNid: string): void {
    this.emitCmd("note_comments_get", { noteNid });
  }

  addNoteComment(noteNid: string, body: string, parentCid?: string, replyToTopic?: string): void {
    this.emitCmd("note_comment_add", { noteNid, body, parentCid, replyToTopic });
  }

  toggleNoteCommentLike(noteNid: string, commentCid: string): void {
    this.emitCmd("note_comment_like", { noteNid, commentCid });
  }

  deleteNoteComment(noteNid: string, commentCid: string): void {
    this.emitCmd("note_comment_delete", { noteNid, commentCid });
  }

  deleteNote(noteNid: string): void {
    this.emitCmd("note_delete", { noteNid });
  }

  recordProfileVisit(ownerUid: string): void {
    this.emitEvent("record_profile_visit", { ownerUid });
  }

  getProfileVisitors(): void {
    this.emitEvent("get_profile_visitors", {});
  }

  getProfileVisitorsCount(): void {
    this.emitEvent("get_profile_visitors_count", {});
  }

  markProfileVisitsSeen(): void {
    this.emitEvent("mark_visits_seen", {});
  }

  // -------- Moderation, Gifts & Actions --------
  sendModerationAction(
    subCmd: "like" | "not" | "meiut" | "kick" | "ban" | "delpic" | "rinvite" | "roomkick" | "gift_icon",
    payload: Record<string, unknown>,
  ): void {
    this.emitCmd("action", { action: subCmd, ...payload });
  }

  sendGift(targetSocketId: string, giftFile: string): void {
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "";
    this.emitCmd("gift", {
      id: targetSocketId,
      file: giftFile,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  // -------- Mic Stage & Private Calls --------
  emitMicAction(cmd: "broadcasting" | "remic" | "micro" | "lock-slot" | "unlock-slot" | "listener-ready" | "speaking" | string, data: Record<string, unknown>): void {
    if (cmd === "broadcasting" || cmd === "remic") {
      this.emitEvent(cmd, data);
    } else {
      this.emitCmd(cmd, data);
    }
  }

  requestCall(targetSocketId: string, callType: "audio" | "video" = "audio", callerName?: string): void {
    this.emitCmd("call-request", {
      id: targetSocketId,
      callType,
      ...(callerName ? { callerName } : {}),
    });
  }

  acceptCall(callerSocketId: string, callId?: string, callType: "audio" | "video" = "audio"): void {
    this.emitCmd("call-accept", {
      id: callerSocketId,
      ...(callId ? { callId } : {}),
      callType,
    });
  }

  rejectCall(partnerSocketId: string, callId?: string, reason = "rejected"): void {
    this.emitCmd("call-reject", {
      id: partnerSocketId,
      ...(callId ? { callId } : {}),
      reason,
    });
  }

  endCall(partnerSocketId: string, callId?: string, reason = "ended"): void {
    this.emitCmd("calldone", {
      id: partnerSocketId,
      ...(callId ? { callId } : {}),
      reason,
    });
  }

  sendCallSignal(targetSocketId: string, signalPayload: Record<string, unknown>): void {
    this.emitCmd("pm-call-signal", { to: targetSocketId, ...signalPayload });
  }

  // -------- Media Search (YouTube / TikTok) --------
  searchYoutube(query: string, mode: "videos" | "shorts" = "videos", count = 12, requestId?: string): void {
    this.emitCmd("youtube_search", { query, mode, count, ...(requestId ? { requestId } : {}) });
  }

  resolveTikTok(url: string, requestId?: string): void {
    this.emitCmd("resolve_tiktok", { url, ...(requestId ? { requestId } : {}) });
  }

  // -------- Room Games (Carrom & Competition Bots) --------
  carromManage(action: "sit" | "stand" | "start" | "reset" | "stop" | "leave" | "join", seat?: number): void {
    this.emitCmd("carrom_manage", { action, ...(seat !== undefined ? { seat } : {}) });
  }

  carromJoin(): void {
    this.emitCmd("carrom_join", {});
  }

  carromLeave(): void {
    this.emitCmd("carrom_leave", {});
  }

  carromPreview(aim: { offset?: number; angle?: number; power?: number }): void {
    this.emitCmd("carrom_preview", aim);
  }

  carromShot(shot: CarromShotInput): void {
    this.emitCmd("carrom_shot", shot);
  }

  carromSync(): void {
    this.emitCmd("carrom_sync", {});
  }

  ludoManage(
    action: "sit" | "stand" | "start" | "reset" | "stop" | "add_bot" | "remove_bot",
    seat?: number,
  ): void {
    this.emitCmd("ludo_manage", { action, ...(seat !== undefined ? { seat } : {}) });
  }

  ludoJoin(seat?: number): void {
    this.emitCmd("ludo_join", seat !== undefined ? { seat } : {});
  }

  ludoLeave(): void {
    this.emitCmd("ludo_leave", {});
  }

  ludoSync(): void {
    this.emitCmd("ludo_sync", {});
  }

  ludoRoll(): void {
    this.emitCmd("ludo_roll", {});
  }

  ludoMove(tokenId: string): void {
    this.emitCmd("ludo_move", { tokenId });
  }

  controlCompetitionBot(
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
  ): void {
    this.emitCmd(cmd, payload);
  }

  disconnect(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.rawEventHandlers.clear();
    this.cmdHandlers.clear();
    this.socket?.disconnect();
    this.socket = null;
  }
}

/**
 * Dedicated client wrapper for the `/carrom` Socket.IO namespace (MsgPack-enabled).
 */
export class CarromArenaClient {
  private socket: Socket | null = null;

  connect(gatewayUrl: string, profile?: { name: string; pic?: string; userId?: string }): Socket {
    if (this.socket) {
      this.socket.disconnect();
    }
    const base = gatewayUrl.replace(/\/+$/, "");
    const s = io(`${base}/carrom`, {
      parser: msgpackParser,
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    if (profile) {
      s.on("connect", () => {
        s.emit("register_profile", profile);
      });
    }
    this.socket = s;
    return s;
  }

  get raw(): Socket | null {
    return this.socket;
  }

  registerProfile(profile: { name: string; pic?: string; userId?: string }): void {
    this.socket?.emit("register_profile", profile);
  }

  requestWaitingRooms(): void {
    this.socket?.emit("request_waiting_rooms");
  }

  createRoom(title?: string, roomCode?: string): void {
    this.socket?.emit("create_room", { ...(title ? { title } : {}), ...(roomCode ? { roomCode } : {}) });
  }

  joinWaitingRoom(roomCode: string): void {
    this.socket?.emit("join_waiting_room", { roomCode });
  }

  leaveRoom(): void {
    this.socket?.emit("leave_room");
  }

  strikerAim(payload: Record<string, unknown>): void {
    this.socket?.emit("striker_aim", payload);
  }

  strikerPlace(payload: Record<string, unknown>): void {
    this.socket?.emit("striker_place", payload);
  }

  strikerHit(payload: Record<string, unknown>): void {
    this.socket?.emit("striker_hit", payload);
  }

  sendStateSnapshot(snapshot: unknown): void {
    this.socket?.emit("state_snapshot", snapshot);
  }

  requestSync(): void {
    this.socket?.emit("request_sync");
  }

  playAgain(): void {
    this.socket?.emit("play_again");
  }

  sendChatMessage(message: string): void {
    const clean = String(message || "").trim();
    if (!clean) return;
    this.socket?.emit("send_chat_message", { message: clean, msg: clean });
  }

  on(event: string, fn: (...args: any[]) => void): () => void {
    this.socket?.on(event, fn);
    return () => {
      this.socket?.off(event, fn);
    };
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

/**
 * Dedicated client wrapper for the `/ludo` Socket.IO namespace (MsgPack-enabled, server-authoritative).
 */
export class LudoArenaClient {
  private socket: Socket | null = null;

  connect(gatewayUrl: string, profile?: { name: string; pic?: string; userId?: string }): Socket {
    if (this.socket) {
      this.socket.disconnect();
    }
    const base = gatewayUrl.replace(/\/+$/, "");
    const s = io(`${base}/ludo`, {
      parser: msgpackParser,
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    if (profile) {
      s.on("connect", () => {
        s.emit("register_profile", profile);
      });
    }
    this.socket = s;
    return s;
  }

  get raw(): Socket | null {
    return this.socket;
  }

  registerProfile(profile: { name: string; pic?: string; userId?: string }): void {
    this.socket?.emit("register_profile", profile);
  }

  requestWaitingRooms(): void {
    this.socket?.emit("request_waiting_rooms");
  }

  createRoom(title?: string, roomCode?: string): void {
    this.socket?.emit("create_room", { ...(title ? { title } : {}), ...(roomCode ? { roomCode } : {}) });
  }

  joinWaitingRoom(roomCode: string): void {
    this.socket?.emit("join_waiting_room", { roomCode });
  }

  addBot(): void {
    this.socket?.emit("add_bot");
  }

  removeBot(): void {
    this.socket?.emit("remove_bot");
  }

  startGame(): void {
    this.socket?.emit("start_game");
  }

  rollDie(): void {
    this.socket?.emit("roll_die");
  }

  makeMove(tokenId: string): void {
    this.socket?.emit("make_move", { tokenId });
  }

  playAgain(): void {
    this.socket?.emit("play_again");
  }

  requestSync(): void {
    this.socket?.emit("request_sync");
  }

  sendChatMessage(msg: string): void {
    this.socket?.emit("send_chat_message", { msg });
  }

  leaveRoom(): void {
    this.socket?.emit("leave_room");
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
