/**
 * Sound effects manager with user mute preference & safe autoplay fallback.
 */

export type SoundCue = "notice" | "mention" | "pm" | "gift" | "win";

const MUTE_STORAGE_KEY = "newchat_sounds_muted";

const SOUND_FILES: Record<SoundCue, string> = {
  notice: "/sun1.mp3",
  mention: "/private-bip.mp3",
  pm: "/private-bip.mp3",
  gift: "/imgs/win.mp3",
  win: "/imgs/win.mp3",
};

const activeAudioCache = new Map<string, HTMLAudioElement>();

export function isSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}

function playSynthChime(freq: number, durationMs = 140): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, durationMs + 60);
  } catch {
    // ignore WebAudio restrictions
  }
}

export function playSoundCue(cue: SoundCue): void {
  if (typeof window === "undefined" || isSoundMuted()) return;
  const src = SOUND_FILES[cue] || SOUND_FILES.notice;
  try {
    let audio = activeAudioCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.volume = 0.45;
      activeAudioCache.set(src, audio);
    }
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        playSynthChime(cue === "gift" || cue === "win" ? 880 : cue === "pm" || cue === "mention" ? 660 : 520);
      });
    }
  } catch {
    playSynthChime(520);
  }
}
