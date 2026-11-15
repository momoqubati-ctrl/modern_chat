import { sanitizeHtmlText, stringGen } from "@newchat/shared";
import type { Namespace, Socket } from "socket.io";

interface CarromArenaPlayer {
  socketId: string;
  slot: 0 | 1;
  name: string;
  pic: string;
  userId?: string;
}

interface CarromArenaRoom {
  roomCode: string;
  title: string;
  hostSocketId: string;
  players: CarromArenaPlayer[];
  spectators: Set<string>;
  pendingSync: Set<string>;
  status: "waiting" | "playing";
  snapshot: Record<string, unknown> | null;
  turnSlot: 0 | 1;
  shotInProgress: boolean;
  lastTurnSeq: number;
  turnDeadlineAt: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
  updatedAt: number;
}

interface CarromSocketProfile {
  name: string;
  pic: string;
  userId?: string;
}

interface RateBucket {
  windowStart: number;
  count: number;
}

const MAX_ROOMS = 2000;
const TURN_DURATION_MS = 20_000;
const VS_INTRO_GRACE_MS = 1_450;
const SHOT_WATCHDOG_MS = 15_000;
const BOARD_MIN = 0;
const BOARD_MAX = 520;
const MAX_VELOCITY = 60;
const MAX_SNAPSHOT_COINS = 25;

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function sanitizeAvatarUrl(raw: unknown): string {
  const s = sanitizeHtmlText(String(raw || "pic.png").trim()).slice(0, 300);
  if (!s) return "pic.png";
  const lower = s.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:text/html")
  ) {
    return "pic.png";
  }
  return s;
}

function sanitizeSnapshot(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const inner =
    obj.snapshot && typeof obj.snapshot === "object"
      ? (obj.snapshot as Record<string, unknown>)
      : obj;

  if (!Array.isArray(inner.players) || !Array.isArray(inner.hittingObjs)) {
    return null;
  }

  const players = inner.players.slice(0, 2).map((p) => {
    const rec = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
    const coins =
      rec.coins && typeof rec.coins === "object"
        ? (rec.coins as Record<string, unknown>)
        : {};
    return {
      score: Math.round(clampNum(rec.score, -1000, 10000, 0)),
      coins: {
        white: Math.max(0, Math.min(20, Math.round(clampNum(coins.white, 0, 20, 0)))),
        black: Math.max(0, Math.min(20, Math.round(clampNum(coins.black, 0, 20, 0)))),
      },
    };
  });

  const allowedNames = new Set(["striker", "black", "white", "red", "coin"]);
  const hittingObjs = inner.hittingObjs.slice(0, MAX_SNAPSHOT_COINS).map((item, idx) => {
    const c = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const rawName = String(c.name || (idx === 0 ? "striker" : "coin")).toLowerCase();
    const name = allowedNames.has(rawName) ? rawName : "coin";
    const defaultColor =
      name === "striker"
        ? "#ffffff"
        : name === "red"
          ? "#ff002b"
          : name === "white"
            ? "#f3e5ab"
            : "#333333";
    const rawColor = sanitizeHtmlText(String(c.color || defaultColor)).slice(0, 24);
    const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : defaultColor;

    return {
      x: clampNum(c.x, -120, BOARD_MAX + 120, 260),
      y: clampNum(c.y, -120, BOARD_MAX + 120, 260),
      vx: clampNum(c.vx, -MAX_VELOCITY, MAX_VELOCITY, 0),
      vy: clampNum(c.vy, -MAX_VELOCITY, MAX_VELOCITY, 0),
      name,
      color,
      radius: clampNum(c.radius, 8, 16, idx === 0 ? 11 : 10),
    };
  });

  const currPlayer = Number(inner.currPlayer) === 1 ? 1 : 0;
  const redPutNum = Number(inner.redPut);
  const redPut = redPutNum === 1 || redPutNum === 2 ? redPutNum : 0;

  return {
    currPlayer,
    redPut,
    strikerPot: Boolean(inner.strikerPot),
    coinPoted: Boolean(inner.coinPoted),
    firstHit: Boolean(inner.firstHit),
    hitBlueCoin: Boolean(inner.hitBlueCoin),
    turnSeq: Math.max(0, Math.round(clampNum(inner.turnSeq, 0, 1_000_000, 0))),
    players,
    hittingObjs,
  };
}

