import { useMemo, useState } from "react";
import { Coins, Gift, Sparkles, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot } from "@newchat/shared";
import { resolveAssetUrl } from "../lib/mediaUrl.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface GiftPickerModalProps {
  dark: boolean;
  target: OnlineUserSnapshot;
  onClose: () => void;
  onOpenWallet: () => void;
}

export function GiftPickerModal({
  dark,
  target,
  onClose,
  onOpenWallet,
}: GiftPickerModalProps) {
  const me = useChatStore((s) => s.me);
  const gifts = useChatStore((s) => s.gifts);
  const giftCategories = useChatStore((s) => s.giftCategories);
  const sendGift = useChatStore((s) => s.sendGift);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const categories = useMemo(() => {
    const names = new Set<string>(["الكل"]);
    for (const c of giftCategories) {
      const label = typeof c === "string" ? c : String((c as { name?: string })?.name || "");
      if (label.trim()) names.add(label.trim());
    }
    for (const g of gifts) {
      if (g.category && String(g.category).trim()) {
        names.add(String(g.category).trim());
      }
    }
    return Array.from(names);
  }, [giftCategories, gifts]);

  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const myCoins = Number(me?.coins ?? me?.coin ?? 0);

  const visibleGifts = useMemo(() => {
    if (selectedCategory === "الكل") return gifts;
    return gifts.filter((g) => String(g.category || "افتراضي").trim() === selectedCategory);
  }, [gifts, selectedCategory]);

  const handleSend = (file: string, coinCost: number) => {
    if (me?.islogin !== "عضو") {
      pushNotice("إرسال الهدايا متاح للأعضاء المسجلين فقط", { force: 1 });
      return;
    }
    if (myCoins < coinCost) {
      pushNotice("رصيد الكوينز غير كافٍ لإرسال هذه الهدية", { force: 1 });
      return;
    }
    sendGift(target.id, file);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <MemberAvatar pic={target.pic} cover={target.cover} topic={target.topic} size="sm" showStatus={false} />
            <div className="min-w-0">
              <div className="text-sm font-extrabold truncate flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-rose-400 shrink-0" />
                <span>إرسال هدية إلى {target.topic}</span>
              </div>
              <div className="text-[11px] text-slate-400">تُعرض الهدية للجميع داخل الغرفة</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWallet();
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-extrabold"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{myCoins}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800/40 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="px-4 py-2 border-b border-slate-800/20 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "bg-rose-600 text-white"
                    : dark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Gifts Grid */}
        <div className="flex-1 overflow-y-auto p-4 chat-scroll">
          {visibleGifts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <Sparkles className="w-7 h-7 mx-auto text-slate-500" />
              <div>لا توجد هدايا مضافة في هذا القسم حالياً</div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {visibleGifts.map((gift, idx) => {
                const cost = Number(gift.coin || 0);
                const affordable = myCoins >= cost;
                const imgUrl = resolveAssetUrl(gift.file, "gifts_git", "");
                return (
                  <button
                    key={gift.id || `${gift.file}-${idx}`}
                    type="button"
                    onClick={() => handleSend(gift.file, cost)}
                    className={`group flex flex-col items-center p-2.5 rounded-2xl border transition text-center ${
                      affordable
                        ? dark
                          ? "bg-slate-950/70 border-slate-800 hover:border-rose-500/60 hover:bg-rose-500/10"
                          : "bg-slate-50 border-slate-200 hover:border-rose-300 hover:bg-rose-50/70"
                        : dark
                          ? "bg-slate-950/40 border-slate-800/50 opacity-55"
                          : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={gift.name || "هدية"}
                      loading="lazy"
                      className="w-14 h-14 object-contain group-hover:scale-110 transition-transform"
                    />
                    <div className="mt-1.5 text-[11px] font-bold truncate w-full">
                      {gift.name || "هدية"}
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-400">
                      <Coins className="w-3 h-3" />
                      <span>{cost}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
