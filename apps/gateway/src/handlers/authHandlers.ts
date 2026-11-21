import crypto from "node:crypto";
import {
  and,
  bars,
  desc,
  eq,
  getDb,
  getRecentChatMessages,
  gift_notifications,
  inArray,
  internal_mail,
  or,
  owner,
  sql,
  storie,
  storieview,
  story_comment_likes,
  story_comments,
  story_likes,
  sub,
  users,
} from "@newchat/db";
import { loadInitialNotes } from "./notesHandlers.js";
import {
  DEFAULT_POWER_NON,
  NO_NAMES,
  compactMessageData,
  getPowerDefinitionByName,
  guestLoginSchema,
  memberLoginSchema,
  normalizeActiveChatUsername,
  filterActiveStorySlides,
  parseEvaluationAwardsJson,
  registerSchema,
  sanitizeHtmlText,
  stringGen,
  verOwner,
  verStealthPanel,
} from "@newchat/shared";
import type { Socket } from "socket.io";
import { gatewayConfig } from "../config.js";
import { hashPasswordSync, verifyPasswordAsync } from "../lib/password.js";
import {
  emitAlert,
  emitNotice,
  extractDeviceFingerprint,
  getSocketClientIp,
  hasSuspiciousScriptToken,
  randomTokenHex,
  resolveSocketCountryCode,
  safeJsonParse,
  sanitizePublicRoom,
  sanitizePublicSnapshot,
} from "../lib/socketUtils.js";
import type { GatewayContext, GatewaySession } from "../types/gateway.js";
import { releasePmCallsForSocket } from "./callsMediaHandlers.js";
import { emitRoomWelcomeToSocket, performRoomJoin } from "./roomHandlers.js";

function normalizePlatformAlias(rawPlt: string): string {
  const lower = rawPlt.trim().toLowerCase();
  if (!lower || lower === "web" || lower === "win32" || lower === "win64" || lower === "mobile") return "windows";
  if (lower.includes("mac") || lower === "darwin") return "mac os";
  if (lower.includes("linux") || lower === "x11") return "linux";
  if (lower.includes("android")) return "android";
  if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) return "ios";
  return lower;
}

function normalizeBrowserAlias(rawBrowser: string): string {
  const lower = rawBrowser.trim().toLowerCase();
  if (!lower || lower === "web" || lower === "node" || lower === "modern") return "chrome";
  return lower;
}

function hasDisallowedNameWord(input: string): string | null {
  const clean = input.trim().toLowerCase();
  if (!clean) return null;
  for (const w of NO_NAMES) {
    if (w && clean.includes(w.toLowerCase())) {
      return w;
    }
  }
  return null;
}

function sanitizeDbText(value: unknown, fallback = "", max = 250): string {
  const cleaned = String(value ?? "").trim();
  return (cleaned || fallback).slice(0, max);
}

export async function disconnectUserSession(
  ctx: GatewayContext,
  socketId: string,
  opts?: { state?: number; forceImmediate?: boolean; reason?: string },
): Promise<void> {
  const session = ctx.presenceDirectory.getLocalSession(socketId);
  if (!session) return;

  await ctx.evaluationEngine.flushSessionEvaluation(session).catch(() => undefined);

  if (session.roomid) {
    await ctx.micStageManager
      .clearUserFromStage(session.roomid, socketId, { evictFromMediaRoom: true })
      .catch(() => undefined);
    await ctx.carromManager.syncRoomGame(session.roomid).catch(() => undefined);
    await ctx.ludoManager.syncRoomGame(session.roomid).catch(() => undefined);
  }
  await releasePmCallsForSocket(ctx, socketId, opts?.reason || "disconnect").catch(() => undefined);

  const canGraceDelay =
    !opts?.forceImmediate &&
    !session.kicked &&
    !session.loggedOut &&
    !session.pageLifecycleExit &&
    opts?.reason !== "client namespace disconnect" &&
    session.islogin === "عضو" &&
    Boolean(session.pageHidden);

  if (canGraceDelay) {
    const scheduled = ctx.presenceDirectory.scheduleBackgroundGrace(socketId, async (expiredSess) => {
      await finalizeSessionRemoval(ctx, expiredSess);
    });
    if (scheduled) return;
  }

  await finalizeSessionRemoval(ctx, session);
}

async function finalizeSessionRemoval(
  ctx: GatewayContext,
  session: GatewaySession,
): Promise<void> {
  const ownerState = ctx.catalogStore.getOwnerState();
  const shouldPinOffline =
    ownerState.offline &&
    session.islogin === "عضو" &&
    Boolean(session.uid) &&
    !session.stealth &&
    !session.loggedOut &&
    !session.kicked;

  if (shouldPinOffline) {
    await ctx.presenceDirectory.transitionToPinnedOffline(session);
  } else {
    await ctx.presenceDirectory.removeSession(session.id, { emitLeave: true });
  }
}

async function buildInitialWallPosts(): Promise<Array<Record<string, unknown>>> {
  try {
    const { db } = getDb();
    const rows = await db.select().from(bars).orderBy(desc(bars.id)).limit(30);
    const uids = Array.from(new Set(rows.map((r) => String(r.uid || "")).filter(Boolean)));
    const verifiedSet = new Set<string>();
    if (uids.length > 0) {
      const userRows = await db
        .select({ uid: users.uid, idreg: users.idreg, doc: users.documentationc })
        .from(users)
        .where(or(inArray(users.uid, uids), inArray(sql`CAST(${users.idreg} AS TEXT)`, uids)));
      for (const u of userRows) {
        if (Number(u.doc || 0) === 1) {
          if (u.uid) verifiedSet.add(u.uid);
          if (u.idreg) verifiedSet.add(String(u.idreg));
        }
      }
    }
    return rows.reverse().map((r) => {
      const isVerified = verifiedSet.has(String(r.uid || "")) || verifiedSet.has(String(r.lid || ""));
      return {
        id: r.id,
        bid: String(r.bid || ""),
        lid: String(r.lid || ""),
        uid: String(r.uid || ""),
        topic: String(r.topic || ""),
        pic: String(r.pic || "pic.png"),
        msg: String(r.msg || ""),
        bg: String(r.bg || "#FFFFFF"),
        ucol: String(r.ucol || "#000000"),
        mcol: String(r.mcol || "#000000"),
        likes: safeJsonParse<string[]>(r.likes, []),
        bcc: safeJsonParse<Array<Record<string, unknown>>>(r.bcc, []),
        documents: isVerified,
        documentationc: isVerified,
      };
    });
  } catch {
    return [];
  }
}

