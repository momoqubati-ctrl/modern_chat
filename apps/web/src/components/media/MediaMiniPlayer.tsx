/**
 * Global floating media mini-player.
 *
 * Mounted once at the App root so playback keeps running no matter which
 * panel/tab the user closes or navigates to. Supports YouTube (IFrame API,
 * lazy-loaded on first use) and native uploaded videos, and persists the
 * watched position so playback resumes after a full page reload.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  clearMediaPosition,
  closeMediaPlayback,
  getMediaPosition,
  saveMediaPosition,
  useMediaPlayback,
  type MediaRef,
} from "../../lib/mediaPlaybackStore.js";

// ---------------------------------------------------------------------------
// YouTube IFrame API loader (script fetched once, on first playback only)
// ---------------------------------------------------------------------------

interface YTPlayerLike {
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
  getCurrentTime(): number;
  getPlayerState(): number;
}

interface YTPlayerConfig {
  videoId: string;
  host?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayerLike }) => void;
    onStateChange?: (event: { data: number; target: YTPlayerLike }) => void;
  };
}

interface YTApi {
  Player: new (element: HTMLElement, config: YTPlayerConfig) => YTPlayerLike;
}

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTApi> | null = null;

function loadYouTubeApi(): Promise<YTApi> {
  const existing = window.YT;
  if (existing?.Player) return Promise.resolve(existing);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<YTApi>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

type TimeGetterRef = { current: () => number };

/** YT.Player replaces its host node with an iframe — use a detached inner node. */
function YouTubeSurface({ media, timeGetterRef }: { media: MediaRef; timeGetterRef: TimeGetterRef }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerLike | null>(null);
  const registerTimeRef = timeGetterRef;

  useEffect(() => {
    const key = media.key;
    const videoId = media.youtubeId || "";
    if (!hostRef.current || !videoId) return;
    const outer = hostRef.current;
    let cancelled = false;
    const startPos = getMediaPosition(key);
    let pollTimer: number | null = null;

    const cleanup = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      const player = playerRef.current;
      playerRef.current = null;
      if (player) {
        try {
          // Skip persisting when the video ended naturally (position = end).
          if (player.getPlayerState() !== 0) {
            saveMediaPosition(key, player.getCurrentTime(), true);
          }
          player.destroy();
        } catch {
          // already gone
        }
      }
      outer.textContent = "";
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !outer.isConnected) return;
        const target = document.createElement("div");
        outer.appendChild(target);
        const player = new YT.Player(target, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 1,
            start: startPos,
            controls: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              try {
                event.target.playVideo();
              } catch {
                // autoplay blocked — native controls remain usable
              }
            },
            onStateChange: (event) => {
              // 1=playing 2=paused 0=ended
              if (event.data === 2) {
                saveMediaPosition(key, event.target.getCurrentTime(), true);
              }
              if (event.data === 0) {
                clearMediaPosition(key);
                closeMediaPlayback();
              }
            },
          },
        });
        playerRef.current = player;
        if (registerTimeRef) {
          registerTimeRef.current = () => {
            try {
              return playerRef.current?.getCurrentTime() ?? 0;
            } catch {
              return 0;
            }
          };
        }
        // Lightweight progress persistence — reads once every 5 seconds.
        pollTimer = window.setInterval(() => {
          const active = playerRef.current;
          if (!active) return;
          try {
            if (active.getPlayerState() === 0) return; // ended — don't persist
            saveMediaPosition(key, active.getCurrentTime());
          } catch {
            // player torn down mid-tick
          }
        }, 5000);
      })
      .catch(() => {
        // network failure — nothing to render, widget stays empty
      });

    return () => {
      cancelled = true;
      if (registerTimeRef) registerTimeRef.current = () => 0;
      cleanup();
    };
  }, [media, registerTimeRef]);

  return (
    <div
      ref={hostRef}
      dir="ltr"
      className="aspect-video w-full overflow-hidden rounded-b-xl bg-black [&_iframe]:h-full [&_iframe]:w-full"
    />
  );
}

/** Native uploaded video — persists currentTime continuously. */
function NativeVideoSurface({ media, timeGetterRef }: { media: MediaRef; timeGetterRef: TimeGetterRef }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const registerTimeRef = timeGetterRef;

  useEffect(() => {
    const video = videoRef.current;
    const key = media.key;
    if (!video) return;
    const startPos = getMediaPosition(key);

    const applyStart = () => {
      try {
        if (video.currentTime < 0.5 && startPos > 0) video.currentTime = startPos;
      } catch {
        // seek before metadata — ignore
      }
    };
    if (startPos > 0) {
      if (video.readyState >= 1) applyStart();
      else video.addEventListener("loadedmetadata", applyStart, { once: true });
    }

    const onTimeUpdate = () => saveMediaPosition(key, video.currentTime);
    const onPause = () => saveMediaPosition(key, video.currentTime, true);
    const onEnded = () => {
      clearMediaPosition(key);
      closeMediaPlayback();
    };
    const onHide = () => saveMediaPosition(key, video.currentTime, true);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    window.addEventListener("pagehide", onHide);
    if (registerTimeRef) {
      registerTimeRef.current = () => {
        try {
          return videoRef.current?.currentTime ?? 0;
        } catch {
          return 0;
        }
      };
    }

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("pagehide", onHide);
      if (registerTimeRef) registerTimeRef.current = () => 0;
      try {
        video.pause();
        // Skip persisting when the video ended naturally (position = end).
        if (!video.ended) saveMediaPosition(key, video.currentTime, true);
      } catch {
        // ignore
      }
    };
  }, [media, registerTimeRef]);

  return (
    <video
      ref={videoRef}
      src={media.src}
      controls
      autoPlay
      playsInline
      className="aspect-video w-full rounded-b-xl bg-black"
    />
  );
}

export function MediaMiniPlayer({ dark = true }: { dark?: boolean }) {
  const { current, playing, generation } = useMediaPlayback();
  const timeGetterRef = useRef<() => number>(() => 0);

  if (!current || !playing) return null;

  const handleClose = () => {
    try {
      const seconds = timeGetterRef.current?.() ?? 0;
      if (seconds > 0) saveMediaPosition(current.key, seconds, true);
    } catch {
      // ignore getter failures
    }
    closeMediaPlayback();
  };

  return (
    <div
      dir="rtl"
      className={`fixed bottom-4 right-4 z-50 w-[290px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md animate-slide-up ${
        dark
          ? "bg-slate-900/95 border-slate-700/80 text-white"
          : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] font-bold ${
          dark ? "border-b border-white/10 bg-white/5" : "border-b border-slate-200 bg-slate-50"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`truncate ${dark ? "text-slate-200" : "text-slate-700"}`}>
            {current.title || "تشغيل الوسائط"}
          </span>
        </span>
        <button
          type="button"
          onClick={handleClose}
          title="إغلاق المشغّل (سيُستكمل من نفس الموضع لاحقاً)"
          className={`shrink-0 rounded-lg p-1 transition ${
            dark
              ? "text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
              : "text-slate-500 hover:bg-rose-500/10 hover:text-rose-600"
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div key={`${current.key}:${generation}`} className="bg-black">
        {current.kind === "youtube" ? (
          <YouTubeSurface media={current} timeGetterRef={timeGetterRef} />
        ) : (
          <NativeVideoSurface media={current} timeGetterRef={timeGetterRef} />
        )}
      </div>
    </div>
  );
}
