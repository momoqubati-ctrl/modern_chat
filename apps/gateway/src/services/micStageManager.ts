import { eq, getDb, getRedis, REDIS_KEYS, rooms } from "@newchat/db";
import {
  MIC_SLOT_COUNT,
  PM_CALL_BUSY_STATES,
  PM_CALL_LOCK_TTL_MS,
  parseRoomOwnerMeta,
  verRoomsOwner,
} from "@newchat/shared";
import type { Server, Socket } from "socket.io";
import { emitNotice, safeJsonParse } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { PresenceDirectory } from "./presenceDirectory.js";
import { StageMediaAuthority } from "./stageMediaAuthority.js";

export interface StageSlotState {
  id: string;
  ev: boolean;
}

export interface RoomMicSnapshot {
  data: Record<string, StageSlotState>;
  micCount: number;
  lockedSlots: Record<string, 0 | 1>;
  mutedUsers: Record<string, boolean>;
}

const STAGE_ROOM_TTL_SEC = 86_400;
const ROOM_LIKES_KEY_PREFIX = "newchat:stage:room_likes:";
const OCCUPANT_HEARTBEAT_TTL_SEC = 180;
const MAINTENANCE_INTERVAL_MS = 30_000;
const OCCUPANT_KEY_PREFIX = "newchat:stage:occupant:";
const ACTIVE_OCCUPANTS_SET = "newchat:stage:active_occupants";
const RECONCILE_LOCK_KEY = "newchat:stage:reconcile_lock";

const LUA_TAKE_STAGE_SLOT = `
local roomKey = KEYS[1]
local occupantKey = KEYS[2]
local activeSetKey = KEYS[3]

local roomId = ARGV[1]
local socketId = ARGV[2]
local slotId = ARGV[3]
local micCount = tonumber(ARGV[4])
local initialJson = ARGV[5]
local roomPrefix = ARGV[6]
local roomTtl = tonumber(ARGV[7])
local occupantTtl = tonumber(ARGV[8])

local raw = redis.call('GET', roomKey) or initialJson
local state = cjson.decode(raw)
if not state.data then state.data = {} end
if not state.lockedSlots then state.lockedSlots = {} end
if not state.mutedUsers then state.mutedUsers = {} end
state.micCount = micCount

if state.lockedSlots[slotId] == 1 or state.lockedSlots[slotId] == true then
  return cjson.encode({ ok = false, reason = 'locked' })
end

local existingSlot = state.data[slotId]
if existingSlot and existingSlot.ev and existingSlot.id ~= '' and existingSlot.id ~= socketId then
  return cjson.encode({ ok = false, reason = 'occupied' })
end

local prevRoomId = nil
local prevRaw = redis.call('GET', occupantKey)
if prevRaw then
  local prev = cjson.decode(prevRaw)
  prevRoomId = prev.roomId
  local prevSlotId = tostring(prev.slotId or '')
  if prevRoomId == roomId then
    if prevSlotId ~= '' and prevSlotId ~= slotId and state.data[prevSlotId] and state.data[prevSlotId].id == socketId then
      state.data[prevSlotId] = { id = '', ev = false }
    end
  elseif prevRoomId and prevRoomId ~= '' then
    local otherKey = roomPrefix .. prevRoomId
    local otherRaw = redis.call('GET', otherKey)
    if otherRaw then
      local otherState = cjson.decode(otherRaw)
      if otherState.data and prevSlotId ~= '' and otherState.data[prevSlotId] and otherState.data[prevSlotId].id == socketId then
        otherState.data[prevSlotId] = { id = '', ev = false }
      end
      if otherState.mutedUsers then
        otherState.mutedUsers[socketId] = nil
      end
      redis.call('SET', otherKey, cjson.encode(otherState), 'EX', roomTtl)
    end
  end
end

state.data[slotId] = { id = socketId, ev = true }
state.mutedUsers[socketId] = false
redis.call('SET', roomKey, cjson.encode(state), 'EX', roomTtl)
redis.call('SET', occupantKey, cjson.encode({ roomId = roomId, slotId = slotId }), 'EX', occupantTtl)
redis.call('SADD', activeSetKey, socketId)

return cjson.encode({
  ok = true,
  previousRoomId = prevRoomId,
  state = state
})
`;

const LUA_VACATE_OCCUPANT = `
local roomKey = KEYS[1]
local occupantKey = KEYS[2]
local activeSetKey = KEYS[3]

local roomId = ARGV[1]
local socketId = ARGV[2]
local roomTtl = tonumber(ARGV[3])

local changed = false
local state = nil
local raw = redis.call('GET', roomKey)
if raw then
  state = cjson.decode(raw)
  if state.data then
    for k, v in pairs(state.data) do
      if type(v) == 'table' and v.id == socketId then
        state.data[k] = { id = '', ev = false }
        changed = true
      end
    end
  end
  if state.mutedUsers and state.mutedUsers[socketId] ~= nil then
    state.mutedUsers[socketId] = nil
    changed = true
  end
  if changed then
    redis.call('SET', roomKey, cjson.encode(state), 'EX', roomTtl)
  end
end

local occRaw = redis.call('GET', occupantKey)
if occRaw then
  local occ = cjson.decode(occRaw)
  if not occ.roomId or occ.roomId == roomId then
    redis.call('DEL', occupantKey)
    redis.call('SREM', activeSetKey, socketId)
  end
else
  redis.call('SREM', activeSetKey, socketId)
end

return cjson.encode({ changed = changed, state = state })
`;