export async function loadInitialStories(viewerKey = ""): Promise<Array<Record<string, unknown>>> {
  try {
    const { db } = getDb();
    const storedRows = await db.select().from(storie).orderBy(desc(storie.id));
    const now = Date.now();
    const preparedRows = storedRows.map((r) => {
      const rawItems = safeJsonParse<Array<Record<string, unknown>>>(r.item, []);
      const baseItems =
        rawItems.length > 0
          ? rawItems
          : r.link
            ? [{ id: `legacy_${r.id}`, type: "image", src: String(r.link), length: 6, time: r.lastUpdated }]
            : [];
      return {
        ...r,
        activeItems: filterActiveStorySlides(baseItems, r.lastUpdated, now),
      };
    });
    const expiredRows = preparedRows.filter((r) => r.activeItems.length === 0);
    const expiredIds = expiredRows.map((r) => r.id);
    const expiredSids = Array.from(new Set(expiredRows.map((r) => String(r.sid || "")).filter(Boolean)));
    if (expiredIds.length > 0) {
      const expiredComments = expiredSids.length
        ? await db
            .select({ cid: story_comments.cid })
            .from(story_comments)
            .where(inArray(story_comments.story_sid, expiredSids))
        : [];
      const expiredCommentIds = expiredComments.map((comment) => comment.cid);
      if (expiredCommentIds.length > 0) {
        await db
          .delete(story_comment_likes)
          .where(inArray(story_comment_likes.comment_cid, expiredCommentIds));
      }

      await Promise.all([
        db.delete(storie).where(inArray(storie.id, expiredIds)),
        ...(expiredSids.length
          ? [
              db.delete(story_likes).where(inArray(story_likes.story_sid, expiredSids)),
              db.delete(story_comments).where(inArray(story_comments.story_sid, expiredSids)),
              db.delete(storieview).where(inArray(storieview.idsto, expiredSids)),
            ]
          : []),
      ]);
    }

    const rows = preparedRows
      .filter((r) => r.activeItems.length > 0)
      .sort(
        (a, b) =>
          Math.max(...b.activeItems.map((item) => item.time)) -
          Math.max(...a.activeItems.map((item) => item.time)),
      )
      .slice(0, 50);
    if (rows.length === 0) return [];

    const storySids = Array.from(new Set(rows.map((r) => String(r.sid || "")).filter(Boolean)));
    const cleanViewer = String(viewerKey || "").trim();

    const [viewCountsRows, myViewsRows, likeCountsRows, myLikesRows, commentCountsRows, userColorsRows] =
      storySids.length > 0
        ? await Promise.all([
            db
              .select({
                idsto: storieview.idsto,
                item: storieview.item,
                cnt: sql<number>`count(distinct ${storieview.sid})::int`,
              })
              .from(storieview)
              .where(inArray(storieview.idsto, storySids))
              .groupBy(storieview.idsto, storieview.item),
            cleanViewer
              ? db
                  .select({
                    idsto: storieview.idsto,
                    item: storieview.item,
                  })
                  .from(storieview)
                  .where(and(inArray(storieview.idsto, storySids), eq(storieview.sid, cleanViewer)))
              : Promise.resolve([]),
            db
              .select({
                story_sid: story_likes.story_sid,
                item_id: story_likes.item_id,
                cnt: sql<number>`count(*)::int`,
              })
              .from(story_likes)
              .where(inArray(story_likes.story_sid, storySids))
              .groupBy(story_likes.story_sid, story_likes.item_id),
            cleanViewer
              ? db
                  .select({
                    story_sid: story_likes.story_sid,
                    item_id: story_likes.item_id,
                  })
                  .from(story_likes)
                  .where(and(inArray(story_likes.story_sid, storySids), eq(story_likes.user_uid, cleanViewer)))
              : Promise.resolve([]),
            db
              .select({
                story_sid: story_comments.story_sid,
                item_id: story_comments.item_id,
                cnt: sql<number>`count(*)::int`,
              })
              .from(story_comments)
              .where(inArray(story_comments.story_sid, storySids))
              .groupBy(story_comments.story_sid, story_comments.item_id),
            db
              .select({
                uid: users.uid,
                ucol: users.ucol,
                pic: users.pic,
                topic: users.topic,
                documentationc: users.documentationc,
              })
              .from(users)
              .where(inArray(users.uid, storySids)),
          ])
        : [[], [], [], [], [], []];

    const viewCountMap = new Map<string, number>();
    for (const v of viewCountsRows) {
      viewCountMap.set(`${v.idsto}::${Number(v.item || 0)}`, Number(v.cnt || 0));
    }
    const myViewSet = new Set<string>();
    for (const v of myViewsRows) {
      myViewSet.add(`${v.idsto}::${Number(v.item || 0)}`);
    }
    const likeCountMap = new Map<string, number>();
    for (const l of likeCountsRows) {
      likeCountMap.set(`${l.story_sid}::${l.item_id}`, Number(l.cnt || 0));
    }
    const myLikeSet = new Set<string>();
    for (const l of myLikesRows) {
      myLikeSet.add(`${l.story_sid}::${l.item_id}`);
    }
    const commentCountMap = new Map<string, number>();
    for (const c of commentCountsRows) {
      commentCountMap.set(`${c.story_sid}::${c.item_id}`, Number(c.cnt || 0));
    }
    const userMetaMap = new Map<string, { ucol: string; pic: string; topic: string; verified: boolean }>();
    for (const u of userColorsRows) {
      if (u.uid) {
        userMetaMap.set(u.uid, {
          ucol: String(u.ucol || ""),
          pic: String(u.pic || ""),
          topic: String(u.topic || ""),
          verified: Number(u.documentationc || 0) === 1,
        });
      }
    }

    return rows.map((r) => {
      const sid = String(r.sid || "");
      const enrichedItems = r.activeItems.map((it) => {
        const itemId = String(it.id || `slide_${r.id}_${it.itemIndex}`);
        const viewKey = `${sid}::${it.itemIndex}`;
        const targetKey = `${sid}::${itemId}`;
        return {
          ...it,
          id: itemId,
          viewsCount: viewCountMap.get(viewKey) || 0,
          likesCount: likeCountMap.get(targetKey) || 0,
          commentsCount: commentCountMap.get(targetKey) || 0,
          viewedByMe: myViewSet.has(viewKey),
          likedByMe: myLikeSet.has(targetKey),
        };
      });
      const uMeta = userMetaMap.get(sid);
      const hasUnviewed = cleanViewer ? enrichedItems.some((it) => !it.viewedByMe) : !Boolean(r.seen);

      return {
        id: r.id,
        sid,
        photo: String(uMeta?.pic || r.photo || "pic.png"),
        name: String(uMeta?.topic || r.name || ""),
        ucol: String(uMeta?.ucol || ""),
        verified: Boolean(uMeta?.verified),
        documents: Boolean(uMeta?.verified),
        documentationc: Boolean(uMeta?.verified),
        link: String(r.link || ""),
        lastUpdated: String(r.lastUpdated || ""),
        item: enrichedItems,
        seen: !hasUnviewed,
        hasUnviewed,
        currentPreview: safeJsonParse<unknown[]>(r.currentPreview, []),
      };
    });
  } catch (error) {
    console.error("[Gateway] Failed to load active stories:", error);
    throw error;
  }
}

