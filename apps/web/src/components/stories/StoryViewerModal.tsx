import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic, resolveAssetUrl } from "../../lib/mediaUrl.js";
import { canAccessControlPanel } from "../../lib/permissions.js";
import { StoryCommentsSheet } from "./StoryCommentsSheet.js";
import { VerifiedBadge, isUserVerified } from "../VerifiedBadge.js";
import {
  formatStoryClock,
  normalizeStorySlides,
  type RawStoryGroup,
} from "./storyTypes.js";

interface StoryViewerModalProps {
  dark: boolean;
  storyIdx: number | null;
  slideIdx: number;
  onChangePosition: (storyIdx: number, slideIdx: number) => void;
  onClose: () => void;
}

export function StoryViewerModal({
  dark,
  storyIdx,
  slideIdx,
  onChangePosition,
  onClose,
}: StoryViewerModalProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const stories = useChatStore((s) => s.stories) as unknown as RawStoryGroup[];
  const storyViewersMap = useChatStore((s) => s.storyViewersMap);
  const storyLikersMap = useChatStore((s) => s.storyLikersMap);
  const markStoryViewed = useChatStore((s) => s.markStoryViewed);
  const getStoryViewers = useChatStore((s) => s.getStoryViewers);
  const fetchStoryLikers = useChatStore((s) => s.fetchStoryLikers);
  const toggleStoryLike = useChatStore((s) => s.toggleStoryLike);
  const deleteStory = useChatStore((s) => s.deleteStory);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [viewersTab, setViewersTab] = useState<"viewers" | "likers">("viewers");
  const [commentsOpen, setCommentsOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const animRef = useRef(0);
  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const pressStartRef = useRef(0);
  const lastVideoTickRef = useRef(0);

  const isOpen = storyIdx !== null && storyIdx >= 0 && storyIdx < stories.length;
  const currentGroup = isOpen ? stories[storyIdx] : undefined;
  const slides = normalizeStorySlides(currentGroup);
  const safeSlideIdx =
    slides.length > 0 ? Math.min(Math.max(0, slideIdx), slides.length - 1) : 0;
  const currentSlide = slides[safeSlideIdx];

  const isAdmin = canAccessControlPanel(me, powers);
  const isOwner = Boolean(me?.uid && currentGroup?.sid && me.uid === currentGroup.sid);
  const isVideo =
    currentSlide?.type === "video" ||
    /\.(mp4|webm|mov)(\?.*)?$/i.test(String(currentSlide?.src || ""));
  const isText = currentSlide?.type === "text";

  const advanceNext = useCallback(() => {
    if (storyIdx === null) return;
    if (safeSlideIdx + 1 < slides.length) {
      onChangePosition(storyIdx, safeSlideIdx + 1);
    } else if (storyIdx + 1 < stories.length) {
      const nextSlides = normalizeStorySlides(stories[storyIdx + 1]);
      const nextUnviewed = nextSlides.findIndex((sl) => !sl.viewedByMe);
      onChangePosition(storyIdx + 1, nextUnviewed !== -1 ? nextUnviewed : 0);
    } else {
      onClose();
    }
  }, [storyIdx, safeSlideIdx, slides.length, stories, onChangePosition, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx === null) return;
    if (safeSlideIdx > 0) {
      onChangePosition(storyIdx, safeSlideIdx - 1);
    } else if (storyIdx > 0) {
      const prevSlides = normalizeStorySlides(stories[storyIdx - 1]);
      onChangePosition(storyIdx - 1, Math.max(0, prevSlides.length - 1));
    }
  }, [storyIdx, safeSlideIdx, stories, onChangePosition]);

  // Reset & report unique slide view
  useEffect(() => {
    if (!isOpen || !currentGroup || !currentSlide) return;
    setProgress(0);
    elapsedBeforePauseRef.current = 0;
    startTimeRef.current = Date.now();
    setLoadError(false);
    setMediaLoaded(isText);

    markStoryViewed(currentGroup.sid, safeSlideIdx, currentSlide.id);

    const safety = setTimeout(() => setMediaLoaded(true), 3500);
    return () => clearTimeout(safety);
  }, [isOpen, currentGroup?.sid, currentSlide?.id, safeSlideIdx, isText, markStoryViewed]);

  // Auto-advance timer for image & text stories
  useEffect(() => {
    if (
      !isOpen ||
      isVideo ||
      !currentSlide ||
      !mediaLoaded ||
      paused ||
      showViewersModal ||
      commentsOpen
    ) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const durationMs = Math.max(4, Number(currentSlide.length || 6)) * 1000;
    startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      elapsedBeforePauseRef.current = elapsed;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      if (pct >= 100) {
        advanceNext();
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [
    isOpen,
    isVideo,
    currentSlide,
    mediaLoaded,
    paused,
    showViewersModal,
    commentsOpen,
    advanceNext,
  ]);

  // Play / pause HTML5 video cleanly
  useEffect(() => {
    if (!isOpen || !isVideo || !videoRef.current) return;
    const v = videoRef.current;
    if (paused || showViewersModal || commentsOpen) {
      v.pause();
    } else {
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [isOpen, isVideo, paused, showViewersModal, commentsOpen, currentSlide?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "Escape") {
        if (commentsOpen) setCommentsOpen(false);
        else if (showViewersModal) setShowViewersModal(false);
        else onClose();
        return;
      }
      if (commentsOpen || showViewersModal) return;
      if (e.key === "ArrowLeft") advanceNext();
      else if (e.key === "ArrowRight") goPrev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "m" || e.key === "M") {
        setIsMuted((m) => !m);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, commentsOpen, showViewersModal, advanceNext, goPrev, onClose]);

  if (!isOpen || !currentGroup || !currentSlide) return null;

  const viewers = storyViewersMap[currentGroup.sid] || [];
  const likers = storyLikersMap[`${currentGroup.sid}::${currentSlide.id}`] || [];

  const handlePointerDown = () => {
    pressStartRef.current = Date.now();
    setPaused(true);
  };

  const handlePointerUp = (dir: "next" | "prev") => {
    const pressMs = Date.now() - pressStartRef.current;
    setPaused(false);
    if (pressMs < 220) {
      if (dir === "next") advanceNext();
      else goPrev();
    }
  };

  const handleOpenViewers = () => {
    getStoryViewers(currentGroup.sid, currentSlide.id, safeSlideIdx);
    fetchStoryLikers(currentGroup.sid, currentSlide.id);
    setViewersTab("viewers");
    setShowViewersModal(true);
  };

  const handleOpenComments = () => {
    setCommentsOpen(true);
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/dashboard?story=${encodeURIComponent(currentGroup.sid)}`;
    if (navigator.share) {
      navigator
        .share({ title: `قصة ${currentGroup.name}`, url: shareUrl })
        .catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        pushNotice("تم نسخ رابط القصة");
      }).catch(() => {});
    }
  };

  const handleDeleteCurrentSlide = () => {
    deleteStory({
      id: currentGroup.id,
      sid: currentGroup.sid,
      itemId: currentSlide.id,
    });
    pushNotice("تم حذف القصة");
    if (slides.length <= 1) {
      onClose();
    } else if (safeSlideIdx >= slides.length - 1) {
      onChangePosition(storyIdx!, Math.max(0, safeSlideIdx - 1));
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/95 select-none"
    >
      {/* Loading Spinner */}
      {!mediaLoaded && !isText && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2.5 bg-black/50">
          <Loader2 className="h-9 w-9 animate-spin text-white/80" />
          <span className="text-xs font-bold text-white/75">جاري التحميل...</span>
        </div>
      )}

      {/* Top Segmented Progress Bars */}
      <div className="absolute top-2.5 inset-x-3 z-40 flex gap-1.5 px-1">
        {slides.map((sl, idx) => (
          <div key={sl.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white"
              style={{
                width:
                  idx < safeSlideIdx
                    ? "100%"
                    : idx === safeSlideIdx
                      ? `${progress}%`
                      : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Top Header: Author on Right, Mute/Close on Left */}
      <div className="pointer-events-none absolute top-7 inset-x-4 z-40 flex items-center justify-between pt-1">
        <div className="pointer-events-auto flex items-center gap-2.5 min-w-0">
          <img
            src={resolveAssetUrl(currentGroup.photo || "pic.png", "pic", "/pic.png")}
            alt={currentGroup.name}
            className="h-10 w-10 rounded-full border-2 border-white/60 object-cover shadow-md shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-extrabold text-white drop-shadow">
                {currentGroup.name || "عضو"}
              </p>
              {isUserVerified(currentGroup, onlineMap) && <VerifiedBadge size="sm" />}
            </div>
            <p className="text-[11px] font-semibold text-white/75 drop-shadow">
              {formatStoryClock(currentSlide.time || currentGroup.lastUpdated)}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {isVideo && (
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
              className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80 border border-white/15"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80 border border-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tap Navigation Zones (RTL: Right = Prev, Left = Next) */}
      <div className="absolute inset-0 z-10 flex">
        <div
          className="h-full w-1/2 cursor-pointer"
          onPointerDown={handlePointerDown}
          onPointerUp={() => handlePointerUp("prev")}
        />
        <div
          className="h-full w-1/2 cursor-pointer"
          onPointerDown={handlePointerDown}
          onPointerUp={() => handlePointerUp("next")}
        />
      </div>

      {/* Story Canvas */}
      <div className="relative z-0 flex h-full w-full max-w-lg flex-col items-center justify-center overflow-hidden">
        {isText ? (
          <div
            className="flex h-full w-full flex-col items-center justify-center p-8 text-center"
            style={{
              background:
                currentSlide.bgColor || "linear-gradient(135deg,#667eea,#764ba2)",
            }}
          >
            {currentSlide.caption && (
              <p
                dir="auto"
                className="text-2xl font-black leading-relaxed select-text break-words max-w-full"
                style={{ color: currentSlide.textColor || "#ffffff" }}
              >
                {currentSlide.caption}
              </p>
            )}
          </div>
        ) : isVideo ? (
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            <video
              key={currentSlide.id}
              ref={videoRef}
              src={resolveAssetUrl(currentSlide.src, "sendfile", "")}
              className="h-full w-full object-contain"
              playsInline
              autoPlay
              preload="auto"
              muted={isMuted}
              onLoadedMetadata={() => setMediaLoaded(true)}
              onCanPlay={() => {
                setMediaLoaded(true);
                if (!paused && !commentsOpen && !showViewersModal) {
                  videoRef.current?.play().catch(() => {});
                }
              }}
              onPlaying={() => setMediaLoaded(true)}
              onTimeUpdate={() => {
                const v = videoRef.current;
                if (!v || !v.duration || !Number.isFinite(v.duration)) return;
                const now = Date.now();
                if (now - lastVideoTickRef.current < 65) return;
                lastVideoTickRef.current = now;
                setProgress(Math.min(100, (v.currentTime / v.duration) * 100));
              }}
              onEnded={advanceNext}
              onError={() => {
                setMediaLoaded(true);
                setLoadError(true);
              }}
            />
            {loadError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-6">
                <p className="text-sm font-bold text-white/90">تعذر تشغيل الفيديو</p>
                <button
                  type="button"
                  onClick={advanceNext}
                  className="rounded-xl bg-white/20 px-4 py-2 text-xs font-bold text-white"
                >
                  التالي
                </button>
              </div>
            )}
            {currentSlide.caption && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-16">
                <p dir="auto" className="text-center text-base font-extrabold text-white drop-shadow">
                  {currentSlide.caption}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-black">
            <img
              key={currentSlide.id}
              src={resolveAssetUrl(currentSlide.src, "sendfile", "/pic.png")}
              alt={currentGroup.name}
              className="h-full w-full object-contain"
              onLoad={() => setMediaLoaded(true)}
              onError={() => {
                setMediaLoaded(true);
                setLoadError(true);
              }}
            />
            {loadError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-6">
                <p className="text-sm font-bold text-white/90">تعذر عرض الصورة</p>
              </div>
            )}
            {currentSlide.caption && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-16">
                <p dir="auto" className="text-center text-base font-extrabold text-white drop-shadow">
                  {currentSlide.caption}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Left-Side Vertical Floating Action Column (Matches Reference Images + Instagram Comments) */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (isOwner || isAdmin) handleOpenViewers();
          }}
          title="المشاهدات"
          className={`flex flex-col items-center gap-1 text-white/90 transition ${
            isOwner || isAdmin ? "hover:text-white cursor-pointer" : "cursor-default"
          }`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 border border-white/15">
            <Eye className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-extrabold">{currentSlide.viewsCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const willLike = !currentSlide.likedByMe;
            toggleStoryLike(currentGroup.sid, currentSlide.id);
            pushNotice(willLike ? "تم التفاعل والإعجاب بالقصة ❤️" : "تم إلغاء الإعجاب بالقصة", { topic: "إعجاب" });
          }}
          title="إعجاب"
          className="flex flex-col items-center gap-1 text-white/90 hover:text-white transition active:scale-90"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-white/20 border border-white/15">
            <Heart
              className={`h-5 w-5 transition-transform ${
                currentSlide.likedByMe ? "fill-rose-500 text-rose-500 animate-action-pop" : ""
              }`}
            />
          </div>
          <span className="text-[11px] font-extrabold">{currentSlide.likesCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenComments}
          title="التعليقات"
          className="flex flex-col items-center gap-1 text-white/90 hover:text-white transition"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-white/20 border border-white/15">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-extrabold">
            {currentSlide.commentsCount || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          title="مشاركة"
          className="flex flex-col items-center gap-1 text-white/90 hover:text-white transition"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-white/20 border border-white/15">
            <Share2 className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-bold">مشاركة</span>
        </button>

        {(isOwner || isAdmin) && (
          <button
            type="button"
            onClick={handleDeleteCurrentSlide}
            title="حذف القصة"
            className="flex flex-col items-center gap-1 text-rose-400 hover:text-rose-300 transition"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-rose-500/20 border border-rose-500/30">
              <Trash2 className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold">حذف</span>
          </button>
        )}
      </div>

      {/* Viewers & Likers Modal (Matching hobi ViewerOverlay.tsx) */}
      {showViewersModal && (
        <div
          onClick={() => setShowViewersModal(false)}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm overflow-hidden rounded-3xl border shadow-2xl ${
              dark
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div
              className={`border-b px-5 py-4 ${
                dark ? "border-slate-800" : "border-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black">
                  {viewersTab === "viewers" ? (
                    <>
                      <Eye className="h-4 w-4 text-sky-400" />
                      <span>المشاهدون</span>
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4 text-rose-500" />
                      <span>المعجبون</span>
                    </>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowViewersModal(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-800/30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setViewersTab("viewers")}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    viewersTab === "viewers"
                      ? "bg-sky-500 text-white"
                      : dark
                        ? "bg-slate-800 text-slate-400"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  <span>{viewers.length} مشاهدة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewersTab("likers")}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    viewersTab === "likers"
                      ? "bg-rose-500 text-white"
                      : dark
                        ? "bg-slate-800 text-slate-400"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Heart className="h-3 w-3" />
                  <span>{likers.length} إعجاب</span>
                </button>
              </div>
            </div>

            <div className="max-h-[55dvh] space-y-1 overflow-y-auto p-3 chat-scroll">
              {viewersTab === "viewers" ? (
                viewers.length === 0 ? (
                  <p className="py-8 text-center text-xs font-bold text-slate-400">
                    لا يوجد مشاهدون بعد
                  </p>
                ) : (
                  viewers.map((v, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
                        dark ? "hover:bg-slate-900" : "hover:bg-slate-50"
                      }`}
                    >
                      <img
                        src={resolveAssetUrl(String(v.photo || "pic.png"), "pic", "/pic.png")}
                        alt={String(v.topic || "")}
                        className="h-10 w-10 rounded-full object-cover border border-slate-700/40 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-sm font-bold">
                            {String(v.topic || "مشاهد")}
                          </p>
                          {isUserVerified(v, onlineMap) && <VerifiedBadge size="xs" />}
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {formatDateTimeArabic(v.time)}
                        </p>
                      </div>
                    </div>
                  ))
                )
              ) : likers.length === 0 ? (
                <p className="py-8 text-center text-xs font-bold text-slate-400">
                  لا يوجد معجبون بعد
                </p>
              ) : (
                likers.map((l, idx) => (
                  <div
                    key={`${l.user_uid}-${idx}`}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
                      dark ? "hover:bg-slate-900" : "hover:bg-slate-50"
                    }`}
                  >
                    <img
                      src={resolveAssetUrl(l.photo || "pic.png", "pic", "/pic.png")}
                      alt={l.topic}
                      className="h-10 w-10 rounded-full object-cover border border-slate-700/40 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-sm font-bold">{l.topic || "عضو"}</p>
                        {isUserVerified(l, onlineMap) && <VerifiedBadge size="xs" />}
                      </div>
                      <p className="text-[10px] font-semibold text-slate-400">
                        {formatDateTimeArabic(l.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instagram-Style Hierarchical Story Comments Bottom Sheet */}
      <StoryCommentsSheet
        dark={dark}
        open={commentsOpen}
        storySid={currentGroup.sid}
        itemId={currentSlide.id}
        storyAuthorTopic={currentGroup.name}
        storyAuthorPic={currentGroup.photo}
        storyAuthorVerified={isUserVerified(currentGroup, onlineMap)}
        viewsCount={currentSlide.viewsCount || 0}
        commentsCount={currentSlide.commentsCount || 0}
        onClose={() => setCommentsOpen(false)}
      />
    </div>
  );
}
