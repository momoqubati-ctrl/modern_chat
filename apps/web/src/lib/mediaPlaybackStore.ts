/**
 * Global media playback state (wall / chat / PM YouTube & video).
 *
 * A single floating mini-player owns playback so closing the post panel,
 * switching tabs, or navigating never interrupts the running video.
 * Watched positions are persisted to localStorage so reopening the same
 * video (even after closing the browser tab) resumes where it stopped.
 *
 * Zero-dependency store via useSyncExternalStore — re-renders are limited
 * to components subscribing to precise boolean selectors.
 */

import { useSyncExternalStore } from "react";

export interface MediaRef {
  /** Stable id: `yt:<videoId>` or `v:<source path>` */
  key: string;
  kind: "youtube" | "video";
  youtubeId?: string;
  /** Resolved absolute URL for native videos */
  src?: string;
  title?: string;
}

interface MediaPlaybackState {
  current: MediaRef | null;
  playing: boolean;
  /** Bumped whenever the mounted media changes → remounts the player */
  generation: number;
}

let state: MediaPlaybackState = { current: null, playing: false, generation: 0 };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<MediaPlaybackState>): void {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): MediaPlaybackState {
  return state;
}

/** Full state — use sparingly (only the floating player subscribes). */
export function useMediaPlayback(): MediaPlaybackState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Precise selector: does this exact media key currently own the player? */
export function useIsMediaActive(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.current?.key === key && state.playing,
    () => false,
  );
}

export function playMedia(ref: MediaRef): void {
  if (state.current?.key === ref.key) {
    // Already active — keep playback running (no restart, no remount).
    if (state.playing) return;
    setState({ playing: true });
    return;
  }
  setState({ current: ref, playing: true, generation: state.generation + 1 });
}

export function setMediaPlaying(playing: boolean): void {
  if (state.playing !== playing) setState({ playing });
}

export function closeMediaPlayback(): void {
  setState({ current: null, playing: false, generation: state.generation + 1 });
}

// ---------------------------------------------------------------------------
// Position persistence (localStorage, single JSON map, throttled writes)
// ---------------------------------------------------------------------------

const POS_KEY = "newchat_media_pos_v1";
const POS_MAX_KEYS = 200;
const POS_KEEP_AFTER_PRUNE = 150;

type PosMap = Record<string, number>;

let posCache: PosMap | null = null;
let lastWriteAt = 0;
let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;

function loadPositions(): PosMap {
  if (posCache) return posCache;
  posCache = {};
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PosMap;
      if (parsed && typeof parsed === "object") posCache = parsed;
    }
  } catch {
    // corrupted map — start fresh
  }
  return posCache!;
}

function flushPositions(): void {
  const map = loadPositions();
  const keys = Object.keys(map);
  if (keys.length > POS_MAX_KEYS) {
    // Drop the oldest entries (insertion order) to keep storage tiny.
    for (const k of keys.slice(0, keys.length - POS_KEEP_AFTER_PRUNE)) delete map[k];
  }
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(map));
  } catch {
    // storage full/private mode — non-fatal
  }
}

export function getMediaPosition(key: string): number {
  if (!key) return 0;
  const val = loadPositions()[key];
  return Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
}

/** `immediate` bypasses the throttle (pause/close/ended/pagehide). */
export function saveMediaPosition(key: string, seconds: number, immediate = false): void {
  if (!key || !Number.isFinite(seconds) || seconds < 1) return;
  const map = loadPositions();
  const next = Math.floor(seconds);
  if ((map[key] | 0) === next) return;
  map[key] = next;
  const now = Date.now();
  if (immediate || now - lastWriteAt >= 3000) {
    lastWriteAt = now;
    flushPositions();
    return;
  }
  if (!pendingFlushTimer) {
    pendingFlushTimer = setTimeout(() => {
      pendingFlushTimer = null;
      lastWriteAt = Date.now();
      flushPositions();
    }, 3000);
  }
}

export function clearMediaPosition(key: string): void {
  if (!key) return;
  const map = loadPositions();
  if (key in map) {
    delete map[key];
    flushPositions();
  }
}

/** Flush any pending throttled write when the document is being unloaded. */
function flushPendingNow(): void {
  if (pendingFlushTimer !== null) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }
  flushPositions();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingNow);
}

/** Formats seconds as m:ss for resume hints. */
export function formatMediaTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}
