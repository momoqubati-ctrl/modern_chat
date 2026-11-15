import {
  addUidSocket,
  getRedis,
  getUidSockets,
  REDIS_KEYS,
  removeUidSocket,
} from "@newchat/db";
import {
  GUEST_BACKGROUND_DISCONNECT_GRACE_MS,
  MOBILE_BACKGROUND_DISCONNECT_GRACE_MS,
  normalizeActiveChatUsername,
  sortOnlineSnapshots,
  verStealthPanel,
  type OnlineUserSnapshot,
} from "@newchat/shared";
import type { Server, Socket } from "socket.io";
import { safeJsonParse, sanitizePublicSnapshot } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { GatewaySession } from "../types/gateway.js";

const PRESENCE_USERS_HASH = "newchat:presence:users";
const PRESENCE_ROOMS_HASH = "newchat:presence:rooms";
const SESSION_TOKENS_HASH = "newchat:session:tokens";

export class PresenceDirectory {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly localSessions = new Map<string, GatewaySession>();
  private readonly socketByLid = new Map<string, string>();
  private readonly socketByUid = new Map<string, Set<string>>();
  private readonly backgroundGraceTimers = new Map<string, NodeJS.Timeout>();
  private roomCountsBroadcastTimer: NodeJS.Timeout | null = null;

  constructor(io: Server, catalogStore: CatalogStore) {
    this.io = io;
    this.catalogStore = catalogStore;
  }

  getLocalSession(socketId: string): GatewaySession | undefined {
    return this.localSessions.get(socketId);
  }

  getAllLocalSessions(): GatewaySession[] {
    return Array.from(this.localSessions.values());
  }

  getLocalSocketIdsByUid(uid: string): string[] {
    const set = this.socketByUid.get(String(uid || "").trim());
    return set ? Array.from(set) : [];
  }

  async getAllSocketIdsByUid(uid: string): Promise<string[]> {
    const local = this.getLocalSocketIdsByUid(uid);
    const distributed = await getUidSockets(uid).catch(() => []);
    return Array.from(new Set([...local, ...distributed]));
  }

  findStaffWithBootEdit(): GatewaySession[] {
    const out: GatewaySession[] = [];
    for (const sess of this.localSessions.values()) {
      const def = this.catalogStore.getPowerRole(sess.rank || sess.power);
      if (def && Number(def.bootedit || 0) === 1) {
        out.push(sess);
      }
    }
    return out;
  }

  async getDistributedSession(socketId: string): Promise<GatewaySession | null> {
    const local = this.localSessions.get(socketId);
    if (local) return local;
    try {
      const redis = getRedis();
      const raw = await redis.hget(PRESENCE_USERS_HASH, socketId);
      if (raw) {
        return safeJsonParse<GatewaySession | null>(raw, null);
      }
      const vRaw = await redis.hget(REDIS_KEYS.presenceVirtual, socketId);
      if (vRaw) {
        return safeJsonParse<GatewaySession | null>(vRaw, null);
      }
      return null;
    } catch {
      return null;
    }
  }

  async getSessionByToken(token: string): Promise<GatewaySession | null> {
    if (!token) return null;
    for (const sess of this.localSessions.values()) {
      if (sess.token === token) return sess;
    }
    try {
      const raw = await getRedis().hget(SESSION_TOKENS_HASH, token);
      return raw ? safeJsonParse<GatewaySession | null>(raw, null) : null;
    } catch {
      return null;
    }
  }

  async isUsernameTakenGlobally(rawName: string, excludeSocketId?: string): Promise<boolean> {
    const target = normalizeActiveChatUsername(rawName);
    if (!target) return false;

    const rows = await this.getAllOnlineSessions();
    for (const row of rows) {
      if (!row || (excludeSocketId && row.id === excludeSocketId)) continue;
      if (row.offline || Number(row.stat || 0) === 3) continue;
      const uMatch = row.username && normalizeActiveChatUsername(row.username) === target;
      const tMatch = row.topic && normalizeActiveChatUsername(row.topic) === target;
      if (uMatch || tMatch) {
        return true;
      }
    }
    return false;
  }

