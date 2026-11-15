import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, "../../../.env") });

function envStr(name: string, fallback = ""): string {
  const val = process.env[name];
  return val && val.trim() ? val.trim() : fallback;
}

function envNum(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const gatewayConfig = {
  nodeEnv: envStr("NODE_ENV", "development"),
  port: envNum("GATEWAY_PORT", 3004),
  host: envStr("GATEWAY_HOST", "0.0.0.0"),
  gatewayId: `${process.pid}-${crypto.randomBytes(4).toString("hex")}`,
  redisUrl: envStr("REDIS_URL", "redis://127.0.0.1:6379"),
  redisAdapterEnabled: envStr("SOCKET_REDIS_ENABLED", "1") !== "0",
  uwsEnabled: envStr("UWS_ENABLED", "0") === "1",
  uwsPort: envNum("UWS_PORT", 9443),
  pingIntervalMs: Math.max(10_000, envNum("SOCKET_PING_INTERVAL_MS", 20_000)),
  pingTimeoutMs: Math.max(60_000, envNum("SOCKET_PING_TIMEOUT_MS", 180_000)),
  uploadDir: path.resolve(here, "../../../", envStr("UPLOAD_DIR", "uploads")),
  youtubeApiKey: envStr("YOUTUBE_API_KEY", ""),
  maxRooms: Math.max(10, envNum("MAX_ROOMS", 100)),
  defaultRoomId: envStr("DEFAULT_ROOM_ID", "D8D8A9A9C00"),
  systemAccountUsername: envStr("SYSTEM_ACCOUNT_USERNAME", "system").toLowerCase(),
  ddosEnabled: envStr("DDOS_GUARD_ENABLED", "1") !== "0",
  ddosWindowMs: Math.max(2_000, envNum("DDOS_WINDOW_MS", 10_000)),
  ddosSocketLimit: Math.max(10, envNum("DDOS_SOCKET_LIMIT", 140)),
  ddosBlockMs: Math.max(60_000, envNum("DDOS_BLOCK_MS", 3 * 60 * 1000)),
  maxVoiceBytes: 3 * 1024 * 1024,
  corsOrigins: envStr("CORS_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173"),
  livekitWsUrl: envStr("LIVEKIT_WS_URL", ""),
  livekitApiKey: envStr("LIVEKIT_API_KEY", ""),
  livekitApiSecret: envStr("LIVEKIT_API_SECRET", ""),
};
