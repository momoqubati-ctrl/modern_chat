import fs from "node:fs/promises";
import path from "node:path";
import {
  bars,
  desc,
  eq,
  getDb,
  getRedis,
  pushRecentChatMessage,
  storie,
  top10wall,
  users,
} from "@newchat/db";
import {
  CHAT_HISTORY_REDIS_LIMIT,
  CHAT_HISTORY_REDIS_TTL_SEC,
  TYPING_THROTTLE_MS,
  buildWallCardMessage,
  buildWallTextMessage,
  compactMessageData,
  normalizeRoomReplyPayload,
  parseRoomOwnerMeta,
  sanitizeHtmlText,
  stringGen,
  stripWallLinkFromText,
  verRoomsOwner,
} from "@newchat/shared";
import type { Socket } from "socket.io";
import { gatewayConfig } from "../config.js";
import { emitNotice, resolveContainedPath, safeJsonParse } from "../lib/socketUtils.js";
import type { GatewayContext, GatewaySession } from "../types/gateway.js";
import { loadInitialStories } from "./authHandlers.js";

const VOICE_MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
};

function sanitizeColorCss(value: unknown, fallback: string): string {
  const clean = sanitizeHtmlText(String(value ?? "").trim());
  return clean ? clean.slice(0, 64) : fallback;
}

function getEffectiveRank(catalogStore: GatewayContext["catalogStore"], sess: GatewaySession): number {
  return Number(catalogStore.getPowerRole(sess.rank || sess.power)?.rank || 0);
}

