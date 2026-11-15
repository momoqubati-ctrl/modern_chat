import { useEffect, useState } from "react";
import {
  Film,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic } from "../lib/mediaUrl.js";
import { canAccessControlPanel } from "../lib/permissions.js";
import { MemberAvatar } from "./MemberAvatar.js";
import { normalizeStorySlides, type RawStoryGroup } from "./stories/storyTypes.js";

interface StoriesPanelProps {
  dark: boolean;
  onOpenStoryCreator: () => void;
  onOpenStoryViewer: (storyIdx: number, slideIdx?: number) => void;
}

export function StoriesPanel({
  dark,
  onOpenStoryCreator,
  onOpenStoryViewer,
}: StoriesPanelProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const stories = useChatStore((s) => s.stories) as unknown as RawStoryGroup[];
  const fetchStories = useChatStore((s) => s.fetchStories);
  const deleteStory = useChatStore((s) => s.deleteStory);
  const getApiClient = useChatStore((s) => s.getApiClient);

  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [topStories, setTopStories] = useState<Array<Record<string, unknown>>>([]);

  const isAdmin = canAccessControlPanel(me, powers);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const handleLoadLeaderboard = async () => {
    setShowLeaderboard((v) => !v);
    try {
      const rows = await getApiClient().getStoriesLeaderboard();
      setTopStories(Array.isArray(rows) ? rows : []);
    } catch {
      setTopStories([]);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header & Publish Actions */}
      <div className="p-3 border-b border-slate-800/30 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            <Film className="w-4 h-4 text-rose-400" />
            <span>القصص اليومية ({stories.length})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleLoadLeaderboard}
              className={`p-1.5 rounded-xl border text-xs ${
                showLeaderboard ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "border-slate-700/50 text-slate-400"
              }`}
              title="الأكثر مشاهدة في القصص"
            >
              <Trophy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fetchStories}
              className="p-1.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-white"
              title="تحديث القصص"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {me?.islogin === "عضو" ? (
          <button
            type="button"
            onClick={onOpenStoryCreator}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:brightness-110 text-white text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إنشاء قصة جديدة (نص / صورة / فيديو)</span>
          </button>
        ) : (
          <div className="text-[11px] text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
            نشر القصص متاح للأعضاء المسجلين فقط
          </div>
        )}
      </div>

      {/* Stories List / Leaderboard */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 chat-scroll">
        {showLeaderboard ? (
          <div className="space-y-2">
            <div className="text-xs font-bold text-amber-400">أحدث مشاهدات القصص (/stor10)</div>
            {topStories.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">لا توجد مشاهدات مسجلة بعد</div>
            ) : (
              topStories.map((v, i) => (
                <div
                  key={i}
                  dir="ltr"
                  className={`flex items-center justify-between gap-2.5 rounded-2xl p-2.5 border text-xs text-left ${
                    dark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar pic={String(v.photo || "")} topic={String(v.topic || "")} size="md" showStatus={false} />
                    <div className="min-w-0">
                      <div dir="auto" className="font-bold truncate">{String(v.topic || "مشاهد")}</div>
                      <div dir="auto" className="text-[10px] text-slate-400">{formatDateTimeArabic(v.time)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-10">لا توجد قصص منشورة حالياً</div>
        ) : (
          stories.map((st, idx) => {
            const slides = normalizeStorySlides(st);
            const count = slides.length || 1;
            const isOwner = me?.uid === st.sid;
            return (
              <div
                key={st.sid || st.id}
                dir="ltr"
                onClick={() => onOpenStoryViewer(idx, 0)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onOpenStoryViewer(idx, 0);
                  }
                }}
                className={`flex items-center justify-between gap-3 rounded-2xl p-2.5 border transition cursor-pointer text-left ${
                  dark ? "bg-slate-900/70 border-slate-800 hover:border-rose-500/40" : "bg-white border-slate-200 hover:border-rose-300"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 shrink-0">
                    <MemberAvatar pic={st.photo} topic={st.name} size="lg" showStatus={false} />
                  </div>
                  <div className="min-w-0">
                    <div dir="auto" className="text-xs font-extrabold truncate">{st.name || "عضو"}</div>
                    <div dir="auto" className="text-[11px] text-slate-400">
                      {count} قصة • {formatDateTimeArabic(st.lastUpdated)}
                    </div>
                  </div>
                </div>

                {(isOwner || isAdmin) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteStory({ id: st.id, sid: st.sid });
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                    title="حذف القصة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
