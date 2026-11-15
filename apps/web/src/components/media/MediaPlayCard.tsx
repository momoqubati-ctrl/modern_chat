/**
 * Lightweight "play cards" replacing heavy inline players.
 *
 * Wall/chat/PM messages show a thumbnail + play button instead of a live
 * YouTube iframe / native video element per post. Clicking hands playback
 * to the single global floating mini-player, which drastically reduces
 * memory, network and DOM cost on feeds with many media posts.
 */

import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import {
  formatMediaTime,
  getMediaPosition,
  playMedia,
  useIsMediaActive,
} from "../../lib/mediaPlaybackStore.js";

function PlayBadge({ dark }: { dark: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white ${
        dark ? "bg-emerald-500/90" : "bg-emerald-600"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      يُشغَّل الآن
    </span>
  );
}

function ResumeHint({ seconds, dark }: { seconds: number; dark: boolean }) {
  return (
    <span
      className={`absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
        dark ? "bg-black/70 text-slate-200" : "bg-white/85 text-slate-700"
      }`}
    >
      استكمال {formatMediaTime(seconds)}
    </span>
  );
}

export function YouTubePlayCard({
  youtubeId,
  dark = true,
}: {
  youtubeId: string;
  dark?: boolean;
}) {
  const key = `yt:${youtubeId}`;
  const isActive = useIsMediaActive(key);
  const [thumbFailed, setThumbFailed] = useState(false);
  // Read once per mount — cheap localStorage cache lookup.
  const savedPos = useMemo(() => getMediaPosition(key), [key]);

  return (
    <div
      dir="ltr"
      className={`group relative aspect-video w-full overflow-hidden rounded-lg border bg-black ${
        dark ? "border-slate-700/60" : "border-slate-300"
      }`}
    >
      {!thumbFailed && (
        <img
          src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
          alt="صورة مصغرة للفيديو"
          loading="lazy"
          draggable={false}
          onError={() => setThumbFailed(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
      )}
      <button
        type="button"
        onClick={() => playMedia({ key, kind: "youtube", youtubeId, title: "مقطع يوتيوب" })}
        aria-label="تشغيل المقطع"
        className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40"
      >
        {isActive ? (
          <PlayBadge dark={dark} />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/95 text-white shadow-lg transition group-hover:scale-105">
            <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
          </span>
        )}
      </button>
      {!isActive && savedPos > 5 && <ResumeHint seconds={savedPos} dark={dark} />}
    </div>
  );
}

export function VideoPlayCard({ file }: { file: string }) {
  const resolved = resolveAssetUrl(file, "sendfile", "");
  const key = `v:${file}`;
  const isActive = useIsMediaActive(key);
  const savedPos = useMemo(() => getMediaPosition(key), [key]);

  if (!resolved) return null;

  return (
    <div
      dir="ltr"
      className="group relative mt-1.5 max-w-xs overflow-hidden rounded-xl border border-slate-700/50 bg-black"
    >
      {/* Poster surface: muted, metadata-only, never interactive. */}
      <video
        src={resolved}
        preload="metadata"
        muted
        playsInline
        tabIndex={-1}
        className="pointer-events-none aspect-video w-full object-cover opacity-90"
      />
      <button
        type="button"
        onClick={() => playMedia({ key, kind: "video", src: resolved, title: "فيديو مرفوع" })}
        aria-label="تشغيل الفيديو"
        className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40"
      >
        {isActive ? (
          <PlayBadge dark />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/85 text-white shadow-lg ring-1 ring-white/30 transition group-hover:scale-105">
            <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
          </span>
        )}
      </button>
      {!isActive && savedPos > 5 && <ResumeHint seconds={savedPos} dark />}
    </div>
  );
}
