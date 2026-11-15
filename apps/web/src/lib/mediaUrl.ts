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

function parseHexToRgb(hexStr: string): [number, number, number] | null {
  let clean = hexStr.replace(/^#/, "").trim();
  if (clean.length === 3 || clean.length === 4) {
    clean = clean.slice(0, 3).split("").map((c) => c + c).join("");
  }
  if (clean.length < 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rf:
        h = (gf - bf) / d + (gf < bf ? 6 : 0);
        break;
      case gf:
        h = (bf - rf) / d + 2;
        break;
      case bf:
        h = (rf - gf) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hNorm = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(hNorm) * 255),
    Math.round(hue2rgb(hNorm - 1 / 3) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rf, gf, bf] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rf + 0.7152 * gf + 0.0722 * bf;
}

/**
 * Ensures user colors (nicknames, messages) maintain high contrast and clarity
 * across light and dark themes. In light mode, light/faint pastels are darkened
 * while strictly preserving their original hue and saturation.
 */
export function adjustColorForTheme(
  rawColor: unknown,
  dark: boolean,
  options?: {
    fallbackDark?: string;
    fallbackLight?: string;
  }
): string {
  const fallback = dark
    ? (options?.fallbackDark || "#38bdf8")
    : (options?.fallbackLight || "#0369a1");

  const val = String(rawColor ?? "").trim();
  if (!val || val.toLowerCase() === "none") return fallback;

  const isAllZero = /^#?0{3,8}$/.test(val);
  if (dark && isAllZero) return fallback;

  const isAllWhite = /^#?[fF]{3,8}$/.test(val);
  if (!dark && (isAllWhite || isAllZero)) {
    return options?.fallbackLight || "#0f172a";
  }

  const rgb = parseHexToRgb(val);
  if (!rgb) return fallback;

  const lum = getRelativeLuminance(rgb[0], rgb[1], rgb[2]);
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  if (!dark) {
    // Light mode: background is white/light. If color is too light, darken it.
    if (lum > 0.22 || l > 0.42) {
      const targetL = s < 0.15 ? 0.20 : Math.min(l, 0.34);
      const targetS = Math.max(s, 0.65);
      const [newR, newG, newB] = hslToRgb(h, targetS, targetL);
      return rgbToHex(newR, newG, newB);
    }
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  } else {
    // Dark mode: background is dark. If color is too dark, brighten it.
    if (lum < 0.12 || l < 0.35) {
      const targetL = s < 0.15 ? 0.88 : Math.max(l, 0.65);
      const [newR, newG, newB] = hslToRgb(h, s, targetL);
      return rgbToHex(newR, newG, newB);
    }
    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
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

export { getCountryNameArabic, resolveCountryFlagUrl } from "./countryData.js";

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
