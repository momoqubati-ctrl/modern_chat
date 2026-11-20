import { memo, type ReactNode } from "react";
import { useChatStore } from "@newchat/core-client";
import { EMOJI_IMAGE_CLASS, EMOJI_INLINE_CLASS, isEmojiAssetPath, parseEmojiSegments } from "./emojiShortcuts.js";
import { isSafeLinkUrl, resolveAssetUrl } from "./mediaUrl.js";
import { VideoPlayCard, YouTubePlayCard } from "../components/media/MediaPlayCard.js";
import { VoiceNotePlayer } from "../components/media/VoiceNotePlayer.js";

export interface ParsedRichMessage {
  isCard: boolean;
  cardLink?: string;
  nodes: ReactNode[];
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp)(?:\?.*)?$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|oga|m4a|aac|webm)(?:\?.*)?$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)(?:\?.*)?$/i;

export function decodeLegacyEscapedText(raw: string): string {
  return raw
    .replace(/&#x3C;/gi, "<")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

export function extractYoutubeVideoId(inputUrl: string): string | null {
  try {
    const parsed = new URL(inputUrl);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
      return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{6,20}$/.test(v)) return v;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") && parts[1]) {
        return /^[A-Za-z0-9_-]{6,20}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    // not a valid URL
  }
  return null;
}

export function isTikTokUrl(inputUrl: string): boolean {
  try {
    const parsed = new URL(inputUrl);
    return parsed.hostname.toLowerCase().includes("tiktok.com");
  } catch {
    return false;
  }
}

export function detectAttachmentTypeFromPath(filePath: string): "image" | "audio" | "video" | "file" {
  if (IMAGE_EXT_RE.test(filePath)) return "image";
  if (AUDIO_EXT_RE.test(filePath)) return "audio";
  if (VIDEO_EXT_RE.test(filePath)) return "video";
  return "file";
}

function renderInlineTextWithSmileys(
  text: string,
  keyPrefix: string,
  emos?: readonly string[]
): ReactNode[] {
  const decoded = decodeLegacyEscapedText(text);
  if (!emos || emos.length === 0) {
    return [decoded];
  }

  const segments = parseEmojiSegments(decoded, emos);
  const out: ReactNode[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]!;
    if (seg.type === "text") {
      out.push(seg.text);
    } else {
      const resolved = resolveAssetUrl(seg.file, "emo", "");
      out.push(
        <img
          key={`${keyPrefix}-emo-${i}-${seg.index}`}
          src={resolved}
          alt={seg.shortcut}
          title={seg.shortcut}
          loading="lazy"
          className={EMOJI_INLINE_CLASS}
        />
      );
    }
  }

  return out;
}

function renderInlineTextWithLinks(
  text: string,
  keyPrefix: string,
  dark = true,
  emos?: readonly string[]
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const urlRe = /(https?:\/\/[^\s<>"']+)/gi;
  let lastIndex = 0;
  let idx = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderInlineTextWithSmileys(text.slice(lastIndex, match.index), `${keyPrefix}-t${idx}`, emos)
      );
    }
    const rawHref = match[1]!;
    if (isSafeLinkUrl(rawHref)) {
      const ytId = extractYoutubeVideoId(rawHref);
      if (ytId) {
        nodes.push(
          <a
            key={`${keyPrefix}-yt-${idx}`}
            href={rawHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 underline break-all ${
              dark
                ? "text-rose-400 hover:text-rose-300 decoration-rose-400/50 font-semibold"
                : "text-rose-600 hover:text-rose-700 decoration-rose-500/60 font-bold"
            }`}
          >
            <span>▶ يوتيوب:</span>
            <span>{rawHref}</span>
          </a>,
        );
      } else {
        nodes.push(
          <a
            key={`${keyPrefix}-lnk-${idx}`}
            href={rawHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all ${
              dark
                ? "text-sky-400 hover:text-sky-300 decoration-sky-400/50 font-semibold"
                : "text-sky-700 hover:text-sky-800 decoration-sky-600/60 font-bold"
            }`}
          >
            {rawHref}
          </a>,
        );
      }
    } else {
      nodes.push(...renderInlineTextWithSmileys(rawHref, `${keyPrefix}-raw-${idx}`, emos));
    }
    lastIndex = match.index + rawHref.length;
    idx += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderInlineTextWithSmileys(text.slice(lastIndex), `${keyPrefix}-end`, emos));
  }

  return nodes;
}

