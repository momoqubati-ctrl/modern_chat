import { resolveLiveKitRuntimeConfig } from "@newchat/db";
import {
  RoomServiceClient,
  TrackSource,
  TrackType,
  type ParticipantInfo,
  type ParticipantPermission,
} from "livekit-server-sdk";
import { gatewayConfig } from "../config.js";

const KNOWN_ROOM_CACHE_TTL_MS = 60_000;

export function parseSafeLiveKitHttpBase(rawWsUrl: string, nodeEnv: string): string | null {
  const trimmed = String(rawWsUrl || "").trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (
    !["ws:", "wss:"].includes(parsed.protocol) ||
    (nodeEnv === "production" && parsed.protocol !== "wss:") ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    return null;
  }

  parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
  return parsed.toString().replace(/\/$/, "");
}

export class StageMediaAuthority {
  private cachedClient: RoomServiceClient | null = null;
  private cachedBase = "";
  private cachedKey = "";
  private cachedSecret = "";
  private readonly knownRooms = new Map<string, number>();

  constructor(private readonly getSiteSetting?: () => Record<string, unknown> | null | undefined) {}

  private resolveClient(): RoomServiceClient | null {
    const resolved = resolveLiveKitRuntimeConfig(this.getSiteSetting?.(), {
      wsUrl: gatewayConfig.livekitWsUrl,
      apiKey: gatewayConfig.livekitApiKey,
      apiSecret: gatewayConfig.livekitApiSecret,
      nodeEnv: gatewayConfig.nodeEnv,
    });
    if (!resolved.ready) {
      return null;
    }
    const base = parseSafeLiveKitHttpBase(resolved.wsUrl, gatewayConfig.nodeEnv);
    const key = resolved.apiKey;
    const secret = resolved.apiSecret;
    if (!base) return null;

    if (
      !this.cachedClient ||
      this.cachedBase !== base ||
      this.cachedKey !== key ||
      this.cachedSecret !== secret
    ) {
      this.cachedClient = new RoomServiceClient(base, key, secret);
      this.cachedBase = base;
      this.cachedKey = key;
      this.cachedSecret = secret;
    }
    return this.cachedClient;
  }

  async ensureMediaRoomExists(roomId: string): Promise<void> {
    const client = this.resolveClient();
    if (!client || !roomId) return;

    const cachedAt = this.knownRooms.get(roomId);
    if (cachedAt && Date.now() - cachedAt < KNOWN_ROOM_CACHE_TTL_MS) {
      return;
    }

    try {
      const existing = await client.listRooms([roomId]);
      if (!existing.some((r) => r.name === roomId)) {
        try {
          await client.createRoom({
            name: roomId,
            emptyTimeout: 300,
            departureTimeout: 20,
          });
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code !== "already_exists") {
            return;
          }
        }
      }
      this.knownRooms.set(roomId, Date.now());
    } catch {
      // Non-fatal when external LiveKit SFU is unreachable in local offline environments
    }
  }

  async evictMediaParticipant(roomId: string, participantIdentity: string): Promise<void> {
    const client = this.resolveClient();
    if (!client || !roomId || !participantIdentity) return;

    try {
      await client.removeParticipant(roomId, participantIdentity, {
        revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== "not_found") {
        console.warn("[StageMediaAuthority] Failed evicting participant:", {
          roomId,
          participantIdentity,
          err,
        });
      }
    }
  }

  private async applyParticipantPermission(
    client: RoomServiceClient,
    roomId: string,
    participant: ParticipantInfo,
    allowBroadcast: boolean,
  ): Promise<void> {
    const identity = participant.identity;
    const nextPermission: Partial<ParticipantPermission> = {
      canSubscribe: participant.permission?.canSubscribe ?? true,
      canPublish: allowBroadcast,
      canPublishData: false,
      canPublishSources: allowBroadcast ? [TrackSource.MICROPHONE] : [],
      hidden: participant.permission?.hidden ?? false,
      recorder: participant.permission?.recorder ?? false,
      canUpdateMetadata: participant.permission?.canUpdateMetadata ?? false,
      agent: participant.permission?.agent ?? false,
      canSubscribeMetrics: participant.permission?.canSubscribeMetrics ?? false,
      canManageAgentSession: participant.permission?.canManageAgentSession ?? false,
    };

    try {
      await client.updateParticipant(roomId, identity, { permission: nextPermission });
    } catch {
      if (!allowBroadcast) {
        await this.evictMediaParticipant(roomId, identity);
      }
      return;
    }

    if (!allowBroadcast) {
      const activeAudioTracks = participant.tracks.filter(
        (t) => t.type === TrackType.AUDIO && !t.muted,
      );
      if (activeAudioTracks.length > 0) {
        try {
          await Promise.all(
            activeAudioTracks.map((t) => client.mutePublishedTrack(roomId, identity, t.sid, true)),
          );
        } catch {
          await this.evictMediaParticipant(roomId, identity);
        }
      }
    }
  }

  async syncBroadcastPermission(
    roomId: string,
    participantIdentity: string,
    allowBroadcast: boolean,
  ): Promise<void> {
    const client = this.resolveClient();
    if (!client || !roomId || !participantIdentity) return;

    try {
      const participants = await client.listParticipants(roomId);
      const target = participants.find((p) => p.identity === participantIdentity);
      if (!target) return;
      await this.applyParticipantPermission(client, roomId, target, allowBroadcast);
    } catch {
      // Room might not exist yet on LiveKit SFU if no user has connected
    }
  }

  async reconcileActiveBroadcastRooms(expectedPublisherKeys: ReadonlySet<string>): Promise<void> {
    const client = this.resolveClient();
    if (!client) return;

    try {
      const activeRooms = await client.listRooms();
      for (const room of activeRooms) {
        const participants = await client.listParticipants(room.name);
        for (const participant of participants) {
          const compositeKey = `${room.name}\u0000${participant.identity}`;
          const shouldPublish = expectedPublisherKeys.has(compositeKey);
          const perm = participant.permission;
          const hasMicSource = Boolean(perm?.canPublishSources?.includes(TrackSource.MICROPHONE));
          const mismatch = shouldPublish
            ? !perm?.canPublish || Boolean(perm?.canPublishData) || !hasMicSource
            : Boolean(perm?.canPublish || perm?.canPublishData || participant.isPublisher);

          if (mismatch) {
            await this.applyParticipantPermission(client, room.name, participant, shouldPublish);
          }
        }
      }
    } catch {
      // Ignore transient LiveKit cloud/network hiccups during periodic reconciliation
    }
  }
}
