import crypto from "node:crypto";

export const LIVEKIT_CREDS_STORAGE_KEY = "livekitCreds";

export interface StoredLiveKitCredentials {
  wsUrl: string;
  encKey?: string;
  encSecret?: string;
  updatedAt?: number;
}

export interface LiveKitEnvFallback {
  wsUrl: string;
  apiKey: string;
  apiSecret: string;
  nodeEnv: string;
}

export interface LiveKitPublicMeta {
  wsUrl: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  source: "db" | "env" | "none";
  ready: boolean;
}

export interface LiveKitRuntimeConfig {
  wsUrl: string;
  apiKey: string;
  apiSecret: string;
  source: "db" | "env" | "none";
  ready: boolean;
}

const SEAL_SALT = "newchat-livekit-voice-creds-v1";
let cachedSealKey: Buffer | null = null;
let cachedSealSecretInput = "";

function deriveSealKey(): Buffer {
  const rawSecret =
    String(process.env.VOICE_CREDS_ENCRYPTION_KEY || process.env.JWT_SECRET || "").trim() ||
    "dev-newchat-jwt-secret-change-in-prod-32chars";
  if (cachedSealKey && cachedSealSecretInput === rawSecret) {
    return cachedSealKey;
  }
  cachedSealSecretInput = rawSecret;
  cachedSealKey = crypto.scryptSync(rawSecret, SEAL_SALT, 32);
  return cachedSealKey;
}

export function sealVoiceSecretValue(plainText: string): string {
  const trimmed = String(plainText || "").trim();
  if (!trimmed) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveSealKey(), iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function unsealVoiceSecretValue(cipherToken: unknown): string {
  const raw = String(cipherToken || "").trim();
  if (!raw) return "";
  const parts = raw.split(".");
  if (parts.length !== 3) return "";
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64!, "base64url");
    const tag = Buffer.from(tagB64!, "base64url");
    const encrypted = Buffer.from(dataB64!, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", deriveSealKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8").trim();
  } catch {
    return "";
  }
}

export function isValidLiveKitWsUrl(rawWsUrl: string, nodeEnv = "development"): boolean {
  const trimmed = String(rawWsUrl || "").trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return Boolean(
    ["ws:", "wss:"].includes(parsed.protocol) &&
      (nodeEnv !== "production" || parsed.protocol === "wss:") &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === "/" &&
      !parsed.search &&
      !parsed.hash,
  );
}

export function areValidLiveKitValues(
  wsUrl: string,
  apiKey: string,
  apiSecret: string,
  nodeEnv = "development",
): boolean {
  const cleanUrl = String(wsUrl || "").trim();
  const cleanKey = String(apiKey || "").trim();
  const cleanSecret = String(apiSecret || "").trim();
  if (!isValidLiveKitWsUrl(cleanUrl, nodeEnv)) return false;
  if (!cleanKey || cleanKey === "devkey" || cleanKey.endsWith("---")) return false;
  if (
    !cleanSecret ||
    cleanSecret.length < 32 ||
    cleanSecret === "secret_which_needs_to_be_at_least_32_characters_long_for_security"
  ) {
    return false;
  }
  return true;
}

