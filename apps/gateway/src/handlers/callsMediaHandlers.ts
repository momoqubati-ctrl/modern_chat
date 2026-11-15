import { getRedis, REDIS_KEYS } from "@newchat/db";
import {
  PM_CALL_BUSY_STATES,
  PM_CALL_LOCK_TTL_MS,
  sanitizeHtmlText,
} from "@newchat/shared";
import type { Socket } from "socket.io";
import { emitNotice, safeJsonParse } from "../lib/socketUtils.js";
import { normalizeYoutubeSearchMode } from "../services/mediaResolver.js";
import type { GatewayContext } from "../types/gateway.js";

export interface PmCallLockRecord {
  callId: string;
  callerId: string;
  calleeId: string;
  callType: "audio" | "video";
  status: "pending" | "incoming" | "connecting" | "active";
  createdAt: number;
  updatedAt: number;
}

function getCallFieldKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export async function releasePmCallsForSocket(
  ctx: GatewayContext,
  socketId: string,
  reason = "ended",
): Promise<void> {
  if (!socketId) return;
  try {
    const redis = getRedis();
    const all = await redis.hgetall(REDIS_KEYS.pmCalls);
    const toDelete: string[] = [];

    for (const [field, raw] of Object.entries(all)) {
      const rec = safeJsonParse<PmCallLockRecord | null>(raw, null);
      if (!rec) {
        toDelete.push(field);
        continue;
      }
      const isExpired = Date.now() - Number(rec.updatedAt || rec.createdAt || 0) > PM_CALL_LOCK_TTL_MS;
      const involvesSocket = rec.callerId === socketId || rec.calleeId === socketId;
      if (!involvesSocket && !isExpired) continue;

      toDelete.push(field);
      if (involvesSocket) {
        const partnerId = rec.callerId === socketId ? rec.calleeId : rec.callerId;
        if (partnerId) {
          ctx.io.to(partnerId).emit("msg", {
            cmd: "donecall",
            data: { id: socketId, peerId: socketId, callId: rec.callId, reason },
          });
        }
      }
    }

    if (toDelete.length > 0) {
      await redis.hdel(REDIS_KEYS.pmCalls, ...toDelete);
    }
  } catch {
    // non-fatal cleanup error
  }
}

