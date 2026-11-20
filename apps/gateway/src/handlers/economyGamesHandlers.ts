import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  bots,
  coin_ledger,
  eq,
  getDb,
  getRedis,
  gift_notifications,
  site_master_wallet,
  site_master_wallet_ledger,
  sql,
  users,
  executeWithIdempotency,
  isIdempotencyError,
  isUnifiedEconomyError,
  loadGiftSettings,
} from "@newchat/db";
import {
  GIFT_RATE_LIMIT_MAX,
  GIFT_RATE_LIMIT_WINDOW_MS,
  SITE_MASTER_WALLET_SITE_ID,
  canActOnRank,
  getPowerDefinitionByName,
  giftSendSchema,
  sanitizeHtmlText,
  verAdminPanel,
} from "@newchat/shared";
import type { Socket } from "socket.io";
import { gatewayConfig } from "../config.js";
import { emitNotice, resolveContainedPath } from "../lib/socketUtils.js";
import type { GatewayContext, GatewaySession } from "../types/gateway.js";
import { disconnectUserSession } from "./authHandlers.js";

export function createEconomyGamesHandlers(ctx: GatewayContext) {
  function safeGiftErrorMessage(err: unknown): string {
    const code = isUnifiedEconomyError(err) || isIdempotencyError(err)
      ? String((err as { code?: string }).code || "")
      : "";
    switch (code) {
      case "CANNOT_GIFT_SELF":
        return "لا يمكنك إرسال هدية لنفسك";
      case "INSUFFICIENT_COINS":
        return "رصيد الكوينز غير كافٍ";
      case "SENDER_NOT_FOUND":
      case "RECEIVER_NOT_FOUND":
        return "تعذر العثور على حساب المرسل أو المستلم";
      case "INVALID_QUANTITY":
        return "كمية الهدية غير صالحة";
      case "GIFT_FEES_TOO_HIGH":
        return "قيمة الهدية أقل من الرسوم المطبقة";
      case "GIFT_FEE_SLAB_NOT_FOUND":
      case "INVALID_GIFT_SETTINGS":
      case "INVALID_HOSTING_FEE":
        return "تعذر معالجة الهدية بسبب إعدادات النظام";
      case "PAYLOAD_MISMATCH":
        return "مفتاح العملية مستخدم لطلب مختلف";
      case "CONCURRENT_TRANSACTION_IN_PROGRESS":
      case "DEADLOCK_DETECTED":
        return "العملية قيد المعالجة، يرجى المحاولة مجدداً";
      default:
        return "تعذر إرسال الهدية";
    }
  }

  async function executeGiftTransfer(
    socket: Socket,
    actor: GatewaySession,
    d: Record<string, unknown>,
  ): Promise<void> {
    if (actor.islogin !== "عضو" || !actor.uid) {
      emitNotice(socket, "إرسال الهدايا متاح للأعضاء المسجلين فقط");
      return;
    }
    const ban = ctx.securityGuard.checkBan({
      ip: actor.ip,
      fp: actor.fp,
      countryCode: actor.co,
      username: actor.username,
      topic: actor.topic,
    });
    if (ban.blocked) {
      emitNotice(socket, "لا يمكن تنفيذ العملية لهذا الحساب");
      return;
    }

    const parsed = giftSendSchema.safeParse({
      id: String(d.id || d.targetId || "").trim(),
      file: String(d.file || d.gift || "").trim(),
      qty: d.qty !== undefined ? Number(d.qty) : 1,
      roomId: d.roomId ? String(d.roomId) : actor.roomid || undefined,
      note: d.note ? String(d.note) : "",
      idempotencyKey: d.idempotencyKey ? String(d.idempotencyKey) : undefined,
    });
    if (!parsed.success) {
      emitNotice(socket, "بيانات الهدية غير صالحة");
      return;
    }

    let giftDef = ctx.catalogStore.getGiftByFile(parsed.data.file);
    if (!giftDef && (parsed.data.file === "rose.png" || parsed.data.file === "rose")) {
      giftDef =
        ctx.catalogStore.getGifts().find((g) => g.coin === 1) ||
        ctx.catalogStore.getGifts()[0] ||
        null;
    }
    if (!giftDef) {
      emitNotice(socket, "الهدية المطلوبة غير موجودة");
      return;
    }

    const target = await ctx.presenceDirectory.getDistributedSession(parsed.data.id);
    if (!target || target.offline || target.islogin !== "عضو" || !target.uid) {
      emitNotice(socket, "يمكن إرسال الهدايا للأعضاء المتصلين فقط");
      return;
    }
    if (target.uid === actor.uid) {
      emitNotice(socket, "لا يمكنك إرسال هدية لنفسك");
      return;
    }

    const giftSettings = await loadGiftSettings();
    if (!giftSettings.giftEnabled) {
      emitNotice(socket, "إرسال الهدايا متوقف مؤقتاً");
      return;
    }
    if (parsed.data.qty > giftSettings.maxQty) {
      emitNotice(socket, `الحد الأقصى لكمية الهدية هو ${giftSettings.maxQty}`);
      return;
    }

    const rate = await ctx.securityGuard.consumeRateSlot(
      `gift:${actor.uid}`,
      giftSettings.rateLimitMax || GIFT_RATE_LIMIT_MAX,
      giftSettings.rateLimitWindowMs || GIFT_RATE_LIMIT_WINDOW_MS,
    );
    if (!rate.ok) {
      emitNotice(socket, "الرجاء الانتظار قليلاً قبل إرسال هدية أخرى");
      return;
    }

    const idempotencyKey =
      parsed.data.idempotencyKey || crypto.randomBytes(16).toString("hex");
    let execution: Awaited<ReturnType<typeof executeWithIdempotency>>;
    try {
      execution = await executeWithIdempotency({
        userUid: actor.uid,
        idempotencyKey,
        targetId: target.uid,
        sourceType: "room",
        senderIdreg: Number(actor.idreg || 0),
        senderUid: actor.uid,
        senderIp: actor.ip,
        receiverIdreg: Number(target.idreg || 0),
        receiverUid: target.uid,
        receiverTopic: target.topic,
        giftFile: giftDef.file,
        unitCoin: Number(giftDef.coin || 0),
        quantity: parsed.data.qty,
        noteSender: parsed.data.note || "",
        noteReceiver: parsed.data.note || "",
        isOnlineTarget: Boolean(target.id),
        maxWaitMs: 2500,
      });
    } catch (err: unknown) {
      if (isUnifiedEconomyError(err) || isIdempotencyError(err)) {
        emitNotice(socket, safeGiftErrorMessage(err));
        return;
      }
      console.error("[Economy] gift transfer error:", err);
      emitNotice(socket, safeGiftErrorMessage(err));
      return;
    }

    const transferRes = execution.data;
    const txid = transferRes.txid;
    const receiverCoin = transferRes.receiverCoin;
    const totalCoin = transferRes.totalCoin;
    const result = {
      ok: true as const,
      senderCoins: transferRes.senderAfter,
      receiverCoins: transferRes.receiverAfter,
      receiverGiftsCount: transferRes.receiverGiftsAfter,
    };

    await ctx.presenceDirectory.patchSession(actor.id, {
      coin: result.senderCoins,
      coins: result.senderCoins,
    });
    await ctx.presenceDirectory.patchSession(target.id, {
      coin: result.receiverCoins,
      coins: result.receiverCoins,
      gifts_received_count: result.receiverGiftsCount,
    });

    emitNotice(socket, `تم إرسال الهدية إلى ${sanitizeHtmlText(target.topic)}`);
    if (!execution.cached) {
      ctx.io.to(target.id).emit("msg", {
        cmd: "not",
        data: {
          topic: sanitizeHtmlText(actor.topic),
          force: 1,
          msg: `أرسل لك ${sanitizeHtmlText(actor.topic)} هدية جديدة (+${receiverCoin} كوينز)`,
          user: actor.id,
        },
      });
    }

    const sourceRoomId = actor.roomid || target.roomid;
    if (!execution.cached && sourceRoomId && actor.roomid === target.roomid) {
      ctx.io.to(sourceRoomId).emit("msg", {
        cmd: "gift_room_fx",
        data: {
          txid,
          roomId: sourceRoomId,
          fromId: actor.id,
          fromTopic: sanitizeHtmlText(actor.topic),
          toId: target.id,
          toTopic: sanitizeHtmlText(target.topic),
          file: giftDef.file,
          qty: parsed.data.qty,
          coin: totalCoin,
        },
      });
    }
  }

  return {
    async handleSendGift(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      await executeGiftTransfer(socket, actor, rawData as Record<string, unknown>);
    },

    async handleActionCommand(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const act = String(d.action || d.type || "").trim();
      const targetId = String(d.id || d.targetId || "").trim();
      if (!act) return;

      const powers = ctx.catalogStore.getPowers();
      const powerDef = getPowerDefinitionByName(powers, actor.rank || actor.power);
      const target = targetId ? await ctx.presenceDirectory.getDistributedSession(targetId) : null;

      switch (act) {
        case "gift": {
          await executeGiftTransfer(socket, actor, d);
          return;
        }

        case "like": {
          if (!target) {
            emitNotice(socket, "العضو غير متواجد حالياً");
            return;
          }
          if (target.id === actor.id) {
            emitNotice(socket, "لا يمكنك الإعجاب بحسابك الخاص");
            return;
          }
          if (target.islogin !== "عضو" || !target.uid) {
            emitNotice(socket, "الإعجاب متاح للملفات الشخصية المسجلة فقط");
            return;
          }
          const likeKey = `like:${actor.uid || actor.fp || socket.id}:${target.uid}`;
          const rl = await ctx.securityGuard.consumeRateSlot(likeKey, 1, 60_000);
          if (!rl.ok) {
            emitNotice(socket, "يمكنك إرسال لايك لنفس العضو مرة كل دقيقة");
            return;
          }
          const nextRep = Math.max(0, Number(target.rep || 0)) + 1;
          const { db } = getDb();
          await db.update(users).set({ rep: nextRep }).where(eq(users.uid, target.uid));
          await ctx.presenceDirectory.patchSession(target.id, { rep: nextRep });
          ctx.io.to(target.id).emit("msg", {
            cmd: "not",
            data: { topic: sanitizeHtmlText(actor.topic), force: 0, msg: "أعجب بملفك الشخصي 👍", user: actor.id },
          });
          emitNotice(socket, `تم التفاعل والإعجاب بـ (${sanitizeHtmlText(target.topic || target.username)}) 👍`);
          return;
        }

        case "not": {
          if (!target || !powerDef || !Number(powerDef.alert || 0)) {
            emitNotice(socket, "لا تملك صلاحية إرسال التنبيهات");
            return;
          }
          const msg = sanitizeHtmlText(String(d.msg || "").trim().slice(0, 300));
          if (!msg) return;
          ctx.io.to(target.id).emit("msg", {
            cmd: "not",
            data: { topic: sanitizeHtmlText(actor.topic), force: 1, msg, user: actor.id },
          });
          await ctx.securityGuard.recordModerationStat({
            state: "تنبيه",
            topic: actor.topic,
            targetTopic: target.topic,
            room: actor.roomid || "",
            ip: actor.ip,
          });
          return;
        }

        case "meiut": {
          if (!target || !powerDef || !Number(powerDef.meiut || 0)) {
            emitNotice(socket, "لا تملك صلاحية الكتم");
            return;
          }
          if (!canActOnRank(powers, actor.rank || actor.power, target.rank || target.power)) {
            emitNotice(socket, "لا يمكنك كتم عضو أعلى منك في الرتبة");
            return;
          }
          const nextMuted = !(target.ismuted || target.muted);
          if (target.islogin === "عضو" && target.uid) {
            const { db } = getDb();
            await db.update(users).set({ muted: nextMuted }).where(eq(users.uid, target.uid));
          }
          await ctx.presenceDirectory.patchSession(target.id, { ismuted: nextMuted, muted: nextMuted });
          if (nextMuted && target.roomid) {
            await ctx.micStageManager.clearUserFromStage(target.roomid, target.id);
          }
          ctx.io.to(target.id).emit("msg", { cmd: "muted", data: { muted: nextMuted, by: actor.topic } });
          emitNotice(socket, nextMuted ? `تم كتم ${sanitizeHtmlText(target.topic)}` : `تم فك كتم ${sanitizeHtmlText(target.topic)}`);
          return;
        }

        case "kick": {
          if (!target || !powerDef || !Number(powerDef.kick || 0)) {
            emitNotice(socket, "لا تملك صلاحية الطرد");
            return;
          }
          if (!canActOnRank(powers, actor.rank || actor.power, target.rank || target.power)) {
            emitNotice(socket, "لا يمكنك طرد عضو أعلى منك في الرتبة");
            return;
          }
          target.kicked = true;
          ctx.io.to(target.id).emit("msg", { cmd: "kicked", data: { by: actor.topic } });
          await ctx.securityGuard.recordModerationStat({
            state: "طرد",
            topic: actor.topic,
            targetTopic: target.topic,
            room: actor.roomid || "",
            ip: actor.ip,
          });
          await disconnectUserSession(ctx, target.id, { forceImmediate: true, reason: "kicked" });
          const targetSock = ctx.io.sockets.sockets.get(target.id);
          if (targetSock) targetSock.disconnect(true);
          return;
        }

        case "ban": {
          if (!target || !powerDef || !Number(powerDef.ban || 0)) {
            emitNotice(socket, "لا تملك صلاحية الحظر");
            return;
          }
          if (!canActOnRank(powers, actor.rank || actor.power, target.rank || target.power)) {
            emitNotice(socket, "لا يمكنك حظر عضو أعلى منك في الرتبة");
            return;
          }
          target.kicked = true;
          await ctx.securityGuard.addBanRule({
            actorTopic: actor.topic,
            ip: target.ip,
            fp: target.fp,
            targetName: target.username || target.topic,
            reason: sanitizeHtmlText(String(d.reason || "حظر إداري")).slice(0, 120),
            countryCode: target.co,
          });
          ctx.io.to(target.id).emit("msg", { cmd: "kicked", data: { by: actor.topic, banned: true } });
          await disconnectUserSession(ctx, target.id, { forceImmediate: true, reason: "banned" });
          const targetSock = ctx.io.sockets.sockets.get(target.id);
          if (targetSock) targetSock.disconnect(true);
          return;
        }

        case "delpic": {
          if (!target || !powerDef || !Number(powerDef.delpic || 0)) {
            emitNotice(socket, "لا تملك صلاحية حذف الصور");
            return;
          }
          if (!canActOnRank(powers, actor.rank || actor.power, target.rank || target.power)) {
            emitNotice(socket, "لا يمكنك حذف صورة عضو أعلى منك في الرتبة");
            return;
          }
          if (target.pic && target.pic !== "pic.png" && target.pic.startsWith("/")) {
            const safePath = resolveContainedPath(gatewayConfig.uploadDir, target.pic);
            if (safePath) {
              await fs.unlink(safePath).catch(() => undefined);
            }
          }
          if (target.islogin === "عضو" && target.uid) {
            const { db } = getDb();
            await db.update(users).set({ pic: "pic.png" }).where(eq(users.uid, target.uid));
          }
          await ctx.presenceDirectory.patchSession(target.id, { pic: "pic.png" });
          await ctx.securityGuard.recordModerationStat({
            state: "حذف صورة",
            topic: actor.topic,
            targetTopic: target.topic,
            room: actor.roomid || "",
            ip: actor.ip,
          });
          return;
        }

        case "rinvite": {
          if (!target || !actor.roomid) return;
          const room = ctx.catalogStore.getRoomById(actor.roomid);
          if (!room) return;
          ctx.io.to(target.id).emit("msg", {
            cmd: "rjoinad",
            data: {
              roomid: room.id,
              roomTopic: sanitizeHtmlText(room.topic),
              byTopic: sanitizeHtmlText(actor.topic),
              pass: room.pass || "",
            },
          });
          emitNotice(socket, `تمت دعوة ${sanitizeHtmlText(target.topic)} إلى الغرفة`);
          return;
        }

        case "roomkick": {
          if (!target || !actor.roomid) return;
          const room = ctx.catalogStore.getRoomById(actor.roomid);
          if (!room) return;
          const isOwner =
            room.owner === actor.username ||
            (actor.idreg !== undefined && room.owner === `#${actor.idreg}`) ||
            Boolean(powerDef && Number(powerDef.kick || 0));
          if (!isOwner) {
            emitNotice(socket, "لا تملك صلاحية الطرد من هذه الغرفة");
            return;
          }
          try {
            await getRedis().set(`newchat:room_ban:${room.id}:${target.fp}`, "1", "EX", 1800);
          } catch {
            // ignore
          }
          const targetSock = ctx.io.sockets.sockets.get(target.id);
          if (targetSock) {
            await ctx.micStageManager.clearUserFromStage(room.id, target.id, { evictFromMediaRoom: true });
            await ctx.presenceDirectory.moveUserToRoom(targetSock, target, ctx.catalogStore.getDefaultRoomId());
            targetSock.emit("msg", { cmd: "lavedon", data: { roomId: room.id, by: actor.topic } });
          }
          return;
        }

        case "gift_icon": {
          if (!target || !powerDef || !Number(powerDef.gifticon || 0)) return;
          const ico = sanitizeHtmlText(String(d.ico || d.gift || "").trim()).slice(0, 250);
          const gift_ico = ico
            ? (ico.startsWith("dro3/") || ico.startsWith("/dro3/")
                ? ico.replace(/^\/+/, "")
                : `dro3/${ico.replace(/^\/+/, "")}`)
            : "";
          if (target.islogin === "عضو" && target.uid) {
            const { db } = getDb();
            await db.update(users).set({ gift_ico }).where(eq(users.uid, target.uid));
          }
          await ctx.presenceDirectory.patchSession(target.id, { gift_ico });
          return;
        }
      }
    },

    async handleCarromCmd(
      socket: Socket,
      cmd: "carrom_manage" | "carrom_sync" | "carrom_join" | "carrom_leave" | "carrom_preview" | "carrom_shot",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !actor.roomid) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};

      switch (cmd) {
        case "carrom_manage":
          await ctx.carromManager.handleManage(socket, d);
          break;
        case "carrom_sync":
          await ctx.carromManager.emitStateToSocket(socket, actor.roomid);
          break;
        case "carrom_join":
          await ctx.carromManager.handleJoinSeat(socket);
          break;
        case "carrom_leave":
          await ctx.carromManager.handleLeaveSeat(socket);
          break;
        case "carrom_preview":
          ctx.carromManager.handlePreview(socket, d);
          break;
        case "carrom_shot":
          await ctx.carromManager.handleShot(socket, d);
          break;
      }
    },

    async handleLudoCmd(
      socket: Socket,
      cmd: "ludo_manage" | "ludo_sync" | "ludo_join" | "ludo_leave" | "ludo_roll" | "ludo_move",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !actor.roomid) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};

      switch (cmd) {
        case "ludo_manage":
          await ctx.ludoManager.handleManage(socket, d);
          break;
        case "ludo_sync":
          await ctx.ludoManager.emitStateToSocket(socket, actor.roomid);
          break;
        case "ludo_join":
          await ctx.ludoManager.handleManage(socket, { op: "sit", ...(d.seat !== undefined ? { seat: d.seat } : {}) });
          break;
        case "ludo_leave":
          await ctx.ludoManager.handleManage(socket, { op: "stand" });
          break;
        case "ludo_roll":
          await ctx.ludoManager.handleRollDice(socket);
          break;
        case "ludo_move":
          await ctx.ludoManager.handleMoveToken(socket, d);
          break;
      }
    },

    async handleBotBrbCmd(socket: Socket, rawData: unknown): Promise<void> {
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      await ctx.competitionEngine.handleCommand(socket, d);
    },

    async handleTalkingBotCmd(socket: Socket, cmd: string, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const powers = ctx.catalogStore.getPowers();
      const powerDef = getPowerDefinitionByName(powers, actor.rank || actor.power);
      const canManageBots =
        Boolean(powerDef && Number(powerDef.bootedit || 0)) || verAdminPanel(powers, actor.rank || actor.power);
      if (!canManageBots) return;

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      switch (cmd) {
        case "enterbot":
          if (d.id) {
            await ctx.talkingBotCoordinator.enterBot(String(d.id));
            emitNotice(socket, "تم إدخال البوت المحدد إلى الغرفة بنجاح 🤖");
          }
          break;
        case "enterbotall":
          await ctx.talkingBotCoordinator.enterAllBots();
          emitNotice(socket, "تم إدخال جميع البوتات إلى الغرفة بنجاح 🤖");
          break;
        case "exitbotall":
          await ctx.talkingBotCoordinator.exitAllBots();
          emitNotice(socket, "تم إخراج جميع البوتات من الغرفة بنجاح 🚪");
          break;
        case "deltbot": {
          const { db } = getDb();
          if (d.all) {
            await ctx.talkingBotCoordinator.exitAllBots();
            await db.delete(bots);
            emitNotice(socket, "تم حذف جميع البوتات بنجاح 🗑️");
          } else {
            const botId = String(d.id || d.botId || "").trim();
            const idregNum = Number.parseInt(String(d.idreg || 0), 10);
            if (botId) {
              await ctx.talkingBotCoordinator.exitBot(botId);
              await db.delete(bots).where(eq(bots.id, botId));
            } else if (Number.isFinite(idregNum) && idregNum > 0) {
              const rows = await db.select().from(bots).where(eq(bots.idreg, idregNum)).limit(1);
              if (rows[0]?.id) {
                await ctx.talkingBotCoordinator.exitBot(rows[0].id);
              }
              await db.delete(bots).where(eq(bots.idreg, idregNum));
            }
            emitNotice(socket, "تم حذف البوت المحدد بنجاح 🗑️");
          }
          break;
        }
        case "startbotchat":
          await ctx.talkingBotCoordinator.startTalkLoop(
            d.msg ? String(d.msg) : undefined,
            d.intervalMs ? Number(d.intervalMs) : undefined,
          );
          emitNotice(socket, "تم تشغيل المحادثة الآلية للبوتات بنجاح 💬");
          break;
        case "stopbotchat":
          ctx.talkingBotCoordinator.stopTalkLoop();
          emitNotice(socket, "تم إيقاف المحادثة الآلية للبوتات 🛑");
          break;
        case "addbots100":
          await ctx.talkingBotCoordinator.seedTalkingBots({ count: 100 });
          emitNotice(socket, "تمت إضافة 100 بوت ناطق بنجاح 🤖");
          break;
        case "addbots":
          await ctx.talkingBotCoordinator.seedTalkingBots({
            count: Number(d.count || 10),
            prefix: d.prefix ? String(d.prefix) : undefined,
            room: d.room ? String(d.room) : undefined,
            message: d.msg ? String(d.msg) : undefined,
          });
          emitNotice(socket, `تمت إضافة ${Number(d.count || 10)} بوت بنجاح 🤖`);
          break;
        case "sendmsgbot": {
          const botId = String(d.id || "").trim();
          const text = String(d.msg || "").trim();
          if (!botId || !text) break;
          const botSess = await ctx.presenceDirectory.getDistributedSession(botId);
          if (botSess && botSess.islogin === "بوت") {
            ctx.talkingBotCoordinator.sendBotRoomMessage(botSess, text);
          }
          break;
        }
      }
    },
  };
}
