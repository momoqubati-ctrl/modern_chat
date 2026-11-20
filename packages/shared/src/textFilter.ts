export interface CompiledEktisarRule {
  regex: RegExp;
  replacement: string;
}

export function sanitizeHtmlText(text: unknown): string {
  return String(text ?? "").split("<").join("&#x3C;");
}

export function escapeHtmlFull(text: unknown): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toEnglishDigits(str: unknown): string {
  const input = String(str ?? "");
  const e = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const a = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];

  let out = input.replace(/[٠-٩]/g, (d) => String(e.indexOf(d)));
  out = out.replace(/[۰-۹]/g, (d) => String(a.indexOf(d)));
  for (let i = 0; i < 10; i += 1) {
    out = out.replace(persianNumbers[i]!, String(i)).replace(arabicNumbers[i]!, String(i));
  }
  return out;
}

const ARABIC_DIGIT_CHARS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicDigits(str: unknown): string {
  return String(str ?? "").replace(/[0-9]/g, (d) => ARABIC_DIGIT_CHARS[Number(d)] ?? d);
}

/**
 * Fast in-memory text shortcut replacement.
 * Automatically handles both Latin and Arabic-Indic numerals (e.g. س1 and س١).
 */
export function applyTextShortcuts(
  text: string,
  shortcuts?: ReadonlyArray<{ text1?: string; text2?: string; title?: string; msg?: string }>,
): string {
  const source = String(text ?? "");
  if (!source || !shortcuts || shortcuts.length === 0) return source;

  const map = new Map<string, string>();
  const triggers: string[] = [];

  for (const s of shortcuts) {
    const raw = String(s.text1 ?? s.title ?? "").trim();
    if (!raw) continue;
    const rep = String(s.text2 ?? s.msg ?? "");

    // 1. Direct trigger
    if (!map.has(raw)) {
      map.set(raw, rep);
      triggers.push(raw);
    }

    // 2. Latin digits variant (e.g. س١ -> س1)
    const latin = toEnglishDigits(raw);
    if (latin && !map.has(latin)) {
      map.set(latin, rep);
      triggers.push(latin);
    }

    // 3. Arabic digits variant (e.g. س1 -> س١)
    const arabic = toArabicDigits(latin || raw);
    if (arabic && !map.has(arabic)) {
      map.set(arabic, rep);
      triggers.push(arabic);
    }
  }

  if (triggers.length === 0) return source;

  // Sort triggers by length descending so longer phrases replace before subphrases
  triggers.sort((a, b) => b.length - a.length);

  const escaped = triggers.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(?<=^|[\\s\\p{P}])(${escaped.join("|")})(?=$|[\\s\\p{P}])`, "gu");

  let current = source;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = current.replace(regex, (match) => {
      const rep = map.get(match);
      return rep !== undefined ? rep : match;
    });
    if (next === current) break;
    current = next;
  }

  return current;
}

const ALLOWED_SEPARATOR = "\\s,;\"'|";

export function findWord(word: string, str: string): boolean {
  const safeWord = String(word || "");
  if (!safeWord) return false;
  const escaped = safeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(^.*[${ALLOWED_SEPARATOR}]${escaped}$)|(^${escaped}[${ALLOWED_SEPARATOR}].*)|(^${escaped}$)|(^.*[${ALLOWED_SEPARATOR}]${escaped}[${ALLOWED_SEPARATOR}].*$)`,
    "i",
  );
  return regex.test(String(str ?? ""));
}

export function matchesProhibitedWord(
  prohibitedList: readonly string[],
  input: string,
): string | null {
  const normalized = toEnglishDigits(input);
  for (const rawWord of prohibitedList) {
    const word = String(rawWord || "").trim();
    if (!word) continue;
    if (findWord(word, normalized) || findWord(word, input)) {
      return word;
    }
  }
  return null;
}

export function compileEktisarRules(
  cuts: ReadonlyArray<{ title?: string; msg?: string } | { ekti1?: string; ekti2?: string }>,
): CompiledEktisarRule[] {
  const out: CompiledEktisarRule[] = [];
  for (const row of cuts) {
    const item = String(
      ("title" in row ? row.title : undefined) ??
        ("ekti1" in row ? row.ekti1 : undefined) ??
        "",
    ).trim();
    const rep = String(
      ("msg" in row ? row.msg : undefined) ??
        ("ekti2" in row ? row.ekti2 : undefined) ??
        "",
    );
    if (!item) continue;
    try {
      const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out.push({
        regex: new RegExp(`(^| )${escaped}( |$|\\n)`),
        replacement: ` ${rep} `,
      });
    } catch {
      // ignore malformed regex pattern safely
    }
  }
  return out;
}

export class EktisarReplacer {
  private rules: CompiledEktisarRule[] = [];
  private readonly cache = new Map<string, string>();
  private readonly maxCacheEntries: number;

  constructor(maxCacheEntries = 500) {
    this.maxCacheEntries = Math.max(50, maxCacheEntries);
  }

  setRules(rules: CompiledEktisarRule[]): void {
    this.rules = Array.isArray(rules) ? rules : [];
    this.cache.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }

