import { useEffect, useState, type ChangeEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic, resolveAssetUrl } from "../lib/mediaUrl.js";
import { canAccessControlPanel } from "../lib/permissions.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface StoryEntryItem {
  id?: string;
  type?: string;
  src?: string;
  length?: number;
  time?: number;
}

interface StoryGroup {
  id?: number;
  sid: string;
  photo: string;
  name: string;
  link: string;
  lastUpdated?: string;
  item: StoryEntryItem[];
}

export function StoriesPanel({ dark }: { dark: boolean }) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const stories = useChatStore((s) => s.stories) as unknown as StoryGroup[];
  const storyViewersMap = useChatStore((s) => s.storyViewersMap);
  const fetchStories = useChatStore((s) => s.fetchStories);
  const publishStory = useChatStore((s) => s.publishStory);
  const deleteStory = useChatStore((s) => s.deleteStory);
  const markStoryViewed = useChatStore((s) => s.markStoryViewed);
  const getStoryViewers = useChatStore((s) => s.getStoryViewers);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [uploading, setUploading] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [viewerStory, setViewerStory] = useState<StoryGroup | null>(null);
  const [viewerItemIdx, setViewerItemIdx] = useState(0);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [topStories, setTopStories] = useState<Array<Record<string, unknown>>>([]);

  const isAdmin = canAccessControlPanel(me, powers);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Auto-advance active story slides & report view tracking
  const currentEntries = viewerStory
    ? viewerStory.item && viewerStory.item.length > 0
      ? viewerStory.item
      : [{ type: "image", src: viewerStory.link, length: 5 }]
    : [];
  const currentEntry = currentEntries[viewerItemIdx];

  useEffect(() => {
    if (!viewerStory || !currentEntry) return;
    markStoryViewed(viewerStory.sid, viewerItemIdx);
    const delayMs = Math.max(3, Number(currentEntry.length || 5)) * 1000;
    const t = setTimeout(() => {
      if (viewerItemIdx + 1 < currentEntries.length) {
        setViewerItemIdx((i) => i + 1);
      } else {
        setViewerStory(null);
      }
    }, delayMs);
    return () => clearTimeout(t);
  }, [viewerStory, viewerItemIdx, currentEntry, currentEntries.length, markStoryViewed]);

  const handleUploadStory = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = (await getApiClient().uploadMediaFile(file, file.name)).trim();
      if (url) {
        const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
        publishStory(url, isVideo ? "video" : "image", isVideo ? 15 : 6);
        pushNotice("تم نشر القصة بنجاح");
      }
    } catch {
      pushNotice("تعذر رفع ملف القصة", { force: 1 });
    } finally {
      setUploading(false);
    }
  };

  const handlePublishUrl = () => {
    const url = linkInput.trim();
    if (!url) return;
    const isVideo = /\.(mp4|webm|mov)(?:\?.*)?$/i.test(url);
    publishStory(url, isVideo ? "video" : "image", isVideo ? 15 : 6);
    setLinkInput("");
    pushNotice("تم نشر القصة");
  };

  const handleLoadLeaderboard = async () => {
    setShowLeaderboard((v) => !v);
    try {
      const rows = await getApiClient().getStoriesLeaderboard();
      setTopStories(Array.isArray(rows) ? rows : []);
    } catch {
      setTopStories([]);
    }
  };

  const viewers = viewerStory ? storyViewersMap[viewerStory.sid] || [] : [];

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
          <div className="space-y-1.5">
            <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:brightness-110 text-white text-xs font-bold cursor-pointer">
              {uploading ? <Upload className="w-3.5 h-3.5 animate-bounce" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{uploading ? "جاري نشر قصتك..." : "أضف قصة (صورة أو فيديو)"}</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleUploadStory}
                className="hidden"
              />
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="أو الصق رابط صورة / فيديو مباشرة..."
                className={`flex-1 rounded-xl px-2.5 py-1.5 text-[11px] border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
              <button
                type="button"
                onClick={handlePublishUrl}
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold"
              >
                نشر
              </button>
            </div>
          </div>
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
                  className={`flex items-center justify-between gap-2 rounded-2xl p-2.5 border text-xs ${
                    dark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MemberAvatar pic={String(v.photo || "")} topic={String(v.topic || "")} size="sm" showStatus={false} />
                    <div className="min-w-0">
                      <div className="font-bold truncate">{String(v.topic || "مشاهد")}</div>
                      <div className="text-[10px] text-slate-400">{formatDateTimeArabic(v.time)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-10">لا توجد قصص منشورة حالياً</div>
        ) : (
          stories.map((st) => {
            const count = Array.isArray(st.item) && st.item.length > 0 ? st.item.length : 1;
            const isOwner = me?.uid === st.sid;
            return (
              <div
                key={st.sid || st.id}
                onClick={() => {
                  setViewerStory(st);
                  setViewerItemIdx(0);
                  setShowViewersModal(false);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setViewerStory(st);
                    setViewerItemIdx(0);
                  }
                }}
                className={`flex items-center justify-between gap-2.5 rounded-2xl p-2.5 border transition cursor-pointer ${
                  dark ? "bg-slate-900/70 border-slate-800 hover:border-rose-500/40" : "bg-white border-slate-200 hover:border-rose-300"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 shrink-0">
                    <MemberAvatar pic={st.photo} topic={st.name} size="md" showStatus={false} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">{st.name || "عضو"}</div>
                    <div className="text-[11px] text-slate-400">
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

      {/* Story Fullscreen Viewer Modal */}
      {viewerStory && currentEntry && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full max-w-md h-[82vh] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col">
            {/* Progress Bars */}
            <div className="p-3 pb-1 flex gap-1 z-20">
              {currentEntries.map((_, idx) => (
                <div key={idx} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      idx <= viewerItemIdx ? "bg-white w-full" : "w-0"
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="px-4 py-2 flex items-center justify-between gap-2 z-20 text-white">
              <div className="flex items-center gap-2 min-w-0">
                <MemberAvatar pic={viewerStory.photo} topic={viewerStory.name} size="sm" showStatus={false} />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{viewerStory.name}</div>
                  <div className="text-[10px] text-slate-300">
                    {formatDateTimeArabic(currentEntry.time || viewerStory.lastUpdated)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    getStoryViewers(viewerStory.sid);
                    setShowViewersModal((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>المشاهدون</span>
                </button>
                {(me?.uid === viewerStory.sid || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => {
                      deleteStory({ id: viewerStory.id, sid: viewerStory.sid });
                      setViewerStory(null);
                    }}
                    className="p-1.5 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/35"
                    title="حذف القصة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerStory(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Story Media */}
            <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
              {currentEntry.type === "video" || /\.(mp4|webm|mov)$/i.test(String(currentEntry.src || "")) ? (
                <video
                  src={resolveAssetUrl(currentEntry.src, "sendfile", "")}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <img
                  src={resolveAssetUrl(currentEntry.src, "sendfile", "/pic.png")}
                  alt={viewerStory.name}
                  className="max-h-full max-w-full object-contain"
                />
              )}

              {currentEntries.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setViewerItemIdx((i) => Math.max(0, i - 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (viewerItemIdx + 1 < currentEntries.length) {
                        setViewerItemIdx((i) => i + 1);
                      } else {
                        setViewerStory(null);
                      }
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Viewers Drawer Overlay */}
              {showViewersModal && (
                <div className="absolute inset-x-0 bottom-0 max-h-56 bg-slate-900/95 border-t border-slate-700 p-3 overflow-y-auto chat-scroll space-y-2 text-white">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>المشاهدون ({viewers.length})</span>
                    <button type="button" onClick={() => setShowViewersModal(false)}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {viewers.length === 0 ? (
                    <div className="text-[11px] text-slate-400 text-center py-3">لا يوجد مشاهدون مسجلون</div>
                  ) : (
                    viewers.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <MemberAvatar pic={String(v.photo || "")} topic={String(v.topic || "")} size="xs" showStatus={false} />
                        <span className="truncate font-semibold">{String(v.topic || "مشاهد")}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
