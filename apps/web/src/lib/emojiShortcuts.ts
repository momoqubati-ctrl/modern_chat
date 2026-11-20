const DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d);
}

const ARABIC_DIGIT_MAP: Record<string, string> = {
  "0": "٠",
  "1": "١",
  "2": "٢",
  "3": "٣",
  "4": "٤",
  "5": "٥",
  "6": "٦",
  "7": "٧",
  "8": "٨",
  "9": "٩",
};

export function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => ARABIC_DIGIT_MAP[d] ?? d);
}

/** Shortcut shown under each smiley in the picker: ف1, ف2, ... */
export function emojiShortcut(index: number): string {
  return `ف${index + 1}`;
}

/** Shared display size for smiley images in attachments. */
export const EMOJI_IMAGE_CLASS = "w-4 h-4 object-contain";

/** Inline smiley image style inside text blocks (preserves line-height & baseline). */
export const EMOJI_INLINE_CLASS = "inline-block w-5 h-5 align-middle object-contain mx-0.5 select-none";

/** True when an attachment path points at a smiley from the emo gallery. */
export function isEmojiAssetPath(file: unknown): boolean {
  const normalized = String(file ?? "")
    .replace(/\\/g, "/")
    .split(/[?#]/)[0];
  return /(^|\/)emo\//i.test(normalized ?? "");
}

/**
 * Resolves a whole-message smiley shortcut such as "ف1" (or "ف١", "ف_1") to the
 * matching emo file, using the same order shown in the picker.
 */
export function resolveEmojiShortcut(text: string, emos: readonly string[]): string | null {
  const match = text.trim().match(/^ف[\s_-]*([0-9٠-٩۰-۹]+)$/u);
  if (!match) return null;
  const index = Number(toLatinDigits(match[1] ?? ""));
  if (!Number.isInteger(index) || index < 1 || index > emos.length) return null;
  return emos[index - 1] ?? null;
}

export type SmileySegment =
  | { type: "text"; text: string }
  | { type: "emoji"; shortcut: string; file: string; index: number };

/**
 * Parses any message text into sequential text & smiley segments, preserving
 * the exact order and position in which shortcuts (ف1, ف2, ...) were typed.
 */
export function parseEmojiSegments(
  text: string,
  emos: readonly string[]
): SmileySegment[] {
  const source = String(text ?? "");
  if (!source || !emos || emos.length === 0) {
    return [{ type: "text", text: source }];
  }

  // Matches shortcuts like ف1, ف2, ف_1, ف-1, ف١, etc.
  // Boundaries ensure it doesn't match inside Arabic words like وقف1 or صف1.
  const regex = /(?:^|(?<=[\s\p{P}\d]))ف[\s_-]*([0-9٠-٩۰-۹]+)(?=$|[\s\p{P}]|(?=ف))/gu;
  const segments: SmileySegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const rawMatch = match[0];
    const num = Number.parseInt(toLatinDigits(match[1] ?? ""), 10);

    if (Number.isInteger(num) && num >= 1 && num <= emos.length) {
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          text: source.slice(lastIndex, match.index),
        });
      }
      segments.push({
        type: "emoji",
        shortcut: rawMatch,
        file: emos[num - 1]!,
        index: num - 1,
      });
      lastIndex = match.index + rawMatch.length;
    }
  }

  if (lastIndex < source.length) {
    segments.push({
      type: "text",
      text: source.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: "text", text: source }];
}

/**
 * Expands text shortcuts (such as "س1" -> "السلام عليكم ورحمة الله وبركاتة")
 * on client-side before sending, preserving smileys & surrounding text.
 */
export function applyTextShortcuts(
  text: string,
  shortcuts?: readonly { text1?: string; text2?: string; title?: string; msg?: string; name?: string; value?: string }[]
): string {
  const source = String(text ?? "");
  if (!source || !shortcuts || shortcuts.length === 0) return source;

  const valid = shortcuts
    .map((s) => ({
      text1: String(s.text1 ?? s.title ?? s.name ?? "").trim(),
      text2: String(s.text2 ?? s.msg ?? s.value ?? ""),
    }))
    .filter((s) => s.text1.length > 0)
    .sort((a, b) => b.text1.length - a.text1.length);

  if (valid.length === 0) return source;

  const map = new Map<string, string>();
  const triggers: string[] = [];
  for (const s of valid) {
    const raw = String(s.text1).trim();
    const rep = String(s.text2 ?? "");

    // 1. Direct trigger
    if (!map.has(raw)) {
      map.set(raw, rep);
      triggers.push(raw);
    }

    // 2. Latin digits variant (e.g. س١ -> س1)
    const latin = toLatinDigits(raw);
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
