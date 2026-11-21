import { memo } from "react";
import { X, Gift, Coins, Loader2 } from "lucide-react";
import type { PostGiftsData } from "@newchat/core-client";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { VerifiedBadge } from "../VerifiedBadge.js";

interface FeedPostGiftsModalProps {
  dark: boolean;
  isOpen: boolean;
  isLoading: boolean;
  giftsData: PostGiftsData | null;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 3600000);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export const FeedPostGiftsModal = memo(function FeedPostGiftsModal({
  dark,
  isOpen,
  isLoading,
  giftsData,
  onClose,
}: FeedPostGiftsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl border shadow-2xl overflow-hidden transition-all animate-in slide-in-from-bottom duration-200 ${
          dark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold">سجل هدايا المنشور</h3>
                {giftsData && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {giftsData.totalGiftsCount} هدية
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                قائمة الداعمين الذين أرسلوا هدايا لهذا المنشور
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[220px]">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-xs font-bold">جارٍ تحميل سجل الهدايا...</span>
            </div>
          ) : !giftsData || giftsData.gifts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                <Gift className="w-8 h-8" />
              </div>
              <span className="text-sm font-bold">لم يتلقَ هذا المنشور أي هدايا بعد</span>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                ستظهر هنا تفاصيل الهدايا وأسماء المرسلين وعدد المرات بمجرد إرسالها
              </p>
            </div>
          ) : (
            giftsData.gifts.map((item, index) => (
              <div
                key={`${item.sender.uid}-${item.giftFile}-${index}`}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                  dark
                    ? "bg-slate-950/60 border-slate-800/80 hover:bg-slate-950"
                    : "bg-slate-50 border-slate-200 hover:bg-white"
                }`}
              >
                {/* Sender Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={resolveAssetUrl(item.sender.pic)}
                    alt={item.sender.topic}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold truncate">{item.sender.topic}</span>
                      {Boolean(item.sender.documentationc) && <VerifiedBadge size="xs" />}
                    </div>
                    {item.sender.username && (
                      <span className="text-[11px] text-slate-400">@{item.sender.username}</span>
                    )}
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {formatRelativeTime(item.lastSentAt)}
                    </span>
                  </div>
                </div>

                {/* Gift & Count Info */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500/15 text-amber-500 border border-amber-500/20">
                      أرسل {item.totalQuantity} {item.totalQuantity === 1 ? "مرة" : item.totalQuantity === 2 ? "مرتين" : "مرات"}
                    </span>
                    {item.totalCoins > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-400 font-bold mt-1">
                        <Coins className="w-3 h-3 text-amber-500" />
                        <span>{item.totalCoins} كوينز</span>
                      </div>
                    )}
                  </div>

                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center p-1 shrink-0">
                    <img
                      src={resolveAssetUrl(item.giftFile, "gift", "/gift.png")}
                      alt="Gift"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
