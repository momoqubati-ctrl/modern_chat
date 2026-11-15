import { and, eq, getDb, getRecentChatMessages, getRedis, room_welcome_visits, rooms, users } from "@newchat/db";
import {
  MIC_SLOT_COUNT,
  compactMessageData,
  getSystemRoomOwner,
  normalizeLiveRoomConfig,
  normalizeRoomMessageMode,
  normalizeRoomOwnerAssignment,
  normalizeRoomOwnerBadge,
  parseRoomOwnerMeta,
  roomJoinSchema,
  sanitizeHtmlText,
  stringGen,
  upsertRoomOwnerAssignment,
  verRoomsOwner,
  verStealthPanel,
} from "@newchat/shared";
import type { Socket } from "socket.io";
import { gatewayConfig } from "../config.js";
import { emitNotice, sanitizePublicRoom } from "../lib/socketUtils.js";
import { normalizeSlotLocks } from "../services/micStageManager.js";
import type { GatewayContext, GatewayRoomRecord, GatewaySession } from "../types/gateway.js";

async function cleanupEmptyTemporaryRoom(
  ctx: GatewayContext,
  roomId: string | null | undefined,
): Promise<void> {
  const targetId = String(roomId || "").trim();
  if (!targetId) return;
  const room = ctx.catalogStore.getRoomById(targetId);
  if (!room || !room.deleted) return;

  const remaining = await ctx.presenceDirectory.getOnlineRoomMemberCount(targetId);
  if (remaining > 0) return;

  try {
    const { db } = getDb();
    await db.delete(rooms).where(eq(rooms.id, targetId));
  } catch {
    // non-fatal
  }
  ctx.catalogStore.removeRoomLocal(targetId);
  await ctx.micStageManager.clearRoomLikes(targetId);
  ctx.io.emit("msg", { cmd: "r-", data: targetId });
}

export async function emitRoomWelcomeToSocket(
  ctx: GatewayContext,
  socket: Socket,
  session: GatewaySession,
  room: GatewayRoomRecord,
  opts?: { minTimestamp?: number },
): Promise<void> {
  const welcomeText = String(room.welcome || "").trim();
  if (!welcomeText) return;

  try {
    const identityKey = session.uid || session.lid || session.fp || session.id;
    const now = Date.now();
    const { db } = getDb();
    const existing = await db
      .select()
      .from(room_welcome_visits)
      .where(
        and(
          eq(room_welcome_visits.room_id, room.id),
          eq(room_welcome_visits.identity_key, identityKey),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(room_welcome_visits)
        .set({ last_seen: now, visits: Number(existing[0].visits || 0) + 1 })
        .where(eq(room_welcome_visits.id, existing[0].id));
    } else {
      await db.insert(room_welcome_visits).values({
        room_id: room.id,
        identity_key: identityKey,
        is_guest: session.islogin !== "عضو",
        first_seen: now,
        last_seen: now,
        visits: 1,
      });
    }
  } catch {
    // non-fatal welcome tracking
  }

  const welcomeTs = Math.max(Date.now(), Number(opts?.minTimestamp || 0));

  socket.emit("msg", {
    cmd: "msg",
    data: {
      bg: "#FFFFFF",
      class: "room-welcome-msg",
      mi: stringGen(14),
      mcol: "#1e293b",
      uid: "",
      msg: ctx.catalogStore.replaceShortcuts(sanitizeHtmlText(welcomeText)),
      pic: room.pic || "pic.png",
      topic: sanitizeHtmlText(room.topic),
      ucol: "#0f766e",
      roomid: room.id,
      time: welcomeTs,
    },
  });
}

async function resolveOwnerTarget(
  rawTarget: unknown,
): Promise<{
  error?: string;
  userId?: string;
  userUser?: string;
  userTopic?: string;
} | null> {
  const targetText = String(rawTarget || "").trim();
  if (!targetText || targetText.toLowerCase() === "system") return null;

  const { db } = getDb();
  if (targetText.startsWith("#")) {
    const numericId = Number.parseInt(targetText.slice(1), 10);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return { error: "تعذر العثور على مالك الغرفة المطلوب" };
    }
    const rows = await db.select().from(users).where(eq(users.idreg, numericId)).limit(1);
    const u = rows[0];
    if (!u) return { error: "تعذر العثور على مالك الغرفة المطلوب" };
    return { userId: `#${u.idreg}`, userUser: u.username, userTopic: u.topic };
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, targetText.toLowerCase()))
    .limit(1);
  const u = rows[0];
  if (!u) return { error: "تعذر العثور على مالك الغرفة المطلوب" };
  return { userId: `#${u.idreg}`, userUser: u.username, userTopic: u.topic };
}