function readStoredLiveKitRecord(siteObj: Record<string, unknown> | null | undefined): StoredLiveKitCredentials | null {
  if (!siteObj || typeof siteObj !== "object") return null;
  const raw = siteObj[LIVEKIT_CREDS_STORAGE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  return {
    wsUrl: String(obj.wsUrl || "").trim(),
    encKey: obj.encKey ? String(obj.encKey).trim() : undefined,
    encSecret: obj.encSecret ? String(obj.encSecret).trim() : undefined,
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : undefined,
  };
}

export function resolveLiveKitRuntimeConfig(
  siteObj: Record<string, unknown> | null | undefined,
  envFallback: LiveKitEnvFallback,
): LiveKitRuntimeConfig {
  const stored = readStoredLiveKitRecord(siteObj);
  const dbWsUrl = String(stored?.wsUrl || "").trim();
  const dbKey = unsealVoiceSecretValue(stored?.encKey);
  const dbSecret = unsealVoiceSecretValue(stored?.encSecret);
  const hasDbOverride = Boolean(dbWsUrl || dbKey || dbSecret);

  const wsUrl = dbWsUrl || String(envFallback.wsUrl || "").trim();
  const apiKey = dbKey || String(envFallback.apiKey || "").trim();
  const apiSecret = dbSecret || String(envFallback.apiSecret || "").trim();

  const source: "db" | "env" | "none" = hasDbOverride
    ? "db"
    : envFallback.wsUrl || envFallback.apiKey || envFallback.apiSecret
      ? "env"
      : "none";

  return {
    wsUrl,
    apiKey,
    apiSecret,
    source,
    ready: areValidLiveKitValues(wsUrl, apiKey, apiSecret, envFallback.nodeEnv),
  };
}

export function extractLiveKitPublicMeta(
  siteObj: Record<string, unknown> | null | undefined,
  envFallback: LiveKitEnvFallback,
): LiveKitPublicMeta {
  const cfg = resolveLiveKitRuntimeConfig(siteObj, envFallback);
  return {
    wsUrl: cfg.wsUrl,
    hasApiKey: Boolean(cfg.apiKey && cfg.apiKey !== "devkey" && !cfg.apiKey.endsWith("---")),
    hasApiSecret: Boolean(
      cfg.apiSecret &&
        cfg.apiSecret.length >= 32 &&
        cfg.apiSecret !== "secret_which_needs_to_be_at_least_32_characters_long_for_security",
    ),
    source: cfg.source,
    ready: cfg.ready,
  };
}

export function mergeLiveKitCredsIntoSite(
  siteObj: Record<string, unknown>,
  input: {
    wsUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    clear?: boolean;
  },
  nodeEnv = "development",
): { ok: true; nextSite: Record<string, unknown> } | { ok: false; msg: string } {
  const nextSite = { ...siteObj };
  if (input.clear) {
    delete nextSite[LIVEKIT_CREDS_STORAGE_KEY];
    return { ok: true, nextSite };
  }

  const prev = readStoredLiveKitRecord(nextSite);
  const nextWsUrl =
    input.wsUrl !== undefined ? String(input.wsUrl).trim() : String(prev?.wsUrl || "").trim();

  if (nextWsUrl && !isValidLiveKitWsUrl(nextWsUrl, nodeEnv)) {
    return {
      ok: false,
      msg: "رابط خادم LiveKit غير صالح — يجب أن يكون ws:// أو wss:// بدون مسار أو بيانات مصادقة",
    };
  }

  const cleanNewKey = input.apiKey !== undefined ? String(input.apiKey).trim() : "";
  const cleanNewSecret = input.apiSecret !== undefined ? String(input.apiSecret).trim() : "";

  if (cleanNewSecret && cleanNewSecret.length < 32) {
    return {
      ok: false,
      msg: "المفتاح السري LiveKit API Secret يجب ألا يقل عن 32 حرفاً",
    };
  }

  const nextEncKey = cleanNewKey ? sealVoiceSecretValue(cleanNewKey) : prev?.encKey;
  const nextEncSecret = cleanNewSecret ? sealVoiceSecretValue(cleanNewSecret) : prev?.encSecret;

  if (!nextWsUrl && !nextEncKey && !nextEncSecret) {
    delete nextSite[LIVEKIT_CREDS_STORAGE_KEY];
    return { ok: true, nextSite };
  }

  nextSite[LIVEKIT_CREDS_STORAGE_KEY] = {
    wsUrl: nextWsUrl,
    ...(nextEncKey ? { encKey: nextEncKey } : {}),
    ...(nextEncSecret ? { encSecret: nextEncSecret } : {}),
    updatedAt: Date.now(),
  };

  return { ok: true, nextSite };
}

export function stripSensitiveSiteFields(
  siteObj: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!siteObj || typeof siteObj !== "object") return {};
  const copy = { ...siteObj };
  delete copy[LIVEKIT_CREDS_STORAGE_KEY];
  return copy;
}