const LUA_TOUCH_HEARTBEAT = `
local roomKey = KEYS[1]
local occupantKey = KEYS[2]
local roomId = ARGV[1]
local socketId = ARGV[2]
local occupantTtl = tonumber(ARGV[3])

local occRaw = redis.call('GET', occupantKey)
if not occRaw then return 0 end
local occ = cjson.decode(occRaw)
if occ.roomId ~= roomId then return 0 end

local roomRaw = redis.call('GET', roomKey)
if not roomRaw then return 0 end
local state = cjson.decode(roomRaw)
local slot = state.data and state.data[tostring(occ.slotId or '')]
if not slot or not slot.ev or slot.id ~= socketId then return 0 end

redis.call('EXPIRE', occupantKey, occupantTtl)
return 1
`;

const LUA_TOGGLE_SLOT_LOCK = `
local roomKey = KEYS[1]
local activeSetKey = KEYS[2]

local slotId = ARGV[1]
local lockVal = tonumber(ARGV[2])
local initialJson = ARGV[3]
local occupantPrefix = ARGV[4]
local roomTtl = tonumber(ARGV[5])

local raw = redis.call('GET', roomKey) or initialJson
local state = cjson.decode(raw)
if not state.data then state.data = {} end
if not state.lockedSlots then state.lockedSlots = {} end
if not state.mutedUsers then state.mutedUsers = {} end

state.lockedSlots[slotId] = lockVal

local kickedId = ''
if lockVal == 1 and state.data[slotId] and state.data[slotId].id and state.data[slotId].id ~= '' then
  kickedId = state.data[slotId].id
  state.data[slotId] = { id = '', ev = false }
  state.mutedUsers[kickedId] = nil
  redis.call('DEL', occupantPrefix .. kickedId)
  redis.call('SREM', activeSetKey, kickedId)
end

redis.call('SET', roomKey, cjson.encode(state), 'EX', roomTtl)
return cjson.encode({ kickedId = kickedId, state = state })
`;

const LUA_SET_MUTE_STATE = `
local roomKey = KEYS[1]

local targetId = ARGV[1]
local hasExplicit = ARGV[2] == '1'
local explicitMuted = ARGV[3] == '1'
local initialJson = ARGV[4]
local roomTtl = tonumber(ARGV[5])

local raw = redis.call('GET', roomKey) or initialJson
local state = cjson.decode(raw)
if not state.data then state.data = {} end
if not state.mutedUsers then state.mutedUsers = {} end

local isOnStage = false
for _, slot in pairs(state.data) do
  if type(slot) == 'table' and slot.ev and slot.id == targetId then
    isOnStage = true
    break
  end
end

local nextMuted = explicitMuted
if not hasExplicit then
  nextMuted = not (state.mutedUsers[targetId] == true)
end

state.mutedUsers[targetId] = nextMuted
redis.call('SET', roomKey, cjson.encode(state), 'EX', roomTtl)
return cjson.encode({ muted = nextMuted, isOnStage = isOnStage, state = state })
`;

function emptySlots(): Record<string, StageSlotState> {
  const slots: Record<string, StageSlotState> = {};
  for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
    slots[String(i)] = { id: "", ev: false };
  }
  return slots;
}

export function normalizeSlotLocks(raw: unknown): Record<string, 0 | 1> {
  const out: Record<string, 0 | 1> = {};
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
    const k = String(i);
    out[k] = obj[k] ? 1 : 0;
  }
  return out;
}

function normalizeMutedMap(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k) out[k] = Boolean(v);
  }
  return out;
}

function normalizeStageSnapshot(raw: Partial<RoomMicSnapshot> | null | undefined, limit: number, defaultLocks?: unknown): RoomMicSnapshot {
  const slots = emptySlots();
  const dataObj =
    raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, Partial<StageSlotState> | undefined>)
      : {};
  for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
    const k = String(i);
    const entry = dataObj[k];
    slots[k] = {
      id: i <= limit ? String(entry?.id || "") : "",
      ev: i <= limit ? Boolean(entry?.ev && entry?.id) : false,
    };
  }
  return {
    data: slots,
    micCount: limit,
    lockedSlots: normalizeSlotLocks(raw?.lockedSlots ?? defaultLocks),
    mutedUsers: normalizeMutedMap(raw?.mutedUsers),
  };
}

