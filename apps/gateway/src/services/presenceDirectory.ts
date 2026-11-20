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

const ROOM_MEMBERS_PRUNE_INTERVAL_MS = 15_000;
const ROOM_MEMBERS_PRUNE_CHUNK = 250;

function roomMembersKey(roomId: string): string {
  return `newchat:room:${roomId}:members`;
}

function isActiveRoomMember(session: GatewaySession | null | undefined, roomId: string): boolean {
  return Boolean(
    session &&
      session.roomid === roomId &&
      !session.offline &&
      Number(session.stat || 0) !== 3 &&
      !session.stealth,
  );
}

export class PresenceDirectory {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly localSessions = new Map<string, GatewaySession>();
  private readonly socketByLid = new Map<string, string>();
  private readonly socketByUid = new Map<string, Set<string>>();
  private readonly backgroundGraceTimers = new Map<string, NodeJS.Timeout>();
  private readonly roomMembersPrunedAt = new Map<string, number>();
  private roomCountsBroadcastTimer: NodeJS.Timeout | null = null;
  private roomMembershipChangedCallback?: (roomId: string) => Promise<void> | void;

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
        tx.sadd(roomMembersKey(session.roomid), session.id);
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

  async reassignSessionSocket(
    oldSocketId: string,
    newSocket: Socket,
    opts?: { roomId?: string },
  ): Promise<GatewaySession | null> {
    this.cancelBackgroundGrace(oldSocketId);
    const existing =
      this.localSessions.get(oldSocketId) || (await this.getDistributedSession(oldSocketId));
    if (!existing) return null;

    const requestedRoomId = String(opts?.roomId || "").trim();
    const existingRoomId = String(existing.roomid || "").trim();
    const targetRoomId =
      (requestedRoomId && this.catalogStore.getRoomById(requestedRoomId) ? requestedRoomId : "") ||
      (existingRoomId && this.catalogStore.getRoomById(existingRoomId) ? existingRoomId : "") ||
      null;
    await this.removeSession(oldSocketId, { emitLeave: true, keepToken: true });
    const next: GatewaySession = {
      ...existing,
      id: newSocket.id,
      roomid: targetRoomId,
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
        tx.srem(roomMembersKey(oldRoomId), session.id);
      }
      if (newRoomId && !session.stealth && !session.offline && Number(session.stat || 0) !== 3) {
        tx.sadd(roomMembersKey(newRoomId), session.id);
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

    const prevRoomId = String(current.roomid || "").trim();
    const nextRoomId = String(updated.roomid || "").trim();
    const wasMember = isActiveRoomMember(current, prevRoomId);
    const isMember = isActiveRoomMember(updated, nextRoomId);
    const membershipChanged = prevRoomId !== nextRoomId || wasMember !== isMember;

    try {
      const redis = getRedis();
      const targetHash = updated.islogin === "بوت" ? REDIS_KEYS.presenceVirtual : PRESENCE_USERS_HASH;
      const tx = redis.pipeline();
      tx.hset(targetHash, socketId, JSON.stringify(updated));
      if (updated.token && updated.islogin !== "بوت") {
        tx.hset(SESSION_TOKENS_HASH, updated.token, JSON.stringify(updated));
      }
      if (membershipChanged) {
        if (prevRoomId && (!wasMember || prevRoomId !== nextRoomId)) {
          tx.srem(roomMembersKey(prevRoomId), socketId);
        }
        if (nextRoomId && isMember) {
          tx.sadd(roomMembersKey(nextRoomId), socketId);
        }
      }
      await tx.exec();
    } catch {
      // ignore
    }

    if (membershipChanged) {
      const roomsToSync = new Set<string>();
      if (prevRoomId) roomsToSync.add(prevRoomId);
      if (nextRoomId) roomsToSync.add(nextRoomId);
      await Promise.all(Array.from(roomsToSync).map((id) => this.syncRoomCount(id)));
      this.queueRoomCountsBroadcast();
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
        tx.srem(roomMembersKey(removed.roomid), socketId);
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

  bindRoomMembershipChanged(cb: (roomId: string) => Promise<void> | void): void {
    this.roomMembershipChangedCallback = cb;
  }

  async syncRoomCount(roomId: string): Promise<number> {
    if (!roomId) return 0;
    const count = await this.countOnlineRoomMembers(roomId);
    try {
      await getRedis().hset(PRESENCE_ROOMS_HASH, roomId, String(count));
    } catch {
      // Local fallback already computed in countOnlineRoomMembers
    }
    if (this.roomMembershipChangedCallback) {
      try {
        await this.roomMembershipChangedCallback(roomId);
      } catch {
        // Non-fatal: listeners count is best-effort
      }
    }
    return count;
  }

  /**
   * Removes room-member ids that no longer belong to a live session in this room.
   * Stale ids accumulate across gateway restarts/reconnects because the presence
   * hashes are flushed on boot while the per-room membership sets are not.
   */
  async pruneStaleRoomMembers(roomId: string, opts?: { force?: boolean }): Promise<void> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return;

    const now = Date.now();
    const lastPrunedAt = this.roomMembersPrunedAt.get(safeRoomId) || 0;
    if (!opts?.force && now - lastPrunedAt < ROOM_MEMBERS_PRUNE_INTERVAL_MS) return;
    this.roomMembersPrunedAt.set(safeRoomId, now);

    try {
      const redis = getRedis();
      const key = roomMembersKey(safeRoomId);
      const members = await redis.smembers(key);
      if (members.length === 0) return;

      const stale: string[] = [];
      for (let i = 0; i < members.length; i += ROOM_MEMBERS_PRUNE_CHUNK) {
        const chunk = members.slice(i, i + ROOM_MEMBERS_PRUNE_CHUNK);
        const [realRaw, virtualRaw] = await Promise.all([
          redis.hmget(PRESENCE_USERS_HASH, ...chunk),
          redis.hmget(REDIS_KEYS.presenceVirtual, ...chunk),
        ]);
        chunk.forEach((id, index) => {
          const raw = realRaw[index] || virtualRaw[index];
          const localSession = this.localSessions.get(id);
          const session = raw ? safeJsonParse<GatewaySession | null>(raw, null) : localSession || null;
          if (!isActiveRoomMember(session, safeRoomId)) {
            stale.push(id);
          }
        });
      }

      for (let i = 0; i < stale.length; i += ROOM_MEMBERS_PRUNE_CHUNK) {
        await redis.srem(key, ...stale.slice(i, i + ROOM_MEMBERS_PRUNE_CHUNK));
      }
    } catch {
      // Non-fatal: keep using SCARD when Redis is unavailable.
    }
  }

  async removeRoomPresence(roomId: string): Promise<void> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return;
    this.roomMembersPrunedAt.delete(safeRoomId);
    try {
      const redis = getRedis();
      await redis.del(roomMembersKey(safeRoomId));
      await redis.hdel(PRESENCE_ROOMS_HASH, safeRoomId);
    } catch {
      // Non-fatal
    }
    this.queueRoomCountsBroadcast();
  }

  async countOnlineRoomMembers(roomId: string): Promise<number> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return 0;

    await this.pruneStaleRoomMembers(safeRoomId);

    try {
      const count = await getRedis().scard(roomMembersKey(safeRoomId));
      return Math.max(0, Number(count) || 0);
    } catch {
      let localCount = 0;
      for (const s of this.localSessions.values()) {
        if (isActiveRoomMember(s, safeRoomId)) localCount += 1;
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
