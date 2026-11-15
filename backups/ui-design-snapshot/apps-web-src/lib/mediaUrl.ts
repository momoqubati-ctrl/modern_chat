/**
 * URL, color, asset-path, and Arabic timestamp helpers.
 */

export function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, "");
  }
  return "";
}

export function resolveGatewayBaseUrl(): string {
  const configured = import.meta.env.VITE_GATEWAY_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location.port === "3003") {
    return `${window.location.protocol}//${window.location.hostname}:3004`;
  }
  return "";
}

export function normalizeHexColor(raw: unknown, fallback = "#0f172a"): string {
  const val = String(raw ?? "").trim();
  if (!val) return fallback;
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val)) {
    return val;
  }
  if (/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val)) {
    return `#${val}`;
  }
  return fallback;
}

export function isSafeLinkUrl(rawUrl: unknown): boolean {
  const s = String(rawUrl ?? "").trim();
  if (!s) return false;
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  try {
    const parsed = new URL(s);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveAssetUrl(rawPath: unknown, subdir?: string, fallback = "/pic.png"): string {
  const raw = String(rawPath ?? "").trim();
  if (!raw) return fallback;
  if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }
  const clean = raw.replace(/^\/+/, "");
  const rootPublicFiles = new Set(["pic.png", "pic.webp", "pich.png", "pich.webp", "room.png", "room.webp", "prv1.png", "prv1.webp", "favicon.png", "tick.png"]);
  if (raw.startsWith("/")) {
    const base = resolveApiBaseUrl();
    return base ? `${base}${raw}` : raw;
  }
  if (rootPublicFiles.has(clean)) {
    return `/${clean}`;
  }
  if (clean.includes("/")) {
    const base = resolveApiBaseUrl();
    return base ? `${base}/${clean}` : `/${clean}`;
  }
  const targetPrefix = subdir ? `/${subdir.replace(/^\/+|\/+$/g, "")}` : "";
  const rel = `${targetPrefix}/${clean}`;
  const base = resolveApiBaseUrl();
  return base ? `${base}${rel}` : rel;
}

export function resolveCountryFlagUrl(countryCode: unknown): string {
  const cc = String(countryCode ?? "").trim().toLowerCase();
  if (!/^[a-z]{2,8}$/.test(cc)) return "";
  return `/flag/${cc}.png`;
}

export function formatTimeArabic(tsInput: unknown): string {
  const ts = Number(tsInput || 0);
  if (!Number.isFinite(ts) || ts <= 0) return "";
  try {
    return new Date(ts).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatDateTimeArabic(tsInput: unknown): string {
  const ts = Number(tsInput || 0);
  if (!Number.isFinite(ts) || ts <= 0) return "";
  try {
    return new Date(ts).toLocaleString("ar-EG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function getInitials(name: unknown): string {
  const clean = String(name ?? "").trim();
  return clean ? clean.slice(0, 1) : "؟";
}
