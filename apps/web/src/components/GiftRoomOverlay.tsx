import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { resolveAssetUrl } from "../lib/mediaUrl.js";
import { playSoundCue } from "../lib/soundFx.js";

export function GiftRoomOverlay() {
  const lastGiftFx = useChatStore((s) => s.lastGiftFx);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const [visibleFx, setVisibleFx] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!lastGiftFx) return;
    const fxRoomId = String(lastGiftFx.roomId || "");
    if (fxRoomId && currentRoomId && fxRoomId !== currentRoomId) return;

    setVisibleFx(lastGiftFx);
    playSoundCue("gift");

    const timer = window.setTimeout(() => {
      setVisibleFx((cur) => (cur === lastGiftFx ? null : cur));
    }, 4300);

    return () => window.clearTimeout(timer);
  }, [lastGiftFx, currentRoomId]);

  if (!visibleFx) return null;

  const giftImg = resolveAssetUrl(String(visibleFx.file || ""), "gifts_git", "");
  const fromTopic = String(visibleFx.fromTopic || "عضو");
  const toTopic = String(visibleFx.toTopic || "عضو");
  const coinVal = Number(visibleFx.coin || 0);

  return (
    <div className="fixed inset-x-0 top-20 z-50 flex justify-center pointer-events-none px-4">
      <div
        key={String(visibleFx.txid || Date.now())}
        className="animate-gift-overlay flex items-center gap-3 px-4 py-2.5 rounded-3xl border border-amber-400/50 bg-slate-900/90 backdrop-blur-md text-white shadow-2xl max-w-md"
      >
        {giftImg && (
          <img
            src={giftImg}
            alt="هدية"
            className="w-12 h-12 object-contain shrink-0 drop-shadow-md"
          />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>هدية مميزة داخل الغرفة</span>
          </div>
          <div className="text-xs font-bold mt-0.5 truncate">
            <span className="text-sky-300">{fromTopic}</span>
            <span className="text-slate-300 mx-1">أهدى</span>
            <span className="text-rose-300">{toTopic}</span>
            {coinVal > 0 && <span className="text-amber-400 mr-1.5">({coinVal}🪙)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
