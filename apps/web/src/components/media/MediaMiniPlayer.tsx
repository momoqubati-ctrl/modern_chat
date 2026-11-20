/**
 * Global floating media mini-player.
 *
 * Mounted once at the App root so playback keeps running no matter which
 * panel/tab the user closes or navigates to. Supports YouTube (IFrame API,
 * lazy-loaded on first use) and native uploaded videos, and persists the
 * watched position so playback resumes after a full page reload.
 *
 * Performance notes (mobile):
 * - Rendered in a portal on <body> so no ancestor stacking/transform/filter
 *   can force the browser to re-composite the video surface.
 * - Positioned with transform only, promoted with `will-change: transform`;
 *   dragging mutates the transform directly (zero React re-renders) so the
 *   iframe/video element is never remounted or re-laid out mid-playback.
 * - Solid surfaces, no backdrop blur, no entry/pulse animations around the
 *   video surface.
 * - A single autoplay path (no autoplay + playVideo() race) avoids the
 *   "plays, stops, starts again" stutter seen on phones.
 */

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, X } from "lucide-react";
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
            // Single start path: autoplay only. Calling playVideo() in onReady
            // as well causes a play → buffer → restart stutter on mobile.
            autoplay: 1,
            start: startPos,
            controls: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
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
        // Lightweight progress persistence — reads once every 10 seconds.
        // Kept infrequent: each read is a cross-frame postMessage round-trip.
        pollTimer = window.setInterval(() => {
          const active = playerRef.current;
          if (!active) return;
          try {
            if (active.getPlayerState() === 0) return; // ended — don't persist
            saveMediaPosition(key, active.getCurrentTime());
          } catch {
            // player torn down mid-tick
          }
        }, 10000);
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
      className="aspect-video w-full overflow-hidden bg-black [&_iframe]:h-full [&_iframe]:w-full"
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
      preload="auto"
      className="aspect-video w-full bg-black"
    />
  );
}

// ---------------------------------------------------------------------------
// Draggable floating shell
// ---------------------------------------------------------------------------

const POS_STORAGE_KEY = "newchat_media_player_pos_v1";
const VIEWPORT_MARGIN = 10;
const DEFAULT_WIDTH = 290;
const HEADER_HEIGHT = 32;

interface PlayerPos {
  x: number;
  y: number;
}

interface PlayerRatio {
  rx: number;
  ry: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
  moved: boolean;
}

function estimatePlayerSize(): { width: number; height: number } {
  const width = Math.max(180, Math.min(DEFAULT_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2));
  return { width, height: Math.round((width * 9) / 16) + HEADER_HEIGHT };
}

function clampToViewport(x: number, y: number, width: number, height: number): PlayerPos {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, x), maxX),
    y: Math.min(Math.max(VIEWPORT_MARGIN, y), maxY),
  };
}

/** Position is stored as a ratio of the free space, so it survives rotation. */
function readStoredRatio(): PlayerRatio | null {
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rx?: unknown; ry?: unknown };
    const rx = Number(parsed?.rx);
    const ry = Number(parsed?.ry);
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;
    return { rx: Math.min(Math.max(0, rx), 1), ry: Math.min(Math.max(0, ry), 1) };
  } catch {
    return null;
  }
}

function storeRatio(ratio: PlayerRatio): void {
  try {
    window.localStorage.setItem(
      POS_STORAGE_KEY,
      JSON.stringify({ rx: ratio.rx, ry: ratio.ry }),
    );
  } catch {
    // storage disabled — position simply won't persist
  }
}

function computeRatio(pos: PlayerPos, width: number, height: number): PlayerRatio {
  const freeX = Math.max(1, window.innerWidth - width);
  const freeY = Math.max(1, window.innerHeight - height);
  return {
    rx: Math.min(Math.max(0, pos.x / freeX), 1),
    ry: Math.min(Math.max(0, pos.y / freeY), 1),
  };
}

/** A sane viewport: ignore transient 0×0 sizes during capture/resize. */
function hasUsableViewport(): boolean {
  return window.innerWidth >= 200 && window.innerHeight >= 150;
}