  replace(data: string): string {
    const source = String(data ?? "");
    if (!source) return "";
    if (source.length <= 450 && this.cache.has(source)) {
      const cached = this.cache.get(source)!;
      this.cache.delete(source);
      this.cache.set(source, cached);
      return cached;
    }
    let current = source;
    for (let pass = 0; pass < 3; pass += 1) {
      for (let i = 0; i < this.rules.length; i += 1) {
        const rule = this.rules[i]!;
        current = current.replace(rule.regex, rule.replacement);
      }
    }
    const sanitized = current.split("<").join("&#x3C;");
    if (source.length <= 450) {
      this.cache.set(source, sanitized);
      if (this.cache.size > this.maxCacheEntries) {
        const oldest = this.cache.keys().next();
        if (!oldest.done) {
          this.cache.delete(oldest.value);
        }
      }
    }
    return sanitized;
  }
}

export function replaceEktisar(
  data: string,
  rules: readonly CompiledEktisarRule[],
): string {
  let current = String(data ?? "");
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i]!;
      current = current.replace(rule.regex, rule.replacement);
    }
  }
  return current.split("<").join("&#x3C;");
}

export function stripWallLinkFromText(rawMsg: unknown, link: unknown): string {
  let safeText = String(rawMsg ?? "");
  const safeLink = String(link ?? "").trim();
  if (!safeText || !safeLink) {
    return safeText.trim();
  }
  const candidates = [safeLink];
  if (/^https?:\/\//i.test(safeLink)) {
    candidates.push(safeLink.replace(/^https?:\/\//i, ""));
  } else {
    candidates.push("https://" + safeLink.replace(/^\/+/, ""));
    candidates.push("http://" + safeLink.replace(/^\/+/, ""));
  }
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    safeText = safeText.split(value).join(" ");
    if (value.endsWith("/")) {
      safeText = safeText.split(value.slice(0, -1)).join(" ");
    } else {
      safeText = safeText.split(value + "/").join(" ");
    }
  }
  return safeText.replace(/\s{2,}/g, " ").trim();
}

export function buildWallTextMessage(
  rawMsg: unknown,
  link: unknown,
  limit = 1000,
  rules: readonly CompiledEktisarRule[] = [],
): string {
  const safeLink = sanitizeHtmlText(String(link ?? "").trim());
  const sliced = stripWallLinkFromText(rawMsg, link).slice(0, limit);
  const safeText = rules.length ? replaceEktisar(sliced, rules) : sanitizeHtmlText(sliced);
  if (safeText && safeLink) {
    return `${safeText} <a href="${safeLink}" class="uplink">${safeLink}</a>`;
  }
  if (safeText) return safeText;
  if (safeLink) return ` <a href="${safeLink}" class="uplink">${safeLink}</a>`;
  return "";
}

export function buildWallCardMessage(
  rawMsg: unknown,
  link: unknown,
  limit = 1000,
  rules: readonly CompiledEktisarRule[] = [],
): string {
  const safeLink = sanitizeHtmlText(String(link ?? "").trim());
  const sliced = stripWallLinkFromText(rawMsg, link).slice(0, limit);
  const safeText = rules.length ? replaceEktisar(sliced, rules) : sanitizeHtmlText(sliced);
  if (!safeLink) {
    return safeText;
  }
  return `<div class="ssss"><a href="${safeLink}" class="uplink">${safeLink}</a>${
    safeText ? `<br/>${safeText}` : ""
  }</div>`;
}

export function normalizeRoomMessageMode(mode: unknown): "real" | "local" {
  return String(mode || "").toLowerCase() === "local" ? "local" : "real";
}

export function normalizeRoomReplyPayload(
  reply: unknown,
  rules: readonly CompiledEktisarRule[] = [],
): { id: string; topic: string; msg: string } | null {
  if (!reply || typeof reply !== "object") {
    return null;
  }
  const source = reply as Record<string, unknown>;
  const rawMsg = String(source.msg || "").replace(/\s+/g, " ").trim();
  if (!rawMsg) {
    return null;
  }
  const rawTopic = String(source.topic || "").replace(/\s+/g, " ").trim();
  const topicSlice = (rawTopic || "رسالة").slice(0, 80);
  const msgSlice = rawMsg.slice(0, 180);
  return {
    id: String(source.id || "").trim().slice(0, 40),
    topic: rules.length
      ? replaceEktisar(topicSlice, rules)
      : sanitizeHtmlText(topicSlice),
    msg: rules.length
      ? replaceEktisar(msgSlice, rules)
      : sanitizeHtmlText(msgSlice),
  };
}

export function compactMessageData<T extends Record<string, unknown>>(data: T): Partial<T> {
  const source = data && typeof data === "object" ? data : ({} as T);
  const compacted: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if ((key === "_cid" || key === "reply" || key === "class") && value === "") continue;
    if ((key === "_cts" || key === "_srt" || key === "_sts") && !value) continue;
    if ((key === "bg" || key === "mcol" || key === "ucol") && value === "") continue;
    compacted[key] = value;
  }
  return compacted as Partial<T>;
}

export function normalizeBotPicturePath(pathValue: unknown, fallbackValue: string): string {
  const fallback = String(fallbackValue || "");
  const value = String(pathValue || "").trim();
  if (!value) return fallback;
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  ) {
    return value;
  }
  return "/" + value.replace(/^\/+/, "");
}

export function normalizeBrbText(text: unknown): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeCapitalsText(text: unknown): string {
  return toEnglishDigits(String(text ?? ""))
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[^\u0621-\u064Aa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeOddNumberAnswer(text: unknown): number | null {
  const match = toEnglishDigits(String(text ?? "")).match(/-?\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

export function normalizeActiveChatUsername(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function stringGen(length = 10): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  const count = Math.max(1, length);
  for (let i = 0; i < count; i += 1) {
    text += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return text;
}
