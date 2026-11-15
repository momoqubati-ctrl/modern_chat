import { getRedis, REDIS_KEYS, withCarromLock } from "@newchat/db";
import {
  CARROM_AUTO_RESET_DELAY_MS,
  createCarromGame,
  resetCarromRoundState,
  simulateCarromShot,
  verRoomsOwner,
  type CarromGameState,
  type CarromPlayer,
  type CarromPublicState,
  type CarromShotInput,
} from "@newchat/shared";
import type { Server, Socket } from "socket.io";
import { emitNotice, safeJsonParse } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { EvaluationEngine } from "./evaluationEngine.js";
import type { MicStageManager } from "./micStageManager.js";
import type { PresenceDirectory } from "./presenceDirectory.js";

export class CarromManager {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly presenceDirectory: PresenceDirectory;
  private readonly micStageManager: MicStageManager;
  private readonly evaluationEngine: EvaluationEngine;
  private readonly autoResetTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    io: Server,
    catalogStore: CatalogStore,
    presenceDirectory: PresenceDirectory,
    micStageManager: MicStageManager,
    evaluationEngine: EvaluationEngine,
  ) {
    this.io = io;
    this.catalogStore = catalogStore;
    this.presenceDirectory = presenceDirectory;
    this.micStageManager = micStageManager;
    this.evaluationEngine = evaluationEngine;
  }

  private getKey(roomId: string): string {
    return REDIS_KEYS.carromGamePrefix + roomId;
  }

  async loadGame(roomId: string): Promise<CarromGameState | null> {
    try {
      const raw = await getRedis().get(this.getKey(roomId));
      return raw ? safeJsonParse<CarromGameState | null>(raw, null) : null;
    } catch {
      return null;
    }
  }

  async saveGame(roomId: string, game: CarromGameState | null): Promise<void> {
    try {
      if (!game) {
        await getRedis().del(this.getKey(roomId));
      } else {
        await getRedis().set(this.getKey(roomId), JSON.stringify(game), "EX", 21_600);
      }
    } catch {
      // ignore
    }
  }

  private clearAutoReset(roomId: string): void {
    const t = this.autoResetTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      this.autoResetTimers.delete(roomId);
    }
  }

  private scheduleAutoReset(roomId: string, finishedAt: number): void {
    this.clearAutoReset(roomId);
    const t = setTimeout(() => {
      this.autoResetTimers.delete(roomId);
      void withCarromLock(roomId, async () => {
        const game = await this.loadGame(roomId);
        if (!game || game.status !== "finished" || game.updatedAt !== finishedAt) return;
        await this.syncPlayersFromStage(game);
        resetCarromRoundState(game);
        await this.saveGame(roomId, game);
        await this.emitGameState(game);
      }).catch(() => undefined);
    }, CARROM_AUTO_RESET_DELAY_MS);
    if (typeof t.unref === "function") t.unref();
    this.autoResetTimers.set(roomId, t);
  }

  private async syncPlayersFromStage(game: CarromGameState): Promise<boolean> {
    const micState = await this.micStageManager.loadRoomState(game.roomId);
    const nextPlayers: CarromPlayer[] = [];
    for (const slotNum of [1, 2]) {
      const slot = micState.data[String(slotNum)];
      if (!slot?.ev || !slot.id) continue;
      const member = await this.presenceDirectory.getDistributedSession(slot.id);
      if (!member || member.roomid !== game.roomId || member.offline) continue;
      nextPlayers.push({
        seat: nextPlayers.length,
        stageSlot: slotNum,
        socketId: member.id,
        userId: String(member.uid || member.lid || member.id),
        topic: String(member.topic || "لاعب"),
        pic: String(member.pic || "pic.png"),
        status: "playing",
      });
    }

    const beforeIds = (game.players || []).map((p) => `${p.seat}:${p.socketId}`).join("|");
    const afterIds = nextPlayers.map((p) => `${p.seat}:${p.socketId}`).join("|");
    const changed = beforeIds !== afterIds;

    game.players = nextPlayers;
    if (nextPlayers.length >= 2 && game.status === "waiting") {
      game.status = "active";
      game.turnSeat = 0;
      game.turnTimerStartedAt = Date.now();
    } else if (nextPlayers.length < 2 && game.status === "active") {
      game.status = "waiting";
      game.turnTimerStartedAt = 0;
    }
    return changed;
  }

  async toPublicState(game: CarromGameState | null, roomId: string): Promise<CarromPublicState> {
    const membersCount = await this.presenceDirectory.getOnlineRoomMemberCount(roomId);
    if (!game) {
      return {
        roomId,
        status: "stopped",
        scores: [0, 0],
        turnSeat: 0,
        turnTopic: "",
        queenPocketed: false,
        queenCoveredBy: null,
        strikerFouled: false,
        turnTimerStartedAt: 0,
        players: [],
        spectators: membersCount,
        shotInProgress: false,
        winnerSeat: null,
        winnerTopic: "",
        lastActionText: "",
        pieces: [],
        updatedAt: Date.now(),
      };
    }

    const players = (game.players || []).map((p) => ({
      seat: Number(p.seat),
      stageSlot: Number(p.stageSlot || p.seat + 1),
      userId: String(p.userId || ""),
      socketId: String(p.socketId || ""),
      topic: String(p.topic || "لاعب"),
      pic: String(p.pic || "pic.png"),
      status: String(p.status || "playing"),
    }));
    const currentTurn = players.find((p) => p.seat === game.turnSeat);
    return {
      roomId: game.roomId,
      status: game.status,
      scores: [Number(game.scores[0] || 0), Number(game.scores[1] || 0)],
      turnSeat: Number(game.turnSeat || 0),
      turnTopic: currentTurn?.topic || "",
      queenPocketed: Boolean(game.queenPocketed),
      queenCoveredBy: game.queenCoveredBy,
      strikerFouled: Boolean(game.strikerFouled),
      turnTimerStartedAt: Number(game.turnTimerStartedAt || 0),
      players,
      spectators: Math.max(0, membersCount - players.length),
      shotInProgress: Boolean(game.shotInProgress),
      winnerSeat: game.winnerSeat,
      winnerTopic: String(game.winnerTopic || ""),
      lastActionText: String(game.lastActionText || ""),
      pieces: game.pieces || [],
      updatedAt: Number(game.updatedAt || Date.now()),
    };
  }

  async emitGameState(game: CarromGameState | null, roomIdOverride?: string): Promise<void> {
    const roomId = game?.roomId || roomIdOverride || "";
    if (!roomId) return;
    const pub = await this.toPublicState(game, roomId);
    this.io.to(roomId).emit("msg", { cmd: "carrom_state", data: pub });
  }

  async emitStateToSocket(socket: Socket, roomId: string): Promise<void> {
    const game = await this.loadGame(roomId);
    const pub = await this.toPublicState(game, roomId);
    socket.emit("msg", { cmd: "carrom_state", data: pub });
  }

  async syncRoomGame(roomId: string, actionText?: string): Promise<void> {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return;
    await withCarromLock(safeRoomId, async () => {
      const game = await this.loadGame(safeRoomId);
      if (!game) return;
      const changed = await this.syncPlayersFromStage(game);
      if (changed && actionText) {
        game.lastActionText = actionText;
        game.updatedAt = Date.now();
      }
      if (changed) {
        await this.saveGame(safeRoomId, game);
      }
      await this.emitGameState(game, safeRoomId);
    }).catch(() => undefined);
  }

  async handleManage(socket: Socket, data: Record<string, unknown>): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    const roomId = session.roomid;
    const isStaff = verRoomsOwner(this.catalogStore.getPowers(), session.rank || session.power);
    if (!isStaff) {
      emitNotice(socket, "لا تملك صلاحية إدارة لعبة الكيرم");
      return;
    }

    const op = String(data.op || data.action || "start").trim().toLowerCase();
    await withCarromLock(roomId, async () => {
      if (op === "stop" || op === "close") {
        this.clearAutoReset(roomId);
        await this.saveGame(roomId, null);
        await this.emitGameState(null, roomId);
        this.io.to(roomId).emit("msg", {
          cmd: "carrom_notice",
          data: { roomId, msg: `تم إغلاق طاولة الكيرم بواسطة ${session.topic}` },
        });
        return;
      }

      if (op === "reset") {
        const existing = (await this.loadGame(roomId)) || createCarromGame(roomId, session.topic);
        await this.syncPlayersFromStage(existing);
        resetCarromRoundState(existing, `تمت إعادة ضبط طاولة الكيرم بواسطة ${session.topic}`);
        await this.saveGame(roomId, existing);
        await this.emitGameState(existing, roomId);
        return;
      }

      const game = (await this.loadGame(roomId)) || createCarromGame(roomId, session.topic);
      await this.syncPlayersFromStage(game);
      if (game.status === "finished") {
        resetCarromRoundState(game, `تم بدء جولة كيرم جديدة بواسطة ${session.topic}`);
      }
      await this.saveGame(roomId, game);
      await this.emitGameState(game, roomId);
    });
  }

  async handleJoinSeat(socket: Socket): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    const roomId = session.roomid;

    const micState = await this.micStageManager.loadRoomState(roomId);
    let targetSlot = 0;
    for (const s of [1, 2]) {
      const slot = micState.data[String(s)];
      if (slot?.id === socket.id) {
        targetSlot = s;
        break;
      }
    }
    if (!targetSlot) {
      for (const s of [1, 2]) {
        const slot = micState.data[String(s)];
        if (!micState.lockedSlots[String(s)] && (!slot?.ev || !slot.id)) {
          targetSlot = s;
          break;
        }
      }
    }
    if (!targetSlot) {
      emitNotice(socket, "المقعدان (1 و 2) ممتلئان أو مقفلان حالياً");
      return;
    }

    await this.micStageManager.handleTakeSlot(socket, roomId, targetSlot);
    await this.syncRoomGame(roomId, `${session.topic} انضم إلى طاولة الكيرم.`);
  }

  async handleLeaveSeat(socket: Socket): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    const roomId = session.roomid;
    await this.micStageManager.clearUserFromStage(roomId, socket.id);
    await this.syncRoomGame(roomId, `${session.topic} غادر طاولة الكيرم.`);
  }

  handlePreview(socket: Socket, data: Record<string, unknown>): void {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    socket.to(session.roomid).emit("msg", {
      cmd: "carrom_preview",
      data: {
        socketId: socket.id,
        angle: data.angle,
        power: data.power,
        offset: data.offset,
      },
    });
  }

  async handleShot(socket: Socket, data: CarromShotInput): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;
    const roomId = session.roomid;

    await withCarromLock(roomId, async () => {
      const game = await this.loadGame(roomId);
      if (!game || game.status !== "active" || game.shotInProgress) return;
      await this.syncPlayersFromStage(game);
      if (game.players.length < 2) {
        await this.saveGame(roomId, game);
        await this.emitGameState(game, roomId);
        return;
      }

      const player = game.players.find((p) => p.socketId === socket.id);
      if (!player || Number(player.seat) !== Number(game.turnSeat)) {
        emitNotice(socket, "ليس دورك حالياً في اللعب");
        return;
      }

      game.shotInProgress = true;
      const outcome = simulateCarromShot(game, player.seat, data, session.topic);
      await this.saveGame(roomId, game);

      this.io.to(roomId).emit("msg", {
        cmd: "carrom_shot_fired",
        data: {
          seat: player.seat,
          playerTopic: session.topic,
          shot: data,
          pocketed: outcome.pocketed,
          strikerPocketed: outcome.strikerPocketed,
          state: await this.toPublicState(game, roomId),
        },
      });
      await this.emitGameState(game, roomId);

      if (outcome.finished) {
        const winnerPlayer = game.players.find((p) => p.seat === game.winnerSeat);
        if (winnerPlayer?.socketId) {
          void this.evaluationEngine.awardPoints(winnerPlayer.socketId, "game_win");
        }
        this.scheduleAutoReset(roomId, game.updatedAt);
      }
    }).catch(() => undefined);
  }
}
