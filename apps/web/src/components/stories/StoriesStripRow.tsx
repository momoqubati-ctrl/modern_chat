import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { normalizeStorySlides, type RawStoryGroup } from "./storyTypes.js";
import { VerifiedBadge, isUserVerified } from "../VerifiedBadge.js";

interface StoriesStripRowProps {
  dark: boolean;
  onOpenCreator: () => void;
  onOpenViewer: (storyIdx: number, slideIdx?: number) => void;
}

export function StoriesStripRow({
  dark,
  onOpenCreator,
  onOpenViewer,
}: StoriesStripRowProps) {
  const me = useChatStore((s) => s.me);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const stories = useChatStore((s) => s.stories) as unknown as RawStoryGroup[];

  const myUid = me?.uid ? String(me.uid) : "";
  const isMember = me?.islogin === "عضو" && Boolean(myUid);

  const { myStoryIdx, myStoryGroup, otherStories } = useMemo(() => {
    const mIdx = myUid ? stories.findIndex((s) => String(s.sid) === myUid) : -1;
    const mGroup = mIdx !== -1 ? stories[mIdx] : undefined;
    const others = stories
      .map((st, idx) => ({ st, idx }))
      .filter(({ st }) => !myUid || String(st.sid) !== myUid);
    return { myStoryIdx: mIdx, myStoryGroup: mGroup, otherStories: others };
  }, [stories, myUid]);

  if (stories.length === 0 && !isMember) {
    return null;
  }

  const myHasUnviewed = myStoryGroup
    ? normalizeStorySlides(myStoryGroup).some((sl) => !sl.viewedByMe)
    : false;

  return (
    <div
      dir="ltr"
      className={`border-b shrink-0 ${
        dark ? "border-slate-800/70 bg-slate-900/40" : "border-slate-200 bg-slate-50/70"
      }`}
    >
      <div className="flex items-start gap-3 overflow-x-auto px-3 py-2.5 chat-scroll">
        {/* Current User's Story Circle (إضافة / قصتي) */}
        {isMember && (
          <div className="relative flex shrink-0 flex-col items-center gap-1">
            {myStoryGroup && myStoryIdx !== -1 ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenViewer(myStoryIdx, 0)}
                  aria-label="عرض قصتي"
                  className="relative flex h-[54px] w-[54px] items-center justify-center rounded-full transition-transform active:scale-95"
                >
                  <div
                    className={`h-full w-full rounded-full p-[2.5px] transition-colors ${
                      myHasUnviewed
                        ? "bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 shadow-sm"
                        : dark
                          ? "bg-slate-600"
                          : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`h-full w-full rounded-full border-2 overflow-hidden ${
                        dark ? "border-slate-900 bg-slate-900" : "border-white bg-white"
                      }`}
                    >
                      <img
                        src={resolveAssetUrl(myStoryGroup.photo || me?.pic || "pic.png", "pic", "/pic.png")}
                        alt="قصتي"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCreator();
                  }}
                  title="إضافة قصة جديدة"
                  aria-label="إضافة قصة جديدة"
                  className={`absolute top-9 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 text-white shadow-md border-2 transition-transform hover:scale-110 active:scale-95 ${
                    dark ? "border-slate-900" : "border-white"
                  }`}
                >
                  <Plus className="h-3 w-3 stroke-[3]" />
                </button>
                <span
                  className={`max-w-[58px] truncate text-[10px] font-bold inline-flex items-center justify-center gap-0.5 ${
                    dark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  <span className="truncate">قصتي</span>
                  {isUserVerified(me, onlineMap) && <VerifiedBadge size="xs" />}
                </span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onOpenCreator}
                  aria-label="إضافة قصة جديدة"
                  className={`relative flex h-[54px] w-[54px] items-center justify-center rounded-full border-2 border-dashed transition-all active:scale-95 ${
                    dark
                      ? "border-slate-600 bg-slate-800/80 hover:border-sky-400"
                      : "border-slate-300 bg-white hover:border-sky-500"
                  }`}
                >
                  <Plus className="h-5 w-5 text-sky-400" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm border-2 ${
                      dark ? "border-slate-900" : "border-white"
                    }`}
                  >
                    <Plus className="h-3 w-3 stroke-[3]" />
                  </span>
                </button>
                <span
                  className={`text-[10px] font-bold ${
                    dark ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  إضافة
                </span>
              </>
            )}
          </div>
        )}

        {/* Other Users' Stories */}
        {otherStories.map(({ st, idx }) => {
          const slides = normalizeStorySlides(st);
          const firstUnviewedIdx = slides.findIndex((sl) => !sl.viewedByMe);
          const hasUnviewed =
            typeof st.hasUnviewed === "boolean"
              ? st.hasUnviewed
              : firstUnviewedIdx !== -1 || !st.seen;
          const openAtSlideIdx = firstUnviewedIdx !== -1 ? firstUnviewedIdx : 0;
          const safeNameColor =
            st.ucol && (!dark || st.ucol.toLowerCase() !== "#000000") ? st.ucol : undefined;

          return (
            <button
              key={st.sid || st.id || idx}
              type="button"
              onClick={() => onOpenViewer(idx, openAtSlideIdx)}
              className="relative flex shrink-0 flex-col items-center gap-1 transition-transform active:scale-95"
            >
              <div
                className={`h-[54px] w-[54px] rounded-full p-[2.5px] transition-colors ${
                  hasUnviewed
                    ? "bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 shadow-sm"
                    : dark
                      ? "bg-slate-700"
                      : "bg-slate-300"
                }`}
              >
                <div
                  className={`h-full w-full rounded-full border-2 overflow-hidden ${
                    dark ? "border-slate-900 bg-slate-900" : "border-white bg-white"
                  }`}
                >
                  <img
                    src={resolveAssetUrl(st.photo || "pic.png", "pic", "/pic.png")}
                    alt={st.name || "قصة"}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <span
                dir="auto"
                className={`max-w-[58px] truncate text-[10px] font-bold inline-flex items-center justify-center gap-0.5 ${
                  dark ? "text-slate-200" : "text-slate-700"
                }`}
                style={safeNameColor ? { color: safeNameColor } : undefined}
              >
                <span className="truncate">{st.name || "عضو"}</span>
                {isUserVerified(st, onlineMap) && <VerifiedBadge size="xs" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
