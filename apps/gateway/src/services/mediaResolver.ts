import { YOUTUBE_SHORTS_DISCOVERY_TERMS } from "@newchat/shared";
import { gatewayConfig } from "../config.js";

export type YoutubeSearchMode = "videos" | "shorts";

export interface YoutubeSearchResultItem {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  isShort?: boolean;
}

export interface ResolvedTikTokMeta {
  videoId: string;
  canonicalUrl: string;
  authorHandle: string;
  authorName: string;
  title: string;
  thumbnailUrl: string;
}

const ALLOWED_TIKTOK_HOSTS = new Set<string>([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

function isAllowedTikTokHost(hostname: string): boolean {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (!normalized) return false;
  if (ALLOWED_TIKTOK_HOSTS.has(normalized)) return true;
  return normalized.endsWith(".tiktok.com");
}

function parseYoutubeUrlId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\/+/, "").split("/")[0];
      return id && /^[\w-]{6,20}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{6,20}$/.test(v)) return v;
      const match = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,20})/);
      if (match?.[1]) return match[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

export function normalizeYoutubeSearchMode(rawMode: unknown): YoutubeSearchMode {
  const mode = String(rawMode || "").trim().toLowerCase();
  return mode === "shorts" || mode === "short" ? "shorts" : "videos";
}

export class MediaResolver {
  async searchYoutube(
    rawQuery: string,
    rawCount = 12,
    opts?: { mode?: YoutubeSearchMode; seed?: unknown },
  ): Promise<YoutubeSearchResultItem[]> {
    const mode = opts?.mode || "videos";
    const count = Math.max(1, Math.min(24, Number(rawCount) || 12));
    let query = String(rawQuery || "").trim();

    if (!query && mode === "shorts") {
      const seedStr = String(opts?.seed ?? Date.now());
      let hash = 0;
      for (let i = 0; i < seedStr.length; i += 1) {
        hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
      }
      query = YOUTUBE_SHORTS_DISCOVERY_TERMS[hash % YOUTUBE_SHORTS_DISCOVERY_TERMS.length] || "شورت عربي";
    }

    if (!query) return [];

    // Direct URL or bare video ID fast-path
    const directId = parseYoutubeUrlId(query) || (/^[\w-]{11}$/.test(query) ? query : null);
    if (directId) {
      return [
        {
          id: directId,
          title: query,
          thumbnail: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
          channelTitle: "YouTube",
          isShort: mode === "shorts",
        },
      ];
    }

    const effectiveQuery = mode === "shorts" && !query.toLowerCase().includes("short")
      ? `${query} #shorts`
      : query;

    if (gatewayConfig.youtubeApiKey) {
      const apiResults = await this.searchViaYoutubeApi(effectiveQuery, count, mode);
      if (apiResults.length > 0) return apiResults;
    }

    return this.searchViaYoutubeScrape(effectiveQuery, count, mode);
  }

  private async searchViaYoutubeApi(
    query: string,
    count: number,
    mode: YoutubeSearchMode,
  ): Promise<YoutubeSearchResultItem[]> {
    try {
      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: String(count),
        q: query,
        key: gatewayConfig.youtubeApiKey,
      });
      if (mode === "shorts") {
        params.set("videoDuration", "short");
      }
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
        signal: AbortSignal.timeout(6000),
        headers: { accept: "application/json" },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        items?: Array<{
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
          };
        }>;
      };
      const out: YoutubeSearchResultItem[] = [];
      for (const item of json.items || []) {
        const vid = item.id?.videoId;
        if (!vid) continue;
        out.push({
          id: vid,
          title: String(item.snippet?.title || "YouTube Video"),
          channelTitle: String(item.snippet?.channelTitle || ""),
          thumbnail:
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          isShort: mode === "shorts",
        });
      }
      return out.slice(0, count);
    } catch {
      return [];
    }
  }

  private async searchViaYoutubeScrape(
    query: string,
    count: number,
    mode: YoutubeSearchMode,
  ): Promise<YoutubeSearchResultItem[]> {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=ar&gl=SA`;
      const res = await fetch(searchUrl, {
        signal: AbortSignal.timeout(6000),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "accept-language": "ar,en;q=0.9",
        },
      });
      if (!res.ok) return [];
      const html = await res.text();
      const marker = "var ytInitialData = ";
      const start = html.indexOf(marker);
      if (start === -1) return [];
      const jsonStart = start + marker.length;
      const end = html.indexOf(";</script>", jsonStart);
      if (end === -1) return [];

      const initialData = JSON.parse(html.slice(jsonStart, end)) as Record<string, unknown>;
      const results: YoutubeSearchResultItem[] = [];
      const seenIds = new Set<string>();

      const walk = (node: unknown) => {
        if (!node || typeof node !== "object" || results.length >= count) return;
        if (Array.isArray(node)) {
          for (const child of node) {
            walk(child);
            if (results.length >= count) break;
          }
          return;
        }
        const obj = node as Record<string, unknown>;
        const renderer = obj.videoRenderer as Record<string, unknown> | undefined;
        if (renderer && typeof renderer.videoId === "string" && !seenIds.has(renderer.videoId)) {
          seenIds.add(renderer.videoId);
          const titleRuns = ((renderer.title as Record<string, unknown>)?.runs as Array<{ text?: string }>) || [];
          const title = titleRuns.map((r) => r.text || "").join("") || "YouTube Video";
          const ownerRuns =
            ((renderer.ownerText as Record<string, unknown>)?.runs as Array<{ text?: string }>) || [];
          const channelTitle = ownerRuns.map((r) => r.text || "").join("");
          results.push({
            id: renderer.videoId,
            title,
            channelTitle,
            thumbnail: `https://i.ytimg.com/vi/${renderer.videoId}/hqdefault.jpg`,
            isShort: mode === "shorts",
          });
          return;
        }
        for (const val of Object.values(obj)) {
          walk(val);
          if (results.length >= count) break;
        }
      };

      walk(initialData);
      return results;
    } catch {
      return [];
    }
  }

  async resolveTikTok(rawUrl: string): Promise<ResolvedTikTokMeta | null> {
    let currentUrl: URL;
    try {
      currentUrl = new URL(String(rawUrl || "").trim());
    } catch {
      return null;
    }

    if (currentUrl.protocol !== "https:" && currentUrl.protocol !== "http:") {
      return null;
    }
    if (!isAllowedTikTokHost(currentUrl.hostname)) {
      return null;
    }

    let resolvedUrl = currentUrl;
    try {
      for (let hop = 0; hop < 5; hop += 1) {
        if (resolvedUrl.pathname.includes("/video/")) break;
        const res = await fetch(resolvedUrl.toString(), {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(6000),
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          },
        });
        const locationHeader = res.headers.get("location");
        if (!locationHeader || res.status < 300 || res.status >= 400) {
          break;
        }
        const nextUrl = new URL(locationHeader, resolvedUrl);
        if (
          (nextUrl.protocol !== "https:" && nextUrl.protocol !== "http:") ||
          !isAllowedTikTokHost(nextUrl.hostname)
        ) {
          return null;
        }
        resolvedUrl = nextUrl;
      }
    } catch {
      // fall through with current resolvedUrl
    }

    const videoMatch = resolvedUrl.pathname.match(/\/(?:@([^/]+)\/)?(?:video|photo)\/(\d+)/i);
    if (!videoMatch?.[2]) {
      return null;
    }

    const authorHandle = videoMatch[1] ? `@${videoMatch[1].replace(/^@/, "")}` : "";
    const videoId = videoMatch[2];
    const canonicalUrl = `https://www.tiktok.com/${authorHandle || "@"}/video/${videoId}`;

    let title = "";
    let authorName = authorHandle;
    let thumbnailUrl = "";
    try {
      const oembedRes = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
        {
          signal: AbortSignal.timeout(5000),
          headers: { accept: "application/json" },
        },
      );
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
        };
        title = String(oembed.title || "").slice(0, 300);
        authorName = String(oembed.author_name || authorHandle).slice(0, 100);
        thumbnailUrl = String(oembed.thumbnail_url || "").slice(0, 500);
      }
    } catch {
      // optional enrichment
    }

    return {
      videoId,
      canonicalUrl,
      authorHandle,
      authorName,
      title,
      thumbnailUrl,
    };
  }
}