async function isSocketBusyInCall(socketId: string, excludeFieldKey?: string): Promise<boolean> {
  try {
    const all = await getRedis().hgetall(REDIS_KEYS.pmCalls);
    const now = Date.now();
    for (const [field, raw] of Object.entries(all)) {
      if (excludeFieldKey && field === excludeFieldKey) continue;
      const rec = safeJsonParse<PmCallLockRecord | null>(raw, null);
      if (!rec) continue;
      if (now - Number(rec.updatedAt || rec.createdAt || 0) > PM_CALL_LOCK_TTL_MS) continue;
      if ((rec.callerId === socketId || rec.calleeId === socketId) && PM_CALL_BUSY_STATES.has(rec.status)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function createCallsMediaHandlers(ctx: GatewayContext) {
  return {
    async handleCallRequest(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      if (actor.offline || Number(actor.stat || 0) === 3) return;
      const d = rawData as Record<string, unknown>;
      const targetId = String(d.id || d.target || d.targetId || d.to || "").trim();
      if (!targetId || targetId === socket.id) return;

      const rate = await ctx.securityGuard.consumeRateSlot(`call:${socket.id}`, 8, 15_000);
      if (!rate.ok) return;

      if (actor.ismuted || actor.muted) {
        emitNotice(socket, "لا يمكنك إجراء مكالمة وأنت مكتوم");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "muted" } });
        return;
      }

      if (await ctx.micStageManager.isUserOnStage(socket.id, actor.roomid)) {
        emitNotice(socket, "لا يمكنك بدء مكالمة خاصة أثناء وجودك على المايك");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "on_stage" } });
        return;
      }

      if (await isSocketBusyInCall(socket.id)) {
        emitNotice(socket, "أنت في مكالمة أخرى حالياً");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "busy" } });
        return;
      }

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target || target.offline || Number(target.stat || 0) === 3 || target.islogin === "بوت") {
        emitNotice(socket, "المستخدم غير متصل بالانترنت في الوقت الحالي");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "offline" } });
        return;
      }

      if (await ctx.micStageManager.isUserOnStage(targetId, target.roomid)) {
        emitNotice(socket, "الطرف الآخر يصعد على المايك حالياً ولا يمكن الاتصال به");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "on_stage" } });
        return;
      }

      const callType: "audio" | "video" =
        String(d.callType || d.mediaKind || d.mediaType || "").toLowerCase() === "video" || d.video === true
          ? "video"
          : "audio";

      if (callType === "video" && target.nopmvideocall) {
        emitNotice(socket, "هذا العضو أغلق استقبال مكالمات الفيديو الخاصة");
        socket.emit("msg", { cmd: "call-rejected", data: { id: targetId, reason: "disabled" } });
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "disabled" } });
        return;
      }
      if (callType === "audio" && target.nopmcall) {
        emitNotice(socket, "هذا العضو أغلق استقبال المكالمات الصوتية الخاصة");
        socket.emit("msg", { cmd: "call-rejected", data: { id: targetId, reason: "disabled" } });
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "disabled" } });
        return;
      }

      if (await isSocketBusyInCall(targetId)) {
        emitNotice(socket, "الطرف الآخر مشغول في مكالمة أخرى حالياً");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "busy" } });
        return;
      }

      const callId = String(d.callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`).slice(0, 64);
      const record: PmCallLockRecord = {
        callId,
        callerId: socket.id,
        calleeId: targetId,
        callType,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await getRedis()
        .hset(REDIS_KEYS.pmCalls, getCallFieldKey(socket.id, targetId), JSON.stringify(record))
        .catch(() => 0);

      const safeCallerName = sanitizeHtmlText(String(d.callerName || actor.topic || ""));
      ctx.io.to(targetId).emit("msg", {
        cmd: "call-request",
        data: {
          callId,
          id: socket.id,
          from: socket.id,
          caller: socket.id,
          callerName: safeCallerName,
          topic: sanitizeHtmlText(actor.topic),
          pic: actor.pic || "pic.png",
          callType,
          mediaType: callType,
          mediaKind: callType,
        },
      });
    },

    async handleCallAccept(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      if (actor.offline || Number(actor.stat || 0) === 3 || actor.ismuted || actor.muted) return;
      const d = rawData as Record<string, unknown>;
      const callerId = String(d.id || d.from || d.caller || d.targetId || "").trim();
      if (!callerId || callerId === socket.id) return;

      const field = getCallFieldKey(socket.id, callerId);
      if (await ctx.micStageManager.isUserOnStage(socket.id, actor.roomid)) {
        emitNotice(socket, "لا يمكنك قبول مكالمة خاصة أثناء وجودك على المايك");
        socket.emit("msg", { cmd: "calldeny", data: { id: callerId, reason: "on_stage" } });
        ctx.io.to(callerId).emit("msg", { cmd: "calldeny", data: { id: socket.id, reason: "on_stage" } });
        await getRedis().hdel(REDIS_KEYS.pmCalls, field).catch(() => 0);
        return;
      }

      if (await isSocketBusyInCall(socket.id, field)) {
        emitNotice(socket, "أنت في مكالمة أخرى حالياً");
        socket.emit("msg", { cmd: "calldeny", data: { id: callerId, reason: "busy" } });
        return;
      }

      const caller = await ctx.presenceDirectory.getDistributedSession(callerId);
      if (!caller || caller.offline || Number(caller.stat || 0) === 3) {
        emitNotice(socket, "المتصل لم يعد متصلاً");
        await getRedis().hdel(REDIS_KEYS.pmCalls, field).catch(() => 0);
        socket.emit("msg", { cmd: "donecall", data: { id: callerId, peerId: callerId, reason: "offline" } });
        return;
      }

      if (await ctx.micStageManager.isUserOnStage(callerId, caller.roomid)) {
        emitNotice(socket, "المتصل صعد على المايك حالياً");
        await getRedis().hdel(REDIS_KEYS.pmCalls, field).catch(() => 0);
        ctx.io.to(callerId).emit("msg", { cmd: "calldeny", data: { id: socket.id, reason: "on_stage" } });
        socket.emit("msg", { cmd: "donecall", data: { id: callerId, peerId: callerId, reason: "on_stage" } });
        return;
      }

      if (await isSocketBusyInCall(callerId, field)) {
        emitNotice(socket, "المتصل مشغول في مكالمة أخرى حالياً");
        await getRedis().hdel(REDIS_KEYS.pmCalls, field).catch(() => 0);
        socket.emit("msg", { cmd: "calldeny", data: { id: callerId, reason: "busy" } });
        return;
      }

      const raw = await getRedis().hget(REDIS_KEYS.pmCalls, field).catch(() => null);
      const existing = safeJsonParse<PmCallLockRecord | null>(raw, null);
      const callType =
        existing?.callType ||
        (String(d.callType || d.mediaKind || d.mediaType || "").toLowerCase() === "video" ? "video" : "audio");

      if (existing) {
        existing.status = "active";
        existing.updatedAt = Date.now();
        await getRedis().hset(REDIS_KEYS.pmCalls, field, JSON.stringify(existing)).catch(() => 0);
      } else {
        const fallbackRecord: PmCallLockRecord = {
          callId: String(d.callId || `call_${Date.now()}`),
          callerId,
          calleeId: socket.id,
          callType,
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await getRedis().hset(REDIS_KEYS.pmCalls, field, JSON.stringify(fallbackRecord)).catch(() => 0);
      }

      const acceptedPayload = {
        callId: existing?.callId || String(d.callId || ""),
        id: socket.id,
        from: socket.id,
        to: callerId,
        caller: callerId,
        called: socket.id,
        callerName: sanitizeHtmlText(caller.topic),
        calledName: sanitizeHtmlText(String(d.calledName || actor.topic || "")),
        topic: sanitizeHtmlText(actor.topic),
        pic: actor.pic || "pic.png",
        callType,
        mediaType: callType,
        mediaKind: callType,
      };
      ctx.io.to(callerId).emit("msg", { cmd: "call-accepted", data: acceptedPayload });
      socket.emit("msg", { cmd: "call-accepted", data: acceptedPayload });
    },

    async handleCallRejectOrEnd(
      socket: Socket,
      cmd: "call-reject" | "calldeny" | "calldone",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const callerField = String(d.caller || "").trim();
      const calledField = String(d.called || "").trim();
      let partnerId = "";
      if (callerField && callerField !== socket.id) {
        partnerId = callerField;
      } else if (calledField && calledField !== socket.id) {
        partnerId = calledField;
      } else {
        const candidate = String(d.id || d.from || d.to || d.target || d.targetId || "").trim();
        if (candidate && candidate !== socket.id) partnerId = candidate;
      }

      if (partnerId) {
        await getRedis().hdel(REDIS_KEYS.pmCalls, getCallFieldKey(socket.id, partnerId)).catch(() => 0);
        const outCmd =
          cmd === "call-reject" ? "call-rejected" : cmd === "calldeny" ? "calldeny" : "donecall";
        ctx.io.to(partnerId).emit("msg", {
          cmd: outCmd,
          data: {
            id: socket.id,
            from: socket.id,
            peerId: socket.id,
            caller: callerField || (cmd === "call-reject" ? partnerId : socket.id),
            called: calledField || (cmd === "call-reject" ? socket.id : partnerId),
            callId: String(d.callId || ""),
            reason: sanitizeHtmlText(String(d.reason || "")).slice(0, 100),
          },
        });
      } else {
        await releasePmCallsForSocket(ctx, socket.id, cmd);
      }
    },

    async handlePmCallSignal(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const targetId = String(d.to || d.target || d.id || d.targetId || "").trim();
      if (!targetId || targetId === socket.id) return;

      const rawSignal = JSON.stringify(d);
      if (rawSignal.length > 65_536) return;

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target || target.offline || Number(target.stat || 0) === 3) {
        await releasePmCallsForSocket(ctx, socket.id, "offline");
        socket.emit("msg", {
          cmd: "donecall",
          data: { id: targetId, peerId: targetId, callId: String(d.callId || ""), reason: "offline" },
        });
        return;
      }

      ctx.io.to(targetId).emit("msg", {
        cmd: "pm-call-signal",
        data: {
          ...d,
          from: socket.id,
          id: socket.id,
          to: targetId,
          target: targetId,
        },
      });
    },

    async handleCalling(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const targetId = String(d.id || d.called || d.to || d.target || "").trim();
      if (!targetId || targetId === socket.id) return;

      const rate = await ctx.securityGuard.consumeRateSlot(`calling:${socket.id}`, 12, 15_000);
      if (!rate.ok) return;

      const limits = ctx.catalogStore.getLimits();
      if (actor.rep < limits.pmlikes) {
        emitNotice(socket, `تحتاج إلى ${limits.pmlikes} نقطة لإجراء مكالمات خاصة`);
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "rep_required" } });
        return;
      }

      if (actor.ismuted || actor.muted) {
        emitNotice(socket, "أنت مكتوم حالياً");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "muted" } });
        return;
      }

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target || target.offline || Number(target.stat || 0) === 3 || target.islogin === "بوت") {
        emitNotice(socket, "المستخدم غير متصل بالانترنت في الوقت الحالي");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "offline" } });
        return;
      }

      if (target.nopmcall) {
        emitNotice(socket, "هذا العضو أغلق استقبال المكالمات الخاصة");
        socket.emit("msg", { cmd: "calldeny", data: { id: targetId, reason: "disabled" } });
        return;
      }

      ctx.io.to(targetId).emit("msg", {
        cmd: "calling",
        data: {
          ...d,
          id: socket.id,
          from: socket.id,
          caller: socket.id,
          called: targetId,
          roomid: String(d.roomid || actor.roomid || ""),
          topic: sanitizeHtmlText(actor.topic),
          pic: actor.pic || "pic.png",
        },
      });
    },

    async handleYoutube(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const query = String(d.search || d.q || d.query || d.url || "").trim();
      if (!query) {
        socket.emit("msg", { cmd: "youtube", data: [] });
        return;
      }

      const rate = await ctx.securityGuard.consumeRateSlot(`yt:${socket.id}`, 10, 20_000);
      if (!rate.ok) return;

      const results = await ctx.mediaResolver.searchYoutube(query, 10, { mode: "videos" });
      socket.emit("msg", { cmd: "youtube", data: results });
    },

    async handleYoutubeSearch(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const mode = normalizeYoutubeSearchMode(d.mode || d.type);
      const query = String(d.query || d.q || d.search || "").trim();
      const count = Math.max(1, Math.min(24, Number(d.count || d.maxResults || 12) || 12));

      const rate = await ctx.securityGuard.consumeRateSlot(`yts:${socket.id}`, 12, 20_000);
      if (!rate.ok) return;

      const results = await ctx.mediaResolver.searchYoutube(query, count, {
        mode,
        seed: d.seed || socket.id,
      });
      socket.emit("msg", {
        cmd: "youtube_search_results",
        data: {
          requestId: d.requestId ?? null,
          mode,
          query,
          items: results,
          results,
        },
      });
    },

    async handleResolveTiktok(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const rawUrl = String(d.url || "").trim();
      if (!rawUrl) return;

      const rate = await ctx.securityGuard.consumeRateSlot(`tt:${socket.id}`, 8, 20_000);
      if (!rate.ok) return;

      const meta = await ctx.mediaResolver.resolveTikTok(rawUrl);
      socket.emit("msg", {
        cmd: "resolve_tiktok_result",
        data: {
          requestId: d.requestId ?? null,
          ok: Boolean(meta),
          url: rawUrl,
          meta,
          result: meta,
        },
      });
    },
  };
}