export class MicStageManager {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly presenceDirectory: PresenceDirectory;
  private readonly mediaAuthority: StageMediaAuthority;
  private readonly localStageCache = new Map<string, RoomMicSnapshot>();
  private readonly roomLikesCache = new Map<string, number>();
  private readonly pendingLikesPersistTimers = new Map<string, NodeJS.Timeout>();
  private readonly roomStageRequests = new Map<
    string,
    Map<string, { socketId: string; topic: string; pic: string; slot: number; time: number }>
  >();
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private onStageChangedCallback?: (roomId: string, reasonText?: string) => Promise<void>;

  constructor(io: Server, catalogStore: CatalogStore, presenceDirectory: PresenceDirectory) {
    this.io = io;
    this.catalogStore = catalogStore;
    this.presenceDirectory = presenceDirectory;
    this.mediaAuthority = new StageMediaAuthority(() => this.catalogStore.getSiteSetting());
  }

  startMaintenanceLoop(): void {
    if (this.maintenanceTimer) return;
    this.maintenanceTimer = setInterval(() => {
      void this.runPeriodicStageMaintenance();
    }, MAINTENANCE_INTERVAL_MS);
    if (typeof this.maintenanceTimer.unref === "function") {
      this.maintenanceTimer.unref();
    }
  }

  stopMaintenanceLoop(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
  }

  bindCarromSyncCallback(cb: (roomId: string, reasonText?: string) => Promise<void>): void {
    this.onStageChangedCallback = cb;
  }

  getStageRequests(roomId: string) {
    const map = this.roomStageRequests.get(roomId);
    return map ? Array.from(map.values()) : [];
  }

  addStageRequest(roomId: string, req: { socketId: string; topic: string; pic: string; slot: number }) {
    if (!this.roomStageRequests.has(roomId)) {
      this.roomStageRequests.set(roomId, new Map());
    }
    const map = this.roomStageRequests.get(roomId)!;
    map.set(req.socketId, { ...req, time: Date.now() });
    return Array.from(map.values());
  }

  removeStageRequest(roomId: string, socketId: string) {
    const map = this.roomStageRequests.get(roomId);
    if (!map) return [];
    map.delete(socketId);
    return Array.from(map.values());
  }

