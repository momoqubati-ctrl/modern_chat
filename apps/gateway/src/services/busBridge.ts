import { resolveLiveKitRuntimeConfig, subscribeBusEvents, type BusEvent } from "@newchat/db";
import { normalizeMicProviderSetting, verAdminPanel } from "@newchat/shared";
import type { Server } from "socket.io";
import { gatewayConfig } from "../config.js";
import { sanitizePublicRoom } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { PresenceDirectory } from "./presenceDirectory.js";
import type { TalkingBotCoordinator } from "./talkingBotCoordinator.js";

export class BusBridge {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly presenceDirectory: PresenceDirectory;
  private readonly talkingBotCoordinator: TalkingBotCoordinator;
  private subscription: { unsubscribe: () => Promise<void> } | null = null;

  constructor(
    io: Server,
    catalogStore: CatalogStore,
    presenceDirectory: PresenceDirectory,
    talkingBotCoordinator: TalkingBotCoordinator,
  ) {
    this.io = io;
    this.catalogStore = catalogStore;
    this.presenceDirectory = presenceDirectory;
    this.talkingBotCoordinator = talkingBotCoordinator;
  }

  start(): void {
    if (this.subscription) return;
    const sub = subscribeBusEvents((event) => this.handleEvent(event));
    this.subscription = sub;
  }

  async stop(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe().catch(() => undefined);
      this.subscription = null;
    }
  }

  private async handleEvent(event: BusEvent): Promise<void> {
    switch (event.type) {
      case "catalog_invalidate": {
        await this.catalogStore.refreshScopes(event.scopes);
        const scopes = new Set(event.scopes);
        if (scopes.has("all") || scopes.has("rooms")) {
          const counts = await this.presenceDirectory.getAllRoomCounts();
          const roomsList = this.catalogStore
            .getRooms()
            .map((r) => sanitizePublicRoom(r, counts[r.id] || 0));
          this.io.emit("msg", { cmd: "rlist", data: roomsList });
        }
        if (scopes.has("all") || scopes.has("powers")) {
          this.io.emit("msg", { cmd: "powers", data: this.catalogStore.getPowers() });
        }
        if (scopes.has("all") || scopes.has("gifts") || scopes.has("settings")) {
          this.io.emit("msg", {
            cmd: "gifts_git",
            data: {
              gifts: this.catalogStore.getGifts(),
              categories: this.catalogStore.getGiftCategories(),
            },
          });
        }
        if (scopes.has("all") || scopes.has("site") || scopes.has("settings")) {
          const siteSetting = this.catalogStore.getSiteSetting();
          const lkRuntime = resolveLiveKitRuntimeConfig(siteSetting, {
            wsUrl: gatewayConfig.livekitWsUrl,
            apiKey: gatewayConfig.livekitApiKey,
            apiSecret: gatewayConfig.livekitApiSecret,
            nodeEnv: gatewayConfig.nodeEnv,
          });
          this.io.emit("msg", {
            cmd: "mic_provider",
            data: {
              micProvider: normalizeMicProviderSetting(siteSetting.micprovider),
              liveKitWsUrl: lkRuntime.wsUrl,
            },
          });
        }
        if (scopes.has("all") || scopes.has("owner")) {
          const ownerState = this.catalogStore.getOwnerState();
          const setting = this.catalogStore.getSiteSetting();
          this.io.emit("msg", {
            cmd: "IsTv",
            data: {
              tv: ownerState.tv,
              pool: Boolean(setting.Pallbool),
              reply: Boolean(setting.Reply),
              love: Boolean(setting.Love),
            },
          });
          this.io.emit("msg", { cmd: "Maxrep", data: ownerState.maxRep });
          this.io.emit("msg", { cmd: "coom", data: ownerState.cooment });
        }
        if (scopes.has("all") || scopes.has("cuts")) {
          const rules = this.catalogStore.getShortcutRules();
          this.io.emit("msg", {
            cmd: "shortcuts",
            data: rules.map((r) => ({ text1: r.text1, text2: r.text2 })),
          });
        }
        break;
      }

      case "socket_broadcast": {
        if (event.volatile) {
          this.io.volatile.emit("msg", { cmd: event.cmd, data: event.data });
        } else {
          this.io.emit("msg", { cmd: event.cmd, data: event.data });
        }
        break;
      }

      case "socket_room_emit": {
        if (event.exceptSocketId) {
          this.io
            .to(event.roomId)
            .except(event.exceptSocketId)
            .emit("msg", { cmd: event.cmd, data: event.data });
        } else {
          this.io.to(event.roomId).emit("msg", { cmd: event.cmd, data: event.data });
        }
        break;
      }

      case "socket_direct_uid": {
        const localSockets = this.presenceDirectory.getLocalSocketIdsByUid(event.uid);
        for (const sid of localSockets) {
          const s = this.io.sockets.sockets.get(sid);
          if (s) {
            s.emit("msg", { cmd: event.cmd, data: event.data });
          }
        }
        break;
      }

      case "socket_direct_id": {
        const s = this.io.sockets.sockets.get(event.socketId);
        if (s) {
          s.emit("msg", { cmd: event.cmd, data: event.data });
        }
        break;
      }

      case "bot_chat_control": {
        if (event.action === "start") {
          await this.talkingBotCoordinator.startTalkLoop(event.message, event.intervalMs);
        } else {
          this.talkingBotCoordinator.stopTalkLoop();
        }
        break;
      }

      case "session_ev": {
        // Security parity: never emit executable JS scripts; convert to structured protocol commands
        const targetSockets = new Set<string>();
        if (event.socketId && this.io.sockets.sockets.has(event.socketId)) {
          targetSockets.add(event.socketId);
        }
        if (event.uid) {
          for (const sid of this.presenceDirectory.getLocalSocketIdsByUid(event.uid)) {
            targetSockets.add(sid);
          }
        }
        const scriptLower = String(event.script || "").toLowerCase();
        const cmd = scriptLower.includes("sagin(3)") || scriptLower.includes("reauth")
          ? "reauth_silent"
          : scriptLower.includes("removede")
            ? "removede"
            : "kicked";

        for (const sid of targetSockets) {
          const s = this.io.sockets.sockets.get(sid);
          if (!s) continue;
          s.emit("msg", { cmd, data: { reason: "session_control" } });
          if (event.disconnect) {
            setTimeout(() => {
              s.disconnect(true);
            }, 250);
          }
        }
        break;
      }

      case "coin_balance": {
        const safeCoins = Math.max(0, Number(event.coins || 0));
        const localSockets = this.presenceDirectory.getLocalSocketIdsByUid(event.uid);
        for (const sid of localSockets) {
          await this.presenceDirectory.patchSession(sid, {
            coin: safeCoins,
            coins: safeCoins,
          });
        }
        break;
      }

      case "topup_admin": {
        const powers = this.catalogStore.getPowers();
        for (const sess of this.presenceDirectory.getAllLocalSessions()) {
          if (verAdminPanel(powers, sess.rank || sess.power)) {
            const s = this.io.sockets.sockets.get(sess.id);
            if (s) {
              s.emit("msg", { cmd: "topup_admin", data: event.payload });
            }
          }
        }
        break;
      }
    }
  }
}
