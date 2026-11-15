import { eq, getDb, users } from "@newchat/db";
import {
  getAutoPromotionTarget,
  normalizeEvaluationAwardSettings,
  parseEvaluationAwardsJson,
  type EvaluationAwardActionKey,
} from "@newchat/shared";
import type { Server } from "socket.io";
import { emitNotice } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { PresenceDirectory } from "./presenceDirectory.js";
import type { GatewaySession } from "../types/gateway.js";

function getUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class EvaluationEngine {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly presenceDirectory: PresenceDirectory;
  private readonly presenceTimers = new Map<string, NodeJS.Timeout>();
  private readonly saveTimers = new Map<string, NodeJS.Timeout>();

  constructor(io: Server, catalogStore: CatalogStore, presenceDirectory: PresenceDirectory) {
    this.io = io;
    this.catalogStore = catalogStore;
    this.presenceDirectory = presenceDirectory;
  }

  private getConfig(actionKey: EvaluationAwardActionKey) {
    const settings = normalizeEvaluationAwardSettings(this.catalogStore.getSiteSetting().evaluation_awards);
    return {
      enabled: settings.enabled,
      rule: settings.actions[actionKey],
    };
  }

  async awardPoints(
    socketId: string,
    actionKey: EvaluationAwardActionKey,
    options?: {
      amount?: number;
      bypassCooldown?: boolean;
      skipSave?: boolean;
      message?: string;
      roomMemberCount?: number;
      targetSocketId?: string;
    },
  ): Promise<boolean> {
    const session = this.presenceDirectory.getLocalSession(socketId);
    if (!session || session.islogin !== "عضو" || !session.uid || session.offline) {
      return false;
    }

    const { enabled, rule } = this.getConfig(actionKey);
    if (!enabled || !rule) return false;

    if (actionKey === "room_message") {
      const msgLen = String(options?.message || "").trim().length;
      if (rule.minLength > 0 && msgLen < rule.minLength) return false;
      const roomCount = Number(options?.roomMemberCount || 0);
      if (rule.minRoomMembers > 0 && roomCount < rule.minRoomMembers) return false;
    } else if (actionKey === "wall_post" || actionKey === "private_message") {
      const msgLen = String(options?.message || "").trim().length;
      if (rule.minLength > 0 && msgLen < rule.minLength) return false;
      if (actionKey === "private_message" && rule.requireDifferentMember && options?.targetSocketId) {
        if (options.targetSocketId === socketId) return false;
      }
    }

    const delta = Math.max(0, Number(options?.amount ?? rule.points) || 0);
    if (delta <= 0) return false;

    const awards = parseEvaluationAwardsJson(session.eval_awards);
    const today = getUtcDayKey();
    const dailyRoot =
      awards.daily && typeof awards.daily === "object"
        ? (awards.daily as Record<string, unknown>)
        : { day: today, amounts: {} };
    if (dailyRoot.day !== today) {
      dailyRoot.day = today;
      dailyRoot.amounts = {};
    }
    const amounts = (dailyRoot.amounts || {}) as Record<string, number>;
    const usedToday = Math.max(0, Number(amounts[actionKey] || 0));
    if (rule.dailyLimit > 0 && usedToday >= rule.dailyLimit) {
      return false;
    }

    const effectiveDelta =
      rule.dailyLimit > 0 ? Math.min(delta, rule.dailyLimit - usedToday) : delta;
    if (effectiveDelta <= 0) return false;

    const now = Date.now();
    if (!options?.bypassCooldown && rule.cooldownMs > 0) {
      const lastAt = Number(awards[actionKey] || 0);
      if (lastAt && now - lastAt < rule.cooldownMs) {
        return false;
      }
    }

    awards[actionKey] = now;
    amounts[actionKey] = usedToday + effectiveDelta;
    dailyRoot.amounts = amounts;
    awards.daily = dailyRoot;

    const nextEval = Math.max(0, Number(session.evaluation || 0) + effectiveDelta);
    session.evaluation = nextEval;
    session.eval_awards = awards;

    await this.presenceDirectory.patchSession(socketId, {
      evaluation: nextEval,
      eval_awards: awards,
    });

    if (!options?.skipSave) {
      this.scheduleSave(session);
    }

    await this.checkAutoPromotion(socketId);
    return true;
  }

  async awardDailyLogin(socketId: string): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socketId);
    if (!session || session.islogin !== "عضو" || !session.uid) return;
    const today = getUtcDayKey();
    if (session.last_eval_login_day === today) return;

    const ok = await this.awardPoints(socketId, "daily_login", {
      bypassCooldown: true,
      skipSave: true,
    });
    if (!ok) return;

    session.last_eval_login_day = today;
    try {
      const { db } = getDb();
      await db
        .update(users)
        .set({
          evaluation: session.evaluation,
          eval_awards_json: JSON.stringify(session.eval_awards),
          last_eval_login_day: today,
        })
        .where(eq(users.uid, session.uid));
    } catch {
      // ignore
    }
  }

  startPresenceTimer(socketId: string): void {
    this.stopPresenceTimer(socketId);
    const session = this.presenceDirectory.getLocalSession(socketId);
    if (!session || session.islogin !== "عضو") return;
    const intervalMs = Math.max(
      60_000,
      this.getConfig("online_duration").rule.cooldownMs || 15 * 60_000,
    );
    const timer = setInterval(() => {
      void this.awardPoints(socketId, "online_duration");
    }, intervalMs);
    if (typeof timer.unref === "function") timer.unref();
    this.presenceTimers.set(socketId, timer);
  }

  stopPresenceTimer(socketId: string): void {
    const t = this.presenceTimers.get(socketId);
    if (t) {
      clearInterval(t);
      this.presenceTimers.delete(socketId);
    }
  }

  private scheduleSave(session: GatewaySession): void {
    const uid = session.uid;
    if (!uid) return;
    const existing = this.saveTimers.get(uid);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.saveTimers.delete(uid);
      try {
        const { db } = getDb();
        await db
          .update(users)
          .set({
            evaluation: session.evaluation,
            eval_awards_json: JSON.stringify(session.eval_awards),
          })
          .where(eq(users.uid, uid));
      } catch {
        // non-fatal
      }
    }, 2000);
    if (typeof timer.unref === "function") timer.unref();
    this.saveTimers.set(uid, timer);
  }

  async flushSessionEvaluation(session: GatewaySession): Promise<void> {
    this.stopPresenceTimer(session.id);
    if (session.islogin !== "عضو" || !session.uid) return;
    const existing = this.saveTimers.get(session.uid);
    if (existing) {
      clearTimeout(existing);
      this.saveTimers.delete(session.uid);
    }
    try {
      const { db } = getDb();
      await db
        .update(users)
        .set({
          evaluation: Math.max(0, Number(session.evaluation || 0)),
          eval_awards_json: JSON.stringify(session.eval_awards || {}),
        })
        .where(eq(users.uid, session.uid));
    } catch {
      // non-fatal
    }
  }

  async checkAutoPromotion(socketId: string): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socketId);
    if (!session || session.islogin !== "عضو" || !session.uid) return;
    const enabled = this.catalogStore.getLimits().evaluationAutoPromotionEnabled;
    const powersList = this.catalogStore.getPowers();
    const target = getAutoPromotionTarget(powersList, session.evaluation, enabled);
    if (!target || !target.power?.name) return;

    const currentRole = this.catalogStore.getPowerRole(session.rank || session.power);
    const currentRank = Number(currentRole?.rank || 0);
    if (currentRank >= Number(target.rank || 0) && session.power === target.power.name) {
      return;
    }
    if (currentRank > Number(target.rank || 0)) {
      return;
    }

    const newPowerName = target.power.name;
    session.power = newPowerName;
    session.rank = newPowerName;
    session.auto_power = newPowerName;

    try {
      const { db } = getDb();
      await db
        .update(users)
        .set({ power: newPowerName, auto_power: newPowerName })
        .where(eq(users.uid, session.uid));
    } catch {
      // ignore
    }

    await this.presenceDirectory.patchSession(socketId, {
      power: newPowerName,
      rank: newPowerName,
      auto_power: newPowerName,
    });

    const targetSocket = this.io.sockets.sockets.get(socketId);
    if (targetSocket) {
      targetSocket.emit("msg", { cmd: "power", data: target.power });
      targetSocket.emit("msg", {
        cmd: "lvel",
        data: { evaluation: session.evaluation, power: newPowerName },
      });
      emitNotice(targetSocket, `تهانينا! تمت ترقيتك تلقائياً إلى رتبة 》 ${newPowerName}`);
    }
  }
}