  async lockAllEmptySlots(socket: Socket, roomId: string): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !verRoomsOwner(this.catalogStore.getPowers(), session.rank || session.power)) return;
    const state = await this.loadRoomState(roomId);
    const limit = this.getRoomMicLimit(roomId);
    const nextLocks: Record<string, 0 | 1> = { ...state.lockedSlots };
    for (let i = 1; i <= limit; i += 1) {
      const k = String(i);
      if (!state.data[k]?.id) {
        nextLocks[k] = 1;
      }
    }
    await this.applyLocks(roomId, nextLocks);
  }

  async unlockAllSlots(socket: Socket, roomId: string): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !verRoomsOwner(this.catalogStore.getPowers(), session.rank || session.power)) return;
    const limit = this.getRoomMicLimit(roomId);
    const nextLocks: Record<string, 0 | 1> = {};
    for (let i = 1; i <= limit; i += 1) {
      nextLocks[String(i)] = 0;
    }
    await this.applyLocks(roomId, nextLocks);
  }

  getRoomMicLimit(roomId: string): number {
    const room = this.catalogStore.getRoomById(roomId);
    if (!room) return MIC_SLOT_COUNT;
    const raw = Number(room.stage_count || room.mic || MIC_SLOT_COUNT);
    if (!Number.isFinite(raw)) return MIC_SLOT_COUNT;
    return Math.max(0, Math.min(MIC_SLOT_COUNT, Math.floor(raw)));
  }

  private buildInitialSnapshot(roomId: string): RoomMicSnapshot {
    const room = this.catalogStore.getRoomById(roomId);
    return {
      data: emptySlots(),
      micCount: this.getRoomMicLimit(roomId),
      lockedSlots: normalizeSlotLocks(room?.stage_state),
      mutedUsers: {},
    };
  }

  async loadRoomState(roomId: string): Promise<RoomMicSnapshot> {
    const redisKey = REDIS_KEYS.roomMicsPrefix + roomId;
    const limit = this.getRoomMicLimit(roomId);
    let state: RoomMicSnapshot | null = null;

    try {
      const raw = await getRedis().get(redisKey);
      if (raw) {
        state = safeJsonParse<RoomMicSnapshot | null>(raw, null);
      }
    } catch {
      state = null;
    }

    const room = this.catalogStore.getRoomById(roomId);
    if (!state) {
      state = this.localStageCache.get(roomId) || this.buildInitialSnapshot(roomId);
    }

    const normalized = normalizeStageSnapshot(state, limit, room?.stage_state);

    let dirty = false;
    for (let i = 1; i <= limit; i += 1) {
      const k = String(i);
      const occupantId = normalized.data[k]!.id;
      if (!occupantId) continue;
      const occupant = await this.presenceDirectory.getDistributedSession(occupantId);
      if (!occupant || occupant.roomid !== roomId || occupant.offline) {
        normalized.data[k] = { id: "", ev: false };
        delete normalized.mutedUsers[occupantId];
        dirty = true;
        await this.mediaAuthority.syncBroadcastPermission(roomId, occupantId, false);
      }
    }

    this.localStageCache.set(roomId, normalized);
    if (dirty) {
      await this.saveRoomState(roomId, normalized);
    }
    return normalized;
  }

  async saveRoomState(roomId: string, state: RoomMicSnapshot): Promise<void> {
    this.localStageCache.set(roomId, state);
    try {
      await getRedis().set(
        REDIS_KEYS.roomMicsPrefix + roomId,
        JSON.stringify(state),
        "EX",
        STAGE_ROOM_TTL_SEC,
      );
    } catch {
      // Fallback cache preserved in localStageCache
    }
  }

  async isUserOnStage(socketId: string, roomId?: string | null): Promise<{ roomId: string; slotId: string } | null> {
    const session = await this.presenceDirectory.getDistributedSession(socketId);
    const targetRoomId = String(roomId || session?.roomid || "").trim();
    if (!targetRoomId) return null;
    const state = await this.loadRoomState(targetRoomId);
    for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
      const k = String(i);
      if (state.data[k]?.ev && state.data[k]?.id === socketId) {
        return { roomId: targetRoomId, slotId: k };
      }
    }
    return null;
  }

  async isUserAllowedToPublish(roomId: string, socketId: string): Promise<boolean> {
    const occupant = await this.presenceDirectory.getDistributedSession(socketId);
    if (!occupant || occupant.roomid !== roomId || occupant.offline || occupant.ismuted || occupant.muted) {
      return false;
    }
    const state = await this.loadRoomState(roomId);
    if (state.mutedUsers[socketId]) return false;
    for (let i = 1; i <= state.micCount; i += 1) {
      const slot = state.data[String(i)];
      if (slot?.ev && slot.id === socketId && !state.lockedSlots[String(i)]) {
        return true;
      }
    }
    return false;
  }

  /**
   * O(1) Redis SCARD listener calculation designed for 10,000+ listeners per room.
   */
  async buildListenerCount(roomId: string): Promise<number> {
    const room = this.catalogStore.getRoomById(roomId);
    if (!room || !room.broadcast) return 0;

    const state = await this.loadRoomState(roomId);
    let activeSpeakerCount = 0;
    for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
      const s = state.data[String(i)];
      if (s?.ev && s.id) activeSpeakerCount += 1;
    }

    try {
      const memberCount = await getRedis().scard(`newchat:room:${roomId}:members`);
      return Math.max(0, Number(memberCount || 0) - activeSpeakerCount);
    } catch {
      let localMembers = 0;
      for (const s of this.presenceDirectory.getAllLocalSessions()) {
        if (s.roomid === roomId && !s.offline && Number(s.stat || 0) !== 3 && !s.stealth) {
          localMembers += 1;
        }
      }
      return Math.max(0, localMembers - activeSpeakerCount);
    }
  }

  async emitStateToSocket(socket: Socket, roomId: string): Promise<void> {
    const state = await this.loadRoomState(roomId);
    const likes = await this.getRoomLikes(roomId);
    socket.emit("broadcasting", { cmd: "all", roomid: roomId, likes, ...state });
    socket.emit("broadcasting", { cmd: "room-likes", roomid: roomId, total: likes });
    const count = await this.buildListenerCount(roomId);
    socket.emit("broadcasting", { cmd: "listeners-count", roomid: roomId, count });
  }

  async emitStateToRoom(roomId: string): Promise<void> {
    const state = await this.loadRoomState(roomId);
    const likes = await this.getRoomLikes(roomId);
    this.io.to(roomId).emit("broadcasting", { cmd: "all", roomid: roomId, likes, ...state });
    this.io.to(roomId).emit("broadcasting", { cmd: "room-likes", roomid: roomId, total: likes });
    const count = await this.buildListenerCount(roomId);
    this.io.to(roomId).emit("broadcasting", { cmd: "listeners-count", roomid: roomId, count });
  }

  async getRoomLikes(roomId: string): Promise<number> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return 0;
    try {
      const redisKey = `${ROOM_LIKES_KEY_PREFIX}${safeRoomId}`;
      const raw = await getRedis().get(redisKey);
      if (raw !== null) {
        const val = Number.parseInt(raw, 10);
        if (Number.isFinite(val)) {
          this.roomLikesCache.set(safeRoomId, val);
          return val;
        }
      } else {
        const room = this.catalogStore.getRoomById(safeRoomId);
        const meta = room?.room_owner_meta ? parseRoomOwnerMeta(room.room_owner_meta) : null;
        const initialLikes = Math.max(0, Number(meta?.live_config?.likes_count || 0));
        if (initialLikes > 0) {
          await getRedis().set(redisKey, String(initialLikes), "EX", STAGE_ROOM_TTL_SEC);
          this.roomLikesCache.set(safeRoomId, initialLikes);
          return initialLikes;
        }
      }
    } catch {
      // Redis fallback
    }
    return this.roomLikesCache.get(safeRoomId) ?? 0;
  }

  async incrementRoomLikes(roomId: string, count: number): Promise<number> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return 0;
    const added = Math.max(1, Math.min(50, Math.floor(count)));
    let nextTotal = (this.roomLikesCache.get(safeRoomId) ?? 0) + added;
    try {
      const redisKey = `${ROOM_LIKES_KEY_PREFIX}${safeRoomId}`;
      const res = await getRedis().incrby(redisKey, added);
      await getRedis().expire(redisKey, STAGE_ROOM_TTL_SEC);
      nextTotal = res;
      this.roomLikesCache.set(safeRoomId, nextTotal);
    } catch {
      this.roomLikesCache.set(safeRoomId, nextTotal);
    }
    this.scheduleLikesPersistence(safeRoomId, nextTotal);
    return nextTotal;
  }

  async clearRoomLikes(roomId: string): Promise<void> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return;
    this.roomLikesCache.delete(safeRoomId);
    const timer = this.pendingLikesPersistTimers.get(safeRoomId);
    if (timer) {
      clearTimeout(timer);
      this.pendingLikesPersistTimers.delete(safeRoomId);
    }
    try {
      await getRedis().del(`${ROOM_LIKES_KEY_PREFIX}${safeRoomId}`);
    } catch {
      // non-fatal
    }
  }

  private scheduleLikesPersistence(roomId: string, totalLikes: number): void {
    if (this.pendingLikesPersistTimers.has(roomId)) return;
    const timer = setTimeout(async () => {
      this.pendingLikesPersistTimers.delete(roomId);
      try {
        const room = this.catalogStore.getRoomById(roomId);
        if (!room) return;
        const meta = parseRoomOwnerMeta(room.room_owner_meta);
        if (!meta.live_config) {
          meta.live_config = { is_live_audio: true };
        }
        meta.live_config.likes_count = totalLikes;
        room.room_owner_meta = meta;
        this.catalogStore.upsertRoomLocal(room);
        const { db } = getDb();
        await db
          .update(rooms)
          .set({ room_owner_meta: JSON.stringify(meta) })
          .where(eq(rooms.id, roomId));
      } catch {
        // non-fatal
      }
    }, 10_000);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    this.pendingLikesPersistTimers.set(roomId, timer);
  }

  async clearUserFromStage(
    roomId: string,
    socketId: string,
    opts?: { evictFromMediaRoom?: boolean },
  ): Promise<boolean> {
    if (!roomId || !socketId) return false;
    const limit = this.getRoomMicLimit(roomId);
    let changed = false;
    let updatedState: RoomMicSnapshot | null = null;

    try {
      const rawRes = (await getRedis().eval(
        LUA_VACATE_OCCUPANT,
        3,
        REDIS_KEYS.roomMicsPrefix + roomId,
        OCCUPANT_KEY_PREFIX + socketId,
        ACTIVE_OCCUPANTS_SET,
        roomId,
        socketId,
        String(STAGE_ROOM_TTL_SEC),
      )) as string;
      const parsed = safeJsonParse<{ changed?: boolean; state?: Partial<RoomMicSnapshot> | null } | null>(
        rawRes,
        null,
      );
      changed = Boolean(parsed?.changed);
      if (parsed?.state) {
        updatedState = normalizeStageSnapshot(parsed.state, limit);
        this.localStageCache.set(roomId, updatedState);
      }
    } catch {
      const state = await this.loadRoomState(roomId);
      for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
        const k = String(i);
        if (state.data[k]?.id === socketId) {
          state.data[k] = { id: "", ev: false };
          changed = true;
        }
      }
      if (state.mutedUsers[socketId] !== undefined) {
        delete state.mutedUsers[socketId];
        changed = true;
      }
      if (changed) {
        await this.saveRoomState(roomId, state);
      }
    }

    if (opts?.evictFromMediaRoom) {
      await this.mediaAuthority.evictMediaParticipant(roomId, socketId);
    } else if (changed) {
      await this.mediaAuthority.syncBroadcastPermission(roomId, socketId, false);
    }

    if (changed) {
      this.io.to(roomId).emit("broadcasting", { cmd: "speaking", user: socketId, speaking: false, roomid: roomId });
      this.io.to(roomId).emit("broadcasting", { cmd: "rleave", user: socketId, roomid: roomId });
      await this.emitStateToRoom(roomId);
      if (this.onStageChangedCallback) {
        await this.onStageChangedCallback(roomId);
      }
    }
    return changed;
  }

  async setParticipantMuted(
    actorSocket: Socket,
    roomId: string,
    targetId: string,
    explicitMuted?: unknown,
  ): Promise<void> {
    const actor = this.presenceDirectory.getLocalSession(actorSocket.id);
    if (!actor || !targetId) return;
    const isStaff = verRoomsOwner(this.catalogStore.getPowers(), actor.rank || actor.power);
    if (targetId !== actorSocket.id && !isStaff) return;

    const targetSession = await this.presenceDirectory.getDistributedSession(targetId);
    if (!targetSession || targetSession.roomid !== roomId) return;

    const hasExplicit = explicitMuted !== undefined;
    let nextMuted = Boolean(explicitMuted);

    // Prevent account-muted users from unmuting themselves on the voice stage
    if ((!hasExplicit || nextMuted === false) && (targetSession.ismuted || targetSession.muted)) {
      nextMuted = true;
      if (targetId === actorSocket.id) {
        emitNotice(actorSocket, "تم منعك من الحديث في الدردشة");
      }
    }

    const limit = this.getRoomMicLimit(roomId);
    const initial = this.buildInitialSnapshot(roomId);

    try {
      const rawRes = (await getRedis().eval(
        LUA_SET_MUTE_STATE,
        1,
        REDIS_KEYS.roomMicsPrefix + roomId,
        targetId,
        hasExplicit || (targetSession.ismuted || targetSession.muted) ? "1" : "0",
        nextMuted ? "1" : "0",
        JSON.stringify(initial),
        String(STAGE_ROOM_TTL_SEC),
      )) as string;
      const parsed = safeJsonParse<{
        muted?: boolean;
        isOnStage?: boolean;
        state?: Partial<RoomMicSnapshot>;
      } | null>(rawRes, null);
      if (parsed?.state) {
        nextMuted = Boolean(parsed.muted);
        this.localStageCache.set(roomId, normalizeStageSnapshot(parsed.state, limit));
      }
    } catch {
      const state = await this.loadRoomState(roomId);
      if (!hasExplicit && !(targetSession.ismuted || targetSession.muted)) {
        nextMuted = !Boolean(state.mutedUsers[targetId]);
      }
      state.mutedUsers[targetId] = nextMuted;
      await this.saveRoomState(roomId, state);
    }

    const allowPublish =
      !nextMuted && !targetSession.ismuted && !targetSession.muted && (await this.isUserAllowedToPublish(roomId, targetId));
    await this.mediaAuthority.syncBroadcastPermission(roomId, targetId, allowPublish);

    if (nextMuted) {
      this.io.to(roomId).emit("broadcasting", {
        cmd: "speaking",
        user: targetId,
        speaking: false,
        roomid: roomId,
      });
    }

    this.io.to(roomId).emit("broadcasting", {
      cmd: "mic-state",
      user: targetId,
      muted: nextMuted,
      roomid: roomId,
    });
    await this.emitStateToRoom(roomId);
  }

  async touchSlotHeartbeat(socketId: string, roomId: string): Promise<boolean> {
    if (!socketId || !roomId) return false;
    try {
      const res = await getRedis().eval(
        LUA_TOUCH_HEARTBEAT,
        2,
        REDIS_KEYS.roomMicsPrefix + roomId,
        OCCUPANT_KEY_PREFIX + socketId,
        roomId,
        socketId,
        String(OCCUPANT_HEARTBEAT_TTL_SEC),
      );
      const ok = Number(res) === 1;
      if (!ok) {
        await this.mediaAuthority.syncBroadcastPermission(roomId, socketId, false);
      }
      return ok;
    } catch {
      return false;
    }
  }

  async applyLocks(roomId: string, nextLocks: Record<string, 0 | 1>): Promise<string[]> {
    const state = await this.loadRoomState(roomId);
    const normalized = normalizeSlotLocks(nextLocks);
    const removedUsers: string[] = [];
    const redis = getRedis();

    for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
      const k = String(i);
      state.lockedSlots[k] = normalized[k]!;
      if (normalized[k] === 1 && state.data[k]?.id) {
        const kickedId = state.data[k]!.id;
        removedUsers.push(kickedId);
        state.data[k] = { id: "", ev: false };
        delete state.mutedUsers[kickedId];
        await redis.del(OCCUPANT_KEY_PREFIX + kickedId).catch(() => 0);
        await redis.srem(ACTIVE_OCCUPANTS_SET, kickedId).catch(() => 0);
        await this.mediaAuthority.syncBroadcastPermission(roomId, kickedId, false);
      }
    }
    await this.saveRoomState(roomId, state);
    for (const kickedId of removedUsers) {
      this.io.to(roomId).emit("broadcasting", { cmd: "rleave", user: kickedId, roomid: roomId });
      this.io.to(roomId).emit("broadcasting", { cmd: "rjoin", user: kickedId, roomid: roomId });
    }
    await this.emitStateToRoom(roomId);
    return removedUsers;
  }

  async handleLockSlot(socket: Socket, roomId: string, cmd: string, slotNum: number, ev?: unknown): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !verRoomsOwner(this.catalogStore.getPowers(), session.rank || session.power)) {
      return;
    }
    const limit = this.getRoomMicLimit(roomId);
    if (!Number.isFinite(slotNum) || slotNum < 1 || slotNum > limit) return;

    const k = String(slotNum);
    const lockVal: 0 | 1 =
      cmd === "unlock-slot" ? 0 : cmd === "lock-slot" ? 1 : ev ? 1 : 0;

    let kickedId = "";
    const initial = this.buildInitialSnapshot(roomId);

    try {
      const rawRes = (await getRedis().eval(
        LUA_TOGGLE_SLOT_LOCK,
        2,
        REDIS_KEYS.roomMicsPrefix + roomId,
        ACTIVE_OCCUPANTS_SET,
        k,
        String(lockVal),
        JSON.stringify(initial),
        OCCUPANT_KEY_PREFIX,
        String(STAGE_ROOM_TTL_SEC),
      )) as string;
      const parsed = safeJsonParse<{ kickedId?: string; state?: Partial<RoomMicSnapshot> } | null>(
        rawRes,
        null,
      );
      kickedId = String(parsed?.kickedId || "");
      if (parsed?.state) {
        this.localStageCache.set(roomId, normalizeStageSnapshot(parsed.state, limit));
      }
    } catch {
      const state = await this.loadRoomState(roomId);
      state.lockedSlots[k] = lockVal;
      if (lockVal === 1 && state.data[k]?.id) {
        kickedId = state.data[k]!.id;
        state.data[k] = { id: "", ev: false };
        delete state.mutedUsers[kickedId];
      }
      await this.saveRoomState(roomId, state);
    }

    if (kickedId) {
      await this.mediaAuthority.syncBroadcastPermission(roomId, kickedId, false);
      this.io.to(roomId).emit("broadcasting", { cmd: "speaking", user: kickedId, speaking: false, roomid: roomId });
      this.io.to(roomId).emit("broadcasting", { cmd: "rleave", user: kickedId, roomid: roomId });
      this.io.to(roomId).emit("broadcasting", { cmd: "rjoin", user: kickedId, roomid: roomId });
    }

    await this.emitStateToRoom(roomId);
    if (this.onStageChangedCallback) {
      await this.onStageChangedCallback(roomId, "تم تحديث مقاعد الغرفة.");
    }
  }

  async handleTakeSlot(socket: Socket, roomId: string, slotNum: number): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session) return;

    const room = this.catalogStore.getRoomById(roomId);
    if (!room || !room.broadcast) {
      emitNotice(socket, "البث الصوتي غير مفعل في هذه الغرفة");
      return;
    }

    try {
      const allCalls = await getRedis().hgetall(REDIS_KEYS.pmCalls);
      const now = Date.now();
      for (const rawCall of Object.values(allCalls)) {
        const rec = safeJsonParse<{
          callerId?: string;
          calleeId?: string;
          status?: string;
          updatedAt?: number;
          createdAt?: number;
        } | null>(rawCall, null);
        if (!rec) continue;
        if (now - Number(rec.updatedAt || rec.createdAt || 0) > PM_CALL_LOCK_TTL_MS) continue;
        if (
          (rec.callerId === socket.id || rec.calleeId === socket.id) &&
          PM_CALL_BUSY_STATES.has(String(rec.status || ""))
        ) {
          emitNotice(socket, "لا يمكنك الصعود على المايك أثناء وجودك في مكالمة خاصة");
          return;
        }
      }
    } catch {
      // ignore redis read fallback
    }

    const limit = this.getRoomMicLimit(roomId);
    if (!Number.isFinite(slotNum) || slotNum < 1 || slotNum > limit) {
      emitNotice(socket, "هذا المايك غير متاح في هذه الغرفة");
      await this.emitStateToSocket(socket, roomId);
      return;
    }

    if (session.ismuted || session.muted) {
      emitNotice(socket, "تم منعك من الحديث في الدردشة");
      return;
    }

    const micLikes = this.catalogStore.getLimits().miclikes;
    if (session.rep < micLikes) {
      emitNotice(socket, `${micLikes} عدد الايكات المطلوبة للمايك`);
      return;
    }

    const slotId = String(slotNum);
    const initial = this.buildInitialSnapshot(roomId);
    let previousRoomId = "";

    try {
      const rawRes = (await getRedis().eval(
        LUA_TAKE_STAGE_SLOT,
        3,
        REDIS_KEYS.roomMicsPrefix + roomId,
        OCCUPANT_KEY_PREFIX + socket.id,
        ACTIVE_OCCUPANTS_SET,
        roomId,
        socket.id,
        slotId,
        String(limit),
        JSON.stringify(initial),
        REDIS_KEYS.roomMicsPrefix,
        String(STAGE_ROOM_TTL_SEC),
        String(OCCUPANT_HEARTBEAT_TTL_SEC),
      )) as string;
      const parsed = safeJsonParse<{
        ok?: boolean;
        reason?: string;
        previousRoomId?: string;
        state?: Partial<RoomMicSnapshot>;
      } | null>(rawRes, null);

      if (!parsed?.ok) {
        if (parsed?.reason === "locked") {
          emitNotice(socket, "هذا المايك مقفل حاليا");
        } else if (parsed?.reason === "occupied") {
          emitNotice(socket, "هذا المايك مشغول حاليا");
        } else if (parsed?.reason === "already_seated") {
          emitNotice(socket, "انزل من المايك الحالي اولا");
        }
        await this.emitStateToSocket(socket, roomId);
        return;
      }

      previousRoomId = String(parsed.previousRoomId || "");
      if (parsed.state) {
        this.localStageCache.set(roomId, normalizeStageSnapshot(parsed.state, limit));
      }
    } catch {
      const state = await this.loadRoomState(roomId);
      if (state.lockedSlots[slotId]) {
        emitNotice(socket, "هذا المايك مقفل حاليا");
        await this.emitStateToSocket(socket, roomId);
        return;
      }
      const currentOccupant = state.data[slotId];
      if (currentOccupant?.ev && currentOccupant.id && currentOccupant.id !== socket.id) {
        emitNotice(socket, "هذا المايك مشغول حاليا");
        return;
      }
      for (let i = 1; i <= limit; i += 1) {
        const k = String(i);
        if (state.data[k]?.id === socket.id && k !== slotId) {
          state.data[k] = { id: "", ev: false };
        }
      }
      state.data[slotId] = { id: socket.id, ev: true };
      state.mutedUsers[socket.id] = false;
      await this.saveRoomState(roomId, state);
    }

    if (previousRoomId && previousRoomId !== roomId) {
      await this.mediaAuthority.evictMediaParticipant(previousRoomId, socket.id);
      await this.emitStateToRoom(previousRoomId);
    }

    await this.mediaAuthority.ensureMediaRoomExists(roomId);
    await this.mediaAuthority.syncBroadcastPermission(roomId, socket.id, true);

    this.io.to(roomId).emit("broadcasting", {
      cmd: "new",
      it: slotId,
      user: socket.id,
      roomid: roomId,
    });
    await this.emitStateToRoom(roomId);
    if (this.onStageChangedCallback) {
      await this.onStageChangedCallback(roomId, `${session.topic} صعد على المايك ${slotId}.`);
    }
  }

  async handleRemic(socket: Socket, targetSocketId: string): Promise<void> {
    const actor = this.presenceDirectory.getLocalSession(socket.id);
    if (!actor || !targetSocketId) return;
    const isStaff = verRoomsOwner(this.catalogStore.getPowers(), actor.rank || actor.power);
    if (!isStaff && targetSocketId !== socket.id) return;

    const target = await this.presenceDirectory.getDistributedSession(targetSocketId);
    const roomId = String(target?.roomid || actor.roomid || "").trim();
    if (!roomId) return;

    await this.clearUserFromStage(roomId, targetSocketId);
    this.io.to(roomId).emit("broadcasting", { cmd: "rjoin", user: targetSocketId, roomid: roomId });
  }

  private async runPeriodicStageMaintenance(): Promise<void> {
    try {
      const redis = getRedis();
      const lock = await redis.set(RECONCILE_LOCK_KEY, "1", "PX", 25_000, "NX");
      if (!lock) return;

      const occupantIds = await redis.smembers(ACTIVE_OCCUPANTS_SET);
      const validPublisherKeys = new Set<string>();

      for (const sid of occupantIds) {
        const occRaw = await redis.get(OCCUPANT_KEY_PREFIX + sid);
        const session = await this.presenceDirectory.getDistributedSession(sid);
        if (!occRaw || !session || !session.roomid || session.offline) {
          await redis.srem(ACTIVE_OCCUPANTS_SET, sid);
          if (session?.roomid) {
            await this.clearUserFromStage(session.roomid, sid, { evictFromMediaRoom: true });
          }
          continue;
        }

        const occ = safeJsonParse<{ roomId?: string } | null>(occRaw, null);
        const roomId = String(occ?.roomId || "");
        if (!roomId || roomId !== session.roomid) {
          if (roomId) {
            await this.clearUserFromStage(roomId, sid, { evictFromMediaRoom: true });
          }
          await redis.del(OCCUPANT_KEY_PREFIX + sid);
          await redis.srem(ACTIVE_OCCUPANTS_SET, sid);
          continue;
        }

        if (await this.isUserAllowedToPublish(roomId, sid)) {
          validPublisherKeys.add(`${roomId}\u0000${sid}`);
        }
      }

      await this.mediaAuthority.reconcileActiveBroadcastRooms(validPublisherKeys);
    } catch {
      // Ignore maintenance errors gracefully
    }
  }
}
