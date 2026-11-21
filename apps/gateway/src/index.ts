import http from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { closeDb, closeRedis, ensureAllDatabaseTablesExist, getDb, getRedis, sql } from "@newchat/db";
import Redis from "ioredis";
import { Server, type Socket } from "socket.io";
import msgpackParser from "socket.io-msgpack-parser";
import { gatewayConfig } from "./config.js";
import { createAuthHandlers, disconnectUserSession, loadInitialStories } from "./handlers/authHandlers.js";
import { createCallsMediaHandlers } from "./handlers/callsMediaHandlers.js";
import { createEconomyGamesHandlers } from "./handlers/economyGamesHandlers.js";
import { createMessagingHandlers } from "./handlers/messagingHandlers.js";
import { createMicStageHandlers } from "./handlers/micStageHandlers.js";
import { createNotesHandlers } from "./handlers/notesHandlers.js";
import { createProfileSocialHandlers } from "./handlers/profileSocialHandlers.js";
import { createRoomHandlers } from "./handlers/roomHandlers.js";
import { emitGatewayError, getSocketClientIp } from "./lib/socketUtils.js";
import { registerCarromNamespace } from "./namespaces/carromNamespace.js";
import { registerLudoNamespace } from "./namespaces/ludoNamespace.js";
import { BusBridge } from "./services/busBridge.js";
import { CarromManager } from "./services/carromManager.js";
import { CatalogStore } from "./services/catalogStore.js";
import { CompetitionEngine } from "./services/competitionEngine.js";
import { EvaluationEngine } from "./services/evaluationEngine.js";
import { LudoManager } from "./services/ludoManager.js";
import { MediaResolver } from "./services/mediaResolver.js";
import { MicStageManager } from "./services/micStageManager.js";
import { PresenceDirectory } from "./services/presenceDirectory.js";
import { SecurityGuard } from "./services/securityGuard.js";
import { TalkingBotCoordinator } from "./services/talkingBotCoordinator.js";
import type { GatewayContext } from "./types/gateway.js";

const ACTION_SHORTHAND_CMDS = new Set([
  "like",
  "not",
  "meiut",
  "kick",
  "ban",
  "delpic",
  "rinvite",
  "roomkick",
  "gift_icon",
]);

async function deleteKeysByPattern(redis: Redis, pattern: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 500);
    cursor = nextCursor;
    if (keys.length > 0) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== "0");
  return deleted;
}

