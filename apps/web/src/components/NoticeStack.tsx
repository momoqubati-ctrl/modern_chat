import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCircle2, Gift, Heart, UserCheck, Volume2, VolumeX, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { SafeRichText } from "../lib/richContent.js";
import { isSoundMuted, playSoundCue, setSoundMuted } from "../lib/soundFx.js";
import { formatTimeArabic } from "../lib/mediaUrl.js";

function getNoticeVisuals(n: { topic?: string; msg: string; force?: number }) {
  const text = `${n.topic || ""} ${n.msg}`.toLowerCase();
  if (text.includes("إعجاب") || text.includes("لايك") || text.includes("أعجب") || text.includes("❤️") || text.includes("👍")) {
    return {
      icon: <Heart className="w-4 h-4 shrink-0 mt-0.5 text-rose-400 fill-rose-500/25 animate-action-pop" />,
      border: "border-rose-500/40 shadow-rose-950/20",
      accent: "text-rose-300",
    };
  }
  if (text.includes("متابعة") || text.includes("متابع")) {
    return {
      icon: <UserCheck className="w-4 h-4 shrink-0 mt-0.5 text-purple-400 animate-action-pop" />,
      border: "border-purple-500/40 shadow-purple-950/20",
      accent: "text-purple-300",
    };
  }
  if (text.includes("هدية") || text.includes("هدايا")) {
    return {
      icon: <Gift className="w-4 h-4 shrink-0 mt-0.5 text-amber-400 animate-action-pop" />,
      border: "border-amber-500/40 shadow-amber-950/20",
      accent: "text-amber-300",
    };
  }
  if (text.includes("نسخ") || text.includes("تم النسخ")) {
    return {
      icon: <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400 animate-action-pop" />,
      border: "border-emerald-500/40 shadow-emerald-950/20",
      accent: "text-emerald-300",
    };
  }
  if (n.force || text.includes("تنبيه") || text.includes("محظور") || text.includes("كتم")) {
    return {
      icon: <Bell className="w-4 h-4 shrink-0 mt-0.5 text-amber-400 animate-action-pop" />,
      border: "border-amber-500/50 shadow-amber-950/20",
      accent: "text-amber-300",
    };
  }
  return {
    icon: <Check className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />,
    border: "border-sky-500/40 shadow-sky-950/20",
    accent: "text-sky-300",
  };
}

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
    <div className="fixed top-4 left-4 sm:left-6 z-[99999] flex flex-col gap-2.5 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
      <div className="flex justify-end pointer-events-auto">
        <button
          type="button"
          onClick={handleToggleSound}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] backdrop-blur-md shadow-lg transition active:scale-95"
          title={muted ? "تفعيل أصوات التنبيهات" : "كتم أصوات التنبيهات"}
        >
          {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          <span>{muted ? "الأصوات مكتومة" : "الصوت مفعّل"}</span>
        </button>
      </div>

      {notices.map((n) => {
        const visuals = getNoticeVisuals(n);
        return (
          <div
            key={n.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-2xl px-4 py-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-md text-sm border bg-slate-900/95 text-white transition-all transform animate-action-pop ${visuals.border}`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {visuals.icon}
              <div className="min-w-0">
                {n.topic && (
                  <div className={`text-[11px] font-bold truncate ${visuals.accent}`}>{n.topic}</div>
                )}
                <div className="leading-relaxed break-words text-xs sm:text-sm">
                  <SafeRichText text={n.msg} dark={true} />
                </div>
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
        );
      })}
    </div>
  );
}
