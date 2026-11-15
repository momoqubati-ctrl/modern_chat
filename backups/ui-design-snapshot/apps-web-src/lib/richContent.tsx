import type { ReactNode } from "react";
import { isSafeLinkUrl, resolveAssetUrl } from "./mediaUrl.js";

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

function renderInlineTextWithLinks(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const urlRe = /(https?:\/\/[^\s<>"']+)/gi;
  let lastIndex = 0;
  let idx = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(decodeLegacyEscapedText(text.slice(lastIndex, match.index)));
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
            className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 underline decoration-rose-400/50 break-all"
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
            className="text-sky-400 hover:text-sky-300 underline decoration-sky-400/50 break-all"
          >
            {rawHref}
          </a>,
        );
      }
    } else {
      nodes.push(decodeLegacyEscapedText(rawHref));
    }
    lastIndex = match.index + rawHref.length;
    idx += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(decodeLegacyEscapedText(text.slice(lastIndex)));
  }

  return nodes;
}

/**
 * Safely parses legacy server-generated wall card & link snippets into pure React JSX.
 * Never executes arbitrary HTML or raw DOM injection.
 */
export function parseSafeRichContent(rawInput: unknown): ParsedRichMessage {
  const source = String(rawInput ?? "").trim();
  if (!source) {
    return { isCard: false, nodes: [] };
  }

  let working = source;
  let isCard = false;
  let cardLink: string | undefined;

  const cardMatch = working.match(/^<div\s+class=["']ssss["']>([\s\S]*)<\/div>$/i);
  if (cardMatch?.[1] !== undefined) {
    isCard = true;
    working = cardMatch[1];
  }

  // Extract <a href="..." class="uplink">...</a> and <br/> tokens safely
  const tokenRe = /(<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>|<br\s*\/?>)/gi;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(working)) !== null) {
    if (m.index > cursor) {
      const slice = working.slice(cursor, m.index);
      nodes.push(...renderInlineTextWithLinks(slice, `seg-${tokenIdx}`));
    }

    const fullTag = m[1]!;
    if (/^<br/i.test(fullTag)) {
      nodes.push(<br key={`br-${tokenIdx}`} />);
    } else {
      const href = String(m[2] || "").trim();
      const label = decodeLegacyEscapedText(String(m[3] || href).trim());
      if (isSafeLinkUrl(href)) {
        if (isCard && !cardLink) {
          cardLink = href;
        }
        nodes.push(
          <a
            key={`a-${tokenIdx}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 underline decoration-sky-400/50 break-all font-medium"
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    }

    cursor = m.index + fullTag.length;
    tokenIdx += 1;
  }

  if (cursor < working.length) {
    nodes.push(...renderInlineTextWithLinks(working.slice(cursor), `tail-${tokenIdx}`));
  }

  // Extract first card link or inline link if not a card
  if (!cardLink) {
    const firstHrefMatch = working.match(/href=["']([^"']+)["']/i);
    if (firstHrefMatch?.[1] && isSafeLinkUrl(firstHrefMatch[1])) {
      cardLink = firstHrefMatch[1].trim();
    } else {
      const plainUrlMatch = working.match(/(https?:\/\/[^\s<>"']+|\/sendfile\/[^\s<>"']+)/i);
      if (plainUrlMatch?.[1] && isSafeLinkUrl(plainUrlMatch[1])) {
        cardLink = plainUrlMatch[1].trim();
      }
    }
  }

  return { isCard, cardLink, nodes };
}

export function SafeRichText({ text }: { text: unknown }) {
  const parsed = parseSafeRichContent(text);
  const youtubeId =
    parsed.cardLink ? extractYoutubeVideoId(parsed.cardLink) : null;
  const mediaType =
    parsed.cardLink && !youtubeId ? detectAttachmentTypeFromPath(parsed.cardLink) : null;
  const showMediaPreview =
    Boolean(parsed.cardLink && mediaType && mediaType !== "file");

  if (parsed.isCard || showMediaPreview || youtubeId) {
    return (
      <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-2.5 text-xs leading-relaxed space-y-2">
        <div className="break-words">{parsed.nodes}</div>
        {youtubeId && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-700/60 bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
              title="YouTube video"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {showMediaPreview && parsed.cardLink && (
          <AttachmentRenderer file={parsed.cardLink} fileType={mediaType!} />
        )}
      </div>
    );
  }

  return <span className="break-words whitespace-pre-wrap">{parsed.nodes}</span>;
}

export function AttachmentRenderer({
  file,
  fileType,
}: {
  file?: string;
  fileType?: string;
}) {
  if (!file) return null;
  const resolved = resolveAssetUrl(file, "sendfile", "");
  if (!resolved) return null;
  const effectiveType = fileType || detectAttachmentTypeFromPath(file);

  if (effectiveType === "image") {
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
      <div className="mt-1.5 max-w-xs">
        <audio controls preload="none" src={resolved} className="h-9 w-full" />
      </div>
    );
  }

  if (effectiveType === "video") {
    return (
      <div className="mt-1.5 max-w-xs overflow-hidden rounded-xl border border-slate-700/50 bg-black">
        <video controls preload="metadata" src={resolved} className="max-h-60 w-full" />
      </div>
    );
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