export function createAuthHandlers(ctx: GatewayContext) {
  async function completeSessionEntry(
    socket: Socket,
    session: GatewaySession,
    opts?: { silent?: boolean },
  ): Promise<void> {
    const powers = ctx.catalogStore.getPowers();
    const powerDef = getPowerDefinitionByName(powers, session.rank || session.power);
    const ownerState = ctx.catalogStore.getOwnerState();
    const setting = ctx.catalogStore.getSiteSetting();
    const limits = ctx.catalogStore.getLimits();

    // Note: owner.datafinish is an admin CP hosting metadata metric only (not a login block in legacy behavior).
    // Evict duplicate sessions cleanly
    await ctx.presenceDirectory.evictDuplicateSessions({
      lid: session.lid,
      uid: session.uid,
      username: session.username,
      excludeSocketId: socket.id,
      onEvict: async (oldSocketId) => {
        await disconnectUserSession(ctx, oldSocketId, { forceImmediate: true, reason: "duplicate_login" });
      },
    });

    // Resolve destination room safely
    let targetRoomId = String(session.roomid || "").trim();
    if (!targetRoomId || !ctx.catalogStore.getRoomById(targetRoomId)) {
      targetRoomId = ctx.catalogStore.getDefaultRoomId();
    }
    session.roomid = targetRoomId;

    // Enforce stealth flag only when role grants stealth
    session.stealth = Boolean(session.stealth && verStealthPanel(powers, session.rank || session.power));
    session.stat = session.busy ? 2 : 0;
    session.offline = false;
    session.meta_ts = Date.now();

    await ctx.presenceDirectory.registerSession(socket, session);

    const publicSelf = sanitizePublicSnapshot(session);
    socket.emit("msg", {
      cmd: "ok",
      data: {
        ...publicSelf,
        user: publicSelf,
        token: session.token,
        roomId: targetRoomId,
        roomid: targetRoomId,
        power: session.power,
        rank: session.rank,
        coin: session.coin,
        coins: session.coins,
        islogin: session.islogin,
      },
    });

    socket.emit("msg", {
      cmd: "IsTv",
      data: {
        tv: ownerState.tv,
        pool: Boolean(setting.Pallbool),
        reply: Boolean(setting.Reply),
        love: Boolean(setting.Love),
      },
    });
    socket.emit("msg", { cmd: "Maxrep", data: ownerState.maxRep });
    socket.emit("msg", { cmd: "coom", data: ownerState.cooment });

    socket.emit("msg", { cmd: "sicos", data: ctx.catalogStore.getSicos() });
    socket.emit("msg", { cmd: "emos", data: ctx.catalogStore.getEmos() });
    socket.emit("msg", { cmd: "dro3", data: ctx.catalogStore.getDro3s() });
    socket.emit("msg", { cmd: "them", data: ctx.catalogStore.getThemes() });
    socket.emit("msg", { cmd: "cover", data: ctx.catalogStore.getCovers() });
    socket.emit("msg", { cmd: "room_badges", data: ctx.catalogStore.getRoomBadges() });
    socket.emit("msg", { cmd: "site_badges", data: ctx.catalogStore.getSiteBadges() });
    const cutsRules = ctx.catalogStore.getShortcutRules();
    socket.emit("msg", {
      cmd: "shortcuts",
      data: cutsRules.map((r) => ({ text1: r.text1, text2: r.text2 })),
    });
    socket.emit("msg", {
      cmd: "gifts_git",
      data: {
        gifts: ctx.catalogStore.getGifts(),
        categories: ctx.catalogStore.getGiftCategories(),
      },
    });
    socket.emit("msg", { cmd: "powers", data: powers });
    if (powerDef) {
      socket.emit("msg", { cmd: "power", data: powerDef });
    }

    const roomCounts = await ctx.presenceDirectory.getAllRoomCounts();
    const roomsList = ctx.catalogStore
      .getRooms()
      .map((r) => sanitizePublicRoom(r, roomCounts[r.id] || 0));
    socket.emit("msg", { cmd: "rlist", data: roomsList });
    socket.emit("msg", { cmd: "rooms_counts", data: roomCounts });

    const onlineList = await ctx.presenceDirectory.buildOnlineSnapshots(session.rank || session.power, socket.id);
    socket.emit("msg", { cmd: "ulist", data: onlineList });
    socket.emit("msg", { cmd: "presence_sync", data: onlineList });

    // Send initial wall posts, stories & notes (completely separated)
    const [wallPosts, storiesList, notesList] = await Promise.all([
      buildInitialWallPosts(),
      loadInitialStories(session.uid || session.lid),
      loadInitialNotes(session.uid || session.lid),
    ]);
    for (const post of wallPosts) {
      socket.emit("msg", { cmd: "bc", data: post });
    }
    if (storiesList.length > 0) {
      socket.emit("msg", { cmd: "stories", data: storiesList });
    }
    if (notesList.length > 0) {
      socket.emit("msg", { cmd: "notes_list", data: notesList });
    }

    // Room bootstrap
    const roomObj = ctx.catalogStore.getRoomById(targetRoomId);
    if (roomObj) {
      socket.emit("msg", {
        cmd: "rjoin",
        data: sanitizePublicRoom(roomObj, roomCounts[roomObj.id] || 1),
      });

      const recentRoomMessages = await getRecentChatMessages<Record<string, unknown>>("room", targetRoomId, 30).catch(
        () => [],
      );
      if (recentRoomMessages.length > 0) {
        socket.emit("msg", {
          cmd: "msg_batch",
          data: recentRoomMessages.map((m) => compactMessageData(m)),
        });
      }

      if (!opts?.silent) {
        const joinTs = Date.now();
        if (!session.stealth) {
          socket.to(targetRoomId).emit("msg", {
            cmd: "msg",
            data: {
              bg: "none",
              class: "hmsg",
              mi: stringGen(14),
              id: session.id,
              topic: sanitizeHtmlText(session.topic),
              msg: "هذا المستخدم قد دخل الغرفة",
              actionType: "room_join",
              targetRoomId,
              targetRoomTopic: sanitizeHtmlText(roomObj.topic),
              roomid: targetRoomId,
              pic: session.pic,
              uid: socket.id,
              time: joinTs,
            },
          });
        }
        await emitRoomWelcomeToSocket(ctx, socket, session, roomObj, { minTimestamp: joinTs + 5 });
      }

      await ctx.micStageManager.emitStateToSocket(socket, targetRoomId);
      await ctx.carromManager.emitStateToSocket(socket, targetRoomId);
      await ctx.ludoManager.emitStateToSocket(socket, targetRoomId);
      ctx.competitionEngine.emitRoomState(targetRoomId);
    }

    // Global welcome banner / site intro messages
    if (!opts?.silent && limits.welcomeMessage) {
      emitNotice(socket, limits.welcomeMessage, { topic: "الترحيب", force: 0 });
    }
    const introMsgs = ctx.catalogStore.getIntroWelcomeMessages("w");
    for (const intro of introMsgs.slice(0, 3)) {
      if (intro.msg) {
        emitNotice(socket, intro.msg, { topic: intro.adresse || "", force: 0 });
      }
    }

    // Member-specific checks & post-entry tasks
    if (session.islogin === "عضو" && session.uid) {
      const { db } = getDb();

      // Check subscription expiry (matches either idreg or uid, skips permanent grants where timeis === "0")
      try {
        const subIdCandidates = [session.uid];
        if (session.idreg) {
          subIdCandidates.push(String(session.idreg));
        }
        const subsRows = await db
          .select()
          .from(sub)
          .where(
            subIdCandidates.length > 1
              ? or(eq(sub.iduser, subIdCandidates[0]!), eq(sub.iduser, subIdCandidates[1]!))
              : eq(sub.iduser, subIdCandidates[0]!),
          );
        const nowCheck = Date.now();
        for (const s of subsRows) {
          const daysVal = Number.parseInt(String(s.timeis || "0"), 10);
          const finishMs = Number.parseInt(String(s.timefinish || "0"), 10);
          if (daysVal > 0 && finishMs > 0 && nowCheck > finishMs) {
            await db.delete(sub).where(eq(sub.id, s.id));
            await db.update(users).set({ power: "" }).where(eq(users.uid, session.uid));
            await ctx.presenceDirectory.patchSession(socket.id, { power: "", rank: "" });
            socket.emit("msg", { cmd: "power", data: DEFAULT_POWER_NON });
            emitNotice(socket, "انتهت مدة اشتراكك في الترقية");
          }
        }
      } catch {
        // non-fatal
      }

      // Check unread gifts & mail
      try {
        const [unreadGifts, unreadMailRows] = await Promise.all([
          db
            .select()
            .from(gift_notifications)
            .where(and(eq(gift_notifications.to_uid, session.uid), eq(gift_notifications.is_read, false)))
            .orderBy(desc(gift_notifications.created_at))
            .limit(10),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(internal_mail)
            .where(and(eq(internal_mail.to_uid, session.uid), eq(internal_mail.is_read, false))),
        ]);

        if (unreadGifts.length > 0) {
          const g = unreadGifts[0]!;
          emitNotice(socket, `وصلتك هدية جديدة من ${sanitizeHtmlText(g.from_topic)} (${g.coin} كوينز)`);
          await db
            .update(gift_notifications)
            .set({ is_read: true, read_at: Date.now() })
            .where(eq(gift_notifications.to_uid, session.uid));
        }

        const unreadMailCount = Number(unreadMailRows[0]?.count || 0);
        socket.emit("msg", { cmd: "mail_unread_count", data: { count: unreadMailCount } });
      } catch {
        // non-fatal
      }

      await ctx.evaluationEngine.awardDailyLogin(socket.id);
      ctx.evaluationEngine.startPresenceTimer(socket.id);
    }
  }

  return {
    async handleGuestLogin(socket: Socket, rawData: unknown): Promise<void> {
      const rate = await ctx.securityGuard.consumeRateSlot(`auth:g:${getSocketClientIp(socket)}`, 10, 20_000);
      if (!rate.ok) {
        emitNotice(socket, "حاول الدخول بعد قليل");
        return;
      }

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const parsed = guestLoginSchema.safeParse({
        username: String(d.username || d.topic || d.name || "").trim(),
        refr: String(d.refr || "web"),
        pic: String(d.pic || "pic.png"),
        fp: String(d.fp || ""),
        id: d.id ? String(d.id) : undefined,
        roomid: d.roomid ? String(d.roomid) : undefined,
      });
      if (!parsed.success) {
        emitNotice(socket, "الرجاء كتابة الاسم للدخول");
        socket.emit("msg", { cmd: "nok", data: { msg: "الرجاء كتابة الاسم للدخول" } });
        return;
      }

      const limits = ctx.catalogStore.getLimits();
      const rawName = sanitizeHtmlText(parsed.data.username).trim();
      if (rawName.length < 2 || rawName.length > limits.lengthUserReg) {
        const msg = `الاسم يجب أن يكون بين 2 و ${limits.lengthUserReg} حرف`;
        emitNotice(socket, msg);
        socket.emit("msg", { cmd: "nok", data: { msg } });
        return;
      }

      const badWord = hasDisallowedNameWord(rawName);
      if (badWord || ctx.catalogStore.scanProhibitedWords(rawName)) {
        const msg = "هذا الاسم غير مسموح به في الدردشة";
        emitNotice(socket, msg);
        socket.emit("msg", { cmd: "nok", data: { msg } });
        return;
      }

      const dev = extractDeviceFingerprint(socket);
      const envCheck = ctx.securityGuard.validateClientEnvironment(
        normalizePlatformAlias(dev.plt),
        normalizeBrowserAlias(dev.browser),
      );
      if (!envCheck.valid) {
        emitNotice(socket, envCheck.reason || "البيئة غير مدعومة");
        socket.emit("msg", { cmd: "nok", data: { msg: envCheck.reason || "البيئة غير مدعومة" } });
        return;
      }

      const ip = getSocketClientIp(socket);
      const fp = parsed.data.fp || dev.raw;
      const countryCode = await resolveSocketCountryCode(socket, ip);
      const ban = ctx.securityGuard.checkBan({ ip, fp, countryCode, username: rawName, topic: rawName });
      if (ban.blocked) {
        await ctx.securityGuard.recordLoginAttempt({
          state: "محظور",
          topic: rawName,
          username: rawName,
          ip,
          code: countryCode,
          device: dev.raw,
          isin: "زائر",
        });
        emitNotice(socket, "انت محظور من دخول الدردشة");
        socket.emit("msg", { cmd: "nok", data: { msg: "انت محظور من دخول الدردشة" } });
        return;
      }

      if (await ctx.presenceDirectory.isUsernameTakenGlobally(rawName, socket.id)) {
        const msg = "الاسم موجود في الدردشة استخدم اسم اخر";
        emitNotice(socket, msg);
        socket.emit("msg", { cmd: "nok", data: { msg } });
        return;
      }

      await ctx.securityGuard.recordGuestDevice(fp);
      await ctx.securityGuard.recordLoginAttempt({
        state: "دخول",
        topic: rawName,
        username: rawName,
        ip,
        code: countryCode,
        device: dev.raw,
        isin: "زائر",
      });
      await ctx.securityGuard.recordAlias({
        iduser: "",
        fp,
        ip,
        topic: rawName,
        username: rawName,
      });

      const guestToken = randomTokenHex(20);
      const guestSession: GatewaySession = {
        id: socket.id,
        lid: `g_${stringGen(12)}`,
        uid: "",
        username: rawName,
        topic: rawName,
        pic: sanitizeDbText(parsed.data.pic, "pic.png"),
        pich: "pich.png",
        msg: "(زائر جديد)",
        power: "",
        rank: "",
        bg: "#FFFFFF",
        gcol: "#FFFFFF",
        ucol: "#000000",
        mcol: "#000000",
        stat: 0,
        offline: false,
        co: countryCode,
        ico: "",
        gift_ico: "",
        documents: false,
        documentationc: false,
        yp: "",
        them: "",
        cover: "",
        site_badge_id: "",
        site_badge: "",
        roomid: parsed.data.roomid || ctx.catalogStore.getDefaultRoomId(),
        islogin: "زائر",
        rep: 0,
        coin: 0,
        coins: 0,
        evaluation: 0,
        wall_post_likes: 0,
        gifts_received_count: 0,
        busy: false,
        alerts: false,
        nopm: false,
        nonot: false,
        nopmcall: false,
        nopmvideocall: false,
        token: guestToken,
        ip,
        fp,
        location: countryCode,
        refr: sanitizeDbText(parsed.data.refr, "web"),
        joinedAt: Date.now(),
        joinuser: Date.now(),
        last_eval_login_day: "",
        auto_power: "",
        eval_awards: {},
        loginG: false,
        stealth: false,
        muted: false,
        ismuted: false,
        meta_ts: Date.now(),
      };

      await completeSessionEntry(socket, guestSession);
    },

    async handleMemberLogin(socket: Socket, rawData: unknown): Promise<void> {
      const ip = getSocketClientIp(socket);
      const rate = await ctx.securityGuard.consumeRateSlot(`auth:sagin:${ip}`, 10, 20_000);
      if (!rate.ok) {
        emitNotice(socket, "محاولات دخول كثيرة، انتظر قليلاً");
        return;
      }

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const parsed = memberLoginSchema.safeParse({
        username: String(d.username || "").trim(),
        password: String(d.password || ""),
        refr: String(d.refr || "web"),
        fp: String(d.fp || ""),
        roomid: d.roomid ? String(d.roomid) : undefined,
        stealth: Boolean(d.stealth ?? d.eye ?? d.s),
      });
      if (!parsed.success) {
        const msg = "الرجاء إدخال اسم المستخدم وكلمة المرور";
        socket.emit("msg", { cmd: "sagin", data: { msg } });
        emitNotice(socket, msg);
        return;
      }

      const cleanUsername = parsed.data.username.toLowerCase();
      const { db } = getDb();
      const rows = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.username}) = ${cleanUsername}`)
        .limit(1);
      const userRow = rows[0];
      if (!userRow) {
        const msg = "اسم المستخدم أو كلمة المرور غير صحيحة";
        socket.emit("msg", { cmd: "sagin", data: { msg } });
        emitNotice(socket, msg);
        return;
      }

      const passOk = await verifyPasswordAsync(parsed.data.password, userRow.password);
      if (!passOk) {
        const msg = "اسم المستخدم أو كلمة المرور غير صحيحة";
        socket.emit("msg", { cmd: "sagin", data: { msg } });
        emitNotice(socket, msg);
        return;
      }

      const dev = extractDeviceFingerprint(socket);
      const fp = parsed.data.fp || userRow.fp || dev.raw;
      const countryCode = await resolveSocketCountryCode(socket, ip);
      const ban = ctx.securityGuard.checkBan({
        ip,
        fp,
        countryCode,
        username: userRow.username,
        topic: userRow.topic,
      });
      if (ban.blocked) {
        await ctx.securityGuard.recordLoginAttempt({
          state: "محظور",
          topic: userRow.topic,
          username: userRow.username,
          ip,
          code: countryCode,
          device: dev.raw,
          isin: "عضو",
        });
        emitNotice(socket, "انت محظور من دخول الدردشة");
        socket.emit("msg", { cmd: "sagin", data: { msg: "انت محظور من دخول الدردشة" } });
        return;
      }

      const newToken = randomTokenHex(24);
      const nowStr = String(Date.now());
      await db
        .update(users)
        .set({
          token: newToken,
          ip,
          fp: fp.slice(0, 250),
          lastssen: nowStr,
          id: socket.id,
        })
        .where(eq(users.idreg, userRow.idreg));

      await ctx.securityGuard.recordLoginAttempt({
        state: "دخول",
        topic: userRow.topic,
        username: userRow.username,
        ip,
        code: countryCode,
        device: dev.raw,
        isin: "عضو",
      });
      await ctx.securityGuard.recordAlias({
        iduser: userRow.uid || String(userRow.idreg),
        fp,
        ip,
        topic: userRow.topic,
        username: userRow.username,
      });

      const powers = ctx.catalogStore.getPowers();
      const hasStealthPermission = verStealthPanel(powers, userRow.power) || verOwner(powers, userRow.power);
      const isStealth = Boolean(parsed.data.stealth && hasStealthPermission);
      const siteBadge = userRow.site_badge_id
        ? ctx.catalogStore.getSiteBadgeById(userRow.site_badge_id) || safeJsonParse(userRow.site_badge, "")
        : safeJsonParse(userRow.site_badge, "");

      const targetRoom = parsed.data.roomid || ctx.catalogStore.getDefaultRoomId();
      const memberSession: GatewaySession = {
        id: socket.id,
        idreg: userRow.idreg,
        lid: String(userRow.lid || userRow.uid || `u_${userRow.idreg}`),
        uid: String(userRow.uid || `u_${userRow.idreg}`),
        username: userRow.username,
        topic: userRow.topic,
        pic: userRow.pic || "pic.png",
        pich: userRow.pich || "pich.png",
        msg: userRow.msg || "(عضو جديد)",
        power: userRow.power || "",
        rank: userRow.power || "",
        bg: userRow.bg || "#FFFFFF",
        gcol: userRow.gcol || "#FFFFFF",
        ucol: userRow.ucol || "#000000",
        mcol: userRow.mcol || "#000000",
        stat: userRow.busy ? 2 : 0,
        offline: false,
        co: countryCode,
        ico: userRow.ico || "",
        gift_ico: userRow.gift_ico || "",
        documents: Boolean(userRow.documentationc),
        documentationc: Boolean(userRow.documentationc),
        yp: userRow.youtub || "",
        them: userRow.them || "",
        cover: userRow.cover || "",
        site_badge_id: userRow.site_badge_id || "",
        site_badge: siteBadge,
        roomid: targetRoom,
        islogin: "عضو",
        rep: Math.max(0, Number(userRow.rep || 0)),
        coin: Math.max(0, Number(userRow.coins || 0)),
        coins: Math.max(0, Number(userRow.coins || 0)),
        evaluation: Math.max(0, Number(userRow.evaluation || 0)),
        wall_post_likes: Math.max(0, Number(userRow.wall_post_likes || 0)),
        gifts_received_count: Math.max(0, Number(userRow.gifts_received_count || 0)),
        busy: Boolean(userRow.busy),
        alerts: Boolean(userRow.alerts),
        nopm: false,
        nonot: false,
        nopmcall: Boolean(userRow.nopmcall),
        nopmvideocall: Boolean(userRow.nopmvideocall),
        token: newToken,
        ip,
        fp,
        location: countryCode,
        refr: sanitizeDbText(parsed.data.refr, "web"),
        joinedAt: Date.now(),
        joinuser: Number(userRow.joinuser || Date.now()) || Date.now(),
        last_eval_login_day: userRow.last_eval_login_day || "",
        auto_power: userRow.auto_power || "",
        eval_awards: parseEvaluationAwardsJson(userRow.eval_awards_json),
        loginG: Boolean(userRow.loginG),
        stealth: isStealth,
        s: isStealth ? 1 : null,
        muted: Boolean(userRow.muted),
        ismuted: Boolean(userRow.muted),
        meta_ts: Date.now(),
      };

      socket.emit("msg", {
        cmd: "sagin",
        data: {
          msg: "ok",
          ttoken: newToken,
          room: targetRoom,
          id: socket.id,
          uid: memberSession.uid,
          username: memberSession.username,
          topic: memberSession.topic,
        },
      });

      await completeSessionEntry(socket, memberSession);
    },

    async handleMemberRegister(socket: Socket, rawData: unknown): Promise<void> {
      const ip = getSocketClientIp(socket);
      const rate = await ctx.securityGuard.consumeRateSlot(`auth:reg:${ip}`, 5, 60_000);
      if (!rate.ok) {
        emitNotice(socket, "الرجاء الانتظار قبل محاولة التسجيل مرة أخرى");
        return;
      }

      const limits = ctx.catalogStore.getLimits();
      if (!limits.allowreg) {
        emitNotice(socket, "التسجيل مغلق حالياً من قبل الإدارة");
        return;
      }

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const parsed = registerSchema.safeParse({
        username: String(d.username || "").trim(),
        password: String(d.password || ""),
        topic: d.topic ? String(d.topic).trim() : undefined,
        refr: String(d.refr || "web"),
        fp: String(d.fp || ""),
      });
      if (!parsed.success) {
        emitNotice(socket, "الرجاء إدخال اسم مستخدم وكلمة مرور صالحة");
        return;
      }

      const cleanUsername = sanitizeHtmlText(parsed.data.username).trim().toLowerCase();
      const topic = sanitizeHtmlText(parsed.data.topic || parsed.data.username).trim();
      if (cleanUsername.length < 2 || cleanUsername.length > limits.lengthUserReg) {
        emitNotice(socket, `اسم المستخدم يجب أن يكون بين 2 و ${limits.lengthUserReg} حرف`);
        return;
      }
      if (hasDisallowedNameWord(cleanUsername) || hasDisallowedNameWord(topic) || ctx.catalogStore.scanProhibitedWords(topic)) {
        emitNotice(socket, "هذا الاسم غير مسموح به");
        return;
      }

      const dev = extractDeviceFingerprint(socket);
      const fp = parsed.data.fp || dev.raw;
      const countryCode = await resolveSocketCountryCode(socket, ip);
      const ban = ctx.securityGuard.checkBan({ ip, fp, countryCode, username: cleanUsername, topic });
      if (ban.blocked) {
        emitNotice(socket, "انت محظور من التسجيل في الدردشة");
        return;
      }

      const { db } = getDb();
      const existing = await db
        .select({ idreg: users.idreg })
        .from(users)
        .where(sql`LOWER(${users.username}) = ${cleanUsername}`)
        .limit(1);
      if (existing[0]) {
        emitNotice(socket, "اسم المستخدم مسجل مسبقاً، اختر اسماً آخر");
        socket.emit("msg", { cmd: "nok", data: { msg: "اسم المستخدم مسجل مسبقاً" } });
        return;
      }

      if (await ctx.presenceDirectory.isUsernameTakenGlobally(cleanUsername, socket.id)) {
        emitNotice(socket, "هذا الاسم مستخدم حالياً في الدردشة");
        return;
      }

      const uid = crypto.randomBytes(12).toString("hex");
      const lid = crypto.randomBytes(10).toString("hex");
      const token = randomTokenHex(24);
      const nowStr = String(Date.now());
      const hashedPassword = hashPasswordSync(parsed.data.password);

      const [inserted] = await db
        .insert(users)
        .values({
          uid,
          lid,
          id: socket.id,
          username: cleanUsername,
          topic,
          password: hashedPassword,
          token,
          ip,
          fp: fp.slice(0, 250),
          joinuser: nowStr,
          lastssen: nowStr,
          pic: "pic.png",
          pich: "pich.png",
          msg: "(عضو جديد)",
        })
        .returning();

      if (!inserted) return;

      await ctx.securityGuard.recordLoginAttempt({
        state: "تسجيل",
        topic,
        username: cleanUsername,
        ip,
        code: countryCode,
        device: dev.raw,
        isin: "عضو",
      });

      const targetRoom = ctx.catalogStore.getDefaultRoomId();
      const memberSession: GatewaySession = {
        id: socket.id,
        idreg: inserted.idreg,
        lid,
        uid,
        username: cleanUsername,
        topic,
        pic: "pic.png",
        pich: "pich.png",
        msg: "(عضو جديد)",
        power: "",
        rank: "",
        bg: "#FFFFFF",
        gcol: "#FFFFFF",
        ucol: "#000000",
        mcol: "#000000",
        stat: 0,
        offline: false,
        co: countryCode,
        ico: "",
        gift_ico: "",
        documents: false,
        documentationc: false,
        yp: "",
        them: "",
        cover: "",
        site_badge_id: "",
        site_badge: "",
        roomid: targetRoom,
        islogin: "عضو",
        rep: 0,
        coin: 0,
        coins: 0,
        evaluation: 0,
        wall_post_likes: 0,
        gifts_received_count: 0,
        busy: false,
        alerts: false,
        nopm: false,
        nonot: false,
        nopmcall: false,
        nopmvideocall: false,
        token,
        ip,
        fp,
        location: countryCode,
        refr: sanitizeDbText(parsed.data.refr, "web"),
        joinedAt: Date.now(),
        joinuser: Date.now(),
        last_eval_login_day: "",
        auto_power: "",
        eval_awards: {},
        loginG: false,
        stealth: false,
        muted: false,
        ismuted: false,
        meta_ts: Date.now(),
      };

      socket.emit("msg", {
        cmd: "sagin",
        data: {
          msg: "ok",
          ttoken: token,
          room: targetRoom,
          id: socket.id,
          uid,
          username: cleanUsername,
          topic,
        },
      });
      await completeSessionEntry(socket, memberSession);
    },

    async handleReconnectToken(socket: Socket, rawData: unknown): Promise<void> {
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const token = String(d.token || d.ttoken || "").trim();
      const requestedRoomId = String(d.roomid || d.roomId || "").trim();
      if (!token) {
        socket.emit("msg", { cmd: "reauth_silent", data: { reason: "missing_token" } });
        return;
      }

      const existing = await ctx.presenceDirectory.getSessionByToken(token);
      if (existing) {
        const requestedRoom =
          requestedRoomId && ctx.catalogStore.getRoomById(requestedRoomId) ? requestedRoomId : "";
        const reassigned = await ctx.presenceDirectory.reassignSessionSocket(existing.id, socket, {
          roomId: requestedRoom || undefined,
        });
        if (reassigned) {
          await completeSessionEntry(socket, reassigned, { silent: true });
          socket.emit("msg", {
            cmd: "rc_room_state",
            data: { roomid: reassigned.roomid, ok: true },
          });
          return;
        }
      }

      // Fall back to persisted member token in PostgreSQL
      try {
        const { db } = getDb();
        const rows = await db.select().from(users).where(eq(users.token, token)).limit(1);
        const userRow = rows[0];
        if (!userRow) {
          socket.emit("msg", { cmd: "reauth_silent", data: { reason: "invalid_token" } });
          return;
        }

        const ip = getSocketClientIp(socket);
        const countryCode = await resolveSocketCountryCode(socket, ip);
        const dev = extractDeviceFingerprint(socket);
        const ban = ctx.securityGuard.checkBan({
          ip,
          fp: userRow.fp || dev.raw,
          countryCode,
          username: userRow.username,
          topic: userRow.topic,
        });
        if (ban.blocked) {
          socket.emit("msg", { cmd: "kicked", data: { reason: "banned" } });
          socket.disconnect(true);
          return;
        }

        const powers = ctx.catalogStore.getPowers();
        const canStealth = false;
        const targetRoom =
          requestedRoomId && ctx.catalogStore.getRoomById(requestedRoomId)
            ? requestedRoomId
            : ctx.catalogStore.getDefaultRoomId();
        const siteBadge = userRow.site_badge_id
          ? ctx.catalogStore.getSiteBadgeById(userRow.site_badge_id) || safeJsonParse(userRow.site_badge, "")
          : safeJsonParse(userRow.site_badge, "");

        const restored: GatewaySession = {
          id: socket.id,
          idreg: userRow.idreg,
          lid: String(userRow.lid || userRow.uid || `u_${userRow.idreg}`),
          uid: String(userRow.uid || `u_${userRow.idreg}`),
          username: userRow.username,
          topic: userRow.topic,
          pic: userRow.pic || "pic.png",
          pich: userRow.pich || "pich.png",
          msg: userRow.msg || "(عضو جديد)",
          power: userRow.power || "",
          rank: userRow.power || "",
          bg: userRow.bg || "#FFFFFF",
          gcol: userRow.gcol || "#FFFFFF",
          ucol: userRow.ucol || "#000000",
          mcol: userRow.mcol || "#000000",
          stat: userRow.busy ? 2 : 0,
          offline: false,
          co: countryCode,
          ico: userRow.ico || "",
          gift_ico: userRow.gift_ico || "",
          documents: Boolean(userRow.documentationc),
          documentationc: Boolean(userRow.documentationc),
          yp: userRow.youtub || "",
          them: userRow.them || "",
          cover: userRow.cover || "",
          site_badge_id: userRow.site_badge_id || "",
          site_badge: siteBadge,
          roomid: targetRoom,
          islogin: "عضو",
          rep: Math.max(0, Number(userRow.rep || 0)),
          coin: Math.max(0, Number(userRow.coins || 0)),
          coins: Math.max(0, Number(userRow.coins || 0)),
          evaluation: Math.max(0, Number(userRow.evaluation || 0)),
          wall_post_likes: Math.max(0, Number(userRow.wall_post_likes || 0)),
          gifts_received_count: Math.max(0, Number(userRow.gifts_received_count || 0)),
          busy: Boolean(userRow.busy),
          alerts: Boolean(userRow.alerts),
          nopm: false,
          nonot: false,
          nopmcall: Boolean(userRow.nopmcall),
          nopmvideocall: Boolean(userRow.nopmvideocall),
          token,
          ip,
          fp: userRow.fp || dev.raw,
          location: countryCode,
          refr: "web",
          joinedAt: Date.now(),
          joinuser: Number(userRow.joinuser || Date.now()) || Date.now(),
          last_eval_login_day: userRow.last_eval_login_day || "",
          auto_power: userRow.auto_power || "",
          eval_awards: parseEvaluationAwardsJson(userRow.eval_awards_json),
          loginG: Boolean(userRow.loginG),
          stealth: canStealth,
          s: null,
          muted: Boolean(userRow.muted),
          ismuted: Boolean(userRow.muted),
          meta_ts: Date.now(),
        };

        await completeSessionEntry(socket, restored, { silent: true });
        socket.emit("msg", {
          cmd: "rc_room_state",
          data: { roomid: restored.roomid, ok: true },
        });
      } catch {
        socket.emit("msg", { cmd: "reauth_silent", data: { reason: "reconnect_error" } });
      }
    },

    async handleLogout(socket: Socket): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;
      session.loggedOut = true;
      await disconnectUserSession(ctx, socket.id, { forceImmediate: true, reason: "logout" });
    },

    async handleRoomLeaveSocket(socket: Socket): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.roomid) return;
      const roomId = session.roomid;
      await ctx.micStageManager.clearUserFromStage(roomId, socket.id, { evictFromMediaRoom: true });
      await ctx.carromManager.syncRoomGame(roomId);
      await ctx.ludoManager.syncRoomGame(roomId);
      await ctx.presenceDirectory.moveUserToRoom(socket, session, null);
    },

    async handleClientTrace(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !rawData || typeof rawData !== "object") return;
      const trace = sanitizeHtmlText(JSON.stringify(rawData)).slice(0, 240);
      await ctx.securityGuard.recordModerationStat({
        state: "تتبع عميل",
        topic: session.topic,
        targetTopic: trace,
        room: session.roomid || "",
        ip: session.ip,
      });
    },

    async handleGh(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      const roomId = String(
        (rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>).roomid : "") ||
          session?.roomid ||
          ctx.catalogStore.getDefaultRoomId(),
      ).trim();
      const history = await getRecentChatMessages<Record<string, unknown>>("room", roomId, 30).catch(() => []);
      socket.emit("msg", { cmd: "gh", data: { roomid: roomId, messages: history } });
    },

    async handleIsStates(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      if (d.stat !== undefined) {
        const nextStat = Math.max(0, Math.min(3, Number(d.stat) || 0));
        await ctx.presenceDirectory.patchSession(socket.id, { stat: nextStat });
      }
      socket.emit("msg", {
        cmd: "isstates",
        data: {
          id: session.id,
          stat: session.stat,
          stealth: session.stealth,
          offline: session.offline,
        },
      });
    },

    handleVisibility(socket: Socket, rawData: unknown): void {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const state = String(d.state || d.visibilityState || "").trim().toLowerCase();
      if (state === "unloading" || state === "pagehide" || state === "beforeunload") {
        session.pageLifecycleExit = true;
        ctx.presenceDirectory.cancelBackgroundGrace(socket.id);
        return;
      }
      const hidden =
        typeof rawData === "boolean"
          ? rawData
          : Boolean(d.hidden ?? (state === "hidden"));
      session.pageHidden = hidden;
      if (!hidden) {
        session.pageLifecycleExit = false;
        ctx.presenceDirectory.cancelBackgroundGrace(socket.id);
      }
    },

    async handleIsVisitor(socket: Socket): Promise<void> {
      const dev = extractDeviceFingerprint(socket);
      const ip = getSocketClientIp(socket);
      try {
        const { db } = getDb();
        const rows = await db.select().from(owner).where(eq(owner.id, 1)).limit(1);
        const row = rows[0];
        if (row) {
          const visitors = safeJsonParse<string[]>(row.Vistor, []);
          const key = dev.raw || ip;
          if (key && !visitors.includes(key)) {
            visitors.push(key);
            await db
              .update(owner)
              .set({ Vistor: JSON.stringify(visitors.slice(-5000)) })
              .where(eq(owner.id, 1));
          }
        }
      } catch {
        // non-fatal
      }
    },

    async handleListHarm(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session) return;
      const serialized = JSON.stringify(rawData ?? {});
      if (hasSuspiciousScriptToken(serialized)) {
        await ctx.securityGuard.recordModerationStat({
          state: "محاولة حقن",
          topic: session.topic,
          targetTopic: sanitizeHtmlText(serialized).slice(0, 200),
          room: session.roomid || "",
          ip: session.ip,
        });
        emitAlert(socket, "تم رصد نشاط غير مصرح به");
      }
    },
  };
}