export async function performRoomJoin(
  ctx: GatewayContext,
  socket: Socket,
  session: GatewaySession,
  targetRoomId: string,
  passwordInput = "",
  opts?: { initialEntry?: boolean },
): Promise<boolean> {
  const room = ctx.catalogStore.getRoomById(targetRoomId);
  if (!room) {
    emitNotice(socket, "الغرفة غير موجودة");
    return false;
  }

  const powers = ctx.catalogStore.getPowers();
  const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
  const myRoomId = session.roomid || "";
  const isOwnerMatch =
    room.owner === session.username ||
    (session.idreg !== undefined && room.owner.replace(/^#/, "") === String(session.idreg).replace(/^#/, ""));
  const canBypassLimits = isOwnerMatch || verStealthPanel(powers, session.rank || session.power) || Boolean(powerDef && Number(powerDef.rooms || 0));

  if (!opts?.initialEntry) {
    try {
      const bannedFlag = await getRedis().get(`newchat:room_ban:${room.id}:${session.fp}`);
      if (bannedFlag && !canBypassLimits) {
        emitNotice(socket, "تم طردك من هذه الغرفة");
        return false;
      }
    } catch {
      // ignore redis read failure
    }

    if (room.needpass && !canBypassLimits && room.pass && room.pass !== passwordInput) {
      emitNotice(socket, "الرقم السري لدخول الغرفة خاطئ");
      return false;
    }

    if (room.rmli > 0 && session.rep < room.rmli && !canBypassLimits) {
      emitNotice(socket, `${room.rmli} عدد الايكات المطلوبة لدخول الغرفة`);
      return false;
    }

    if (room.max > 0 && myRoomId !== room.id && !canBypassLimits) {
      const currentMembers = await ctx.presenceDirectory.getOnlineRoomMemberCount(room.id);
      if (currentMembers >= room.max) {
        emitNotice(socket, "الغرفة ممتلئة حالياً");
        return false;
      }
    }
  }

  if (myRoomId === room.id && !opts?.initialEntry) {
    const count = await ctx.presenceDirectory.getOnlineRoomMemberCount(room.id);
    socket.emit("msg", { cmd: "rjoin", data: sanitizePublicRoom(room, count) });
    await ctx.micStageManager.emitStateToSocket(socket, room.id);
    await ctx.carromManager.emitStateToSocket(socket, room.id);
    await ctx.ludoManager.emitStateToSocket(socket, room.id);
    ctx.competitionEngine.emitRoomState(room.id);
    return true;
  }

  if (myRoomId && myRoomId !== room.id) {
    await ctx.micStageManager.clearUserFromStage(myRoomId, socket.id, { evictFromMediaRoom: true });
    await ctx.carromManager.syncRoomGame(myRoomId);
    await ctx.ludoManager.syncRoomGame(myRoomId);
    if (!session.stealth) {
      socket.to(myRoomId).emit("msg", {
        cmd: "msg",
        data: {
          bg: "none",
          class: "hmsg",
          mi: stringGen(14),
          id: session.id,
          topic: sanitizeHtmlText(session.topic),
          msg: "هذا المستخدم انتقل الى",
          actionType: "room_move",
          targetRoomId: room.id,
          targetRoomTopic: sanitizeHtmlText(room.topic),
          roomid: room.id,
          pic: session.pic,
          uid: socket.id,
          time: Date.now(),
        },
      });
    }
  }

  await ctx.presenceDirectory.moveUserToRoom(socket, session, room.id);

  if (myRoomId && myRoomId !== room.id) {
    await cleanupEmptyTemporaryRoom(ctx, myRoomId);
  }

  const nextCount = await ctx.presenceDirectory.getOnlineRoomMemberCount(room.id);
  socket.emit("msg", { cmd: "rjoin", data: sanitizePublicRoom(room, nextCount) });

  const joinTs = Date.now();

  if (!session.stealth) {
    ctx.io.to(room.id).emit("msg", {
      cmd: "msg",
      data: {
        bg: "none",
        class: "hmsg",
        mi: stringGen(14),
        id: session.id,
        topic: sanitizeHtmlText(session.topic),
        msg: "هذا المستخدم قد دخل الغرفة",
        actionType: "room_join",
        targetRoomId: room.id,
        targetRoomTopic: sanitizeHtmlText(room.topic),
        roomid: room.id,
        pic: session.pic,
        uid: socket.id,
        time: joinTs,
      },
    });
  }

  if (room.broadcast) {
    ctx.io.to(room.id).emit("broadcasting", { cmd: "rjoin", user: socket.id, roomid: room.id });
  }

  await emitRoomWelcomeToSocket(ctx, socket, session, room, { minTimestamp: joinTs + 5 });
  await ctx.micStageManager.emitStateToSocket(socket, room.id);
  await ctx.carromManager.emitStateToSocket(socket, room.id);
  await ctx.ludoManager.emitStateToSocket(socket, room.id);
  ctx.competitionEngine.emitRoomState(room.id);
  return true;
}

export function createRoomHandlers(ctx: GatewayContext) {
  return {
    async handleRoomJoin(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;
      const parsed = roomJoinSchema.safeParse(rawData);
      if (!parsed.success) return;

      const targetId = parsed.data.id.trim();
      const pass = String(parsed.data.pwd || parsed.data.pass || "").trim();
      const joined = await performRoomJoin(ctx, socket, session, targetId, pass);
      if (joined) {
        const history = await getRecentChatMessages<Record<string, unknown>>("room", targetId, 30).catch(() => []);
        if (history.length > 0) {
          socket.emit("msg", {
            cmd: "msg_batch",
            data: history.map((m) => compactMessageData(m)),
          });
        }
      }
    },

    async handleCreateRoom(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;

      const isVoiceRoom = Boolean(d.is_live_audio || d.room_type === "live_audio" || d.isVoiceLive);
      const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
      if (isVoiceRoom) {
        const hasVoicePerm = Boolean(
          powerDef && (
            Number(powerDef.can_create_voice_room || 0) ||
            Number(powerDef.owner || 0) ||
            Number(powerDef.cp || 0)
          )
        );
        if (!hasVoicePerm) {
          emitNotice(socket, "لا تملك صلاحية إنشاء قناة صوتية");
          return;
        }
      } else if (!powerDef || !Number(powerDef.createroom || 0)) {
        emitNotice(socket, "لا تملك صلاحية انشاء غرف");
        return;
      }

      if (ctx.catalogStore.getRooms().length >= gatewayConfig.maxRooms) {
        emitNotice(socket, "تم إنشاء الحد الاقصى لرومات");
        return;
      }

      const topic = sanitizeHtmlText(String(d.topic || "").trim().slice(0, 80));
      const about = sanitizeHtmlText(String(d.about || (isVoiceRoom ? "قناة صوتية مباشرة" : "")).trim().slice(0, 200));
      const welcome = sanitizeHtmlText(String(d.welcome || (isVoiceRoom ? "مرحباً بكم في البث الصوتي المباشر" : "")).trim().slice(0, 250));
      if (!topic || !about || !welcome) return;

      const duplicate = ctx.catalogStore.getRooms().some(
        (r) => r.topic.trim().toLowerCase() === topic.trim().toLowerCase(),
      );
      if (duplicate) {
        emitNotice(socket, "يوجد غرفة تحمل نفس الاسم");
        return;
      }

      const maxNum = Number.parseInt(String(d.max ?? 100), 10);
      const safeMax = Number.isFinite(maxNum) ? Math.max(2, Math.min(500, maxNum)) : 100;

      const rate = await ctx.securityGuard.consumeRateSlot(`rplus:${socket.id}`, 4, 30_000);
      if (!rate.ok) return;

      const micCountRaw = Number.parseInt(String(d.stage_count ?? d.mic ?? (isVoiceRoom ? 12 : MIC_SLOT_COUNT)), 10);
      const stageCount = Number.isFinite(micCountRaw)
        ? Math.max(isVoiceRoom ? 2 : 0, Math.min(MIC_SLOT_COUNT, micCountRaw))
        : (isVoiceRoom ? 12 : MIC_SLOT_COUNT);
      const normalizedLocks = normalizeSlotLocks(d.micLocks);
      const messageMode = normalizeRoomMessageMode(d.message_mode);
      const pass = String(d.pass || "").trim().slice(0, 120);
      const needpass = Boolean(pass);
      const broadcast = isVoiceRoom ? true : Boolean(d.broadcast);
      const isTemporary = Boolean(d.delete ?? d.deleted ?? true);
      const pic = sanitizeHtmlText(String(d.pic || (isVoiceRoom && session.pic ? session.pic : "pic.png")).trim().slice(0, 250)) || "pic.png";
      const color = sanitizeHtmlText(String(d.color || "#000000").trim().slice(0, 32)) || "#000000";
      const rmli = Math.max(0, Number.parseInt(String(d.like ?? d.rmli ?? 0), 10) || 0);

      const sysOwner = getSystemRoomOwner();
      const ownerMeta = parseRoomOwnerMeta(sysOwner.meta);
      if (isVoiceRoom && session.idreg) {
        ownerMeta.ownerId = `#${session.idreg}`;
        ownerMeta.ownerUser = session.username;
        ownerMeta.ownerTopic = session.topic;
      }
      if (isVoiceRoom) {
        ownerMeta.live_config = normalizeLiveRoomConfig({
          is_live_audio: true,
          join_mode: d.join_mode === "request" ? "request" : "free",
          chat_locked: false,
          gift_goal: d.gift_goal,
          pinned_notice: d.pinned_notice || "مباشر وفي الوقت الفعلي، يلزم أن يكون عمر المذيعين 18 عاماً أو أكثر لبدء بث مباشر، ويلزم أن يكون عمر المشاهدين 18 عاماً أو أكثر لشحن الرصيد وإرسال الهدايا. تذكر اتباع إرشادات المجتمع لدينا.",
          hourly_rank: d.hourly_rank || "🔥 ترتيب كل ساعة",
        });
      }
      const selectedBadgeId = String(d.ownerBadgeId || "").trim();
      const selectedBadge = ctx.catalogStore.getRoomBadgeById(selectedBadgeId);
      ownerMeta.badge_id = selectedBadge ? selectedBadge.id : "";
      ownerMeta.badge = normalizeRoomOwnerBadge(selectedBadge || d.ownerBadge || {});
      const ownerMetaJson = JSON.stringify(ownerMeta);
      const roomOwnerId = isVoiceRoom && session.idreg ? `#${session.idreg}` : (session.username || sysOwner.owner);

      const newRoomId = stringGen(10);
      const { db } = getDb();
      const [created] = await db
        .insert(rooms)
        .values({
          id: newRoomId,
          topic,
          about,
          welcome,
          user: sanitizeHtmlText(session.topic).slice(0, 250),
          pass,
          needpass,
          broadcast,
          deleted: isTemporary,
          owner: roomOwnerId,
          pic,
          rmli,
          max: safeMax,
          color,
          mic: stageCount,
          stage_count: stageCount,
          stage_state: JSON.stringify(normalizedLocks),
          message_mode: messageMode,
          room_owner_meta: ownerMetaJson,
        })
        .returning();

      if (!created) return;

      const record: GatewayRoomRecord = {
        id: newRoomId,
        idroom: created.idroom,
        topic,
        about,
        pic,
        welcome,
        owner: roomOwnerId,
        pass,
        user: sanitizeHtmlText(session.topic),
        needpass,
        broadcast,
        deleted: isTemporary,
        color,
        max: safeMax,
        rmli,
        mic: stageCount,
        stage_count: stageCount,
        stage_state: normalizedLocks,
        message_mode: messageMode,
        room_owner_meta: ownerMeta,
      };

      ctx.catalogStore.upsertRoomLocal(record);
      await ctx.micStageManager.applyLocks(newRoomId, normalizedLocks);

      await ctx.securityGuard.recordModerationStat({
        state: isVoiceRoom ? "انشاء بث صوتي" : "انشاء غرفه",
        topic: session.topic,
        targetTopic: session.username,
        room: topic,
        ip: session.ip,
      });

      const pub = sanitizePublicRoom(record, 0);
      ctx.io.emit("msg", {
        cmd: "r+",
        data: {
          ...pub,
          delete: pub.deleted,
          micLocks: normalizedLocks,
          live_config: ownerMeta.live_config,
          is_live_audio: isVoiceRoom,
          join_mode: ownerMeta.live_config?.join_mode || "free",
        },
      });

      if (isVoiceRoom) {
        await performRoomJoin(ctx, socket, session, newRoomId, pass);
        await ctx.micStageManager.handleTakeSlot(socket, newRoomId, 1);
      }

      socket.emit("msg", {
        cmd: "voice_room_created",
        data: {
          id: newRoomId,
          topic,
          is_live_audio: isVoiceRoom,
        },
      });
    },

    async handleEditRoom(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;

      const roomId = String(d.id || "").trim();
      const topic = sanitizeHtmlText(String(d.topic || "").trim().slice(0, 80));
      const about = sanitizeHtmlText(String(d.about || "").trim().slice(0, 200));
      const welcome = sanitizeHtmlText(String(d.welcome || "").trim().slice(0, 250));
      if (!roomId || !topic || !about || !welcome) return;

      const currentRoom = ctx.catalogStore.getRoomById(roomId);
      if (!currentRoom) {
        emitNotice(socket, "الغرفة غير موجودة");
        return;
      }

      const actorReg = session.idreg ? String(session.idreg).replace(/^#/, "") : "";
      const roomOwnerNorm = String(currentRoom.owner || "").replace(/^#/, "");
      const isAssignedOwner = Boolean(actorReg && roomOwnerNorm && actorReg === roomOwnerNorm);
      const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
      const hasCreateRoom = Boolean(powerDef && Number(powerDef.createroom || 0));

      if (!hasCreateRoom && !isAssignedOwner) {
        emitNotice(socket, "لا تملك صلاحيه تعديل غرفة");
        return;
      }

      const rate = await ctx.securityGuard.consumeRateSlot(`redit:${socket.id}`, 8, 20_000);
      if (!rate.ok) return;

      const ownerResolved = await resolveOwnerTarget(d.ownerTargetUser);
      if (ownerResolved?.error) {
        emitNotice(socket, ownerResolved.error);
        return;
      }

      const micCountRaw = Number.parseInt(String(d.mic ?? currentRoom.stage_count ?? MIC_SLOT_COUNT), 10);
      const stageCount = Number.isFinite(micCountRaw)
        ? Math.max(0, Math.min(MIC_SLOT_COUNT, micCountRaw))
        : MIC_SLOT_COUNT;
      const normalizedLocks = normalizeSlotLocks(d.micLocks ?? currentRoom.stage_state);
      const messageMode = normalizeRoomMessageMode(d.message_mode ?? currentRoom.message_mode);
      const pass = String(d.pass ?? "").trim().slice(0, 120);
      const needpass = Boolean(pass);
      const broadcast = Boolean(d.broadcast);
      const maxNum = Number.parseInt(String(d.max ?? currentRoom.max ?? 40), 10);
      const safeMax = Number.isFinite(maxNum) ? Math.max(2, Math.min(500, maxNum)) : 40;
      const rmli = Math.max(0, Number.parseInt(String(d.like ?? d.rmli ?? currentRoom.rmli ?? 0), 10) || 0);
      const color = sanitizeHtmlText(String(d.color || currentRoom.color || "#000000").slice(0, 32)) || "#000000";
      const pic = sanitizeHtmlText(String(d.pic || currentRoom.pic || "pic.png").slice(0, 250)) || "pic.png";

      const ownerMetaObj = parseRoomOwnerMeta(currentRoom.room_owner_meta);
      const hasRequestedBadgeId = Object.prototype.hasOwnProperty.call(d, "ownerBadgeId");
      const requestedBadgeId = String(d.ownerBadgeId || "").trim();
      let finalBadgeId = hasRequestedBadgeId ? requestedBadgeId : ownerMetaObj.badge_id;
      let resolvedBadge = ctx.catalogStore.getRoomBadgeById(finalBadgeId);
      if (!resolvedBadge && !hasRequestedBadgeId && ownerMetaObj.badge) {
        resolvedBadge = { id: finalBadgeId, ...normalizeRoomOwnerBadge(ownerMetaObj.badge) };
      }
      if (!resolvedBadge) {
        finalBadgeId = "";
      }

      const currentOwnerId = `#${roomOwnerNorm || "1"}`;
      if (ownerResolved?.userId) {
        if (ownerResolved.userId === currentOwnerId) {
          ownerMetaObj.badge_id = finalBadgeId;
          ownerMetaObj.badge = normalizeRoomOwnerBadge(resolvedBadge || {});
        } else {
          const assignment = normalizeRoomOwnerAssignment({
            userId: ownerResolved.userId,
            userUser: ownerResolved.userUser || "",
            userTopic: ownerResolved.userTopic || "",
            badge_id: finalBadgeId,
            badge: normalizeRoomOwnerBadge(resolvedBadge || {}),
          });
          upsertRoomOwnerAssignment(ownerMetaObj, assignment);
        }
      } else {
        ownerMetaObj.badge_id = finalBadgeId;
        ownerMetaObj.badge = normalizeRoomOwnerBadge(resolvedBadge || {});
      }
      ownerMetaObj.ownerId = currentOwnerId;
      const ownerMetaRaw = JSON.stringify(ownerMetaObj);

      const { db } = getDb();
      await db
        .update(rooms)
        .set({
          topic,
          about,
          welcome,
          pass,
          needpass,
          broadcast,
          rmli,
          max: safeMax,
          color,
          pic,
          mic: stageCount,
          stage_count: stageCount,
          stage_state: JSON.stringify(normalizedLocks),
          message_mode: messageMode,
          room_owner_meta: ownerMetaRaw,
        })
        .where(eq(rooms.id, roomId));

      const updated: GatewayRoomRecord = {
        ...currentRoom,
        topic,
        about,
        welcome,
        pass,
        needpass,
        broadcast,
        rmli,
        max: safeMax,
        color,
        pic,
        mic: stageCount,
        stage_count: stageCount,
        stage_state: normalizedLocks,
        message_mode: messageMode,
        room_owner_meta: ownerMetaObj,
      };
      ctx.catalogStore.upsertRoomLocal(updated);

      const removedUsers = await ctx.micStageManager.applyLocks(roomId, normalizedLocks);
      for (const removedId of removedUsers) {
        ctx.io.to(roomId).emit("broadcasting", { cmd: "rleave", user: removedId, roomid: roomId });
      }
      if (updated.broadcast) {
        await ctx.micStageManager.emitStateToRoom(roomId);
      }

      await ctx.securityGuard.recordModerationStat({
        state: "تعديل غرفه",
        topic: session.topic,
        targetTopic: session.username,
        room: topic,
        ip: session.ip,
      });

      const count = await ctx.presenceDirectory.getOnlineRoomMemberCount(roomId);
      const pub = sanitizePublicRoom(updated, count);
      ctx.io.emit("msg", {
        cmd: "r^",
        data: { ...pub, delete: pub.deleted, micLocks: normalizedLocks },
      });
    },

    async handleDeleteRoom(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const roomId = String((rawData as Record<string, unknown>).id || "").trim();
      if (!roomId) return;

      const defaultRoomId = ctx.catalogStore.getDefaultRoomId();
      if (roomId === defaultRoomId || roomId === "D8D8A9A9C0") {
        emitNotice(socket, "لا يمكن حذف الغرفة الرئيسية");
        return;
      }

      const room = ctx.catalogStore.getRoomById(roomId);
      if (!room) return;

      const powerDef = ctx.catalogStore.getPowerRole(session.rank || session.power);
      const myIdreg = session.idreg !== undefined ? String(session.idreg).replace(/^#/, "") : "";
      const roomOwnerClean = String(room.owner || "").replace(/^#/, "");
      const canDelete =
        Boolean(powerDef && Number(powerDef.createroom || 0)) ||
        room.owner === session.username ||
        (myIdreg && myIdreg === roomOwnerClean) ||
        (room.user && session.topic && room.user === session.topic);

      if (!canDelete) {
        emitNotice(socket, "لا تملك صلاحية حذف الغرف");
        return;
      }

      const members = await ctx.presenceDirectory.getRoomMemberSnapshots(roomId);
      for (const member of members) {
        const s = ctx.io.sockets.sockets.get(member.id);
        const sess = ctx.presenceDirectory.getLocalSession(member.id);
        if (s && sess) {
          await ctx.micStageManager.clearUserFromStage(roomId, member.id);
          if (member.id !== socket.id) {
            await ctx.presenceDirectory.moveUserToRoom(s, sess, defaultRoomId);
            s.emit("msg", { cmd: "lavedon", data: { roomId } });
          }
        }
      }

      const { db } = getDb();
      await db.delete(rooms).where(eq(rooms.id, roomId));
      ctx.catalogStore.removeRoomLocal(roomId);

      await ctx.securityGuard.recordModerationStat({
        state: "حذف غرفه",
        topic: session.topic,
        targetTopic: session.username,
        room: room.topic,
        ip: session.ip,
      });

      await ctx.micStageManager.clearRoomLikes(roomId);
      ctx.io.emit("msg", { cmd: "r-", data: roomId });
    },

    async handleRoomResume(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const defaultRoomId = ctx.catalogStore.getDefaultRoomId();
      const requestedId = String(d.roomid || d.roomId || session.roomid || defaultRoomId).trim();
      const room =
        ctx.catalogStore.getRoomById(requestedId) ||
        (session.roomid ? ctx.catalogStore.getRoomById(session.roomid) : undefined) ||
        ctx.catalogStore.getRoomById(defaultRoomId);
      if (!room) return;

      if (session.roomid !== room.id) {
        const joined = await performRoomJoin(ctx, socket, session, room.id, String(d.pwd || d.pass || ""), {
          initialEntry: room.id === defaultRoomId,
        });
        if (!joined) return;
      } else {
        const count = await ctx.presenceDirectory.getOnlineRoomMemberCount(room.id);
        socket.emit("msg", { cmd: "rjoin", data: sanitizePublicRoom(room, count) });
        await ctx.micStageManager.emitStateToSocket(socket, room.id);
        await ctx.carromManager.emitStateToSocket(socket, room.id);
        await ctx.ludoManager.emitStateToSocket(socket, room.id);
        ctx.competitionEngine.emitRoomState(room.id);
      }

      const history = await getRecentChatMessages<Record<string, unknown>>("room", room.id, 30).catch(() => []);
      if (history.length > 0) {
        socket.emit("msg", {
          cmd: "msg_batch",
          data: history.map((m) => compactMessageData(m)),
        });
      }

      const count = await ctx.presenceDirectory.getOnlineRoomMemberCount(room.id);
      socket.emit("msg", {
        cmd: "room_resume",
        data: {
          roomId: room.id,
          roomid: room.id,
          room: sanitizePublicRoom(room, count),
          ok: true,
        },
      });
    },

    async handleLiveSettingsUpdate(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const roomId = String(d.roomId || d.id || session.roomid || "").trim();
      if (!roomId) return;
      const room = ctx.catalogStore.getRoomById(roomId);
      if (!room) return;

      const actorReg = session.idreg ? String(session.idreg).replace(/^#/, "") : "";
      const roomOwnerNorm = String(room.owner || "").replace(/^#/, "");
      const isOwner = Boolean(actorReg && roomOwnerNorm && actorReg === roomOwnerNorm) || room.owner === session.username;
      const isStaff = isOwner || verRoomsOwner(ctx.catalogStore.getPowers(), session.rank || session.power);
      if (!isStaff) {
        emitNotice(socket, "لا تملك صلاحية تعديل إعدادات البث");
        return;
      }

      const ownerMeta = parseRoomOwnerMeta(room.room_owner_meta);
      const prevLive = ownerMeta.live_config || { is_live_audio: true };

      if (d.topic !== undefined) {
        const nextTopic = sanitizeHtmlText(String(d.topic || "").trim().slice(0, 80));
        if (nextTopic) room.topic = nextTopic;
      }

      const nextJoinMode = d.join_mode === "request" ? "request" : d.join_mode === "free" ? "free" : prevLive.join_mode;
      const nextChatLocked = d.chat_locked !== undefined ? Boolean(d.chat_locked) : prevLive.chat_locked;
      const nextGiftGoal = d.gift_goal !== undefined ? (d.gift_goal as any) : prevLive.gift_goal;

      ownerMeta.live_config = normalizeLiveRoomConfig({
        ...prevLive,
        is_live_audio: true,
        join_mode: nextJoinMode,
        chat_locked: nextChatLocked,
        gift_goal: nextGiftGoal,
      });

      room.room_owner_meta = ownerMeta;
      ctx.catalogStore.upsertRoomLocal(room);

      try {
        const { db } = getDb();
        await db
          .update(rooms)
          .set({
            topic: room.topic,
            room_owner_meta: JSON.stringify(ownerMeta),
          })
          .where(eq(rooms.id, roomId));
      } catch {
        // non-fatal
      }

      const count = await ctx.presenceDirectory.getOnlineRoomMemberCount(roomId);
      const pub = sanitizePublicRoom(room, count);
      ctx.io.to(roomId).emit("broadcasting", {
        cmd: "live-settings",
        roomid: roomId,
        live_config: ownerMeta.live_config,
        topic: room.topic,
      });
      ctx.io.emit("msg", {
        cmd: "r*",
        data: pub,
      });
    },
  };
}
