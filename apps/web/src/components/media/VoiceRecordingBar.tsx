import { Mic, Square, Trash2 } from "lucide-react";

const LIVE_BARS = [
  46, 72, 38, 84, 56, 92, 44, 68, 34, 78, 60, 88, 40, 74, 52, 94, 62, 36, 80,
  54, 86, 48, 70, 58,
];

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export interface VoiceRecordingBarProps {
  seconds: number;
  dark: boolean;
  label?: string;
  stopLabel?: string;
  onCancel: () => void;
  onStop: () => void;
  className?: string;
}

export function VoiceRecordingBar({
  seconds,
  dark,
  label = "جارٍ تسجيل رسالة صوتية...",
  stopLabel = "إنهاء",
  onCancel,
  onStop,
  className = "",
}: VoiceRecordingBarProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
        dark
          ? "border-rose-500/30 bg-rose-500/10"
          : "border-rose-200 bg-rose-50 shadow-xs"
      } ${className}`.trim()}
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-lg shadow-rose-500/30">
        <Mic className="h-5 w-5" />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold ${
              dark ? "text-rose-300" : "text-rose-600"
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500 animate-pulse" />
            <span className="truncate">{label}</span>
          </span>
          <span
            dir="ltr"
            className={`shrink-0 font-mono text-xs font-extrabold tabular-nums ${
              dark ? "text-rose-300" : "text-rose-600"
            }`}
          >
            {formatClock(seconds)}
          </span>
        </div>

        <div className="mt-1.5 flex h-6 items-center gap-[3px]" aria-hidden="true">
          {LIVE_BARS.map((height, index) => (
            <span
              key={index}
              className="animate-voice-bar flex-1 rounded-full bg-rose-500/60"
              style={{
                height: `${height}%`,
                animationDelay: `${(index % 8) * 90}ms`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          title="إلغاء التسجيل وحذفه"
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition active:scale-95 ${
            dark
              ? "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-rose-500/40 hover:text-rose-400"
              : "border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:text-rose-500"
          }`}
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onStop}
          title={`${stopLabel} ومعاينة التسجيل`}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-[11px] font-bold text-white shadow-md shadow-rose-500/25 transition hover:bg-rose-500 active:scale-95"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          <span>{stopLabel}</span>
        </button>
      </div>
    </div>
  );
}