function initialPosition(ratio: PlayerRatio): PlayerPos {
  const { width, height } = estimatePlayerSize();
  return clampToViewport(
    ratio.rx * Math.max(0, window.innerWidth - width),
    ratio.ry * Math.max(0, window.innerHeight - height),
    width,
    height,
  );
}

export const MediaMiniPlayer = memo(function MediaMiniPlayer({ dark = true }: { dark?: boolean }) {
  const { current, playing, generation } = useMediaPlayback();
  const timeGetterRef = useRef<() => number>(() => 0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const ratioRef = useRef<PlayerRatio>(readStoredRatio() ?? { rx: 1, ry: 1 });
  const posRef = useRef<PlayerPos>(initialPosition(ratioRef.current));
  const dragRef = useRef<DragState | null>(null);
  const pendingPosRef = useRef<PlayerPos | null>(null);

  const applyPosition = useCallback((pos: PlayerPos) => {
    const shell = shellRef.current;
    if (shell) {
      shell.style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)`;
    }
  }, []);

  /** Re-derive the on-screen position from the saved ratio + real shell size. */
  const restoreFromRatio = useCallback(() => {
    if (!hasUsableViewport()) return;
    const rect = shellRef.current?.getBoundingClientRect();
    const size =
      rect && rect.width > 0 && rect.height > 0
        ? { width: rect.width, height: rect.height }
        : estimatePlayerSize();
    const ratio = ratioRef.current;
    const target = clampToViewport(
      ratio.rx * Math.max(0, window.innerWidth - size.width),
      ratio.ry * Math.max(0, window.innerHeight - size.height),
      size.width,
      size.height,
    );
    posRef.current = target;
    applyPosition(target);
  }, [applyPosition]);

  // Keep the widget fully on-screen after opening / rotating / URL-bar resize.
  useLayoutEffect(() => {
    if (current) restoreFromRatio();
  }, [current, generation, restoreFromRatio]);

  useEffect(() => {
    const onResize = () => restoreFromRatio();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [restoreFromRatio]);

  const handleHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button")) return;
    const shell = shellRef.current;
    if (!shell) return;
    e.preventDefault();
    const rect = shell.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: posRef.current.x,
      originY: posRef.current.y,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    pendingPosRef.current = null;
    try {
      shell.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture unsupported — bubbling still works
    }
  };

  const handleShellPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    // Direct style mutation: no React state, no re-render, iframe untouched.
    const next = clampToViewport(drag.originX + dx, drag.originY + dy, drag.width, drag.height);
    pendingPosRef.current = next;
    posRef.current = next;
    applyPosition(next);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    const shell = shellRef.current;
    if (shell) {
      try {
        shell.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    }
    if (drag.moved) {
      const final = pendingPosRef.current ?? posRef.current;
      posRef.current = final;
      const ratio = computeRatio(final, drag.width, drag.height);
      ratioRef.current = ratio;
      storeRatio(ratio);
    }
    pendingPosRef.current = null;
  };

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

  const shell = (
    <div
      ref={shellRef}
      dir="rtl"
      style={{
        width: `min(${DEFAULT_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
        transform: `translate3d(${Math.round(posRef.current.x)}px, ${Math.round(posRef.current.y)}px, 0)`,
        willChange: "transform",
      }}
      onPointerMove={handleShellPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      className={`fixed left-0 top-0 z-40 overflow-hidden rounded-2xl border shadow-xl ${
        dark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
      }`}
    >
      <div
        onPointerDown={handleHeaderPointerDown}
        title="اسحب الشريط لنقل المشغل إلى أي مكان في الشاشة"
        className={`flex touch-none select-none items-center justify-between gap-2 px-2 py-1.5 text-[11px] font-bold ${
          dark
            ? "cursor-grab border-b border-white/10 bg-slate-800 active:cursor-grabbing"
            : "cursor-grab border-b border-slate-200 bg-slate-100 active:cursor-grabbing"
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <GripHorizontal className={`h-3.5 w-3.5 shrink-0 ${dark ? "text-slate-400" : "text-slate-500"}`} />
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
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
          <X className="h-3.5 w-3.5" />
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

  return typeof document === "undefined" ? shell : createPortal(shell, document.body);
});