export function registerCarromNamespace(nsp: Namespace): { stopAllTimers: () => void } {
  const rooms = new Map<string, CarromArenaRoom>();
  const profiles = new Map<string, CarromSocketProfile>();
  const socketToRoom = new Map<string, string>();
  const motionRates = new Map<string, RateBucket>();
  const actionRates = new Map<string, RateBucket>();

  function allowRate(map: Map<string, RateBucket>, socketId: string, maxPerSec: number): boolean {
    const now = Date.now();
    let bucket = map.get(socketId);
    if (!bucket || now - bucket.windowStart >= 1000) {
      bucket = { windowStart: now, count: 1 };
      map.set(socketId, bucket);
      return true;
    }
    bucket.count += 1;
    return bucket.count <= maxPerSec;
  }

  function getWaitingRoomList() {
    const out: Array<{
      roomCode: string;
      roomId: string;
      title: string;
      hostName: string;
      hostAvatar: string;
      playerCount: number;
      spectatorCount: number;
      status: string;
      game: string;
    }> = [];
    for (const room of rooms.values()) {
      if (room.players.length === 0) continue;
      out.push({
        roomCode: room.roomCode,
        roomId: room.roomCode,
        title: room.title,
        hostName: room.players[0]?.name || "مضيف",
        hostAvatar: room.players[0]?.pic || "pic.png",
        playerCount: room.players.length,
        spectatorCount: room.spectators.size,
        status: room.status,
        game: "كيرم",
      });
    }
    out.sort((a, b) => (a.playerCount === b.playerCount ? 0 : a.playerCount < b.playerCount ? -1 : 1));
    return out;
  }

  function broadcastWaitingRooms(): void {
    nsp.emit("waiting_rooms", getWaitingRoomList());
  }

  function buildPlayerProfiles(players: CarromArenaPlayer[]) {
    const ordered = [...players].sort((a, b) => a.slot - b.slot);
    return ordered.map((p) => ({
      socketId: p.socketId,
      slot: p.slot,
      name: p.name,
      playerName: p.name,
      pic: p.pic,
      playerAvatar: p.pic,
      userId: p.userId,
    }));
  }

  function clearRoomTurnTimer(room: CarromArenaRoom): void {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    room.turnDeadlineAt = null;
  }

  function applyServerTimeoutToSnapshot(room: CarromArenaRoom, nextSlot: 0 | 1): void {
    if (!room.snapshot || typeof room.snapshot !== "object") return;
    const snap = room.snapshot;
    snap.currPlayer = nextSlot;
    snap.strikerPot = false;
    snap.coinPoted = false;
    snap.firstHit = false;
    snap.hitBlueCoin = false;
    snap.turnSeq = Number(snap.turnSeq || 0) + 1;

    // If red queen was uncovered on this turn, return it to center (260, 260)
    if (snap.redPut === 2 && Array.isArray(snap.hittingObjs)) {
      snap.redPut = 0;
      const list = snap.hittingObjs as Array<Record<string, unknown>>;
      if (!list.some((d) => d && d.name === "red")) {
        list.push({
          x: 260,
          y: 260,
          vx: 0,
          vy: 0,
          name: "red",
          color: "#e61938",
          radius: 10,
        });
      }
    } else if (snap.redPut === 1) {
      snap.redPut = 2;
    }
  }

  function scheduleRoomTurnTimer(
    room: CarromArenaRoom,
    slot: 0 | 1,
    durationMs = TURN_DURATION_MS,
    emitTurnEvent = true,
  ): void {
    clearRoomTurnTimer(room);
    if (room.status !== "playing" || room.players.length < 2) return;

    room.turnSlot = slot;
    room.shotInProgress = false;
    const now = Date.now();
    room.turnDeadlineAt = now + durationMs;

    if (emitTurnEvent) {
      nsp.to(room.roomCode).emit("turn_timer", {
        roomCode: room.roomCode,
        roomId: room.roomCode,
        turnSlot: slot,
        turnDeadlineAt: room.turnDeadlineAt,
        turnDurationMs: durationMs,
        serverNow: now,
      });
    }

    room.turnTimer = setTimeout(() => {
      const currentRoom = rooms.get(room.roomCode);
      if (!currentRoom || currentRoom.status !== "playing" || currentRoom.players.length < 2) {
        return;
      }
      const timedOutSlot = currentRoom.turnSlot;
      const nextSlot: 0 | 1 = timedOutSlot === 0 ? 1 : 0;
      const timedOutPlayer = currentRoom.players.find((p) => p.slot === timedOutSlot);
      const nextPlayer = currentRoom.players.find((p) => p.slot === nextSlot);

      applyServerTimeoutToSnapshot(currentRoom, nextSlot);
      currentRoom.updatedAt = Date.now();

      scheduleRoomTurnTimer(currentRoom, nextSlot, TURN_DURATION_MS, false);
      nsp.to(currentRoom.roomCode).emit("turn_timeout", {
        roomCode: currentRoom.roomCode,
        roomId: currentRoom.roomCode,
        timedOutSlot,
        timedOutName: timedOutPlayer?.name || `اللاعب ${timedOutSlot + 1}`,
        nextSlot,
        nextName: nextPlayer?.name || `اللاعب ${nextSlot + 1}`,
        turnDeadlineAt: currentRoom.turnDeadlineAt,
        turnDurationMs: TURN_DURATION_MS,
        serverNow: Date.now(),
        message: `انتهى وقت ${timedOutPlayer?.name || "اللاعب"} — انتقل الدور إلى ${nextPlayer?.name || "الخصم"}`,
      });
    }, durationMs);

    if (typeof room.turnTimer.unref === "function") {
      room.turnTimer.unref();
    }
  }

  function leaveCurrentRoom(socket: Socket): void {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    socketToRoom.delete(socket.id);
    void socket.leave(roomCode);

    const room = rooms.get(roomCode);
    if (!room) return;

    const wasPlayerIdx = room.players.findIndex((p) => p.socketId === socket.id);
    room.spectators.delete(socket.id);
    room.pendingSync.delete(socket.id);
    if (wasPlayerIdx !== -1) {
      const removed = room.players.splice(wasPlayerIdx, 1)[0]!;
      clearRoomTurnTimer(room);
      room.shotInProgress = false;
      room.turnSlot = 0;
      room.lastTurnSeq = 0;
      room.snapshot = null;

      nsp.to(roomCode).emit("player_left", {
        roomCode,
        roomId: roomCode,
        socketId: socket.id,
        slot: removed.slot,
        playerIndex: removed.slot,
        departedSlot: removed.slot,
        name: removed.name,
        departedName: removed.name,
        pic: removed.pic,
        departedPic: removed.pic,
        remainingPlayers: room.players,
        message: `غادر ${removed.name} الغرفة.`,
      });

      if (room.players.length === 1) {
        room.players[0]!.slot = 0;
        room.hostSocketId = room.players[0]!.socketId;
        room.status = "waiting";
        nsp.to(roomCode).emit("player_reassigned", {
          roomCode,
          roomId: roomCode,
          playerIndex: 0,
          playerLabel: "اللاعب 1",
          players: room.players,
        });
        nsp.to(roomCode).emit("room_waiting", {
          roomCode,
          roomId: roomCode,
          hostName: room.players[0]!.name,
          players: room.players,
        });
        nsp.to(roomCode).emit("match_paused", {
          roomCode,
          roomId: roomCode,
          reason: "opponent_left",
          departedName: removed.name,
          departedPic: removed.pic,
          departedSlot: removed.slot,
          message: `غادر ${removed.name} اللعبة — الغرفة متاحة لانضمام لاعب آخر.`,
        });
      }
    }

    if (room.players.length === 0 && room.spectators.size === 0) {
      clearRoomTurnTimer(room);
      rooms.delete(roomCode);
    } else {
      room.updatedAt = Date.now();
    }
    broadcastWaitingRooms();
  }

  function getRoomActivePlayer(socketId: string): { room: CarromArenaRoom; player: CarromArenaPlayer } | null {
    const roomCode = socketToRoom.get(socketId);
    if (!roomCode) return null;
    const room = rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    return { room, player };
  }

  nsp.on("connection", (socket) => {
    socket.on("register_profile", (raw: unknown) => {
      if (!allowRate(actionRates, socket.id, 15)) return;
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const profile: CarromSocketProfile = {
        name:
          sanitizeHtmlText(String(d.name || d.playerName || d.topic || "لاعب").trim()).slice(0, 60) ||
          "لاعب",
        pic: sanitizeAvatarUrl(d.pic || d.playerAvatar),
        userId: d.userId ? sanitizeHtmlText(String(d.userId)).slice(0, 80) : undefined,
      };
      profiles.set(socket.id, profile);
      socket.emit("profile_ready", {
        ok: true,
        id: socket.id,
        profile,
        playerName: profile.name,
        playerAvatar: profile.pic,
      });
    });

    socket.on("request_waiting_rooms", () => {
      if (!allowRate(actionRates, socket.id, 12)) return;
      socket.emit("waiting_rooms", getWaitingRoomList());
    });

    socket.on("create_room", (raw: unknown) => {
      if (!allowRate(actionRates, socket.id, 6)) return;
      if (rooms.size >= MAX_ROOMS) {
        socket.emit("join_error", { msg: "الخادم مشغول حالياً، حاول مرة أخرى لاحقاً" });
        return;
      }
      leaveCurrentRoom(socket);
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const profile = profiles.get(socket.id) || { name: "لاعب", pic: "pic.png" };
      const rawCode = sanitizeHtmlText(String(d.roomCode || d.roomId || "")).replace(/[^a-zA-Z0-9_-]/g, "");
      const roomCode = rawCode.slice(0, 24) || `CR-${stringGen(5).toUpperCase()}`;

      if (rooms.has(roomCode)) {
        socket.emit("join_error", { msg: "رمز الطاولة مستخدم بالفعل" });
        return;
      }

      const room: CarromArenaRoom = {
        roomCode,
        title: sanitizeHtmlText(String(d.title || `طاولة ${profile.name}`).trim()).slice(0, 60),
        hostSocketId: socket.id,
        players: [{ socketId: socket.id, slot: 0, name: profile.name, pic: profile.pic, userId: profile.userId }],
        spectators: new Set<string>(),
        pendingSync: new Set<string>(),
        status: "waiting",
        snapshot: null,
        turnSlot: 0,
        shotInProgress: false,
        lastTurnSeq: 0,
        turnDeadlineAt: null,
        turnTimer: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      rooms.set(roomCode, room);
      socketToRoom.set(socket.id, roomCode);
      void socket.join(roomCode);

      socket.emit("room_joined", {
        roomCode,
        roomId: roomCode,
        title: room.title,
        slot: 0,
        playerIndex: 0,
        players: room.players,
        status: room.status,
      });
      socket.emit("room_waiting", {
        roomCode,
        roomId: roomCode,
        hostName: profile.name,
        players: room.players,
      });
      broadcastWaitingRooms();
    });

    socket.on("join_waiting_room", (raw: unknown) => {
      if (!allowRate(actionRates, socket.id, 10)) return;
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const roomCode = String(d.roomCode || d.roomId || d.code || "").trim().slice(0, 24);
      const room = rooms.get(roomCode);
      if (!room) {
        socket.emit("join_error", { msg: "الطاولة غير موجودة" });
        return;
      }
      if (socketToRoom.get(socket.id) === roomCode) {
        return;
      }

      leaveCurrentRoom(socket);
      const profile = profiles.get(socket.id) || { name: "لاعب", pic: "pic.png" };
      socketToRoom.set(socket.id, roomCode);
      void socket.join(roomCode);

      if (room.players.length < 2) {
        const slot: 0 | 1 = room.players.some((p) => p.slot === 0) ? 1 : 0;
        room.players.push({
          socketId: socket.id,
          slot,
          name: profile.name,
          pic: profile.pic,
          userId: profile.userId,
        });
        room.status = room.players.length === 2 ? "playing" : "waiting";
        room.updatedAt = Date.now();

        socket.emit("room_joined", {
          roomCode,
          roomId: roomCode,
          title: room.title,
          slot,
          playerIndex: slot,
          players: room.players,
          status: room.status,
        });

        if (room.players.length === 2) {
          const initialSlot: 0 | 1 =
            room.snapshot && Number(room.snapshot.currPlayer) === 1 ? 1 : 0;
          const initialDuration = room.snapshot
            ? TURN_DURATION_MS
            : TURN_DURATION_MS + VS_INTRO_GRACE_MS;
          scheduleRoomTurnTimer(room, initialSlot, initialDuration, false);

          nsp.to(roomCode).emit("game_ready", {
            roomCode,
            roomId: roomCode,
            players: room.players,
            playerProfiles: buildPlayerProfiles(room.players),
            snapshot: room.snapshot,
            turnSlot: room.turnSlot,
            turnDeadlineAt: room.turnDeadlineAt,
            turnDurationMs: TURN_DURATION_MS,
            serverNow: Date.now(),
          });
          if (room.snapshot) {
            nsp.to(roomCode).emit("room_resume_state", {
              roomCode,
              roomId: roomCode,
              snapshot: room.snapshot,
              turnSlot: room.turnSlot,
              turnDeadlineAt: room.turnDeadlineAt,
              turnDurationMs: TURN_DURATION_MS,
              serverNow: Date.now(),
            });
          }
        } else {
          nsp.to(roomCode).emit("room_waiting", {
            roomCode,
            roomId: roomCode,
            hostName: room.players[0]?.name || profile.name,
            players: room.players,
          });
        }
      } else {
        room.spectators.add(socket.id);
        socket.emit("room_joined", {
          roomCode,
          roomId: roomCode,
          title: room.title,
          slot: -1,
          playerIndex: -1,
          spectator: true,
          players: room.players,
          playerProfiles: buildPlayerProfiles(room.players),
          status: room.status,
        });
        if (room.snapshot) {
          socket.emit("room_resume_state", { roomCode, roomId: roomCode, snapshot: room.snapshot });
        }
      }

      broadcastWaitingRooms();
    });

    socket.on("state_snapshot", (raw: unknown) => {
      if (!allowRate(actionRates, socket.id, 15)) return;
      const membership = getRoomActivePlayer(socket.id);
      if (!membership) return;
      const safeSnap = sanitizeSnapshot(raw);
      if (!safeSnap) return;
      const room = membership.room;
      room.snapshot = safeSnap;
      room.updatedAt = Date.now();

      const discCount = Array.isArray(safeSnap.hittingObjs) ? safeSnap.hittingObjs.length : 2;
      const snapCurrPlayer: 0 | 1 = Number(safeSnap.currPlayer) === 1 ? 1 : 0;
      const snapSeq = Number(safeSnap.turnSeq || 0);

      if (discCount <= 1 || room.status !== "playing" || room.players.length < 2) {
        clearRoomTurnTimer(room);
        room.shotInProgress = false;
      } else if (
        room.shotInProgress ||
        snapSeq > room.lastTurnSeq ||
        snapCurrPlayer !== room.turnSlot ||
        !room.turnDeadlineAt
      ) {
        room.lastTurnSeq = Math.max(room.lastTurnSeq, snapSeq);
        scheduleRoomTurnTimer(room, snapCurrPlayer, TURN_DURATION_MS, true);
      }

      if (room.pendingSync.size > 0) {
        for (const targetId of room.pendingSync) {
          if (targetId !== socket.id) {
            nsp.to(targetId).emit("room_resume_state", {
              roomCode: room.roomCode,
              roomId: room.roomCode,
              snapshot: safeSnap,
              turnSlot: room.turnSlot,
              turnDeadlineAt: room.turnDeadlineAt,
              turnDurationMs: TURN_DURATION_MS,
              serverNow: Date.now(),
            });
          }
        }
        room.pendingSync.clear();
      }
    });

    socket.on("request_sync", () => {
      if (!allowRate(actionRates, socket.id, 8)) return;
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      room.pendingSync.add(socket.id);
      if (room.snapshot) {
        socket.emit("room_resume_state", {
          roomCode,
          roomId: roomCode,
          snapshot: room.snapshot,
          turnSlot: room.turnSlot,
          turnDeadlineAt: room.turnDeadlineAt,
          turnDurationMs: TURN_DURATION_MS,
          serverNow: Date.now(),
        });
      }
      if (room.players.length > 0) {
        for (const p of room.players) {
          if (p.socketId !== socket.id) {
            nsp.to(p.socketId).emit("request_sync_from_peer", { requesterId: socket.id });
            break;
          }
        }
      }
    });

    socket.on("striker_place", (raw: unknown) => {
      if (!allowRate(motionRates, socket.id, 65)) return;
      const membership = getRoomActivePlayer(socket.id);
      if (!membership || membership.room.players.length < 2) return;
      if (membership.room.status !== "playing" || membership.player.slot !== membership.room.turnSlot) return;
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      if (typeof d.x !== "number" || typeof d.y !== "number") return;
      const x = clampNum(d.x, BOARD_MIN, BOARD_MAX, 260);
      const y = clampNum(d.y, BOARD_MIN, BOARD_MAX, 430);

      socket.to(membership.room.roomCode).volatile.emit("opponent_striker_place", {
        playerIndex: membership.player.slot,
        x,
        y,
      });
    });

    socket.on("striker_aim", (raw: unknown) => {
      if (!allowRate(motionRates, socket.id, 65)) return;
      const membership = getRoomActivePlayer(socket.id);
      if (!membership || membership.room.players.length < 2) return;
      if (membership.room.status !== "playing" || membership.player.slot !== membership.room.turnSlot) return;
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      if (typeof d.aimX !== "number" || typeof d.aimY !== "number") return;
      const aimX = clampNum(d.aimX, -600, 1120, 260);
      const aimY = clampNum(d.aimY, -600, 1120, 480);

      socket.to(membership.room.roomCode).volatile.emit("opponent_striker_aim", {
        playerIndex: membership.player.slot,
        aimX,
        aimY,
      });
    });

    socket.on("striker_hit", (raw: unknown) => {
      if (!allowRate(actionRates, socket.id, 12)) return;
      const membership = getRoomActivePlayer(socket.id);
      if (!membership || membership.room.players.length < 2) return;
      const room = membership.room;
      if (room.status !== "playing" || membership.player.slot !== room.turnSlot || room.shotInProgress) return;
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      if (typeof d.vX !== "number" || typeof d.vY !== "number") return;

      const strikerX = clampNum(d.strikerX, BOARD_MIN, BOARD_MAX, 260);
      const strikerY = clampNum(d.strikerY, BOARD_MIN, BOARD_MAX, 430);
      const vX = clampNum(d.vX, -MAX_VELOCITY, MAX_VELOCITY, 0);
      const vY = clampNum(d.vY, -MAX_VELOCITY, MAX_VELOCITY, 0);

      clearRoomTurnTimer(room);
      room.shotInProgress = true;
      room.updatedAt = Date.now();

      // Safety watchdog in case clients stall/disconnect mid-shot animation
      room.turnTimer = setTimeout(() => {
        const cur = rooms.get(room.roomCode);
        if (!cur || !cur.shotInProgress || cur.players.length < 2) return;
        const timedOutSlot = cur.turnSlot;
        const nextSlot: 0 | 1 = timedOutSlot === 0 ? 1 : 0;
        applyServerTimeoutToSnapshot(cur, nextSlot);
        scheduleRoomTurnTimer(cur, nextSlot, TURN_DURATION_MS, true);
      }, SHOT_WATCHDOG_MS);
      if (typeof room.turnTimer.unref === "function") {
        room.turnTimer.unref();
      }

      socket.to(room.roomCode).emit("opponent_striker_hit", {
        playerIndex: membership.player.slot,
        strikerX,
        strikerY,
        vX,
        vY,
      });
    });

    socket.on("play_again", () => {
      if (!allowRate(actionRates, socket.id, 6)) return;
      const membership = getRoomActivePlayer(socket.id);
      if (!membership) return;
      const room = membership.room;
      clearRoomTurnTimer(room);
      room.snapshot = null;
      room.shotInProgress = false;
      room.turnSlot = 0;
      room.lastTurnSeq = 0;
      room.updatedAt = Date.now();
      socket.to(room.roomCode).emit("opponent_play_again");
      if (room.players.length >= 2) {
        room.status = "playing";
        scheduleRoomTurnTimer(room, 0, TURN_DURATION_MS, true);
      }
    });

    socket.on("send_chat_message", (raw: unknown) => {
      if (!allowRate(actionRates, socket.id, 10)) return;
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      const profile = profiles.get(socket.id) || { name: "لاعب", pic: "pic.png" };
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const msg = sanitizeHtmlText(String(d.message || d.msg || d.text || "").trim()).slice(0, 250);
      if (!msg) return;
      nsp.to(roomCode).emit("chat_message", {
        from: socket.id,
        name: profile.name,
        senderName: profile.name,
        pic: profile.pic,
        senderAvatar: profile.pic,
        msg,
        message: msg,
        ts: Date.now(),
      });
    });

    socket.on("leave_room", () => {
      leaveCurrentRoom(socket);
    });

    socket.on("disconnect", () => {
      leaveCurrentRoom(socket);
      profiles.delete(socket.id);
      motionRates.delete(socket.id);
      actionRates.delete(socket.id);
    });
  });

  // Periodic sweep of stale empty rooms every 10 minutes
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      if (now - room.updatedAt > 6 * 60 * 60 * 1000 && room.players.length === 0) {
        rooms.delete(code);
      }
    }
  }, 10 * 60 * 1000);
  if (typeof sweepTimer.unref === "function") sweepTimer.unref();

  return {
    stopAllTimers: () => {
      clearInterval(sweepTimer);
      for (const room of rooms.values()) {
        clearRoomTurnTimer(room);
      }
    },
  };
}
