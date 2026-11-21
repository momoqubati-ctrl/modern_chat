import { Plus, Bell, ArrowRight, Sparkles } from "lucide-react";

interface FeedTopHeaderProps {
  dark: boolean;
  onOpenCreate: () => void;
  onBack?: () => void;
}

export function FeedTopHeader({ dark, onOpenCreate, onBack }: FeedTopHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b transition-colors ${
        dark
          ? "bg-slate-950 border-slate-800/80 text-white"
          : "bg-white border-slate-200/80 text-slate-900"
      }`}
    >
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={`p-2 rounded-full transition-colors active:scale-95 ${
              dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-700"
            }`}
            title="العودة للمحادثة"
            aria-label="العودة"
          >
            <ArrowRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
          </button>
        )}

        {/* Instagram stylized title */}
        <div className="flex items-center gap-1.5 cursor-pointer select-none">
          <span className="text-xl font-black tracking-tight font-serif bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 bg-clip-text text-transparent">
            Instagram
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            Feed
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 hover:opacity-95 active:scale-95 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>منشور جديد</span>
        </button>

        <button
          type="button"
          className={`p-2 rounded-full transition-colors active:scale-95 ${
            dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-700"
          }`}
          title="التنبيهات"
          aria-label="التنبيهات"
        >
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