function normalizeHtmlEntities(str: string): string {
  return str
    .replace(/&#x3C;/gi, "<")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function renderSafeTextWithLineBreaks(
  text: string,
  keyPrefix: string,
  dark = true,
  emos?: readonly string[]
): ReactNode[] {
  const clean = String(text ?? "").trim();
  if (!clean) return [];

  // Split on <br>, <br/>, &#x3C;br...>, &lt;br...&gt;
  const brRe = /(?:<|&#x3C;|&lt;)br\s*\/?(?:>|&gt;)/gi;
  const parts = clean.split(brRe);
  const nodes: ReactNode[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (part) {
      nodes.push(...renderInlineTextWithLinks(part, `${keyPrefix}-l${i}`, dark, emos));
    }
    if (i < parts.length - 1) {
      nodes.push(<br key={`${keyPrefix}-br-${i}`} />);
    }
  }

  return nodes;
}

/**
 * Safely parses legacy server-generated wall card & link snippets into pure React JSX.
 * Handles both raw HTML (<div class="ssss">) and server-escaped (&#x3C;div class="ssss">).
 * Never executes arbitrary HTML or raw DOM injection.
 */
export function parseSafeRichContent(
  rawInput: unknown,
  dark = true,
  emos?: readonly string[]
): ParsedRichMessage {
  const source = String(rawInput ?? "").trim();
  if (!source) {
    return { isCard: false, nodes: [] };
  }

  const normalized = normalizeHtmlEntities(source);

  // 1. Detect if wrapped in wall card container: <div class="ssss">...</div>
  const cardMatch = normalized.match(
    /^\s*<div\b[^>]*?\bclass=["'][^"']*?\bssss\b[^"']*?["'][^>]*>([\s\S]*?)<\/div>\s*$/i
  );

  let isCard = false;
  let cardLink: string | undefined;
  let userCaption = "";

  if (cardMatch) {
    isCard = true;
    const inner = cardMatch[1]!.trim();
    const uplinkMatch = inner.match(/^\s*<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    if (uplinkMatch) {
      const tagAttrs = uplinkMatch[1]!;
      const hrefMatch = tagAttrs.match(/\bhref=["']([^"'>\s]+)["']/i);
      const hasUplinkClass = /\bclass=["'][^"']*?\buplink\b[^"']*?["']/i.test(tagAttrs);

      if (hrefMatch && (hasUplinkClass || !inner.includes("uplink"))) {
        const rawHref = hrefMatch[1]!.trim();
        if (isSafeLinkUrl(rawHref)) {
          cardLink = rawHref;
        }
        let remainder = inner.slice(uplinkMatch[0].length);
        remainder = remainder.replace(/^\s*<br\s*\/?>\s*/i, "");
        userCaption = remainder.trim();
      } else {
        userCaption = inner;
      }
    } else {
      userCaption = inner;
    }
  } else {
    // 2. Check for standalone <a ... class="uplink">...</a> (e.g. from buildWallTextMessage)
    const standaloneUplink =
      normalized.match(/<a\b([^>]*?\bclass=["'][^"']*?\buplink\b[^"']*?["'][^>]*)>([\s\S]*?)<\/a>/i) ||
      normalized.match(/<a\b([^>]*?\bhref=["'][^"']*?["'][^>]*?\bclass=["'][^"']*?\buplink\b[^"']*?["'][^>]*)>([\s\S]*?)<\/a>/i);

    if (standaloneUplink) {
      const tagAttrs = standaloneUplink[1]!;
      const hrefMatch = tagAttrs.match(/\bhref=["']([^"'>\s]+)["']/i);
      if (hrefMatch && isSafeLinkUrl(hrefMatch[1]!)) {
        cardLink = hrefMatch[1]!.trim();
        const matchIdx = standaloneUplink.index ?? 0;
        const before = normalized.slice(0, matchIdx);
        const after = normalized.slice(matchIdx + standaloneUplink[0].length);
        userCaption = (before + " " + after).replace(/\s{2,}/g, " ").trim();
        isCard = true;
      } else {
        userCaption = normalized;
      }
    } else {
      userCaption = normalized;
    }
  }

  // 3. Fallback: extract plain URL if no cardLink detected
  if (!cardLink) {
    const plainUrlMatch = userCaption.match(/(https?:\/\/[^\s<>"']+|\/sendfile\/[^\s<>"']+)/i);
    if (plainUrlMatch && isSafeLinkUrl(plainUrlMatch[1]!)) {
      cardLink = plainUrlMatch[1]!.trim();
    }
  }

  // 4. Render user caption nodes (if any)
  const nodes = renderSafeTextWithLineBreaks(userCaption, "rich", dark, emos);

  return { isCard, cardLink, nodes };
}

// ---------------------------------------------------------------------------
// SafeRichText — parse cache + memo
//
// Parsing is regex-heavy (URL extraction, sanitization, markup) and used for
// every visible chat/wall/PM row. Results are deterministic per (text, dark, emos),
// so a module-level cache survives virtualizer row remounts, and memo() skips
// re-renders whose text/dark props did not change.
// ---------------------------------------------------------------------------

const PARSE_CACHE_MAX = 500;
const parseCache = new Map<string, ParsedRichMessage>();

function getCachedParse(
  text: string,
  dark: boolean,
  emos: readonly string[],
  emosKey: string
): ParsedRichMessage {
  const key = `${dark ? "d" : "l"}|${emosKey}|${text}`;
  const cached = parseCache.get(key);
  if (cached) return cached;
  const parsed = parseSafeRichContent(text, dark, emos);
  if (parseCache.size >= PARSE_CACHE_MAX) parseCache.clear();
  parseCache.set(key, parsed);
  return parsed;
}

function SafeRichTextImpl({
  text,
  dark = true,
  emos: propEmos,
}: {
  text: unknown;
  dark?: boolean;
  emos?: readonly string[];
}) {
  const storeEmos = useChatStore((s) => s.emos);
  const effectiveEmos = propEmos ?? storeEmos;
  const emosKey = effectiveEmos.length > 0 ? effectiveEmos.join(",") : "";
  const parsed =
    typeof text === "string"
      ? getCachedParse(text, dark, effectiveEmos, emosKey)
      : parseSafeRichContent(text, dark, effectiveEmos);
  const youtubeId =
    parsed.cardLink ? extractYoutubeVideoId(parsed.cardLink) : null;
  const mediaType =
    parsed.cardLink && !youtubeId ? detectAttachmentTypeFromPath(parsed.cardLink) : null;
  const showMediaPreview =
    Boolean(parsed.cardLink && mediaType && mediaType !== "file");
  const isMedia = Boolean(youtubeId || showMediaPreview);
  const hasText = parsed.nodes.length > 0;

  if (parsed.isCard || isMedia) {
    return (
      <div
        dir="rtl"
        className={`rounded-xl border p-2.5 text-xs leading-relaxed space-y-2 text-right ${
          dark
            ? "border-sky-500/25 bg-sky-500/5 text-slate-100"
            : "border-sky-300/60 bg-sky-50/70 text-slate-900 shadow-2xs"
        }`}
      >
        {hasText && <div dir="rtl" className="break-words font-medium text-right">{parsed.nodes}</div>}
        {youtubeId && <YouTubePlayCard youtubeId={youtubeId} dark={dark} />}
        {showMediaPreview && parsed.cardLink && (
          <AttachmentRenderer file={parsed.cardLink} fileType={mediaType!} dark={dark} />
        )}
        {parsed.isCard && !isMedia && parsed.cardLink && (
          <a
            href={parsed.cardLink}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className={`inline-flex items-center gap-1.5 underline break-all font-bold ${
              dark
                ? "text-sky-400 hover:text-sky-300 decoration-sky-400/50"
                : "text-sky-700 hover:text-sky-800 decoration-sky-600/60"
            }`}
          >
            <span>🔗</span>
            <span>{parsed.cardLink}</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <span dir="auto" className={`break-words whitespace-pre-wrap ${dark ? "text-slate-100" : "text-slate-900"}`}>
      {parsed.nodes}
    </span>
  );
}

export const SafeRichText = memo(SafeRichTextImpl);

export function AttachmentRenderer({
  file,
  fileType,
  dark = false,
}: {
  file?: string;
  fileType?: string;
  dark?: boolean;
}) {
  if (!file) return null;
  const resolved = resolveAssetUrl(file, "sendfile", "");
  if (!resolved) return null;
  const effectiveType = fileType || detectAttachmentTypeFromPath(file);

  if (effectiveType === "image") {
    if (isEmojiAssetPath(file)) {
      return (
        <a
          href={resolved}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block align-middle"
          title="سمايل"
        >
          <img src={resolved} alt="سمايل" loading="lazy" className={EMOJI_IMAGE_CLASS} />
        </a>
      );
    }
    return (
      <a
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-1.5 max-w-xs overflow-hidden rounded-xl border border-slate-700/50"
      >
        <img
          src={resolved}
          alt="صورة مرفقة"
          loading="lazy"
          className="max-h-64 w-auto object-contain bg-black/20"
        />
      </a>
    );
  }

  if (effectiveType === "audio") {
    return (
      <VoiceNotePlayer
        src={resolved}
        dark={dark}
        className="mt-1.5 w-full"
      />
    );
  }

  if (effectiveType === "video") {
    return <VideoPlayCard file={file} />;
  }

  return (
    <a
      href={resolved}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg bg-slate-800/70 text-sky-400 text-xs hover:bg-slate-700/80"
    >
      📎 فتح الملف المرفق
    </a>
  );
}