export function createMessagingHandlers(ctx: GatewayContext) {
  const floodWindowTrack = new Map<string, { lastText: string; count: number; lastAt: number }>();
  const typingCooldownMap = new Map<string, number>();

  return {
    async handleRoomChatMessage(socket: Socket, rawData: unknown): Promise<void> {
      // Cold-start protection: ensure catalog & services are ready on demand
      if (!ctx.catalogStore.isInitialized()) {
        try {
          await ctx.catalogStore.initialize();
        } catch (err) {
          console.warn("[Gateway:handleRoomChatMessage] Cold start lazy-init warning:", err);
        }
      }

      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.roomid || !rawData || typeof rawData !== "object") return;
      if (session.offline || session.ismuted || session.muted) {
        if (session.ismuted || session.muted) {
          emitNotice(socket, "أنت مكتوم ولا يمكنك إرسال رسائل حالياً");
        }
        return;
      }

      const d = rawData as Record<string, unknown>;
      let room = ctx.catalogStore.getRoomById(String(d.roomid || session.roomid));
      if (!room && !ctx.catalogStore.isInitialized()) {
        await ctx.catalogStore.initialize().catch(() => {});
        room = ctx.catalogStore.getRoomById(String(d.roomid || session.roomid));
      }
      if (!room) return;

      const ownerMeta = parseRoomOwnerMeta(room.room_owner_meta);
      if (ownerMeta.live_config?.chat_locked) {
        const isOwner =
          room.owner === session.username ||
          (session.idreg !== undefined && room.owner === `#${session.idreg}`);
        const isStaff =
          isOwner ||
          verRoomsOwner(ctx.catalogStore.getPowers(), session.rank || session.power);
        if (!isStaff) {
          emitNotice(socket, "الدردشة مقفلة حالياً من قبل المضيف");
          return;
        }
      }

      const rawText = String(d.msg || "").trim();
      const hasAttachment = Boolean(d.file || d.fileUrl);
      if (!rawText && !hasAttachment) return;

      const limits = ctx.catalogStore.getLimits();
      const maxLen = Math.max(50, limits.lengthMsgRoom);
      const slicedText = rawText.slice(0, maxLen);

      // Repetition / flood detection matching MaxRep rule
      const maxRep = Math.max(3, ctx.catalogStore.getOwnerState().maxRep || 3);
      const prevFlood = floodWindowTrack.get(socket.id);
      const now = Date.now();
      if (prevFlood && prevFlood.lastText === slicedText && now - prevFlood.lastAt < 10_000) {
        prevFlood.count += 1;
        prevFlood.lastAt = now;
        if (prevFlood.count >= maxRep && getEffectiveRank(ctx.catalogStore, session) === 0) {
          await ctx.securityGuard.autoBanFlooder(ctx.io, socket, session);
          return;
        }
      } else {
        floodWindowTrack.set(socket.id, { lastText: slicedText, count: 1, lastAt: now });
      }

      const scan = await ctx.securityGuard.scanAndLogProhibitedText(ctx.io, socket, slicedText, {
        source: `room:${room.id}`,
        target: room.topic,
      });

      const processedMsg = ctx.catalogStore.replaceShortcuts(sanitizeHtmlText(slicedText));
      const replyPayload = normalizeRoomReplyPayload(d.reply ?? d.replyTo);
      const mi = stringGen(14);
      const payload: Record<string, unknown> = {
        id: mi,
        mi,
        uid: session.uid || socket.id,
        lid: session.lid,
        topic: sanitizeHtmlText(session.topic),
        msg: processedMsg,
        pic: session.pic || "pic.png",
        power: session.power,
        bg: sanitizeColorCss(session.bg, "#FFFFFF"),
        gcol: sanitizeColorCss(session.gcol, "#FFFFFF"),
        ucol: sanitizeColorCss(session.ucol, "#000000"),
        mcol: sanitizeColorCss(session.mcol, "#000000"),
        ico: session.ico || "",
        gift_ico: session.gift_ico || "",
        documents: Boolean(session.documents || session.documentationc),
        documentationc: Boolean(session.documentationc || session.documents),
        roomid: room.id,
        time: now,
        likes: [],
        ...(replyPayload ? { reply: replyPayload, replyTo: replyPayload } : {}),
        ...(d.file ? { file: sanitizeHtmlText(String(d.file)).slice(0, 255) } : {}),
        ...(d.fileType ? { fileType: sanitizeHtmlText(String(d.fileType)).slice(0, 32) } : {}),
        ...(d._cid ? { _cid: String(d._cid).slice(0, 64) } : {}),
        ...(d._cts ? { _cts: Number(d._cts) || now } : {}),
        _srt: now,
        _sts: now,
      };

      const compact = compactMessageData(payload);

      if (scan.actionPath === "bmsgs") {
        socket.emit("msg", { cmd: "msg", data: compact });
      } else {
        ctx.io.to(room.id).emit("msg", { cmd: "msg", data: compact });
        await pushRecentChatMessage("room", room.id, compact, CHAT_HISTORY_REDIS_LIMIT, CHAT_HISTORY_REDIS_TTL_SEC).catch(
          () => undefined,
        );

        // @idreg mention alert sound notification
        const mentionMatch = slicedText.match(/@(\d{1,8})/);
        if (mentionMatch?.[1]) {
          const mentionedIdReg = Number.parseInt(mentionMatch[1], 10);
          for (const online of await ctx.presenceDirectory.getAllOnlineSessions()) {
            if (Number(online.idreg) === mentionedIdReg && online.id !== socket.id && !online.nonot) {
              ctx.io.to(online.id).emit("msg", {
                cmd: "not",
                data: {
                  topic: sanitizeHtmlText(session.topic),
                  force: 0,
                  msg: `أشار إليك ${sanitizeHtmlText(session.topic)} في غرفة ${sanitizeHtmlText(room.topic)}`,
                  user: socket.id,
                  sound: "mention",
                },
              });
            }
          }
        }
      }

      ctx.competitionEngine.checkAnswer("room", room.id, session, slicedText);

      if (session.islogin === "عضو") {
        const roomMemberCount = await ctx.presenceDirectory.getOnlineRoomMemberCount(room.id);
        void ctx.evaluationEngine.awardPoints(socket.id, "room_message", {
          message: slicedText,
          roomMemberCount,
        });
      }
    },

    async handleLikeRoomMessage(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.roomid || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const mi = String(d.mi || d.id || "").trim();
      if (!mi) return;

      const rate = await ctx.securityGuard.consumeRateSlot(`likemsg:${socket.id}`, 12, 15_000);
      if (!rate.ok) return;

      ctx.io.to(session.roomid).emit("msg", {
        cmd: "likemsg",
        data: {
          mi,
          id: session.id,
          uid: session.uid || session.lid,
          topic: sanitizeHtmlText(session.topic),
          roomid: session.roomid,
        },
      });
    },

    async handleDeleteRoomMessage(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.roomid) return;
      const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
      if (!powerDef || !Number(powerDef.delmsg || 0)) {
        emitNotice(socket, "لا تملك صلاحية حذف الرسائل");
        return;
      }

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const mi = String(typeof rawData === "string" ? rawData : d.mi || d.id || "").trim();
      if (!mi) return;

      ctx.io.to(session.roomid).emit("msg", { cmd: "delmsg", data: mi });
    },

    async handleWallBroadcast(
      socket: Socket,
      cmd: "bc" | "bc2",
      rawData: unknown,
    ): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      if (session.ismuted || session.muted) {
        emitNotice(socket, "أنت مكتوم حالياً");
        return;
      }

      const ownerState = ctx.catalogStore.getOwnerState();
      if (!ownerState.bars && !verRoomsOwner(ctx.catalogStore.getPowers(), session.rank || session.power)) {
        emitNotice(socket, "الحائط مغلق حالياً من قبل الإدارة");
        return;
      }

      const limits = ctx.catalogStore.getLimits();
      if (session.rep < limits.bclikes) {
        emitNotice(socket, `تحتاج إلى ${limits.bclikes} لايك للنشر على الحائط`);
        return;
      }

      // Per-user cooldown
      if (limits.wallminutes > 0 && getEffectiveRank(ctx.catalogStore, session) === 0) {
        const cooldownKey = `newchat:wall_cd:${session.uid || session.fp || socket.id}`;
        try {
          const redis = getRedis();
          const ttl = await redis.ttl(cooldownKey);
          if (ttl > 0) {
            emitNotice(socket, `انتظر ${Math.ceil(ttl / 60)} دقيقة قبل النشر مرة أخرى`);
            return;
          }
          await redis.set(cooldownKey, "1", "EX", Math.max(10, limits.wallminutes * 60));
        } catch {
          // ignore
        }
      }

      const d = rawData as Record<string, unknown>;
      const rawMsg = String(d.msg || "").trim();
      const rawLink = String(d.link || "").trim();
      const pic = sanitizeHtmlText(String(d.pic || session.pic || "pic.png")).slice(0, 250);
      if (!rawMsg && !rawLink && cmd !== "bc2") return;

      const scan = await ctx.securityGuard.scanAndLogProhibitedText(ctx.io, socket, rawMsg, {
        source: "wall",
        target: "public",
      });

      const strippedMsg = stripWallLinkFromText(rawMsg, rawLink).slice(0, limits.lengthMsgBar);
      const cleanMsg = strippedMsg
        ? ctx.catalogStore.replaceShortcuts(sanitizeHtmlText(strippedMsg))
        : "";

      const finalMsg =
        cmd === "bc2"
          ? buildWallCardMessage(cleanMsg, rawLink, limits.lengthMsgBar)
          : buildWallTextMessage(cleanMsg, rawLink, limits.lengthMsgBar);
      const bid = stringGen(14);
      const lid = session.lid || session.uid || socket.id;
      const uid = session.uid || socket.id;

      const postObj = {
        bid,
        lid,
        uid,
        topic: sanitizeHtmlText(session.topic).slice(0, 250),
        pic,
        msg: finalMsg,
        bg: sanitizeColorCss(session.bg, "#FFFFFF"),
        ucol: sanitizeColorCss(session.ucol, "#000000"),
        mcol: sanitizeColorCss(session.mcol, "#000000"),
        likes: [] as string[],
        bcc: [] as Array<Record<string, unknown>>,
        documents: Boolean(session.documents || session.documentationc),
        documentationc: Boolean(session.documentationc || session.documents),
      };

      if (scan.actionPath === "bmsgs") {
        socket.emit("msg", { cmd: "bc", data: postObj });
        return;
      }

      try {
        const { db } = getDb();
        await db.insert(bars).values({
          bid,
          lid,
          uid,
          topic: postObj.topic,
          pic: postObj.pic,
          msg: postObj.msg,
          bg: postObj.bg,
          ucol: postObj.ucol,
          mcol: postObj.mcol,
          likes: "[]",
          bcc: "[]",
        });

        await db.insert(top10wall).values({
          uid: lid,
          otype: "bc",
          pic: postObj.pic,
          topic: postObj.topic,
        });

        // Trim older bars beyond 30 and notify clients to remove oldest
        const overflowRows = await db
          .select({ id: bars.id, bid: bars.bid })
          .from(bars)
          .orderBy(desc(bars.id))
          .offset(30)
          .limit(20);
        for (const old of overflowRows) {
          await db.delete(bars).where(eq(bars.id, old.id));
          if (old.bid) {
            ctx.io.emit("msg", { cmd: "delbc", data: old.bid });
          }
        }
      } catch (err) {
        console.error("[Messaging] wall insert failed:", err);
      }

      ctx.io.emit("msg", { cmd: "bc", data: postObj });
      ctx.competitionEngine.checkAnswer("wall", "wall", session, rawMsg);

      if (session.islogin === "عضو") {
        void ctx.evaluationEngine.awardPoints(socket.id, "wall_post", { message: rawMsg });
      }
    },

    async handleDeleteWallPost(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const bid = String(typeof rawData === "string" ? rawData : d.bid || d.id || "").trim();
      if (!bid) return;

      const { db } = getDb();
      const rows = await db.select().from(bars).where(eq(bars.bid, bid)).limit(1);
      const row = rows[0];
      if (!row) return;

      const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
      const isAuthor =
        (row.uid && row.uid === session.uid) || (row.lid && row.lid === session.lid);
      const canDelete = isAuthor || Boolean(powerDef && Number(powerDef.delbc || 0));

      if (!canDelete) {
        emitNotice(socket, "لا تملك صلاحية حذف هذا المنشور");
        return;
      }

      await db.delete(bars).where(eq(bars.id, row.id));
      ctx.io.emit("msg", { cmd: "delbc", data: bid });
    },

    async handleWallComment(
      socket: Socket,
      cmd: "sco" | "sco_reply",
      rawData: unknown,
    ): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      if (session.ismuted || session.muted) {
        emitNotice(socket, "أنت مكتوم حالياً");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const bid = String(d.bid || "").trim();
      const commentText = String(d.msg || d.comment || "").trim().slice(0, 350);
      if (!bid || !commentText) return;

      const rate = await ctx.securityGuard.consumeRateSlot(`sco:${socket.id}`, 8, 15_000);
      if (!rate.ok) return;

      const { db } = getDb();
      const rows = await db.select().from(bars).where(eq(bars.bid, bid)).limit(1);
      const post = rows[0];
      if (!post) return;

      const existing = safeJsonParse<Array<Record<string, unknown>>>(post.bcc, []);
      const commentItem: Record<string, unknown> = {
        cid: stringGen(10),
        id: session.id,
        uid: session.uid || session.lid,
        topic: sanitizeHtmlText(session.topic),
        pic: session.pic || "pic.png",
        msg: ctx.catalogStore.replaceShortcuts(sanitizeHtmlText(commentText)),
        ucol: sanitizeColorCss(session.ucol, "#000000"),
        time: Date.now(),
        documents: Boolean(session.documents || session.documentationc),
        documentationc: Boolean(session.documentationc || session.documents),
        ...(cmd === "sco_reply" && d.replyToCid ? { replyToCid: String(d.replyToCid) } : {}),
      };

      const nextList = [...existing, commentItem].slice(-60);
      await db
        .update(bars)
        .set({ bcc: JSON.stringify(nextList) })
        .where(eq(bars.id, post.id));

      ctx.io.emit("msg", {
        cmd: cmd === "sco_reply" ? "bcco_reply" : "bcco",
        data: { bid, comment: commentItem, bcc: nextList },
      });
    },

    async handleLikeWallPost(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const bid = String(d.bid || "").trim();
      const stateVal = Number(d.state ?? d.type ?? 1) === 2 ? 2 : 1;
      if (!bid) return;

      const rate = await ctx.securityGuard.consumeRateSlot(`likebc:${socket.id}`, 15, 15_000);
      if (!rate.ok) return;

      const { db } = getDb();
      const rows = await db.select().from(bars).where(eq(bars.bid, bid)).limit(1);
      const post = rows[0];
      if (!post) return;

      const actorKey = session.uid || session.lid || session.fp || socket.id;
      const prefix = `${actorKey}:`;
      const likesList = safeJsonParse<string[]>(post.likes, []);
      const existingIdx = likesList.findIndex((x) => String(x) === actorKey || String(x).startsWith(prefix));
      const hadState2 = existingIdx !== -1 && likesList[existingIdx] === `${actorKey}:2`;
      let nextState2Delta = 0;

      if (existingIdx !== -1) {
        const existingVal = likesList[existingIdx]!;
        if (existingVal === `${actorKey}:${stateVal}` || (stateVal === 1 && existingVal === actorKey)) {
          likesList.splice(existingIdx, 1);
          if (hadState2) nextState2Delta = -1;
        } else {
          likesList[existingIdx] = `${actorKey}:${stateVal}`;
          if (!hadState2 && stateVal === 2) nextState2Delta = 1;
          if (hadState2 && stateVal !== 2) nextState2Delta = -1;
        }
      } else {
        likesList.push(`${actorKey}:${stateVal}`);
        if (stateVal === 2) nextState2Delta = 1;
      }

      // Guard DB varchar(2000) column limit safely
      let serializedLikes = JSON.stringify(likesList);
      while (serializedLikes.length > 1990 && likesList.length > 0) {
        likesList.shift();
        serializedLikes = JSON.stringify(likesList);
      }

      await db.update(bars).set({ likes: serializedLikes }).where(eq(bars.id, post.id));

      if (nextState2Delta !== 0 && post.uid) {
        try {
          const authorRows = await db.select().from(users).where(eq(users.uid, post.uid)).limit(1);
          const author = authorRows[0];
          if (author) {
            const nextAuthorLikes = Math.max(0, Number(author.wall_post_likes || 0) + nextState2Delta);
            await db
              .update(users)
              .set({ wall_post_likes: nextAuthorLikes })
              .where(eq(users.idreg, author.idreg));
            for (const sid of await ctx.presenceDirectory.getAllSocketIdsByUid(author.uid || "")) {
              await ctx.presenceDirectory.patchSession(sid, { wall_post_likes: nextAuthorLikes });
            }
          }
        } catch {
          // non-fatal
        }
      }

      const like2Count = likesList.filter((x) => String(x).endsWith(":2")).length;
      ctx.io.emit("msg", {
        cmd: "bc^",
        data: { bid, likes: serializedLikes, like2_count: like2Count },
      });
    },

    async handlePrivateMessage(
      socket: Socket,
      cmd: "pm" | "pmsg" | "ppmsg",
      rawData: unknown,
    ): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      if (session.ismuted || session.muted) {
        emitNotice(socket, "أنت مكتوم ولا يمكنك إرسال رسائل خاصة");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const targetId = String(d.id || d.to || d.targetId || "").trim();
      const rawText = String(d.msg || "").trim();
      if (!targetId || (!rawText && !d.file)) return;
      if (targetId === socket.id) return;

      // Flood guard: room chat has rep/autoban protection; PMs get a hard rate slot.
      const pmRate = await ctx.securityGuard.consumeRateSlot(`pmsg:${socket.id}`, 20, 15_000);
      if (!pmRate.ok) return;

      const limits = ctx.catalogStore.getLimits();
      const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
      const canForcePm = Boolean(powerDef && Number(powerDef.forcepm || 0));

      if (session.rep < limits.pmlikes && !canForcePm) {
        emitNotice(socket, `تحتاج إلى ${limits.pmlikes} نقطة لإرسال الرسائل الخاصة`);
        return;
      }

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target || target.offline || target.islogin === "بوت") {
        emitNotice(socket, "المستخدم غير متصل بالانترنت في الوقت الحالي");
        return;
      }

      if (target.nopm && !canForcePm) {
        emitNotice(socket, "هذا العضو مغلق للرسائل الخاصة");
        return;
      }

      const sliced = rawText.slice(0, Math.max(50, limits.lengthMsgPm));

      // Fail-closed verification for private messages (processTextStrict)
      const strictCheck = ctx.catalogStore.getFilterService().processTextStrict(sliced);
      if (!strictCheck.allowed) {
        if (strictCheck.matchedWord) {
          await ctx.securityGuard.scanAndLogProhibitedText(ctx.io, socket, sliced, {
            source: "pm",
            target: target.topic,
          });
        }
        emitNotice(socket, strictCheck.reason || "تم منع إرسال الرسالة لاحتوائها على عبارات محظورة");
        return;
      }

      const scan = await ctx.securityGuard.scanAndLogProhibitedText(ctx.io, socket, sliced, {
        source: "pm",
        target: target.topic,
      });
      if (scan.actionPath === "bmsgs") return;

      const cleanMsg = ctx.catalogStore.replaceShortcuts(sanitizeHtmlText(sliced));
      const payload = {
        id: socket.id,
        from: socket.id,
        to: targetId,
        uid: session.uid || session.lid,
        topic: sanitizeHtmlText(session.topic),
        pic: session.pic || "pic.png",
        msg: cleanMsg,
        bg: sanitizeColorCss(session.bg, "#FFFFFF"),
        ucol: sanitizeColorCss(session.ucol, "#000000"),
        mcol: sanitizeColorCss(session.mcol, "#000000"),
        time: Date.now(),
        documents: Boolean(session.documents || session.documentationc),
        documentationc: Boolean(session.documentationc || session.documents),
        ...(d.file ? { file: sanitizeHtmlText(String(d.file)).slice(0, 255) } : {}),
        ...(d.fileType ? { fileType: sanitizeHtmlText(String(d.fileType)).slice(0, 32) } : {}),
      };

      const outCmd = cmd === "ppmsg" ? "ppmsg" : "pmsg";
      ctx.io.to(targetId).emit("msg", { cmd: outCmd, data: payload });

      if (session.islogin === "عضو") {
        void ctx.evaluationEngine.awardPoints(socket.id, "private_message", {
          message: sliced,
          targetSocketId: targetId,
        });
      }
    },

    async handlePmSeen(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const targetId = String(d.id || d.to || "").trim();
      if (!targetId || targetId === socket.id) return;

      const rate = await ctx.securityGuard.consumeRateSlot(`pmseen:${socket.id}`, 60, 10_000);
      if (!rate.ok) return;

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target || target.offline) return;

      ctx.io.to(target.id).emit("msg", {
        cmd: "pm_seen",
        data: { from: socket.id, uid: session.uid || session.lid || "", at: Date.now() },
      });
    },

    async handlePublicNoticeCmd(
      socket: Socket,
      cmd: "pmsghide" | "ppmsghide",
      rawData: unknown,
    ): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
      const isAllowed =
        cmd === "ppmsghide"
          ? Boolean(powerDef && Number(powerDef.publicmsghide || 0))
          : Boolean(powerDef && Number(powerDef.publicmsg || 0));
      if (!isAllowed) {
        emitNotice(socket, "لا تملك صلاحية إرسال إعلان عام");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const msgText = ctx.catalogStore.replaceShortcuts(
        sanitizeHtmlText(String(d.msg || "").trim().slice(0, 400)),
      );
      if (!msgText) return;

      ctx.io.emit("msg", {
        cmd,
        data: {
          id: socket.id,
          topic: cmd === "ppmsghide" ? "إعلان إداري" : sanitizeHtmlText(session.topic),
          pic: session.pic || "pic.png",
          msg: msgText,
          time: Date.now(),
        },
      });
    },

    async handleToggleNoNot(socket: Socket): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;
      const next = !session.nonot;
      await ctx.presenceDirectory.patchSession(socket.id, { nonot: next });
      emitNotice(socket, next ? "تم إيقاف التنبيهات" : "تم تفعيل التنبيهات");
    },

    async handleToggleNoPm(socket: Socket): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;
      const next = !session.nopm;
      await ctx.presenceDirectory.patchSession(socket.id, { nopm: next });
      emitNotice(socket, next ? "تم إغلاق الخاص" : "تم فتح الخاص");
    },

    async handleSaveStoryEvent(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || session.islogin !== "عضو" || !session.uid || !rawData || typeof rawData !== "object") {
        if (session && session.islogin !== "عضو") {
          emitNotice(socket, "هذه الميزة متاحة للأعضاء المسجلين فقط");
        }
        return;
      }

      if (session.ismuted || session.muted) {
        emitNotice(socket, "أنت مكتوم ولا يمكنك نشر قصص حالياً");
        return;
      }

      const rate = await ctx.securityGuard.consumeRateSlot(`story:pub:${session.uid}`, 12, 300_000);
      if (!rate.ok) {
        emitNotice(socket, "يرجى الانتظار قليلاً قبل نشر قصة جديدة");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const rawType = String(d.type || d.mediaType || "image").trim().toLowerCase();
      const storyType: "text" | "image" | "video" =
        rawType === "text" ? "text" : rawType === "video" ? "video" : "image";

      const rawMediaUrl = String(d.link || d.url || d.src || d.mediaUrl || "").trim();
      const mediaUrl =
        storyType === "text"
          ? ""
          : sanitizeHtmlText(rawMediaUrl).slice(0, 255);

      if (storyType !== "text") {
        if (
          !mediaUrl ||
          (!mediaUrl.startsWith("/") && !mediaUrl.startsWith("https://") && !mediaUrl.startsWith("http://"))
        ) {
          emitNotice(socket, "يرجى اختيار صورة أو فيديو صالح للقصة");
          return;
        }
      }

      const caption = sanitizeHtmlText(String(d.caption || d.text || "").trim()).slice(0, 500);
      if (storyType === "text" && !caption) {
        emitNotice(socket, "يرجى كتابة نص للقصة");
        return;
      }
      if (storyType === "text" && /https?:\/\/[^\s]+/i.test(caption)) {
        emitNotice(socket, "لا يُسمح بإدراج روابط في النص");
        return;
      }
      if (caption && ctx.catalogStore.scanProhibitedWords(caption)) {
        emitNotice(socket, "يحتوي النص على كلمات غير مسموح بها");
        return;
      }

      const rawBg = String(d.bgColor || "").trim();
      const bgColor =
        storyType === "text" && /^linear-gradient\(135deg,\s*#[0-9a-fA-F]{3,8},\s*#[0-9a-fA-F]{3,8}\)$/.test(rawBg)
          ? rawBg
          : storyType === "text"
            ? "linear-gradient(135deg,#667eea,#764ba2)"
            : "";

      const rawTextColor = String(d.textColor || "").trim();
      const textColor =
        storyType === "text" && /^#[0-9a-fA-F]{3,8}$/.test(rawTextColor)
          ? rawTextColor
          : storyType === "text"
            ? "#ffffff"
            : "";

      const { db } = getDb();
      const rows = await db.select().from(storie).where(eq(storie.sid, session.uid)).limit(1);
      const nowMs = Date.now();
      const nowStr = String(nowMs);
      const newEntry: Record<string, unknown> = {
        id: stringGen(10),
        type: storyType,
        src: mediaUrl,
        ...(caption ? { caption } : {}),
        ...(bgColor ? { bgColor } : {}),
        ...(textColor ? { textColor } : {}),
        length: Math.max(3, Math.min(30, Number(d.length || (storyType === "video" ? 15 : 6)) || 6)),
        time: nowMs,
      };

      const previewLink = mediaUrl || `text:${caption.slice(0, 60)}`;

      if (rows[0]) {
        const items = safeJsonParse<Array<Record<string, unknown>>>(rows[0].item, []);
        items.push(newEntry);
        await db
          .update(storie)
          .set({
            photo: session.pic || "pic.png",
            name: sanitizeHtmlText(session.topic).slice(0, 250),
            link: previewLink.slice(0, 250),
            lastUpdated: nowStr,
            item: JSON.stringify(items.slice(-15)),
          })
          .where(eq(storie.id, rows[0].id));
      } else {
        await db.insert(storie).values({
          sid: session.uid,
          photo: session.pic || "pic.png",
          name: sanitizeHtmlText(session.topic).slice(0, 250),
          link: previewLink.slice(0, 250),
          lastUpdated: nowStr,
          item: JSON.stringify([newEntry]),
          seen: false,
          currentPreview: "[]",
        });
      }

      const [senderStories, publicStories] = await Promise.all([
        loadInitialStories(session.uid),
        loadInitialStories(),
      ]);
      socket.emit("msg", { cmd: "stori", data: senderStories });
      socket.broadcast.emit("msg", { cmd: "stories", data: publicStories });
    },

    async handleSendVoice(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      if (session.ismuted || session.muted) {
        emitNotice(socket, "أنت مكتوم حالياً");
        return;
      }

      const limits = ctx.catalogStore.getLimits();
      if (session.rep < limits.fileslikes) {
        emitNotice(socket, `تحتاج إلى ${limits.fileslikes} نقطة لإرسال المقاطع الصوتية`);
        return;
      }

      const rate = await ctx.securityGuard.consumeRateSlot(`voice:${socket.id}`, 6, 20_000);
      if (!rate.ok) return;

      const d = rawData as Record<string, unknown>;
      const rawAudio = String(d.audio || d.data || d.voice || "").trim();
      if (!rawAudio) return;

      let mime = String(d.mime || "audio/webm").toLowerCase().split(";")[0]!.trim();
      let base64Body = rawAudio;
      const dataUrlMatch = rawAudio.match(/^data:([^;,]+);base64,(.+)$/is);
      if (dataUrlMatch?.[1] && dataUrlMatch[2]) {
        mime = dataUrlMatch[1].toLowerCase().trim();
        base64Body = dataUrlMatch[2];
      }

      const ext = VOICE_MIME_TO_EXT[mime];
      if (!ext) {
        emitNotice(socket, "صيغة الصوت غير مدعومة");
        return;
      }

      const buffer = Buffer.from(base64Body, "base64");
      if (buffer.length === 0 || buffer.length > gatewayConfig.maxVoiceBytes) {
        emitNotice(socket, "حجم التسجيل الصوتي يتجاوز الحد المسموح (3 ميجابايت)");
        return;
      }

      const recorderDir = path.join(gatewayConfig.uploadDir, "recorder");
      await fs.mkdir(recorderDir, { recursive: true });
      const fileName = `voice_${Date.now()}_${stringGen(8)}.${ext}`;
      const targetPath = resolveContainedPath(recorderDir, fileName);
      if (!targetPath) return;

      await fs.writeFile(targetPath, buffer);
      const publicUrl = `/recorder/${fileName}`;
      const targetId = String(d.to || d.targetId || "").trim();

      if (targetId) {
        const pmPayload = {
          id: socket.id,
          from: socket.id,
          to: targetId,
          uid: session.uid || session.lid,
          topic: sanitizeHtmlText(session.topic),
          pic: session.pic || "pic.png",
          msg: "",
          file: publicUrl,
          fileType: "audio",
          time: Date.now(),
        };
        ctx.io.to(targetId).emit("msg", {
          cmd: "pmsg",
          data: pmPayload,
        });
        socket.emit("msg", {
          cmd: "pmsg",
          data: { ...pmPayload, self: true },
        });
      } else if (session.roomid) {
        const mi = stringGen(14);
        const msgObj = compactMessageData({
          id: mi,
          mi,
          uid: session.uid || socket.id,
          topic: sanitizeHtmlText(session.topic),
          pic: session.pic || "pic.png",
          msg: "",
          file: publicUrl,
          fileType: "audio",
          roomid: session.roomid,
          time: Date.now(),
        });
        ctx.io.to(session.roomid).emit("msg", { cmd: "msg", data: msgObj });
        await pushRecentChatMessage(
          "room",
          session.roomid,
          msgObj,
          CHAT_HISTORY_REDIS_LIMIT,
          CHAT_HISTORY_REDIS_TTL_SEC,
        ).catch(() => undefined);
      }
    },

    handleTypingEvent(socket: Socket, isTyping: boolean, rawData: unknown): void {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || session.stealth) return;

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const targetId = String(d.to || d.targetId || "").trim();
      if (targetId) {
        if (isTyping) {
          ctx.io.to(targetId).emit("msg", {
            cmd: "typing",
            data: { id: socket.id, from: socket.id, topic: sanitizeHtmlText(session.topic), pm: true },
          });
        } else {
          ctx.io.to(targetId).emit("msg", {
            cmd: "stopTyping",
            data: { id: socket.id, from: socket.id, pm: true },
          });
        }
        return;
      }

      const roomId = String(typeof rawData === "string" ? rawData : d.room || session.roomid || "").trim();
      if (!roomId) return;

      if (isTyping) {
        const now = Date.now();
        const prev = typingCooldownMap.get(socket.id) || 0;
        if (now - prev < TYPING_THROTTLE_MS) return;
        typingCooldownMap.set(socket.id, now);
        socket.to(roomId).emit("msg", {
          cmd: "typing",
          data: { id: socket.id, topic: sanitizeHtmlText(session.topic), roomid: roomId },
        });
      } else {
        socket.to(roomId).emit("msg", {
          cmd: "stopTyping",
          data: { id: socket.id, roomid: roomId },
        });
      }
    },
  };
}