export async function startGateway(externalHttpServer?: http.Server): Promise<{ io: Server; shutdown: () => Promise<void> }> {
  await ensureAllDatabaseTablesExist();
  const isStandalone = !externalHttpServer;
  const httpServer = externalHttpServer || http.createServer((req, res) => {
    if (req.url === "/healthz" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          ok: true,
          service: "newchat-gateway",
          gatewayId: gatewayConfig.gatewayId,
          ts: Date.now(),
        }),
      );
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("NewChat Gateway");
  });

  const io = new Server(httpServer, {
    parser: msgpackParser,
    transports: ["websocket", "polling"],
    allowUpgrades: true,
    pingInterval: gatewayConfig.pingIntervalMs,
    pingTimeout: gatewayConfig.pingTimeoutMs,
    maxHttpBufferSize: 5_242_880,
    cors: {
      origin: gatewayConfig.corsOrigins === "*" ? true : gatewayConfig.corsOrigins.split(",").map((s) => s.trim()),
      credentials: true,
    },
  });

  if (gatewayConfig.redisAdapterEnabled) {
    try {
      const pubClient = getRedis(gatewayConfig.redisUrl);
      const subClient = new Redis(gatewayConfig.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
      subClient.on("error", (err) => {
        console.error("[Gateway RedisSub] error:", err.message);
      });
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Gateway] Socket.IO Redis Adapter connected (Memurai/Redis).");
    } catch (err) {
      console.warn("[Gateway] Redis Adapter fallback to local memory:", err);
    }
  }

  // Optional C++ uWebSockets.js transport (enabled on Linux production with UWS_ENABLED=1)
  if (gatewayConfig.uwsEnabled) {
    try {
      const uwsPkg = "uWebSockets.js";
      const uws = (await import(uwsPkg)) as { App: () => { listen: (port: number, cb: (token: unknown) => void) => void } };
      const uwsApp = uws.App();
      (io as unknown as { attachApp: (app: unknown) => void }).attachApp(uwsApp);
      uwsApp.listen(gatewayConfig.uwsPort, (token: unknown) => {
        if (token) {
          console.log(`[Gateway:uWS] Listening on port ${gatewayConfig.uwsPort}`);
        }
      });
    } catch {
      console.warn("[Gateway:uWS] Unavailable in current environment; using HTTP/WS transport.");
    }
  }

  // Flush all stale presence and invalidate previous sessions on restart
  try {
    const redis = getRedis(gatewayConfig.redisUrl);
    await redis.del(
      "newchat:presence:users",
      "newchat:presence:rooms",
      "newchat:presence:virtual",
      "newchat:presence:pinned",
      "newchat:session:tokens",
      "newchat:cache:bootstrap:default",
    );
    const bootEpoch = Date.now();
    await redis.set("newchat:server:boot_epoch", String(bootEpoch));

    // Every session is invalidated on restart, so all room membership sets,
    // uid sockets, and stage occupant data are stale too.
    // Leaving them behind made listener/room counters grow forever across restarts.
    const [staleRoomMemberSets, staleUidSockets, staleStageOccupants, staleRoomMics] =
      await Promise.all([
        deleteKeysByPattern(redis, "newchat:room:*:members"),
        deleteKeysByPattern(redis, "newchat:uid_sockets:*"),
        deleteKeysByPattern(redis, "newchat:stage:occupant:*"),
        deleteKeysByPattern(redis, "newchat:room:mics:*"),
      ]);
    await redis.del("newchat:stage:active_occupants", "newchat:stage:reconcile_lock");

    const { db } = getDb();
    await db.execute(sql`UPDATE users SET token = md5(random()::text || clock_timestamp()::text)`);
    console.log(
      `[Gateway] All sessions and presence flushed for restart. Cleaned: ${staleRoomMemberSets} room member sets, ${staleUidSockets} uid sets, ${staleRoomMics} stage states. Boot epoch: ${bootEpoch}`,
    );
  } catch (err) {
    console.error("[Gateway] Failed to flush presence/sessions on restart:", err);
  }

  const catalogStore = new CatalogStore();
  await catalogStore.initialize();
  // Warm filter & shortcut caches at boot so even first message doesn't wait on DB
  await Promise.allSettled([
    catalogStore.getFilterService().warmFilterCache(),
    catalogStore.getShortcutService().warmShortcutCache(),
  ]);

  const securityGuard = new SecurityGuard(catalogStore);
  const presenceDirectory = new PresenceDirectory(io, catalogStore);
  const evaluationEngine = new EvaluationEngine(io, catalogStore, presenceDirectory);
  const micStageManager = new MicStageManager(io, catalogStore, presenceDirectory);
  const carromManager = new CarromManager(io, catalogStore, presenceDirectory, micStageManager, evaluationEngine);
  const ludoManager = new LudoManager(io, catalogStore, presenceDirectory, evaluationEngine);
  const competitionEngine = new CompetitionEngine(io, catalogStore, presenceDirectory, evaluationEngine);
  const talkingBotCoordinator = new TalkingBotCoordinator(io, catalogStore, presenceDirectory);
  const mediaResolver = new MediaResolver();
  const busBridge = new BusBridge(io, catalogStore, presenceDirectory, talkingBotCoordinator);

  securityGuard.bindPresenceCallbacks({
    getSession: (socketId) => presenceDirectory.getLocalSession(socketId),
    findStaffWithBootEdit: () => presenceDirectory.findStaffWithBootEdit(),
  });

  micStageManager.bindCarromSyncCallback(async (roomId, reasonText) => {
    await carromManager.syncRoomGame(roomId, reasonText);
  });
  presenceDirectory.bindRoomMembershipChanged((roomId) => micStageManager.emitListenerCountToRoom(roomId));
  micStageManager.startMaintenanceLoop();

  busBridge.start();

  const ctx: GatewayContext = {
    io,
    catalogStore,
    securityGuard,
    presenceDirectory,
    evaluationEngine,
    micStageManager,
    competitionEngine,
    talkingBotCoordinator,
    carromManager,
    ludoManager,
    mediaResolver,
    disconnectUserSession: (socketId, opts) => disconnectUserSession(ctx, socketId, opts),
  };

  const authHandlers = createAuthHandlers(ctx);
  const roomHandlers = createRoomHandlers(ctx);
  const micStageHandlers = createMicStageHandlers(ctx);
  const messagingHandlers = createMessagingHandlers(ctx);
  const notesHandlers = createNotesHandlers(ctx);
  const profileSocialHandlers = createProfileSocialHandlers(ctx);
  const economyGamesHandlers = createEconomyGamesHandlers(ctx);
  const callsMediaHandlers = createCallsMediaHandlers(ctx);

  const storyFingerprint = (stories: Array<Record<string, unknown>>) =>
    JSON.stringify(
      stories.map((story) => [
        story.sid,
        Array.isArray(story.item)
          ? story.item.map((item) =>
              item && typeof item === "object" ? (item as Record<string, unknown>).id : null,
            )
          : [],
      ]),
    );
  let lastStoryFingerprint = "";
  let storyExpirySweepRunning = false;
  const runStoryExpirySweep = async () => {
    if (storyExpirySweepRunning) return;
    storyExpirySweepRunning = true;
    try {
      const activeStories = await loadInitialStories();
      const nextFingerprint = storyFingerprint(activeStories);
      if (lastStoryFingerprint && nextFingerprint !== lastStoryFingerprint) {
        io.emit("msg", { cmd: "stories", data: activeStories });
      }
      lastStoryFingerprint = nextFingerprint;
    } catch (error) {
      console.error("[Gateway] Story expiry sweep failed:", error);
    } finally {
      storyExpirySweepRunning = false;
    }
  };
  void runStoryExpirySweep();
  const storyExpiryTimer = setInterval(() => {
    void runStoryExpirySweep();
  }, 60_000);
  if (typeof storyExpiryTimer.unref === "function") storyExpiryTimer.unref();

  async function emitPresenceSnapshot(socket: Socket): Promise<void> {
    const sess = presenceDirectory.getLocalSession(socket.id);
    const list = await presenceDirectory.buildOnlineSnapshots(sess?.rank || sess?.power, socket.id);
    socket.emit("msg", { cmd: "presence_sync", data: list });
    socket.emit("msg", { cmd: "ulist", data: list });
  }

  async function runGuarded(socket: Socket, label: string, fn: () => Promise<void> | void): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(`[Gateway] Error in "${label}":`, err);
      emitGatewayError(socket, label, "internal_handler_error");
    }
  }

  io.on("connection", async (socket) => {
    const clientIp = getSocketClientIp(socket);
    if (await securityGuard.isIpDdosBlocked(clientIp)) {
      socket.emit("msg", { cmd: "kicked", data: { reason: "ddos_blocked" } });
      socket.disconnect(true);
      return;
    }

    socket.use(async (packet, next) => {
      const evName = String(packet[0] || "");
      if (evName === "__ping" || evName === "hb" || evName === "latency_probe") {
        next();
        return;
      }
      const allowed = await securityGuard.checkSocketFlood(socket.id, clientIp);
      if (!allowed) {
        return;
      }
      next();
    });

    socket.on("__ping", (ts: unknown) => {
      socket.emit("__pong", ts ?? Date.now());
    });

    socket.on("hb", () => {
      const sess = presenceDirectory.getLocalSession(socket.id);
      if (sess) {
        sess.meta_ts = Date.now();
      }
    });

    socket.on("latency_probe", (data: unknown, cb?: (res: unknown) => void) => {
      if (typeof cb === "function") cb({ serverTs: Date.now(), data });
    });

    socket.on("__visibility", (data: unknown) => {
      authHandlers.handleVisibility(socket, data);
    });

    socket.on("page_visibility", (data: unknown) => {
      authHandlers.handleVisibility(socket, data);
    });

    socket.on("rc", async (data: unknown) => {
      await runGuarded(socket, "rc", () => authHandlers.handleReconnectToken(socket, data));
    });

    socket.on("gh", async (data: unknown) => {
      await runGuarded(socket, "gh", () => authHandlers.handleGh(socket, data));
    });

    socket.on("isstates", async (data: unknown) => {
      await runGuarded(socket, "isstates", () => authHandlers.handleIsStates(socket, data));
    });

    socket.on("isVistor", async () => {
      await runGuarded(socket, "isVistor", () => authHandlers.handleIsVisitor(socket));
    });

    socket.on("listharm", async (data: unknown) => {
      await runGuarded(socket, "listharm", () => authHandlers.handleListHarm(socket, data));
    });

    socket.on("sync_presence", async () => {
      await runGuarded(socket, "sync_presence", () => emitPresenceSnapshot(socket));
    });

    socket.on("sync_presence_all", async () => {
      await runGuarded(socket, "sync_presence_all", () => emitPresenceSnapshot(socket));
    });

    socket.on("typing", (data: unknown) => {
      messagingHandlers.handleTypingEvent(socket, true, data);
    });

    socket.on("stopTyping", (data: unknown) => {
      messagingHandlers.handleTypingEvent(socket, false, data);
    });

    socket.on("broadcasting", async (payload: { cmd?: string } & Record<string, unknown>) => {
      if (!payload || typeof payload !== "object") return;
      await runGuarded(socket, "broadcasting", () =>
        micStageHandlers.handleStageEvent(socket, String(payload.cmd || ""), payload),
      );
    });

    socket.on("remic", async (data: unknown) => {
      await runGuarded(socket, "remic", () => micStageHandlers.handleRemic(socket, data));
    });

    socket.on("stor", async (data: unknown) => {
      await runGuarded(socket, "stor", () => profileSocialHandlers.handleStorySocketEvent(socket, "stor", data));
    });

    socket.on("sviw", async (data: unknown) => {
      await runGuarded(socket, "sviw", () => profileSocialHandlers.handleStorySocketEvent(socket, "sviw", data));
    });

    socket.on("storvi", async (data: unknown) => {
      await runGuarded(socket, "storvi", () => profileSocialHandlers.handleStorySocketEvent(socket, "storvi", data));
    });

    socket.on("remstorv", async (data: unknown) => {
      await runGuarded(socket, "remstorv", () => profileSocialHandlers.handleStorySocketEvent(socket, "remstorv", data));
    });

    socket.on("record_profile_visit", async (data: unknown) => {
      await runGuarded(socket, "record_profile_visit", () =>
        profileSocialHandlers.handleProfileVisitEvent(socket, "record_profile_visit", data),
      );
    });

    socket.on("get_profile_visitors", async (data: unknown) => {
      await runGuarded(socket, "get_profile_visitors", () =>
        profileSocialHandlers.handleProfileVisitEvent(socket, "get_profile_visitors", data),
      );
    });

    socket.on("get_profile_visitors_count", async (data: unknown) => {
      await runGuarded(socket, "get_profile_visitors_count", () =>
        profileSocialHandlers.handleProfileVisitEvent(socket, "get_profile_visitors_count", data),
      );
    });

    socket.on("mark_visits_seen", async (data: unknown) => {
      await runGuarded(socket, "mark_visits_seen", () =>
        profileSocialHandlers.handleProfileVisitEvent(socket, "mark_visits_seen", data),
      );
    });

    socket.on("allseen", () => {
      emitGatewayError(socket, "allseen", "unsupported_client_command");
    });

    socket.on("msg", async (envelope: { cmd?: string; data?: unknown }) => {
      if (!envelope || typeof envelope !== "object" || typeof envelope.cmd !== "string") return;
      const { cmd, data } = envelope;

      await runGuarded(socket, cmd, async () => {
        if (ACTION_SHORTHAND_CMDS.has(cmd)) {
          const payload =
            data && typeof data === "object"
              ? { ...(data as Record<string, unknown>), action: cmd }
              : { id: data, action: cmd };
          await economyGamesHandlers.handleActionCommand(socket, payload);
          return;
        }

        switch (cmd) {
          // Auth & session
          case "g":
            await authHandlers.handleGuestLogin(socket, data);
            break;
          case "sagin":
            await authHandlers.handleMemberLogin(socket, data);
            break;
          case "reg":
            await authHandlers.handleMemberRegister(socket, data);
            break;
          case "rc":
            await authHandlers.handleReconnectToken(socket, data);
            break;
          case "logout":
            await authHandlers.handleLogout(socket);
            socket.disconnect(true);
            break;
          case "rleave":
            await authHandlers.handleRoomLeaveSocket(socket);
            break;
          case "client_trace":
            await authHandlers.handleClientTrace(socket, data);
            break;
          case "gh":
            await authHandlers.handleGh(socket, data);
            break;
          case "isstates":
            await authHandlers.handleIsStates(socket, data);
            break;
          case "listharm":
            await authHandlers.handleListHarm(socket, data);
            break;
          case "sync_presence":
          case "sync_presence_all":
            await emitPresenceSnapshot(socket);
            break;

          // Rooms
          case "rjoin":
            await roomHandlers.handleRoomJoin(socket, data);
            break;
          case "r+":
            await roomHandlers.handleCreateRoom(socket, data);
            break;
          case "r^":
            await roomHandlers.handleEditRoom(socket, data);
            break;
          case "r-":
            await roomHandlers.handleDeleteRoom(socket, data);
            break;
          case "room_resume":
            await roomHandlers.handleRoomResume(socket, data);
            break;
          case "live-settings":
          case "room-live-settings":
            await roomHandlers.handleLiveSettingsUpdate(socket, data);
            break;

          // Messaging & Wall
          case "msg":
          case "room_message":
            await messagingHandlers.handleRoomChatMessage(socket, data);
            break;
          case "likemsg":
            await messagingHandlers.handleLikeRoomMessage(socket, data);
            break;
          case "delmsg":
            await messagingHandlers.handleDeleteRoomMessage(socket, data);
            break;
          case "bc":
          case "bc2":
            await messagingHandlers.handleWallBroadcast(socket, cmd, data);
            break;
          case "delbc":
            await messagingHandlers.handleDeleteWallPost(socket, data);
            break;
          case "sco":
          case "sco_reply":
            await messagingHandlers.handleWallComment(socket, cmd, data);
            break;
          case "likebc":
            await messagingHandlers.handleLikeWallPost(socket, data);
            break;
          case "pm":
          case "pmsg":
          case "ppmsg":
            await messagingHandlers.handlePrivateMessage(socket, cmd, data);
            break;
          case "pm_seen":
            await messagingHandlers.handlePmSeen(socket, data);
            break;
          case "pmsghide":
          case "ppmsghide":
            await messagingHandlers.handlePublicNoticeCmd(socket, cmd, data);
            break;
          case "nonot":
            await messagingHandlers.handleToggleNoNot(socket);
            break;
          case "nopm":
            await messagingHandlers.handleToggleNoPm(socket);
            break;
          case "sevf":
            await messagingHandlers.handleSaveStoryEvent(socket, data);
            break;
          case "stori": {
            const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
            if (
              d.link ||
              d.url ||
              d.src ||
              d.mediaUrl ||
              d.type === "text" ||
              d.mediaType === "text" ||
              d.caption
            ) {
              await messagingHandlers.handleSaveStoryEvent(socket, data);
            } else {
              await profileSocialHandlers.handleStorySocketEvent(socket, "stor", data);
            }
            break;
          }
          case "sendVoice":
            await messagingHandlers.handleSendVoice(socket, data);
            break;

          // Profile & Social & Mail & Stories & Visits
          case "unick":
            await profileSocialHandlers.handleUnick(socket, data);
            break;
          case "setpoweron":
            await profileSocialHandlers.handleSetPowerOn(socket, data);
            break;
          case "setprofile":
            await profileSocialHandlers.handleSetProfile(socket, data);
            break;
          case "setpic":
          case "setpic2":
            await profileSocialHandlers.handleSetPic(socket, cmd, data);
            break;
          case "chpass":
            await profileSocialHandlers.handleChangePassword(socket, data);
            break;
          case "setLikes":
            await profileSocialHandlers.handleSetLikes(socket, data);
            break;
          case "setMsg":
            await profileSocialHandlers.handleSetMsgStatus(socket, data);
            break;
          case "setSiteBadge":
            await profileSocialHandlers.handleSetSiteBadge(socket, data);
            break;
          case "bnr":
          case "bnr-":
          case "uthem":
          case "uthem-":
          case "ucover":
          case "ucover-":
          case "udro3":
          case "udro3-":
            await profileSocialHandlers.handleCosmeticToggle(socket, cmd, data);
            break;
          case "alerts":
            await profileSocialHandlers.handleToggleAlerts(socket);
            break;
          case "busy":
            await profileSocialHandlers.handleToggleBusy(socket);
            break;
          case "pm-call-toggle":
          case "pm-video-call-toggle":
            await profileSocialHandlers.handleToggleCallSetting(socket, cmd, data);
            break;
          case "follow_user":
          case "unfollow_user":
          case "get_follow_info":
            await profileSocialHandlers.handleFollowAction(socket, cmd, data);
            break;
          case "mail_search_users":
          case "mail_inbox":
          case "mail_sent":
          case "mail_send":
          case "mail_mark_read":
            await profileSocialHandlers.handleInternalMail(socket, cmd, data);
            break;
          case "stor":
          case "sviw":
          case "storvi":
          case "remstorv":
            await profileSocialHandlers.handleStorySocketEvent(socket, cmd, data);
            break;
          case "story_like_toggle":
          case "story_likes_get":
          case "story_comments_get":
          case "story_comment_add":
          case "story_comment_like":
          case "story_comment_delete":
            await profileSocialHandlers.handleStorySocialAction(socket, cmd, data);
            break;

          // Member Notes (Completely Separated from Stories)
          case "notes_get":
          case "get_notes":
            await notesHandlers.handleGetNotes(socket);
            break;
          case "note_publish":
          case "publish_note":
            await notesHandlers.handlePublishNote(socket, data);
            break;
          case "note_like_toggle":
            await notesHandlers.handleToggleNoteLike(socket, data);
            break;
          case "note_comment_add":
            await notesHandlers.handleAddNoteComment(socket, data);
            break;
          case "note_comment_like":
            await notesHandlers.handleToggleNoteCommentLike(socket, data);
            break;
          case "note_comment_delete":
            await notesHandlers.handleDeleteNoteComment(socket, data);
            break;
          case "note_comments_get":
            await notesHandlers.handleGetNoteComments(socket, data);
            break;
          case "note_delete":
            await notesHandlers.handleDeleteNote(socket, data);
            break;

          case "record_profile_visit":
          case "get_profile_visitors":
          case "get_profile_visitors_count":
          case "mark_visits_seen":
            await profileSocialHandlers.handleProfileVisitEvent(socket, cmd, data);
            break;

          // Economy, Moderation Actions, Carrom & Bots
          case "gift":
            await economyGamesHandlers.handleSendGift(socket, data);
            break;
          case "action":
          case "actions":
            await economyGamesHandlers.handleActionCommand(socket, data);
            break;
          case "carrom_manage":
          case "carrom_sync":
          case "carrom_join":
          case "carrom_leave":
          case "carrom_preview":
          case "carrom_shot":
            await economyGamesHandlers.handleCarromCmd(socket, cmd, data);
            break;
          case "ludo_manage":
          case "ludo_sync":
          case "ludo_join":
          case "ludo_leave":
          case "ludo_roll":
          case "ludo_move":
            await economyGamesHandlers.handleLudoCmd(socket, cmd, data);
            break;
          case "botbrb":
            await economyGamesHandlers.handleBotBrbCmd(socket, data);
            break;
          case "enterbot":
          case "enterbotall":
          case "exitbotall":
          case "deltbot":
          case "startbotchat":
          case "stopbotchat":
          case "addbots":
          case "addbots100":
          case "sendmsgbot":
            await economyGamesHandlers.handleTalkingBotCmd(socket, cmd, data);
            break;

          // Calls & Media
          case "call-request":
            await callsMediaHandlers.handleCallRequest(socket, data);
            break;
          case "call-accept":
            await callsMediaHandlers.handleCallAccept(socket, data);
            break;
          case "call-reject":
          case "calldeny":
          case "calldone":
            await callsMediaHandlers.handleCallRejectOrEnd(socket, cmd, data);
            break;
          case "pm-call-signal":
            await callsMediaHandlers.handlePmCallSignal(socket, data);
            break;
          case "calling":
            await callsMediaHandlers.handleCalling(socket, data);
            break;
          case "youtube":
            await callsMediaHandlers.handleYoutube(socket, data);
            break;
          case "youtube_search":
            await callsMediaHandlers.handleYoutubeSearch(socket, data);
            break;
          case "resolve_tiktok":
            await callsMediaHandlers.handleResolveTiktok(socket, data);
            break;

          // Mic Stage shortcuts over msg envelope
          case "all":
          case "heartbeat":
          case "leave":
          case "new":
          case "lock":
          case "lock-slot":
          case "unlock-slot":
          case "mic-state":
          case "speaking":
          case "listener-ready":
          case "send":
            await micStageHandlers.handleStageEvent(socket, cmd, data);
            break;

          default:
            break;
        }
      });
    });

    socket.on("room_message", async (data: unknown) => {
      await runGuarded(socket, "room_message", async () => {
        await messagingHandlers.handleRoomChatMessage(socket, data);
      });
    });

    socket.on("disconnect", async () => {
      await disconnectUserSession(ctx, socket.id).catch((err) => {
        console.error("[Gateway] disconnect cleanup error:", err);
      });
    });
  });

  const carromArenaNsp = registerCarromNamespace(io.of("/carrom"));
  const ludoArenaNsp = registerLudoNamespace(io.of("/ludo"));

  const shutdown = async () => {
    clearInterval(storyExpiryTimer);
    try {
      io.emit("msg", {
        cmd: "reauth_silent",
        data: { reason: "server_restart", message: "تمت إعادة تشغيل الخادم، يرجى تسجيل الدخول مجدداً" },
      });
    } catch {}
    ludoManager.stopAllTimers();
    carromArenaNsp.stopAllTimers();
    ludoArenaNsp.stopAllTimers();
    micStageManager.stopMaintenanceLoop();
    talkingBotCoordinator.stopTalkLoop();
    await busBridge.stop();
    io.close();
    if (isStandalone) {
      httpServer.close();
      await closeRedis();
      await closeDb();
      process.exit(0);
    }
  };

  if (isStandalone) {
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    httpServer.listen(gatewayConfig.port, gatewayConfig.host, () => {
      console.log(
        `[Gateway] Socket.IO (MsgPack) listening on http://${gatewayConfig.host}:${gatewayConfig.port}`,
      );
    });
  }

  return { io, shutdown };
}

const isMain =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith("gateway/src/index.ts") ||
    process.argv[1].endsWith("gateway/dist/index.js") ||
    process.argv[1].endsWith("gateway\\src\\index.ts") ||
    process.argv[1].endsWith("gateway\\dist\\index.js"));

if (isMain) {
  startGateway().catch((err) => {
    console.error("[Gateway] Fatal startup error:", err);
    process.exit(1);
  });
}
