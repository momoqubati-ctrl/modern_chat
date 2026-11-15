import { isSoundMuted } from "../../lib/soundFx.js";

const TICK_URL = "/carrom-game/assets/music/tick.wav";
const COIN_DROP_URL = "/carrom-game/assets/music/coin-drop.wav";
const STRIKER_DROP_URL = "/carrom-game/assets/music/striker-drop.wav";
const BGM_URL = "/carrom-game/assets/music/walk.mp3";

/**
 * Low-overhead WebAudio + pre-pooled audio player.
 * Eliminates `new Audio()` GC churn inside 60fps physics collision loops.
 */
class CarromSoundPool {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<void>>();
  private fallbackPools = new Map<string, HTMLAudioElement[]>();
  private fallbackIdx = new Map<string, number>();
  private bgmAudio: HTMLAudioElement | null = null;
  private lastTickAt = 0;
  private sfxMuted = false;
  private bgmEnabled = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.sfxMuted = isSoundMuted();
    }
  }

  setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
  }

  isSfxMuted(): boolean {
    return this.sfxMuted;
  }

  async toggleBgm(enable?: boolean): Promise<boolean> {
    const next = enable !== undefined ? enable : !this.bgmEnabled;
    this.bgmEnabled = next;
    if (typeof window === "undefined") return next;

    if (!next) {
      if (this.bgmAudio) {
        this.bgmAudio.pause();
      }
      return false;
    }

    if (!this.bgmAudio) {
      this.bgmAudio = new Audio(BGM_URL);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.14;
      this.bgmAudio.preload = "none";
    }
    try {
      await this.bgmAudio.play();
      return true;
    } catch {
      this.bgmEnabled = false;
      return false;
    }
  }

  isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  warmup(): void {
    if (typeof window === "undefined" || this.sfxMuted) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx && !this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => undefined);
    }
    void this.loadBuffer(TICK_URL);
    void this.loadBuffer(COIN_DROP_URL);
    void this.loadBuffer(STRIKER_DROP_URL);
  }

  private async loadBuffer(url: string): Promise<void> {
    if (!this.ctx || this.buffers.has(url)) return;
    const existing = this.loading.get(url);
    if (existing) return existing;

    const p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const ab = await res.arrayBuffer();
        if (!this.ctx) return;
        const decoded = await this.ctx.decodeAudioData(ab);
        this.buffers.set(url, decoded);
      } catch {
        // fallback handled gracefully
      } finally {
        this.loading.delete(url);
      }
    })();
    this.loading.set(url, p);
    return p;
  }

  private playUrl(url: string, volume: number): void {
    if (typeof window === "undefined" || this.sfxMuted) return;
    const clampedVol = Math.max(0.01, Math.min(1, volume));

    const ctx = this.ctx;
    const buf = this.buffers.get(url);
    if (ctx && buf) {
      try {
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => undefined);
        }
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = buf;
        gain.gain.value = clampedVol;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
        return;
      } catch {
        // fall through to HTMLAudio pool
      }
    }

    let pool = this.fallbackPools.get(url);
    if (!pool) {
      pool = Array.from({ length: 3 }, () => {
        const el = new Audio(url);
        el.preload = "auto";
        return el;
      });
      this.fallbackPools.set(url, pool);
    }
    const idx = this.fallbackIdx.get(url) ?? 0;
    const el = pool[idx % pool.length]!;
    this.fallbackIdx.set(url, idx + 1);
    el.volume = clampedVol;
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  }

  playTick(impactSpeed = 6): void {
    if (this.sfxMuted) return;
    const now = performance.now();
    if (now - this.lastTickAt < 28) return;
    this.lastTickAt = now;
    const vol = Math.min(0.32, Math.max(0.04, impactSpeed * 0.014));
    this.playUrl(TICK_URL, vol);
  }

  playCoinDrop(): void {
    this.playUrl(COIN_DROP_URL, 0.35);
  }

  playStrikerDrop(): void {
    this.playUrl(STRIKER_DROP_URL, 0.32);
  }

  dispose(): void {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.src = "";
      this.bgmAudio = null;
    }
    this.bgmEnabled = false;
  }
}

export const carromSoundPool = new CarromSoundPool();
