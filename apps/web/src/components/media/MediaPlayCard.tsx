/**
 * Lightweight "play cards" replacing heavy inline players.
 *
 * Wall/chat/PM messages show a thumbnail + play button instead of a live
 * YouTube iframe / native video element per post. Clicking hands playback
 * to the single global floating mini-player, which drastically reduces
 * memory, network and DOM cost on feeds with many media posts.
 */

import { useMemo, useState } from "react";
import { Film, Play } from "lucide-react";
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
          decoding="async"
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

export function VideoPlayCard({
  file,
  dark = true,
}: {
  file: string;
  dark?: boolean;
}) {
  const resolved = resolveAssetUrl(file, "sendfile", "");
  const key = `v:${file}`;
  const isActive = useIsMediaActive(key);
  const savedPos = useMemo(() => getMediaPosition(key), [key]);

  if (!resolved) return null;

  return (
    <div
      dir="ltr"
      className={`group relative mt-1.5 w-full max-w-xs overflow-hidden rounded-xl border ${
        dark ? "border-slate-700/60 bg-slate-950" : "border-slate-300 bg-slate-100"
      }`}
    >
      {/*
        Static poster — intentionally no <video> here.
        A metadata preload per wall post opens a media session and decodes a
        frame for every video while the user scrolls, which stalls weaker
        phone GPUs. The real media element is created only inside the single
        floating player after the user taps this card.
      */}
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden">
        <div
          aria-hidden
          className={`absolute inset-0 ${
            dark
              ? "bg-[radial-gradient(120%_120%_at_25%_15%,#334155_0%,#111827_48%,#000_100%)]"
              : "bg-[radial-gradient(120%_120%_at_25%_15%,#e2e8f0_0%,#cbd5e1_48%,#94a3b8_100%)]"
          }`}
        />
        <Film
          aria-hidden
          className={`absolute start-2.5 top-2.5 h-4 w-4 ${
            dark ? "text-white/25" : "text-slate-700/30"
          }`}
        />
        <button
          type="button"
          onClick={() => playMedia({ key, kind: "video", src: resolved, title: "فيديو مرفوع" })}
          aria-label="تشغيل الفيديو"
          className="absolute inset-0 flex items-center justify-center"
        >
          {isActive ? (
            <PlayBadge dark={dark} />
          ) : (
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 transition group-hover:scale-105 ${
                dark ? "bg-white/15 text-white ring-white/35" : "bg-slate-900/80 text-white ring-white/40"
              }`}
            >
              <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
            </span>
          )}
        </button>
        <span
          className={`absolute bottom-2 end-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            dark ? "bg-black/60 text-slate-200" : "bg-white/80 text-slate-700"
          }`}
        >
          فيديو
        </span>
      </div>
      {!isActive && savedPos > 5 && <ResumeHint seconds={savedPos} dark={dark} />}
    </div>
  );
}
