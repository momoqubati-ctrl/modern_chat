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

const secretCoinsKey = envStr("SECRET_COINS_KEY", "");
const secretCoinsEnabled =
  Boolean(secretCoinsKey) && secretCoinsKey !== "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";
const secretCoinsPath =
  "/_coins_" +
  crypto.createHash("sha256").update(secretCoinsKey || "disabled").digest("hex").slice(0, 20);
const jwtSecret = envStr("JWT_SECRET", "dev-newchat-jwt-secret-change-in-prod-32chars");

export const apiConfig = {
  nodeEnv: envStr("NODE_ENV", "development"),
  port: envNum("API_PORT", 3003),
  host: envStr("API_HOST", "0.0.0.0"),
  // Only trust proxy headers (X-Forwarded-For / CF-Connecting-IP ...) when the app
  // actually runs behind a reverse proxy. Otherwise clients could spoof their IP.
  trustProxyEnabled: envStr("TRUST_PROXY_ENABLED", "0") === "1",
  redisUrl: envStr("REDIS_URL", "redis://127.0.0.1:6379"),
  jwtSecret,
  jwtRefreshSecret: envStr("JWT_REFRESH_SECRET", "dev-newchat-refresh-secret-change-in-prod"),
  corsOrigins: envStr("CORS_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173"),
  agentPanelSessionSecret: envStr(
    "AGENT_PANEL_SESSION_SECRET",
    crypto.createHash("sha256").update(`${jwtSecret}:agent-panel`).digest("hex"),
  ),
  uploadDir: path.resolve(here, "../../../", envStr("UPLOAD_DIR", "uploads")),
  publicDir: path.resolve(here, "../../web/public"),
  maxUploadBytes: 50 * 1000 * 1000,
  ownerUsername: envStr("APP_OWNER_USERNAME", ""),
  ownerPassword: envStr("APP_OWNER_PASSWORD", ""),
  owner2Username: envStr("APP_OWNER2_USERNAME", ""),
  owner2Password: envStr("APP_OWNER2_PASSWORD", ""),
  systemUsername: envStr("SYSTEM_ACCOUNT_USERNAME", ""),
  systemPassword: envStr("SYSTEM_ACCOUNT_PASSWORD", ""),
  systemUsername2: envStr("SYSTEM_ACCOUNT2_USERNAME", ""),
  systemPassword2: envStr("SYSTEM_ACCOUNT2_PASSWORD", ""),
  ddosEnabled: envStr("DDOS_GUARD_ENABLED", "1") !== "0",
  giftPlatformFeePercent: 40,
  topupPendingExpiryMs: 30 * 60 * 1000,
  secretCoinsSessionTtlMs: 10 * 60 * 1000,
  agentPanelSessionTtlMs: 12 * 60 * 60 * 1000,
  livekitWsUrl: envStr("LIVEKIT_WS_URL", ""),
  livekitApiKey: envStr("LIVEKIT_API_KEY", ""),
  livekitApiSecret: envStr("LIVEKIT_API_SECRET", ""),
  livekitToken: envStr("LIVEKIT_TOKEN", ""),
  livekitRoomName: envStr("LIVEKIT_ROOM_NAME", "main"),
  secretCoinsEnabled,
  secretCoinsKey,
  secretCoinsPath,
  secretCoinsApiPath: `${secretCoinsPath}.nd`,
};
