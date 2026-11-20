import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { AlertTriangle, Loader2, Pause, Play, RotateCw } from "lucide-react";

export interface VoiceNotePlayerProps {
  src: string;
  dark?: boolean;
  /** Known duration in seconds (used before the file metadata loads). */
  durationSec?: number;
  /** Smaller footprint for dense preview rows. */
  compact?: boolean;
  className?: string;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/** Deterministic pseudo-waveform so every clip keeps the same shape between renders. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildWaveform(seed: string, count: number): number[] {
  let state = hashString(seed) || 7;
  const bars: number[] = [];
  for (let i = 0; i < count; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const rand = state / 0xffffffff;
    const envelope = 0.5 + 0.5 * Math.sin((Math.PI * (i + 1)) / (count + 1));
    bars.push(24 + Math.round(rand * 58 * envelope) + Math.round(envelope * 14));
  }
  return bars;
}

function VoiceNotePlayerImpl({
  src,
  dark = false,
  durationSec,
  compact = false,
  className = "",
}: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(Math.max(0, durationSec || 0));
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const barCount = compact ? 24 : 34;
  const bars = useMemo(() => buildWaveform(src, barCount), [src, barCount]);
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const progressPercent = progress * 100;

  useEffect(() => {
    setCurrent(0);
    setPlaying(false);
    setFailed(false);
    setDuration(Math.max(0, durationSec || 0));
    setLoading(false);
  }, [src, durationSec]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    document
      .querySelectorAll<HTMLAudioElement>('audio[data-voice-note="1"]')
      .forEach((other) => {
        if (other !== audio) other.pause();
      });

    setLoading(true);
    void audio
      .play()
      .then(() => setLoading(false))
      .catch(() => {
        setLoading(false);
        setFailed(true);
      });
  };

  const seekTo = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration || !Number.isFinite(duration)) return;
    const next = Math.max(0, Math.min(1, ratio)) * duration;
    audio.currentTime = next;
    setCurrent(next);
  };

  const handleWaveformPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    seekTo((event.clientX - rect.left) / rect.width);
  };

  const handleWaveformKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekTo((current - 5) / Math.max(1, duration));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seekTo((current + 5) / Math.max(1, duration));
    } else if (event.key === "Home") {
      event.preventDefault();
      seekTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      seekTo(1);
    }
  };

  const shell = dark
    ? "border-slate-700/70 bg-slate-900/80"
    : "border-slate-200 bg-white/95";
  const barBase = dark ? "bg-slate-600/60" : "bg-slate-300/80";
  const timeColor = dark ? "text-slate-400" : "text-slate-500";

  if (failed) {
    return (
      <div
        dir="rtl"
        className={`mt-1.5 flex w-full max-w-[320px] items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${
          dark
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-amber-200 bg-amber-50"
        } ${className}`.trim()}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            dark ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-600"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={`text-[11px] font-extrabold ${
              dark ? "text-amber-300" : "text-amber-700"
            }`}
          >
            تعذر تشغيل هذا التسجيل الصوتي
          </div>
          <div
            className={`mt-0.5 text-[10px] font-medium leading-snug ${
              dark ? "text-amber-200/70" : "text-amber-600/90"
            }`}
          >
            الملف تالف أو غير مدعوم — جرّب إعادة المحاولة أو اطلب إعادة التسجيل
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFailed(false)}
          title="إعادة محاولة التشغيل"
          aria-label="إعادة محاولة تشغيل التسجيل"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${
            dark
              ? "border-amber-500/30 bg-slate-900/40 text-amber-300 hover:bg-amber-500/15"
              : "border-amber-200 bg-white text-amber-600 hover:bg-amber-100"
          }`}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      dir="ltr"
      className={`flex w-full items-center gap-3 rounded-2xl border shadow-sm ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      } ${shell} ${className}`.trim()}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        data-voice-note="1"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "إيقاف مؤقت للتسجيل الصوتي" : "تشغيل التسجيل الصوتي"}
        title={playing ? "إيقاف مؤقت" : "تشغيل التسجيل"}
        className={`relative flex ${
          compact ? "h-10 w-10" : "h-12 w-12"
        } shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 via-fuchsia-500 to-violet-500 text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110 active:scale-95`}
      >
        {loading ? (
          <Loader2 className={`${compact ? "h-4 w-4" : "h-5 w-5"} animate-spin`} />
        ) : playing ? (
          <Pause className={`${compact ? "h-4 w-4" : "h-5 w-5"} fill-current`} />
        ) : (
          <Play className={`${compact ? "h-4 w-4" : "h-5 w-5"} fill-current`} />
        )}
        {playing && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full ring-2 ring-rose-400/40 animate-pulse"
          />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="موضع التشغيل"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          onPointerDown={handleWaveformPointer}
          onKeyDown={handleWaveformKey}
          className={`relative ${
            compact ? "h-7" : "h-9"
          } w-full cursor-pointer touch-none select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70`}
        >
          <div className="absolute inset-0 flex items-center gap-[2px]">
            {bars.map((height, index) => (
              <span
                key={`base-${index}`}
                className={`flex-1 rounded-full ${barBase} ${
                  playing ? "animate-voice-bar" : ""
                }`}
                style={{
                  height: `${height}%`,
                  animationDelay: `${(index % 9) * 70}ms`,
                }}
              />
            ))}
          </div>
          <div
            className="pointer-events-none absolute inset-0 flex items-center gap-[2px]"
            style={{ clipPath: `inset(0 ${100 - progressPercent}% 0 0)` }}
          >
            {bars.map((height, index) => (
              <span
                key={`fill-${index}`}
                className={`flex-1 rounded-full bg-gradient-to-t from-rose-500 via-fuchsia-500 to-orange-400 ${
                  playing ? "animate-voice-bar" : ""
                }`}
                style={{
                  height: `${height}%`,
                  animationDelay: `${(index % 9) * 70}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <div
          className={`mt-0.5 flex items-center justify-between font-mono text-[10px] font-bold tabular-nums ${timeColor}`}
        >
          <span>{formatClock(current)}</span>
          <span>{duration > 0 ? formatClock(duration) : "--:--"}</span>
        </div>
      </div>
    </div>
  );
}

export const VoiceNotePlayer = memo(VoiceNotePlayerImpl);
