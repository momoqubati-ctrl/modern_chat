import type { Socket } from "socket.io";
import type { GatewayContext } from "../types/gateway.js";

export function createMicStageHandlers(ctx: GatewayContext) {
  async function handleStageEvent(socket: Socket, cmd: string, rawData: unknown): Promise<void> {
    const session = ctx.presenceDirectory.getLocalSession(socket.id);
    if (!session || !session.roomid) return;

    const roomId = session.roomid;
    const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
    const slotNum = Number(d.it ?? d.slot ?? d.slotId ?? 0);

    switch (cmd) {
      case "all": {
        await ctx.micStageManager.emitStateToSocket(socket, roomId);
        const reqs = ctx.micStageManager.getStageRequests(roomId);
        socket.emit("broadcasting", {
          cmd: "stage-request-list",
          roomid: roomId,
          requests: reqs,
        });
        break;
      }

      case "heartbeat": {
        await ctx.micStageManager.touchSlotHeartbeat(socket.id, roomId);
        break;
      }

      case "leave":
      case "rleave": {
        await ctx.micStageManager.clearUserFromStage(roomId, socket.id);
        break;
      }

      case "new": {
        const rate = await ctx.securityGuard.consumeRateSlot(`micnew:${socket.id}`, 8, 10_000);
        if (!rate.ok) return;
        await ctx.micStageManager.handleTakeSlot(socket, roomId, slotNum);
        break;
      }

      case "lock":
      case "lock-slot":
      case "unlock-slot": {
        await ctx.micStageManager.handleLockSlot(socket, roomId, cmd, slotNum, d.ev);
        break;
      }

      case "lock-all-empty": {
        await ctx.micStageManager.lockAllEmptySlots(socket, roomId);
        break;
      }

      case "unlock-all": {
        await ctx.micStageManager.unlockAllSlots(socket, roomId);
        break;
      }

      case "stage-request":
      case "raise-hand": {
        const rate = await ctx.securityGuard.consumeRateSlot(`micreq:${socket.id}`, 6, 10_000);
        if (!rate.ok) return;
        const requests = ctx.micStageManager.addStageRequest(roomId, {
          socketId: socket.id,
          topic: session.topic,
          pic: session.pic || "pic.png",
          slot: slotNum || 0,
        });
        ctx.io.to(roomId).emit("broadcasting", {
          cmd: "stage-request-list",
          roomid: roomId,
          requests,
        });
        break;
      }

      case "stage-request-cancel": {
        const requests = ctx.micStageManager.removeStageRequest(roomId, socket.id);
        ctx.io.to(roomId).emit("broadcasting", {
          cmd: "stage-request-list",
          roomid: roomId,
          requests,
        });
        break;
      }

      case "stage-request-approve": {
        const targetId = String(d.target || d.user || "").trim();
        if (!targetId) return;
        const targetSession = await ctx.presenceDirectory.getDistributedSession(targetId);
        if (targetSession) {
          (targetSession as any)._stageApproved = true;
          const targetSocket = ctx.io.sockets.sockets.get(targetId);
          if (targetSocket) {
            (targetSocket as any)._stageApproved = true;
            targetSocket.emit("broadcasting", {
              cmd: "stage-request-approved",
              roomid: roomId,
              slot: slotNum,
            });
            if (slotNum > 0) {
              await ctx.micStageManager.handleTakeSlot(targetSocket, roomId, slotNum);
            }
          }
        }
        const requests = ctx.micStageManager.removeStageRequest(roomId, targetId);
        ctx.io.to(roomId).emit("broadcasting", {
          cmd: "stage-request-list",
          roomid: roomId,
          requests,
        });
        break;
      }

      case "stage-request-reject": {
        const targetId = String(d.target || d.user || "").trim();
        if (!targetId) return;
        const requests = ctx.micStageManager.removeStageRequest(roomId, targetId);
        ctx.io.to(roomId).emit("broadcasting", {
          cmd: "stage-request-list",
          roomid: roomId,
          requests,
        });
        break;
      }

      case "stage-invite": {
        const targetId = String(d.target || d.user || "").trim();
        if (!targetId || targetId === socket.id) return;
        const targetSocket = ctx.io.sockets.sockets.get(targetId);
        if (targetSocket) {
          targetSocket.emit("broadcasting", {
            cmd: "stage-invite-offer",
            roomid: roomId,
            slot: slotNum || 0,
            hostTopic: session.topic,
          });
        }
        break;
      }

      case "req-room-likes": {
        const total = await ctx.micStageManager.getRoomLikes(roomId);
        socket.emit("broadcasting", {
          cmd: "room-likes",
          roomid: roomId,
          total,
        });
        break;
      }

      case "room-like": {
        const rate = await ctx.securityGuard.consumeRateSlot(`roomlike:${socket.id}`, 30, 5_000);
        if (!rate.ok) return;
        const count = Math.max(1, Math.min(20, Number(d.count || 1)));
        const total = await ctx.micStageManager.incrementRoomLikes(roomId, count);
        ctx.io.to(roomId).emit("broadcasting", {
          cmd: "room-like",
          roomid: roomId,
          user: session.topic,
          count,
          total,
        });
        break;
      }

      case "sound-fx": {
        const rate = await ctx.securityGuard.consumeRateSlot(`micsfx:${socket.id}`, 10, 5_000);
        if (!rate.ok) return;
        const sound = String(d.sound || d.name || "applause").trim();
        ctx.io.to(roomId).emit("broadcasting", {
          cmd: "sound-fx",
          roomid: roomId,
          sound,
          user: session.topic,
        });
        break;
      }

      case "mic-state": {
        const targetId = String(d.user || d.id || socket.id).trim();
        await ctx.micStageManager.setParticipantMuted(socket, roomId, targetId, d.muted);
        break;
      }

      case "speaking": {
        const rate = await ctx.securityGuard.consumeRateSlot(`micspk:${socket.id}`, 25, 5_000);
        if (!rate.ok) return;

        const speaking = Boolean(d.speaking ?? d.active ?? false);
        if (speaking) {
          const allowed = await ctx.micStageManager.isUserAllowedToPublish(roomId, socket.id);
          if (!allowed) return;
        } else {
          const seated = await ctx.micStageManager.isUserOnStage(socket.id, roomId);
          if (!seated) return;
        }

        socket.to(roomId).emit("broadcasting", {
          cmd: "speaking",
          user: socket.id,
          speaking,
          roomid: roomId,
        });
        break;
      }

      case "listener-ready": {
        const rate = await ctx.securityGuard.consumeRateSlot(`miclr:${socket.id}`, 12, 10_000);
        if (!rate.ok) return;

        const targetId = String(d.target || d.to || "").trim();
        if (targetId && targetId !== socket.id) {
          const targetSession = await ctx.presenceDirectory.getDistributedSession(targetId);
          if (!targetSession || targetSession.roomid !== roomId || targetSession.offline) return;
          const targetOnStage = await ctx.micStageManager.isUserOnStage(targetId, roomId);
          if (!targetOnStage) return;

          ctx.io.to(targetId).emit("broadcasting", {
            cmd: "listener-ready",
            user: socket.id,
            roomid: roomId,
            target: targetId,
          });
        } else {
          socket.to(roomId).emit("broadcasting", {
            cmd: "listener-ready",
            user: socket.id,
            roomid: roomId,
            target: "",
          });
        }
        break;
      }

      case "send": {
        const serializedSize = JSON.stringify(d).length;
        if (serializedSize > 65_536) return;

        const rate = await ctx.securityGuard.consumeRateSlot(`micsig:${socket.id}`, 60, 10_000);
        if (!rate.ok) return;

        const targetId = String(d.target || d.to || "").trim();
        if (!targetId || targetId === socket.id) return;

        const targetSession = await ctx.presenceDirectory.getDistributedSession(targetId);
        if (!targetSession || targetSession.roomid !== roomId || targetSession.offline) return;

        // Enforce stage discipline: WebRTC signal pairs must involve at least one seated stage occupant
        const senderOnStage = await ctx.micStageManager.isUserOnStage(socket.id, roomId);
        const targetOnStage = await ctx.micStageManager.isUserOnStage(targetId, roomId);
        if (!senderOnStage && !targetOnStage) return;

        ctx.io.to(targetId).emit("broadcasting", {
          ...d,
          cmd: "send",
          user: socket.id,
          roomid: roomId,
          to: targetId,
          target: targetId,
        });
        break;
      }
    }
  }

  async function handleRemic(socket: Socket, rawData: unknown): Promise<void> {
    const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
    const targetId = String(d.id || d.user || rawData || socket.id).trim();
    if (!targetId) return;
    await ctx.micStageManager.handleRemic(socket, targetId);
  }

  return {
    handleStageEvent,
    handleRemic,
  };
}
