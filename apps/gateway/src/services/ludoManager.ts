import crypto from "node:crypto";
import { getRedis, REDIS_KEYS, takeRedisRateSlot, withLudoLock } from "@newchat/db";
import {
  applyLudoDiceRoll,
  applyLudoTokenMove,
  createLudoGame,
  LUDO_AUTO_RESET_DELAY_MS,
  LUDO_BOT_THINK_DELAY_MS,
  LUDO_COLOR_LABELS_AR,
  LUDO_SEAT_COLORS,
  LUDO_TURN_TIMEOUT_MS,
  ludoManageSchema,
  ludoMoveSchema,
  pickBestLudoBotMove,
  resetLudoMatch,
  startLudoMatch,
  toLudoPublicState,
  verRoomsOwner,
  type LudoGameState,
  type LudoPlayer,
  type LudoPublicState,
} from "@newchat/shared";
import type { Server, Socket } from "socket.io";
import { emitNotice, safeJsonParse } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { EvaluationEngine } from "./evaluationEngine.js";
import type { PresenceDirectory } from "./presenceDirectory.js";

const BOT_NAMES = ["بوت لودو", "الذكي 1", "الذكي 2", "الذكي 3"] as const;

export class LudoManager {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly presenceDirectory: PresenceDirectory;
  private readonly evaluationEngine: EvaluationEngine;
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();
  private readonly botTimers = new Map<string, NodeJS.Timeout>();
  private readonly autoResetTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    io: Server,
    catalogStore: CatalogStore,
    presenceDirectory: PresenceDirectory,
    evaluationEngine: EvaluationEngine,
  ) {
    this.io = io;
    this.catalogStore = catalogStore;
    this.presenceDirectory = presenceDirectory;
    this.evaluationEngine = evaluationEngine;
  }

  private getKey(roomId: string): string {
    return REDIS_KEYS.ludoGamePrefix + roomId;
  }

  async loadGame(roomId: string): Promise<LudoGameState | null> {
    try {
      const raw = await getRedis().get(this.getKey(roomId));
      return raw ? safeJsonParse<LudoGameState | null>(raw, null) : null;
    } catch {
      return null;
    }
  }

  async saveGame(roomId: string, game: LudoGameState | null): Promise<void> {
    try {
      if (!game) {
        await getRedis().del(this.getKey(roomId));
      } else {
        await getRedis().set(this.getKey(roomId), JSON.stringify(game), "EX", 21_600);
      }
    } catch {
      // ignore redis transient error
    }
  }

  private clearTimer(map: Map<string, NodeJS.Timeout>, roomId: string): void {
    const t = map.get(roomId);
    if (t) {
      clearTimeout(t);
      map.delete(roomId);
    }
  }

  private clearAllRoomTimers(roomId: string): void {
    this.clearTimer(this.turnTimers, roomId);
    this.clearTimer(this.botTimers, roomId);
    this.clearTimer(this.autoResetTimers, roomId);
  }

  stopAllTimers(): void {
    for (const t of this.turnTimers.values()) clearTimeout(t);
    for (const t of this.botTimers.values()) clearTimeout(t);
    for (const t of this.autoResetTimers.values()) clearTimeout(t);
    this.turnTimers.clear();
    this.botTimers.clear();
    this.autoResetTimers.clear();
  }

  private scheduleTimersForGame(roomId: string, game: LudoGameState | null): void {
    this.clearTimer(this.turnTimers, roomId);
    this.clearTimer(this.botTimers, roomId);

    if (!game || game.status !== "active") return;

    const activePlayer = game.players.find((p) => p.seat === game.turnSeat);
    if (!activePlayer) return;

    if (activePlayer.isBot) {
      const expectedUpdatedAt = game.updatedAt;
      const t = setTimeout(() => {
        this.botTimers.delete(roomId);
        void this.executeBotStep(roomId, expectedUpdatedAt).catch(() => undefined);
      }, LUDO_BOT_THINK_DELAY_MS);
      if (typeof t.unref === "function") t.unref();
      this.botTimers.set(roomId, t);
      return;
    }

    const expectedUpdatedAt = game.updatedAt;
    const t = setTimeout(() => {
      this.turnTimers.delete(roomId);
      void this.handleTurnTimeout(roomId, expectedUpdatedAt).catch(() => undefined);
    }, LUDO_TURN_TIMEOUT_MS);
    if (typeof t.unref === "function") t.unref();
    this.turnTimers.set(roomId, t);
  }

  private scheduleAutoReset(roomId: string, finishedAt: number): void {
    this.clearTimer(this.autoResetTimers, roomId);
    const t = setTimeout(() => {
      this.autoResetTimers.delete(roomId);
      void withLudoLock(roomId, async () => {
        const game = await this.loadGame(roomId);
        if (!game || game.status !== "finished" || game.updatedAt !== finishedAt) return;
        await this.pruneDisconnectedHumans(game);
        resetLudoMatch(game, "تم تجهيز جولة لودو جديدة تلقائياً.");
        await this.saveGame(roomId, game);
        await this.emitGameState(game, roomId);
        this.scheduleTimersForGame(roomId, game);
      }).catch(() => undefined);
    }, LUDO_AUTO_RESET_DELAY_MS);
    if (typeof t.unref === "function") t.unref();
    this.autoResetTimers.set(roomId, t);
  }

  private async pruneDisconnectedHumans(game: LudoGameState): Promise<boolean> {
    let changed = false;
    const kept: LudoPlayer[] = [];
    for (const p of game.players) {
      if (p.isBot) {
        kept.push(p);
        continue;
      }
      const member = await this.presenceDirectory.getDistributedSession(p.socketId);
      if (!member || member.roomid !== game.roomId || member.offline) {
        changed = true;
        continue;
      }
      kept.push({
        ...p,
        topic: String(member.topic || p.topic || "لاعب"),
        pic: String(member.pic || p.pic || "pic.png"),
        online: true,
      });
    }
    if (!changed) return false;

    const removedCurrentTurn = !kept.some((p) => p.seat === game.turnSeat);
    game.players = kept;
    const humanCount = kept.filter((p) => !p.isBot).length;

    if (humanCount === 0) {
      game.players = [];
      game.tokens = [];
      game.status = "waiting";
      game.phase = "awaiting_roll";
      game.turnStartedAt = 0;
      game.lastActionText = "غادر جميع اللاعبين طاولة اللودو.";
      game.updatedAt = Date.now();
      return true;
    }

    if (game.status === "active" && kept.length < 2) {
      resetLudoMatch(game, "غادر أحد اللاعبين — بانتظار لاعب آخر لاستكمال الطاولة.");
      return true;
    }

    if (game.status === "active" && removedCurrentTurn) {
      game.turnSeat = kept[0]!.seat;
      game.phase = "awaiting_roll";
      game.diceValue = null;
      game.consecutiveSixes = 0;
      game.legalTokenIds = [];
      game.turnStartedAt = Date.now();
      game.lastActionText = `غادر اللاعب صاحب الدور — انتقل الدور إلى ${kept[0]!.topic}.`;
    }
    game.updatedAt = Date.now();
    return true;
  }

  async toPublicState(game: LudoGameState | null, roomId: string): Promise<LudoPublicState> {
    const membersCount = await this.presenceDirectory.getOnlineRoomMemberCount(roomId);
    const humanCount = game ? game.players.filter((p) => !p.isBot).length : 0;
    const spectators = Math.max(0, membersCount - humanCount);
    return toLudoPublicState(game, roomId, spectators);
  }

  async emitGameState(game: LudoGameState | null, roomIdOverride?: string): Promise<void> {
    const roomId = game?.roomId || roomIdOverride || "";
    if (!roomId) return;
    const pub = await this.toPublicState(game, roomId);
    this.io.to(roomId).emit("msg", { cmd: "ludo_state", data: pub });
  }

  async emitStateToSocket(socket: Socket, roomId: string): Promise<void> {
    const game = await this.loadGame(roomId);
    const pub = await this.toPublicState(game, roomId);
    socket.emit("msg", { cmd: "ludo_state", data: pub });
  }

  async syncRoomGame(roomId: string, actionText?: string): Promise<void> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return;
    await withLudoLock(safeRoomId, async () => {
      const game = await this.loadGame(safeRoomId);
      if (!game) return;
      const changed = await this.pruneDisconnectedHumans(game);
      if (changed) {
        if (actionText && game.players.length > 0) {
          game.lastActionText = actionText;
          game.updatedAt = Date.now();
        }
        await this.saveGame(safeRoomId, game);
        this.scheduleTimersForGame(safeRoomId, game);
      }
      await this.emitGameState(game, safeRoomId);
    }).catch(() => undefined);
  }

  private async handleTurnTimeout(roomId: string, expectedUpdatedAt: number): Promise<void> {
    await withLudoLock(roomId, async () => {
      const game = await this.loadGame(roomId);
      if (!game || game.status !== "active" || game.updatedAt !== expectedUpdatedAt) return;
      const activePlayer = game.players.find((p) => p.seat === game.turnSeat);
      if (!activePlayer) return;

      let matchFinished = false;
      if (game.phase === "awaiting_roll") {
        const roll = crypto.randomInt(1, 7);
        const res = applyLudoDiceRoll(game, roll, activePlayer.topic);
        if (res.valid && !res.autoSkipped && game.legalTokenIds.length > 0) {
          const picked = pickBestLudoBotMove(game) || game.legalTokenIds[0]!;
          const outcome = applyLudoTokenMove(game, picked);
          matchFinished = Boolean(outcome?.finished);
          game.lastActionText = `⏱️ انتهى وقت ${activePlayer.topic} — تم تنفيذ حركة تلقائية (${roll}).`;
        } else {
          game.lastActionText = `⏱️ انتهى وقت ${activePlayer.topic} — تم تمرير الدور تلقائياً.`;
        }
      } else if (game.phase === "awaiting_move" && game.legalTokenIds.length > 0) {
        const picked = pickBestLudoBotMove(game) || game.legalTokenIds[0]!;
        const outcome = applyLudoTokenMove(game, picked);
        matchFinished = Boolean(outcome?.finished);
        game.lastActionText = `⏱️ انتهى وقت ${activePlayer.topic} — تم تحريك قطعة تلقائياً.`;
      }

      await this.saveGame(roomId, game);
      await this.emitGameState(game, roomId);

      if (matchFinished) {
        this.clearAllRoomTimers(roomId);
        const winner = game.players.find((p) => p.seat === game.winnerSeat);
        if (winner && !winner.isBot && winner.socketId) {
          void this.evaluationEngine.awardPoints(winner.socketId, "game_win");
        }
        this.scheduleAutoReset(roomId, game.updatedAt);
      } else {
        this.scheduleTimersForGame(roomId, game);
      }
    });
  }

  private async executeBotStep(roomId: string, expectedUpdatedAt: number): Promise<void> {
    await withLudoLock(roomId, async () => {
      const game = await this.loadGame(roomId);
      if (!game || game.status !== "active" || game.updatedAt !== expectedUpdatedAt) return;
      const activePlayer = game.players.find((p) => p.seat === game.turnSeat);
      if (!activePlayer?.isBot) return;

      let matchFinished = false;
      if (game.phase === "awaiting_roll") {
        const roll = crypto.randomInt(1, 7);
        const rollRes = applyLudoDiceRoll(game, roll, activePlayer.topic);
        this.io.to(roomId).emit("msg", {
          cmd: "ludo_event",
          data: {
            kind: "roll",
            seat: activePlayer.seat,
            color: activePlayer.color,
            diceValue: roll,
            autoSkipped: rollRes.autoSkipped,
          },
        });
      } else if (game.phase === "awaiting_move") {
        const tokenId = pickBestLudoBotMove(game);
        if (tokenId) {
          const outcome = applyLudoTokenMove(game, tokenId);
          if (outcome) {
            matchFinished = outcome.finished;
            this.io.to(roomId).emit("msg", {
              cmd: "ludo_event",
              data: {
                kind: "move",
                seat: activePlayer.seat,
                color: activePlayer.color,
                ...outcome,
              },
            });
          }
        }
      }

      await this.saveGame(roomId, game);
      await this.emitGameState(game, roomId);

      if (matchFinished) {
        this.clearAllRoomTimers(roomId);
        this.scheduleAutoReset(roomId, game.updatedAt);
      } else {
        this.scheduleTimersForGame(roomId, game);
      }
    });
  }

  async handleManage(socket: Socket, rawData: unknown): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    const parsed = ludoManageSchema.safeParse(rawData ?? {});
    if (!parsed.success) {
      emitNotice(socket, "بيانات إدارة لعبة اللودو غير صالحة");
      return;
    }

    const roomId = session.roomid;
    const op = parsed.data.op || parsed.data.action || "start";
    const requestedSeat = parsed.data.seat;
    const isStaff = verRoomsOwner(this.catalogStore.getPowers(), session.rank || session.power);

    await withLudoLock(roomId, async () => {
      if (op === "stop" || op === "close") {
        const existing = await this.loadGame(roomId);
        const isSeated = existing?.players.some((p) => p.socketId === socket.id);
        if (!isStaff && !isSeated) {
          emitNotice(socket, "لا تملك صلاحية إغلاق طاولة اللودو");
          return;
        }
        this.clearAllRoomTimers(roomId);
        await this.saveGame(roomId, null);
        await this.emitGameState(null, roomId);
        this.io.to(roomId).emit("msg", {
          cmd: "ludo_notice",
          data: { roomId, msg: `تم إغلاق طاولة اللودو بواسطة ${session.topic}` },
        });
        return;
      }

      const game = (await this.loadGame(roomId)) || createLudoGame(roomId, session.topic);
      await this.pruneDisconnectedHumans(game);

      if (op === "sit") {
        if (game.status === "active") {
          emitNotice(socket, "المباراة جارية حالياً — انتظر انتهاء الجولة");
          return;
        }
        const already = game.players.find((p) => p.socketId === socket.id);
        if (already) {
          await this.emitStateToSocket(socket, roomId);
          return;
        }
        let targetSeat: 0 | 1 | 2 | 3 | null = null;
        if (requestedSeat !== undefined && !game.players.some((p) => p.seat === requestedSeat)) {
          targetSeat = requestedSeat as 0 | 1 | 2 | 3;
        } else {
          for (const s of [0, 1, 2, 3] as const) {
            if (!game.players.some((p) => p.seat === s)) {
              targetSeat = s;
              break;
            }
          }
        }
        if (targetSeat === null) {
          emitNotice(socket, "جميع مقاعد اللودو الأربعة ممتلئة حالياً");
          return;
        }
        const color = LUDO_SEAT_COLORS[targetSeat];
        game.players.push({
          seat: targetSeat,
          color,
          socketId: socket.id,
          userId: String(session.uid || session.lid || session.id),
          topic: String(session.topic || "لاعب"),
          pic: String(session.pic || "pic.png"),
          isBot: false,
          online: true,
        });
        game.lastActionText = `${session.topic} جلس في المقعد ${targetSeat + 1} (${LUDO_COLOR_LABELS_AR[color]}).`;
        game.updatedAt = Date.now();
        await this.saveGame(roomId, game);
        await this.emitGameState(game, roomId);
        return;
      }

      if (op === "stand") {
        const idx = game.players.findIndex((p) => p.socketId === socket.id);
        if (idx === -1) return;
        const leaving = game.players.splice(idx, 1)[0]!;
        if (game.status === "active") {
          if (game.players.filter((p) => !p.isBot).length === 0 || game.players.length < 2) {
            resetLudoMatch(game, `${leaving.topic} غادر الطاولة — بانتظار لاعبين.`);
          } else if (game.turnSeat === leaving.seat) {
            game.turnSeat = game.players[0]!.seat;
            game.phase = "awaiting_roll";
            game.diceValue = null;
            game.consecutiveSixes = 0;
            game.legalTokenIds = [];
            game.turnStartedAt = Date.now();
            game.lastActionText = `${leaving.topic} غادر — انتقل الدور إلى ${game.players[0]!.topic}.`;
          }
        } else {
          game.lastActionText = `${leaving.topic} قام من طاولة اللودو.`;
        }
        game.updatedAt = Date.now();
        await this.saveGame(roomId, game);
        this.scheduleTimersForGame(roomId, game);
        await this.emitGameState(game, roomId);
        return;
      }

      if (op === "add_bot") {
        if (game.status === "active") {
          emitNotice(socket, "لا يمكن إضافة بوت أثناء سير المباراة");
          return;
        }
        let targetSeat: 0 | 1 | 2 | 3 | null = null;
        if (requestedSeat !== undefined && !game.players.some((p) => p.seat === requestedSeat)) {
          targetSeat = requestedSeat as 0 | 1 | 2 | 3;
        } else {
          for (const s of [0, 1, 2, 3] as const) {
            if (!game.players.some((p) => p.seat === s)) {
              targetSeat = s;
              break;
            }
          }
        }
        if (targetSeat === null) {
          emitNotice(socket, "الطاولة ممتلئة باللاعبين");
          return;
        }
        const color = LUDO_SEAT_COLORS[targetSeat];
        game.players.push({
          seat: targetSeat,
          color,
          socketId: `bot:${roomId}:${targetSeat}`,
          userId: `bot_${targetSeat}`,
          topic: BOT_NAMES[targetSeat],
          pic: "/imgs/brb-bot.svg",
          isBot: true,
          online: true,
        });
        game.lastActionText = `تمت إضافة ${BOT_NAMES[targetSeat]} (${LUDO_COLOR_LABELS_AR[color]}).`;
        game.updatedAt = Date.now();
        await this.saveGame(roomId, game);
        await this.emitGameState(game, roomId);
        return;
      }

      if (op === "remove_bot") {
        if (game.status === "active") {
          emitNotice(socket, "أوقف أو صفّر الجولة أولاً لإزالة البوت");
          return;
        }
        const before = game.players.length;
        game.players =
          requestedSeat !== undefined
            ? game.players.filter((p) => !(p.isBot && p.seat === requestedSeat))
            : game.players.filter((p) => !p.isBot);
        if (game.players.length !== before) {
          game.lastActionText = "تمت إزالة البوت من طاولة اللودو.";
          game.updatedAt = Date.now();
          await this.saveGame(roomId, game);
          await this.emitGameState(game, roomId);
        }
        return;
      }

      const isParticipant = game.players.some((p) => p.socketId === socket.id);
      if (!isStaff && !isParticipant) {
        emitNotice(socket, "اجلس على الطاولة أولاً أو اطلب من المشرف بدء اللعبة");
        return;
      }

      if (op === "reset") {
        this.clearAllRoomTimers(roomId);
        resetLudoMatch(game, `تمت إعادة ضبط طاولة اللودو بواسطة ${session.topic}`);
        await this.saveGame(roomId, game);
        this.scheduleTimersForGame(roomId, game);
        await this.emitGameState(game, roomId);
        return;
      }

      // op === "start"
      if (game.players.length < 2) {
        emitNotice(socket, "يجب جلوس لاعبين اثنين على الأقل (أو إضافة بوت) لبدء اللودو");
        await this.saveGame(roomId, game);
        await this.emitGameState(game, roomId);
        return;
      }
      this.clearAllRoomTimers(roomId);
      startLudoMatch(game, session.topic);
      await this.saveGame(roomId, game);
      this.scheduleTimersForGame(roomId, game);
      await this.emitGameState(game, roomId);
    });
  }

  async handleRollDice(socket: Socket): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    const roomId = session.roomid;

    const rl = await takeRedisRateSlot(`ludo_roll:${socket.id}`, 8, 5000);
    if (!rl.ok) return;

    await withLudoLock(roomId, async () => {
      const game = await this.loadGame(roomId);
      if (!game || game.status !== "active" || game.phase !== "awaiting_roll") return;

      const player = game.players.find((p) => p.socketId === socket.id);
      if (!player || player.seat !== game.turnSeat) {
        emitNotice(socket, "ليس دورك في اللعب حالياً");
        return;
      }

      const roll = crypto.randomInt(1, 7);
      const outcome = applyLudoDiceRoll(game, roll, session.topic);
      if (!outcome.valid) return;

      await this.saveGame(roomId, game);
      this.io.to(roomId).emit("msg", {
        cmd: "ludo_event",
        data: {
          kind: "roll",
          seat: player.seat,
          color: player.color,
          diceValue: roll,
          forfeitedByThreeSixes: outcome.forfeitedByThreeSixes,
          autoSkipped: outcome.autoSkipped,
        },
      });
      await this.emitGameState(game, roomId);
      this.scheduleTimersForGame(roomId, game);
    }).catch(() => undefined);
  }

  async handleMoveToken(socket: Socket, rawData: unknown): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    const parsed = ludoMoveSchema.safeParse(rawData ?? {});
    if (!parsed.success) {
      emitNotice(socket, "معرّف القطعة غير صالح");
      return;
    }

    const roomId = session.roomid;
    await withLudoLock(roomId, async () => {
      const game = await this.loadGame(roomId);
      if (!game || game.status !== "active" || game.phase !== "awaiting_move") return;

      const player = game.players.find((p) => p.socketId === socket.id);
      if (!player || player.seat !== game.turnSeat) {
        emitNotice(socket, "ليس دورك في اللعب حالياً");
        return;
      }

      const outcome = applyLudoTokenMove(game, parsed.data.tokenId);
      if (!outcome) {
        emitNotice(socket, "هذه القطعة غير متاحة للتحرك بهذه القيمة");
        return;
      }

      await this.saveGame(roomId, game);
      this.io.to(roomId).emit("msg", {
        cmd: "ludo_event",
        data: {
          kind: "move",
          seat: player.seat,
          color: player.color,
          ...outcome,
        },
      });
      await this.emitGameState(game, roomId);

      if (outcome.finished) {
        this.clearAllRoomTimers(roomId);
        const winner = game.players.find((p) => p.seat === game.winnerSeat);
        if (winner && !winner.isBot && winner.socketId) {
          void this.evaluationEngine.awardPoints(winner.socketId, "game_win");
        }
        this.scheduleAutoReset(roomId, game.updatedAt);
      } else {
        this.scheduleTimersForGame(roomId, game);
      }
    }).catch(() => undefined);
  }
}
