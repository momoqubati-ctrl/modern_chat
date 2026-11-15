import { useEffect, useRef } from "react";
import { Bell, Volume2, VolumeX, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { isSoundMuted, playSoundCue, setSoundMuted } from "../lib/soundFx.js";
import { formatTimeArabic } from "../lib/mediaUrl.js";
import { useState } from "react";

export function NoticeStack() {
  const notices = useChatStore((s) => s.notices);
  const dismissNotice = useChatStore((s) => s.dismissNotice);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [muted, setMuted] = useState(() => isSoundMuted());

  useEffect(() => {
    for (const n of notices) {
      if (!seenIdsRef.current.has(n.id)) {
        seenIdsRef.current.add(n.id);
        if (n.sound === "mention") {
          playSoundCue("mention");
        } else {
          playSoundCue("notice");
        }
        const timer = setTimeout(() => {
          dismissNotice(n.id);
        }, n.force ? 7500 : 5000);
        void timer;
      }
    }
  }, [notices, dismissNotice]);

  const handleToggleSound = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  if (notices.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
      <div className="flex justify-end pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleSound}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700/70 text-[11px] backdrop-blur-md"
          title={muted ? "تفعيل أصوات التنبيهات" : "كتم أصوات التنبيهات"}
        >
          {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          <span>{muted ? "الأصوات مكتومة" : "الصوت مفعّل"}</span>
        </button>
      </div>

      {notices.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`pointer-events-auto flex items-start justify-between gap-3 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md text-sm border transition ${
            n.force
              ? "bg-slate-900/95 text-white border-amber-500/50"
              : "bg-slate-900/95 text-white border-indigo-500/40"
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Bell className={`w-4 h-4 shrink-0 mt-0.5 ${n.force ? "text-amber-400" : "text-indigo-400"}`} />
            <div className="min-w-0">
              {n.topic && (
                <div className="text-[11px] font-bold text-indigo-300 truncate">{n.topic}</div>
              )}
              <div className="leading-relaxed break-words text-xs sm:text-sm">{n.msg}</div>
              {n.ts > 0 && (
                <div className="text-[10px] text-slate-400 mt-0.5">{formatTimeArabic(n.ts)}</div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => dismissNotice(n.id)}
            className="text-slate-400 hover:text-white shrink-0 p-0.5"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