  async evictDuplicateSessions(params: {
    lid?: string;
    uid?: string;
    username?: string;
    excludeSocketId?: string;
    onEvict?: (oldSocketId: string) => Promise<void> | void;
  }): Promise<void> {
    const rows = await this.getAllOnlineSessions();
    const toEvict = new Set<string>();
    const targetLid = String(params.lid || "").trim();
    const targetUid = String(params.uid || "").trim();
    const targetUsername = params.username ? normalizeActiveChatUsername(params.username) : "";

    for (const row of rows) {
      if (!row?.id || row.id === params.excludeSocketId) continue;
      if (row.islogin === "بوت") continue;
      if (targetLid && row.lid === targetLid) toEvict.add(row.id);
      if (targetUid && row.uid === targetUid) toEvict.add(row.id);
      if (targetUsername && normalizeActiveChatUsername(row.username || row.topic) === targetUsername) {
        toEvict.add(row.id);
      }
    }

    for (const oldSocketId of toEvict) {
      this.cancelBackgroundGrace(oldSocketId);
      if (params.onEvict) {
        await params.onEvict(oldSocketId);
      } else {
        await this.removeSession(oldSocketId, { emitLeave: true });
      }
      const oldSocket = this.io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.emit("msg", {
          cmd: "not",
          data: {
            topic: "",
            force: 1,
            msg: "تم تسجيل الدخول من جهاز أو تبويب آخر",
            user: "",
          },
        });
        oldSocket.disconnect(true);
      }
    }
  }

  async registerSession(socket: Socket | null, session: GatewaySession): Promise<void> {
    this.localSessions.set(session.id, session);
    if (session.lid) this.socketByLid.set(session.lid, session.id);
    if (session.uid) {
      let set = this.socketByUid.get(session.uid);
      if (!set) {
        set = new Set<string>();
        this.socketByUid.set(session.uid, set);
      }
      set.add(session.id);
      await addUidSocket(session.uid, session.id).catch(() => 0);
    }

    if (socket && session.roomid) {
      await socket.join(session.roomid);
    }

    try {
      const redis = getRedis();
      const tx = redis.pipeline();
      if (session.islogin === "بوت") {
        tx.hset(REDIS_KEYS.presenceVirtual, session.id, JSON.stringify(session));
      } else {
        tx.hset(PRESENCE_USERS_HASH, session.id, JSON.stringify(session));
        if (session.token) {
          tx.hset(SESSION_TOKENS_HASH, session.token, JSON.stringify(session));
        }
      }
      if (session.roomid && !session.offline && Number(session.stat) !== 3 && !session.stealth) {
        tx.sadd(`newchat:room:${session.roomid}:members`, session.id);
      }
      if (session.uid) {
        tx.hdel(REDIS_KEYS.presencePinned, session.uid);
      }
      await tx.exec();
      if (session.roomid) {
        await this.syncRoomCount(session.roomid);
      }
    } catch {
      // Redis fallback already holds localSessions
    }

    if (!session.stealth) {
      const pub = sanitizePublicSnapshot(session);
      if (pub) {
        this.io.emit("msg", { cmd: "u+", data: pub });
        this.io.emit("msg", {
          cmd: "ur",
          data: { id: session.id, roomid: session.roomid || null },
        });
      }
    }
    this.queueRoomCountsBroadcast();
  }

  async reassignSessionSocket(oldSocketId: string, newSocket: Socket): Promise<GatewaySession | null> {
    this.cancelBackgroundGrace(oldSocketId);
    const existing =
      this.localSessions.get(oldSocketId) || (await this.getDistributedSession(oldSocketId));
    if (!existing) return null;

    await this.removeSession(oldSocketId, { emitLeave: true, keepToken: true });
    const next: GatewaySession = {
      ...existing,
      id: newSocket.id,
      offline: false,
      stat: existing.busy ? 2 : 0,
      pageHidden: false,
      meta_ts: Date.now(),
    };
    await this.registerSession(newSocket, next);
    return next;
  }

  async moveUserToRoom(
    socket: Socket | null,
    session: GatewaySession,
    newRoomId: string | null,
  ): Promise<void> {
    const oldRoomId = session.roomid;
    if (socket && oldRoomId && oldRoomId !== newRoomId) {
      await socket.leave(oldRoomId);
    }
    if (socket && newRoomId) {
      await socket.join(newRoomId);
    }

    session.roomid = newRoomId;
    session.meta_ts = Date.now();
    this.localSessions.set(session.id, session);

    try {
      const redis = getRedis();
      const tx = redis.pipeline();
      const targetHash = session.islogin === "بوت" ? REDIS_KEYS.presenceVirtual : PRESENCE_USERS_HASH;
      tx.hset(targetHash, session.id, JSON.stringify(session));
      if (session.token && session.islogin !== "بوت") {
        tx.hset(SESSION_TOKENS_HASH, session.token, JSON.stringify(session));
      }
      if (oldRoomId) {
        tx.srem(`newchat:room:${oldRoomId}:members`, session.id);
      }
      if (newRoomId && !session.stealth && !session.offline) {
        tx.sadd(`newchat:room:${newRoomId}:members`, session.id);
      }
      await tx.exec();

      await Promise.all([
        oldRoomId ? this.syncRoomCount(oldRoomId) : Promise.resolve(),
        newRoomId ? this.syncRoomCount(newRoomId) : Promise.resolve(),
      ]);
    } catch {
      // ignore
    }

    if (!session.stealth) {
      this.io.emit("msg", {
        cmd: "ur",
        data: { id: session.id, roomid: newRoomId },
      });
    }
    this.queueRoomCountsBroadcast();
  }

  async patchSession(
    socketId: string,
    patch: Partial<GatewaySession>,
    opts?: { broadcastUpdate?: boolean },
  ): Promise<GatewaySession | null> {
    const current =
      this.localSessions.get(socketId) || (await this.getDistributedSession(socketId));
    if (!current) return null;

    const updated: GatewaySession = {
      ...current,
      ...patch,
      meta_ts: Date.now(),
    };
    if (patch.coin !== undefined) {
      updated.coins = patch.coin;
    } else if (patch.coins !== undefined) {
      updated.coin = patch.coins;
    }
    this.localSessions.set(socketId, updated);

    try {
      const redis = getRedis();
      const targetHash = updated.islogin === "بوت" ? REDIS_KEYS.presenceVirtual : PRESENCE_USERS_HASH;
      const tx = redis.pipeline();
      tx.hset(targetHash, socketId, JSON.stringify(updated));
      if (updated.token && updated.islogin !== "بوت") {
        tx.hset(SESSION_TOKENS_HASH, updated.token, JSON.stringify(updated));
      }
      await tx.exec();
    } catch {
      // ignore
    }

    if (opts?.broadcastUpdate !== false && !updated.stealth) {
      const snap = sanitizePublicSnapshot(updated);
      if (snap) {
        this.io.emit("msg", { cmd: "u^", data: snap });
      }
    }
    return updated;
  }

  async transitionToPinnedOffline(session: GatewaySession): Promise<void> {
    await this.removeSession(session.id, { emitLeave: false });
    const pinned: OnlineUserSnapshot = {
      ...sanitizePublicSnapshot(session)!,
      stat: 3,
      offline: true,
      roomid: null,
      meta_ts: Date.now(),
    };
    try {
      if (session.uid) {
        await getRedis().hset(REDIS_KEYS.presencePinned, session.uid, JSON.stringify(pinned));
      }
    } catch {
      // ignore
    }
    this.io.emit("msg", { cmd: "u^", data: pinned });
  }

  async removeSession(
    socketId: string,
    opts?: { emitLeave?: boolean; keepToken?: boolean },
  ): Promise<GatewaySession | undefined> {
    this.cancelBackgroundGrace(socketId);
    const removed =
      this.localSessions.get(socketId) ||
      (await this.getDistributedSession(socketId).catch(() => null)) ||
      undefined;
    this.localSessions.delete(socketId);

    if (removed) {
      if (removed.lid && this.socketByLid.get(removed.lid) === socketId) {
        this.socketByLid.delete(removed.lid);
      }
      if (removed.uid) {
        const set = this.socketByUid.get(removed.uid);
        if (set) {
          set.delete(socketId);
          if (set.size === 0) this.socketByUid.delete(removed.uid);
        }
        await removeUidSocket(removed.uid, socketId).catch(() => 0);
      }
    }

    try {
      const redis = getRedis();
      const tx = redis.pipeline();
      tx.hdel(PRESENCE_USERS_HASH, socketId);
      tx.hdel(REDIS_KEYS.presenceVirtual, socketId);
      if (removed?.roomid) {
        tx.srem(`newchat:room:${removed.roomid}:members`, socketId);
      }
      if (!opts?.keepToken && removed?.token && removed.islogin === "زائر") {
        tx.hdel(SESSION_TOKENS_HASH, removed.token);
      }
      await tx.exec();
      if (removed?.roomid) {
        await this.syncRoomCount(removed.roomid);
      }
    } catch {
      // ignore
    }

    if (opts?.emitLeave !== false && (!removed || !removed.stealth)) {
      this.io.emit("msg", { cmd: "u-", data: socketId });
      this.io.emit("msg", { cmd: "ur", data: { id: socketId, roomid: null } });
    }
    this.queueRoomCountsBroadcast();
    return removed;
  }

  scheduleBackgroundGrace(
    socketId: string,
    onExpire: (session: GatewaySession) => Promise<void> | void,
  ): boolean {
    const sess = this.localSessions.get(socketId);
    if (!sess || !sess.pageHidden) return false;
    this.cancelBackgroundGrace(socketId);
    const delayMs =
      sess.islogin === "عضو"
        ? MOBILE_BACKGROUND_DISCONNECT_GRACE_MS
        : GUEST_BACKGROUND_DISCONNECT_GRACE_MS;

    const timer = setTimeout(() => {
      this.backgroundGraceTimers.delete(socketId);
      void onExpire(sess);
    }, delayMs);
    if (typeof timer.unref === "function") timer.unref();
    this.backgroundGraceTimers.set(socketId, timer);
    return true;
  }

  cancelBackgroundGrace(socketId: string): void {
    const timer = this.backgroundGraceTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      this.backgroundGraceTimers.delete(socketId);
    }
  }

  async syncRoomCount(roomId: string): Promise<number> {
    if (!roomId) return 0;
    try {
      const redis = getRedis();
      const count = await redis.scard(`newchat:room:${roomId}:members`);
      await redis.hset(PRESENCE_ROOMS_HASH, roomId, String(count));
      return count;
    } catch {
      let localCount = 0;
      for (const s of this.localSessions.values()) {
        if (s.roomid === roomId && !s.stealth && !s.offline) localCount += 1;
      }
      return localCount;
    }
  }

  async getAllRoomCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    try {
      const raw = await getRedis().hgetall(PRESENCE_ROOMS_HASH);
      for (const [k, v] of Object.entries(raw)) {
        const n = Math.max(0, Number.parseInt(v, 10) || 0);
        if (n > 0) counts[k] = n;
      }
      return counts;
    } catch {
      for (const s of this.localSessions.values()) {
        if (s.roomid && !s.stealth && !s.offline) {
          counts[s.roomid] = (counts[s.roomid] || 0) + 1;
        }
      }
      return counts;
    }
  }

  queueRoomCountsBroadcast(): void {
    if (this.roomCountsBroadcastTimer) return;
    this.roomCountsBroadcastTimer = setTimeout(async () => {
      this.roomCountsBroadcastTimer = null;
      const counts = await this.getAllRoomCounts();
      this.io.emit("msg", { cmd: "rooms_counts", data: counts });
    }, 180);
    if (typeof this.roomCountsBroadcastTimer.unref === "function") {
      this.roomCountsBroadcastTimer.unref();
    }
  }

  async getAllOnlineSessions(): Promise<GatewaySession[]> {
    const byId = new Map<string, GatewaySession>();
    try {
      const redis = getRedis();
      const [realRaw, virtualRaw] = await Promise.all([
        redis.hvals(PRESENCE_USERS_HASH),
        redis.hvals(REDIS_KEYS.presenceVirtual),
      ]);
      for (const raw of [...realRaw, ...virtualRaw]) {
        const parsed = safeJsonParse<GatewaySession | null>(raw, null);
        if (parsed?.id) byId.set(parsed.id, parsed);
      }
    } catch {
      for (const s of this.localSessions.values()) {
        byId.set(s.id, s);
      }
    }
    return Array.from(byId.values());
  }

  async buildOnlineSnapshots(viewerPower?: string): Promise<OnlineUserSnapshot[]> {
    const canSeeStealth = verStealthPanel(this.catalogStore.getPowers(), viewerPower || "");
    const live = await this.getAllOnlineSessions();
    const out: OnlineUserSnapshot[] = [];

    for (const s of live) {
      if (s.stealth && !canSeeStealth) continue;
      const pub = sanitizePublicSnapshot(s);
      if (pub) out.push(pub);
    }

    if (this.catalogStore.getOwnerState().offline) {
      try {
        const pinnedRaw = await getRedis().hvals(REDIS_KEYS.presencePinned);
        for (const raw of pinnedRaw) {
          const parsed = safeJsonParse<OnlineUserSnapshot | null>(raw, null);
          if (parsed?.id && !out.some((o) => o.uid && o.uid === parsed.uid)) {
            out.push(parsed);
          }
        }
      } catch {
        // ignore
      }
    }

    return sortOnlineSnapshots(out, this.catalogStore.getPowers());
  }

  async getRoomMemberSnapshots(roomId: string): Promise<OnlineUserSnapshot[]> {
    const list = await this.buildOnlineSnapshots();
    return list.filter((u) => u.roomid === roomId && !u.offline && Number(u.stat || 0) !== 3);
  }

  async getOnlineRoomMemberCount(roomId: string): Promise<number> {
    const list = await this.getRoomMemberSnapshots(roomId);
    return list.length;
  }

  async emitAuthoritativeSync(socket: Socket, viewerPower?: string): Promise<void> {
    const usersList = await this.buildOnlineSnapshots(viewerPower);
    socket.emit("msg", { cmd: "presence_sync", data: usersList });
  }
}
