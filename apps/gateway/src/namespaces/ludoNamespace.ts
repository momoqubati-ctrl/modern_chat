import crypto from "node:crypto";
import { getRedis, REDIS_KEYS, takeRedisRateSlot, withLudoLock } from "@newchat/db";
import {
  applyLudoDiceRoll,
  applyLudoTokenMove,
  createLudoGame,
  LUDO_BOT_THINK_DELAY_MS,
  LUDO_COLOR_LABELS_AR,
  LUDO_SEAT_COLORS,
  LUDO_TURN_TIMEOUT_MS,
  ludoArenaCreateSchema,
  ludoArenaJoinSchema,
  ludoMoveSchema,
  pickBestLudoBotMove,
  resetLudoMatch,
  sanitizeHtmlText,
  startLudoMatch,
  stringGen,
  toLudoPublicState,
  type LudoArenaRoomSummary,
  type LudoGameState,
} from "@newchat/shared";
import type { Namespace, Socket } from "socket.io";
import { safeJsonParse } from "../lib/socketUtils.js";

interface LudoArenaRoomRecord {
  roomCode: string;
  title: string;
  hostSocketId: string;
  spectatorIds: string[];
  game: LudoGameState;
  createdAt: number;
  updatedAt: number;
}

interface LudoSocketProfile {
  name: string;
  pic: string;
  userId?: string;
}

const ARENA_BOT_NAMES = ["بوت لودو 1", "بوت لودو 2", "بوت لودو 3", "بوت لودو 4"] as const;
const ARENA_ROOM_TTL_SEC = 6 * 60 * 60;

export function registerLudoNamespace(nsp: Namespace): { stopAllTimers: () => void } {
  const profiles = new Map<string, LudoSocketProfile>();
  const socketToRoom = new Map<string, string>();
  const turnTimers = new Map<string, NodeJS.Timeout>();
  const botTimers = new Map<string, NodeJS.Timeout>();

  function roomKey(roomCode: string): string {
    return REDIS_KEYS.ludoArenaPrefix + roomCode;
  }

  function clearRoomTimers(roomCode: string): void {
    const t = turnTimers.get(roomCode);
    if (t) {
      clearTimeout(t);
      turnTimers.delete(roomCode);
    }
    const b = botTimers.get(roomCode);
    if (b) {
      clearTimeout(b);
      botTimers.delete(roomCode);
    }
  }

  async function loadRoom(roomCode: string): Promise<LudoArenaRoomRecord | null> {
    try {
      const raw = await getRedis().get(roomKey(roomCode));
      return raw ? safeJsonParse<LudoArenaRoomRecord | null>(raw, null) : null;
    } catch {
      return null;
    }
  }

  async function saveRoom(room: LudoArenaRoomRecord | null, roomCode: string): Promise<void> {
    const redis = getRedis();
    if (!room) {
      await redis.del(roomKey(roomCode)).catch(() => undefined);
      await redis.srem(REDIS_KEYS.ludoArenaIndex, roomCode).catch(() => undefined);
      return;
    }
    await redis
      .set(roomKey(roomCode), JSON.stringify(room), "EX", ARENA_ROOM_TTL_SEC)
      .catch(() => undefined);
    await redis.sadd(REDIS_KEYS.ludoArenaIndex, roomCode).catch(() => undefined);
  }

  async function getWaitingRoomList(): Promise<LudoArenaRoomSummary[]> {
    try {
      const redis = getRedis();
      const codes = await redis.smembers(REDIS_KEYS.ludoArenaIndex);
      if (codes.length === 0) return [];
      const rawList = await redis.mget(codes.map((c) => roomKey(c)));
      const out: LudoArenaRoomSummary[] = [];
      const staleCodes: string[] = [];

      for (let i = 0; i < codes.length; i += 1) {
        const raw = rawList[i];
        const code = codes[i]!;
        if (!raw) {
          staleCodes.push(code);
          continue;
        }
        const rec = safeJsonParse<LudoArenaRoomRecord | null>(raw, null);
        if (!rec || rec.game.players.filter((p) => !p.isBot).length === 0) {
          staleCodes.push(code);
          continue;
        }
        const host = rec.game.players.find((p) => !p.isBot);
        out.push({
          roomCode: rec.roomCode,
          title: rec.title,
          hostName: host?.topic || "مضيف",
          playerCount: rec.game.players.length,
          botCount: rec.game.players.filter((p) => p.isBot).length,
          spectatorCount: rec.spectatorIds.length,
          status: rec.game.status,
        });
      }
      if (staleCodes.length > 0) {
        await redis.srem(REDIS_KEYS.ludoArenaIndex, ...staleCodes).catch(() => undefined);
      }
      return out;
    } catch {
      return [];
    }
  }

  async function broadcastWaitingRooms(): Promise<void> {
    const list = await getWaitingRoomList();
    nsp.emit("waiting_rooms", list);
  }

  function emitRoomState(room: LudoArenaRoomRecord): void {
    const pub = toLudoPublicState(room.game, room.roomCode, room.spectatorIds.length);
    nsp.to(room.roomCode).emit("ludo_state", pub);
  }

  function scheduleTimers(room: LudoArenaRoomRecord): void {
    clearRoomTimers(room.roomCode);
    if (room.game.status !== "active") return;
    const active = room.game.players.find((p) => p.seat === room.game.turnSeat);
    if (!active) return;

    const expectedUpdatedAt = room.game.updatedAt;
    if (active.isBot) {
      const t = setTimeout(() => {
        botTimers.delete(room.roomCode);
        void executeBotStep(room.roomCode, expectedUpdatedAt).catch(() => undefined);
      }, LUDO_BOT_THINK_DELAY_MS);
      if (typeof t.unref === "function") t.unref();
      botTimers.set(room.roomCode, t);
      return;
    }

    const t = setTimeout(() => {
      turnTimers.delete(room.roomCode);
      void handleTimeout(room.roomCode, expectedUpdatedAt).catch(() => undefined);
    }, LUDO_TURN_TIMEOUT_MS);
    if (typeof t.unref === "function") t.unref();
    turnTimers.set(room.roomCode, t);
  }

  async function executeBotStep(roomCode: string, expectedUpdatedAt: number): Promise<void> {
    await withLudoLock(`arena:${roomCode}`, async () => {
      const room = await loadRoom(roomCode);
      if (!room || room.game.status !== "active" || room.game.updatedAt !== expectedUpdatedAt) return;
      const active = room.game.players.find((p) => p.seat === room.game.turnSeat);
      if (!active?.isBot) return;

      if (room.game.phase === "awaiting_roll") {
        const roll = crypto.randomInt(1, 7);
        const res = applyLudoDiceRoll(room.game, roll, active.topic);
        nsp.to(roomCode).emit("ludo_event", {
          kind: "roll",
          seat: active.seat,
          color: active.color,
          diceValue: roll,
          autoSkipped: res.autoSkipped,
        });
      } else if (room.game.phase === "awaiting_move") {
        const tokenId = pickBestLudoBotMove(room.game);
        if (tokenId) {
          const outcome = applyLudoTokenMove(room.game, tokenId);
          if (outcome) {
            nsp.to(roomCode).emit("ludo_event", {
              kind: "move",
              seat: active.seat,
              color: active.color,
              ...outcome,
            });
          }
        }
      }

      room.updatedAt = Date.now();
      await saveRoom(room, roomCode);
      emitRoomState(room);
      scheduleTimers(room);
    });
  }

  async function handleTimeout(roomCode: string, expectedUpdatedAt: number): Promise<void> {
    await withLudoLock(`arena:${roomCode}`, async () => {
      const room = await loadRoom(roomCode);
      if (!room || room.game.status !== "active" || room.game.updatedAt !== expectedUpdatedAt) return;
      const active = room.game.players.find((p) => p.seat === room.game.turnSeat);
      if (!active) return;

      if (room.game.phase === "awaiting_roll") {
        const roll = crypto.randomInt(1, 7);
        const res = applyLudoDiceRoll(room.game, roll, active.topic);
        if (res.valid && !res.autoSkipped && room.game.legalTokenIds.length > 0) {
          const picked = pickBestLudoBotMove(room.game) || room.game.legalTokenIds[0]!;
          applyLudoTokenMove(room.game, picked);
          room.game.lastActionText = `⏱️ انتهى وقت ${active.topic} — حركة تلقائية (${roll}).`;
        } else {
          room.game.lastActionText = `⏱️ انتهى وقت ${active.topic} — تم تمرير الدور.`;
        }
      } else if (room.game.phase === "awaiting_move" && room.game.legalTokenIds.length > 0) {
        const picked = pickBestLudoBotMove(room.game) || room.game.legalTokenIds[0]!;
        applyLudoTokenMove(room.game, picked);
        room.game.lastActionText = `⏱️ انتهى وقت ${active.topic} — تم تحريك قطعة تلقائياً.`;
      }

      room.updatedAt = Date.now();
      await saveRoom(room, roomCode);
      emitRoomState(room);
      scheduleTimers(room);
    });
  }

  async function leaveCurrentRoom(socket: Socket): Promise<void> {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    socketToRoom.delete(socket.id);
    void socket.leave(roomCode);

    await withLudoLock(`arena:${roomCode}`, async () => {
      const room = await loadRoom(roomCode);
      if (!room) return;

      room.spectatorIds = room.spectatorIds.filter((id) => id !== socket.id);
      const pIdx = room.game.players.findIndex((p) => p.socketId === socket.id);
      if (pIdx !== -1) {
        const removed = room.game.players.splice(pIdx, 1)[0]!;
        const remainingHumans = room.game.players.filter((p) => !p.isBot);

        if (remainingHumans.length === 0) {
          clearRoomTimers(roomCode);
          await saveRoom(null, roomCode);
          await broadcastWaitingRooms();
          return;
        }

        if (room.hostSocketId === socket.id) {
          room.hostSocketId = remainingHumans[0]!.socketId;
        }

        if (room.game.status === "active" && room.game.players.length < 2) {
          resetLudoMatch(room.game, `${removed.topic} غادر الطاولة — بانتظار لاعب آخر.`);
          clearRoomTimers(roomCode);
        } else if (room.game.status === "active" && room.game.turnSeat === removed.seat) {
          room.game.turnSeat = room.game.players[0]!.seat;
          room.game.phase = "awaiting_roll";
          room.game.diceValue = null;
          room.game.consecutiveSixes = 0;
          room.game.legalTokenIds = [];
          room.game.turnStartedAt = Date.now();
          room.game.lastActionText = `${removed.topic} غادر — انتقل الدور إلى ${room.game.players[0]!.topic}.`;
        } else {
          room.game.lastActionText = `${removed.topic} غادر الطاولة.`;
        }
      }

      if (room.game.players.filter((p) => !p.isBot).length === 0 && room.spectatorIds.length === 0) {
        clearRoomTimers(roomCode);
        await saveRoom(null, roomCode);
      } else {
        room.updatedAt = Date.now();
        room.game.updatedAt = Date.now();
        await saveRoom(room, roomCode);
        emitRoomState(room);
        scheduleTimers(room);
      }
      await broadcastWaitingRooms();
    }).catch(() => undefined);
  }

  nsp.on("connection", (socket) => {
    socket.on("register_profile", (raw: unknown) => {
      const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const profile: LudoSocketProfile = {
        name: sanitizeHtmlText(String(d.name || d.topic || "لاعب").trim()).slice(0, 60) || "لاعب",
        pic: sanitizeHtmlText(String(d.pic || "pic.png").trim()).slice(0, 250) || "pic.png",
        userId: d.userId ? String(d.userId).slice(0, 80) : undefined,
      };
      profiles.set(socket.id, profile);
      socket.emit("profile_ready", { ok: true, id: socket.id, profile });
    });

    socket.on("request_waiting_rooms", () => {
      void getWaitingRoomList().then((list) => {
        socket.emit("waiting_rooms", list);
      });
    });

    socket.on("create_room", (raw: unknown) => {
      void (async () => {
        const parsed = ludoArenaCreateSchema.safeParse(raw ?? {});
        if (!parsed.success) {
          socket.emit("join_error", { msg: "بيانات الطاولة غير صالحة" });
          return;
        }
        await leaveCurrentRoom(socket);
        const profile = profiles.get(socket.id) || { name: "لاعب", pic: "pic.png" };
        const roomCode = (parsed.data.roomCode || `LD-${stringGen(5)}`).toUpperCase();

        await withLudoLock(`arena:${roomCode}`, async () => {
          const exists = await loadRoom(roomCode);
          if (exists) {
            socket.emit("join_error", { msg: "رمز الطاولة مستخدم بالفعل" });
            return;
          }

          const title =
            sanitizeHtmlText(String(parsed.data.title || `طاولة ${profile.name}`).trim()).slice(0, 60) ||
            `طاولة ${profile.name}`;
          const game = createLudoGame(roomCode, profile.name, title);
          game.players.push({
            seat: 0,
            color: LUDO_SEAT_COLORS[0],
            socketId: socket.id,
            userId: profile.userId || socket.id,
            topic: profile.name,
            pic: profile.pic,
            isBot: false,
            online: true,
          });
          game.hostSocketId = socket.id;

          const record: LudoArenaRoomRecord = {
            roomCode,
            title,
            hostSocketId: socket.id,
            spectatorIds: [],
            game,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveRoom(record, roomCode);
          socketToRoom.set(socket.id, roomCode);
          void socket.join(roomCode);

          socket.emit("room_joined", {
            roomCode,
            title,
            slot: 0,
            isHost: true,
            state: toLudoPublicState(game, roomCode, 0),
          });
          await broadcastWaitingRooms();
        });
      })().catch(() => {
        socket.emit("join_error", { msg: "تعذر إنشاء طاولة اللودو" });
      });
    });

    socket.on("join_waiting_room", (raw: unknown) => {
      void (async () => {
        const parsed = ludoArenaJoinSchema.safeParse(raw ?? {});
        if (!parsed.success) {
          socket.emit("join_error", { msg: "رمز الطاولة غير صالح" });
          return;
        }
        const roomCode = parsed.data.roomCode.toUpperCase();
        await leaveCurrentRoom(socket);

        await withLudoLock(`arena:${roomCode}`, async () => {
          const room = await loadRoom(roomCode);
          if (!room) {
            socket.emit("join_error", { msg: "الطاولة غير موجودة" });
            return;
          }

          const profile = profiles.get(socket.id) || { name: "لاعب", pic: "pic.png" };
          socketToRoom.set(socket.id, roomCode);
          void socket.join(roomCode);

          let assignedSeat = -1;
          if (room.game.status === "waiting" && room.game.players.length < 4) {
            for (const s of [0, 1, 2, 3] as const) {
              if (!room.game.players.some((p) => p.seat === s)) {
                assignedSeat = s;
                const color = LUDO_SEAT_COLORS[s];
                room.game.players.push({
                  seat: s,
                  color,
                  socketId: socket.id,
                  userId: profile.userId || socket.id,
                  topic: profile.name,
                  pic: profile.pic,
                  isBot: false,
                  online: true,
                });
                room.game.lastActionText = `${profile.name} انضم إلى الطاولة (${LUDO_COLOR_LABELS_AR[color]}).`;
                room.game.updatedAt = Date.now();
                break;
              }
            }
          }

          if (assignedSeat === -1) {
            if (!room.spectatorIds.includes(socket.id)) {
              room.spectatorIds.push(socket.id);
            }
          }

          room.updatedAt = Date.now();
          await saveRoom(room, roomCode);

          socket.emit("room_joined", {
            roomCode,
            title: room.title,
            slot: assignedSeat,
            spectator: assignedSeat === -1,
            isHost: room.hostSocketId === socket.id,
            state: toLudoPublicState(room.game, roomCode, room.spectatorIds.length),
          });
          emitRoomState(room);
          await broadcastWaitingRooms();
        });
      })().catch(() => {
        socket.emit("join_error", { msg: "تعذر الانضمام إلى طاولة اللودو" });
      });
    });

    socket.on("add_bot", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      void withLudoLock(`arena:${roomCode}`, async () => {
        const room = await loadRoom(roomCode);
        if (!room || room.game.status !== "waiting") return;
        if (room.hostSocketId !== socket.id) {
          socket.emit("join_error", { msg: "المضيف فقط يمكنه إضافة بوت" });
          return;
        }
        for (const s of [0, 1, 2, 3] as const) {
          if (!room.game.players.some((p) => p.seat === s)) {
            const color = LUDO_SEAT_COLORS[s];
            room.game.players.push({
              seat: s,
              color,
              socketId: `bot:${roomCode}:${s}`,
              userId: `bot_${s}`,
              topic: ARENA_BOT_NAMES[s],
              pic: "/imgs/brb-bot.svg",
              isBot: true,
              online: true,
            });
            room.game.lastActionText = `تمت إضافة ${ARENA_BOT_NAMES[s]} (${LUDO_COLOR_LABELS_AR[color]}).`;
            room.game.updatedAt = Date.now();
            room.updatedAt = Date.now();
            await saveRoom(room, roomCode);
            emitRoomState(room);
            await broadcastWaitingRooms();
            return;
          }
        }
      }).catch(() => undefined);
    });

    socket.on("remove_bot", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      void withLudoLock(`arena:${roomCode}`, async () => {
        const room = await loadRoom(roomCode);
        if (!room || room.game.status !== "waiting") return;
        if (room.hostSocketId !== socket.id) return;
        const lastBot = [...room.game.players].reverse().find((p) => p.isBot);
        if (!lastBot) return;
        room.game.players = room.game.players.filter((p) => p.seat !== lastBot.seat);
        room.game.lastActionText = `تمت إزالة ${lastBot.topic}.`;
        room.game.updatedAt = Date.now();
        room.updatedAt = Date.now();
        await saveRoom(room, roomCode);
        emitRoomState(room);
        await broadcastWaitingRooms();
      }).catch(() => undefined);
    });

    socket.on("start_game", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      void withLudoLock(`arena:${roomCode}`, async () => {
        const room = await loadRoom(roomCode);
        if (!room) return;
        const isParticipant = room.game.players.some((p) => p.socketId === socket.id);
        if (!isParticipant) return;
        if (room.game.players.length < 2) {
          socket.emit("join_error", { msg: "يجب وجود لاعبين اثنين على الأقل (أو إضافة بوت)" });
          return;
        }
        const profile = profiles.get(socket.id);
        clearRoomTimers(roomCode);
        startLudoMatch(room.game, profile?.name || "اللاعب");
        room.updatedAt = Date.now();
        await saveRoom(room, roomCode);
        emitRoomState(room);
        scheduleTimers(room);
        await broadcastWaitingRooms();
      }).catch(() => undefined);
    });

    socket.on("roll_die", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      void (async () => {
        const rl = await takeRedisRateSlot(`ludo_arena_roll:${socket.id}`, 8, 5000);
        if (!rl.ok) return;
        await withLudoLock(`arena:${roomCode}`, async () => {
          const room = await loadRoom(roomCode);
          if (!room || room.game.status !== "active" || room.game.phase !== "awaiting_roll") return;
          const player = room.game.players.find((p) => p.socketId === socket.id);
          if (!player || player.seat !== room.game.turnSeat) return;

          const roll = crypto.randomInt(1, 7);
          const res = applyLudoDiceRoll(room.game, roll, player.topic);
          if (!res.valid) return;

          room.updatedAt = Date.now();
          await saveRoom(room, roomCode);
          nsp.to(roomCode).emit("ludo_event", {
            kind: "roll",
            seat: player.seat,
            color: player.color,
            diceValue: roll,
            forfeitedByThreeSixes: res.forfeitedByThreeSixes,
            autoSkipped: res.autoSkipped,
          });
          emitRoomState(room);
          scheduleTimers(room);
        });
      })().catch(() => undefined);
    });

    socket.on("make_move", (raw: unknown) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      const parsed = ludoMoveSchema.safeParse(raw ?? {});
      if (!parsed.success) return;

      void withLudoLock(`arena:${roomCode}`, async () => {
        const room = await loadRoom(roomCode);
        if (!room || room.game.status !== "active" || room.game.phase !== "awaiting_move") return;
        const player = room.game.players.find((p) => p.socketId === socket.id);
        if (!player || player.seat !== room.game.turnSeat) return;

        const outcome = applyLudoTokenMove(room.game, parsed.data.tokenId);
        if (!outcome) return;

        room.updatedAt = Date.now();
        await saveRoom(room, roomCode);
        nsp.to(roomCode).emit("ludo_event", {
          kind: "move",
          seat: player.seat,
          color: player.color,
          ...outcome,
        });
        emitRoomState(room);
        if (outcome.finished) {
          clearRoomTimers(roomCode);
          await broadcastWaitingRooms();
        } else {
          scheduleTimers(room);
        }
      }).catch(() => undefined);
    });

    socket.on("play_again", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      void withLudoLock(`arena:${roomCode}`, async () => {
        const room = await loadRoom(roomCode);
        if (!room) return;
        const isParticipant = room.game.players.some((p) => p.socketId === socket.id);
        if (!isParticipant) return;
        clearRoomTimers(roomCode);
        resetLudoMatch(room.game, "بدأت جولة لودو جديدة!");
        room.updatedAt = Date.now();
        await saveRoom(room, roomCode);
        emitRoomState(room);
        scheduleTimers(room);
        await broadcastWaitingRooms();
      }).catch(() => undefined);
    });

    socket.on("request_sync", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      void loadRoom(roomCode).then((room) => {
        if (!room) return;
        socket.emit(
          "ludo_state",
          toLudoPublicState(room.game, room.roomCode, room.spectatorIds.length),
        );
      });
    });

    socket.on("send_chat_message", (raw: unknown) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      void (async () => {
        const rl = await takeRedisRateSlot(`ludo_arena_chat:${socket.id}`, 8, 5000);
        if (!rl.ok) return;
        const profile = profiles.get(socket.id) || { name: "لاعب", pic: "pic.png" };
        const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        const msg = sanitizeHtmlText(String(d.msg || d.text || "").trim()).slice(0, 250);
        if (!msg) return;
        nsp.to(roomCode).emit("chat_message", {
          from: socket.id,
          name: profile.name,
          pic: profile.pic,
          msg,
          ts: Date.now(),
        });
      })().catch(() => undefined);
    });

    socket.on("leave_room", () => {
      void leaveCurrentRoom(socket);
    });

    socket.on("disconnect", () => {
      void leaveCurrentRoom(socket);
      profiles.delete(socket.id);
    });
  });

  return {
    stopAllTimers: () => {
      for (const t of turnTimers.values()) clearTimeout(t);
      for (const t of botTimers.values()) clearTimeout(t);
      turnTimers.clear();
      botTimers.clear();
    },
  };
}
