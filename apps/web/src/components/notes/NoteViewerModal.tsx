import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreVertical,
  Music,
  Pause,
  Play,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { UserNote } from "./noteTypes.js";
import { MemberAvatar } from "../MemberAvatar.js";
import { NoteCommentsSheet } from "./NoteCommentsSheet.js";
import { canAccessControlPanel } from "../../lib/permissions.js";

interface NoteViewerModalProps {
  dark: boolean;
  isOpen: boolean;
  onClose: () => void;
  notes: UserNote[];
  initialNoteId?: string;
  onOpenDirectChat?: (userUid: string, userTopic?: string) => void;
  onToggleLikeNote?: (noteNid: string) => void;
  onAddCommentNote?: (noteNid: string, comment: string) => void;
}

function formatDurationSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function NoteViewerModal({
  dark,
  isOpen,
  onClose,
  notes,
  initialNoteId,
  onOpenDirectChat,
  onToggleLikeNote,
  onAddCommentNote,
}: NoteViewerModalProps) {
  const [filterTab, setFilterTab] = useState<"all" | "notes" | "audio">("all");
  const [currentIndex, setCurrentIndex] = useState(0);

  // Zustand Store Integration for Comments & Likes
  const noteCommentsMap = useChatStore((s) => s.noteCommentsMap);
  const fetchNoteComments = useChatStore((s) => s.fetchNoteComments);
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const deleteNote = useChatStore((s) => s.deleteNote);
  const pushNotice = useChatStore((s) => s.pushNotice);

  // Local optimistic likes state per note for instant feedback
  const [localLikes, setLocalLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  // Audio Playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [, setAudioLoaded] = useState(false);

  // Filter notes based on selected tab
  const filteredNotes = useMemo(() => {
    if (filterTab === "notes") return notes.filter((n) => n.type === "text");
    if (filterTab === "audio") return notes.filter((n) => n.type === "audio");
    return notes;
  }, [notes, filterTab]);

  const totalCount = notes.length;
  const textNotesCount = notes.filter((n) => n.type === "text").length;
  const audioNotesCount = notes.filter((n) => n.type === "audio").length;

  // Sync initial note selection
  useEffect(() => {
    if (isOpen && initialNoteId) {
      const idx = filteredNotes.findIndex((n) => n.id === initialNoteId || n.nid === initialNoteId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      } else {
        setCurrentIndex(0);
      }
    }
  }, [isOpen, initialNoteId, filteredNotes]);

  // Clamp current index when filter changes
  useEffect(() => {
    if (currentIndex >= filteredNotes.length) {
      setCurrentIndex(Math.max(0, filteredNotes.length - 1));
    }
  }, [filteredNotes.length, currentIndex]);

  const currentNote: UserNote | undefined = filteredNotes[currentIndex] || filteredNotes[0];

  // Fetch comments from backend whenever current note is active
  useEffect(() => {
    if (isOpen && currentNote?.nid) {
      fetchNoteComments(currentNote.nid);
    }
  }, [isOpen, currentNote?.nid, fetchNoteComments]);

  // Stop audio and reset player when note changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setAudioLoaded(false);

    if (currentNote?.type === "audio") {
      setDuration(currentNote.duration || 25);
    }
  }, [currentNote?.id, currentNote?.type, currentNote?.duration]);

  // Audio player handlers
  const handleTogglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(true);
        });
    }
  };

  // Simulated progress fallback if audio source is local or mock
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying && (!audioRef.current || audioRef.current.paused)) {
      const totalSec = duration || currentNote?.duration || 25;
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalSec) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, duration, currentNote?.duration]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const totalSec = duration || currentNote?.duration || 25;
    const targetTime = ratio * totalSec;
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : filteredNotes.length - 1));
  }, [filteredNotes.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < filteredNotes.length - 1 ? prev + 1 : 0));
  }, [filteredNotes.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") handleNext();
      else if (e.key === "ArrowRight") handlePrev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Like handler
  const handleLike = () => {
    if (!currentNote) return;
    const currentLike = localLikes[currentNote.id] ?? {
      liked: currentNote.likedByMe,
      count: currentNote.likesCount,
    };
    const nextLiked = !currentLike.liked;
    const nextCount = nextLiked ? currentLike.count + 1 : Math.max(0, currentLike.count - 1);

    setLocalLikes((prev) => ({
      ...prev,
      [currentNote.id]: { liked: nextLiked, count: nextCount },
    }));

    onToggleLikeNote?.(currentNote.nid || currentNote.id);
  };

  // Comment submission handler
  const handleSendComment = (e: FormEvent) => {
    e.preventDefault();
    if (!currentNote) return;
    const body = commentDraft.trim();
    if (body) {
      onAddCommentNote?.(currentNote.nid || currentNote.id, body);
      setCommentDraft("");
    }
    setShowCommentsSheet(true);
  };

  if (!isOpen || !currentNote) return null;

  const activeLike = localLikes[currentNote.id] ?? {
    liked: currentNote.likedByMe,
    count: currentNote.likesCount,
  };

  const liveComments = currentNote.nid ? noteCommentsMap[currentNote.nid] || [] : [];
  const currentTotalComments = Math.max(currentNote.commentsCount, liveComments.length);

  const isAdmin = canAccessControlPanel(me, powers);
  const isAuthor = Boolean(
    me?.uid &&
      currentNote &&
      (me.uid === currentNote.uid ||
        (me.topic &&
          currentNote.authorTopic.replace(/^@/, "").toLowerCase() ===
            me.topic.replace(/^@/, "").toLowerCase()))
  );
  const canDeleteNote = isAuthor || isAdmin;

  const handleDeleteCurrentNote = () => {
    if (!currentNote) return;
    deleteNote(currentNote.nid || currentNote.id);
    pushNotice("تم حذف الملاحظة بنجاح", { force: 1 });
    setShowOptionsMenu(false);
    onClose();
  };

  const totalSec = duration || currentNote.duration || 25;
  const progressRatio = totalSec > 0 ? Math.min(1, currentTime / totalSec) : 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 bg-black/60 backdrop-blur-md select-none animate-fadeIn">
        {/* Hidden audio element for real playback */}
        {currentNote.audioUrl && (
          <audio
            ref={audioRef}
            src={currentNote.audioUrl}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (d && !isNaN(d) && isFinite(d)) {
                setDuration(d);
              }
              setAudioLoaded(true);
            }}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
            onError={() => {
              setAudioLoaded(false);
            }}
          />
        )}

        {/* Top Filter Pills (Matching Reference Image 3) */}
        <div className="w-full max-w-sm flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setFilterTab("all");
              setCurrentIndex(0);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${
              filterTab === "all"
                ? "bg-white text-slate-900 shadow-md scale-105"
                : "bg-white/20 hover:bg-white/30 text-white/90"
            }`}
          >
            الكل {totalCount}
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterTab("notes");
              setCurrentIndex(0);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${
              filterTab === "notes"
                ? "bg-white text-slate-900 shadow-md scale-105"
                : "bg-white/20 hover:bg-white/30 text-white/90"
            }`}
          >
            ملاحظات {textNotesCount}
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterTab("audio");
              setCurrentIndex(0);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${
              filterTab === "audio"
                ? "bg-white text-slate-900 shadow-md scale-105"
                : "bg-white/20 hover:bg-white/30 text-white/90"
            }`}
          >
            موسيقى {audioNotesCount}
          </button>
        </div>

        {/* Main Lined Stationery Note Card (Matching Reference Image 3) */}
        <div className="relative w-full max-w-[340px] sm:max-w-[370px] my-auto">
          <div
            className="relative w-full rounded-[28px] overflow-hidden shadow-2xl border border-amber-200/50 flex flex-col transition-all"
            style={{
              backgroundColor: "#fdf8ec", // Warm vintage ivory parchment
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* Subtle Ruled Notebook Lines overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 31px, #e7ddc4 31px, #e7ddc4 32px)",
                backgroundPosition: "0 60px",
              }}
            />

            {/* Card Header */}
            <div className="relative z-10 px-4 pt-4 pb-2 flex items-center justify-between">
              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-amber-100/60 transition"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Author Information (RTL side) */}
              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 font-serif italic tracking-wide">
                    {currentNote.authorTopic.replace(/^@/, "")} ♡
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium dir-ltr">
                    {currentNote.authorTopic}
                  </div>
                </div>

                <div className="relative w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-pink-500 to-amber-400">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                    <MemberAvatar
                      pic={currentNote.authorPic}
                      topic={currentNote.authorTopic}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Options Dots */}
                {canDeleteNote && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowOptionsMenu((p) => !p)}
                      className="p-1 text-slate-500 hover:text-slate-800 transition mr-0.5 rounded-full hover:bg-amber-100/60"
                      title="خيارات الملاحظة"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showOptionsMenu && (
                      <div className="absolute left-0 top-7 z-30 bg-white border border-slate-200 rounded-2xl p-1 shadow-xl whitespace-nowrap animate-fadeIn">
                        <button
                          type="button"
                          onClick={handleDeleteCurrentNote}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition w-full"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف الملاحظة</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Card Body (Ruled paper content) */}
            <div className="relative z-10 px-6 py-8 min-h-[160px] flex flex-col justify-center items-center text-center">
              {currentNote.type === "audio" ? (
                /* Audio Note Experience with dynamic progress bar */
                <div className="w-full space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleTogglePlayAudio}
                      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                        isPlaying
                          ? "bg-rose-500 text-white animate-pulse"
                          : "bg-gradient-to-tr from-pink-500 to-amber-500 text-white hover:brightness-105"
                      }`}
                      title={isPlaying ? "إيقاف مؤقت" : "تشغيل الملاحظة الصوتية"}
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 fill-current" />
                      ) : (
                        <Play className="w-6 h-6 fill-current ml-1" />
                      )}
                    </button>
                  </div>

                  {/* Audio Title / Tag */}
                  <div className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                    <Music className="w-4 h-4 text-pink-500" />
                    <span>{currentNote.caption || currentNote.tag || "تسجيل صوتي"}</span>
                  </div>

                  {/* Interactive Dynamic Progress Bar according to recording length */}
                  <div className="w-full space-y-1.5 px-2">
                    <div
                      onClick={handleSeek}
                      className="relative w-full h-2.5 bg-amber-200/70 hover:bg-amber-200 rounded-full cursor-pointer overflow-hidden transition-all shadow-inner"
                      title="انقر للتنقل في التسجيل"
                    >
                      <div
                        className="absolute top-0 right-0 h-full bg-gradient-to-l from-pink-500 to-rose-400 rounded-full transition-all duration-150"
                        style={{ width: `${progressRatio * 100}%` }}
                      />
                    </div>

                    {/* Playback time & total duration */}
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 px-1">
                      <span>{formatDurationSeconds(currentTime)}</span>
                      {isPlaying && (
                        <div className="flex items-center gap-0.5">
                          <span className="w-1 h-3 bg-pink-500 rounded-full animate-bounce" />
                          <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                          <span className="w-1 h-2 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        </div>
                      )}
                      <span>{formatDurationSeconds(totalSec)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Text Note on Ruled lines */
                <div className="w-full py-4 px-2">
                  <p className="text-base sm:text-lg font-bold text-slate-800 leading-relaxed font-sans">
                    {currentNote.text || currentNote.caption || "ملاحظة"}
                  </p>
                </div>
              )}
            </div>

            {/* Card Footer Actions (Matching Reference Image 3) */}
            <div className="relative z-10 px-4 py-3 border-t border-amber-200/80 bg-[#faf3e0]/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                {/* Direct message button "رسالة >" */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDirectChat?.(currentNote.uid || (currentNote as any).sid, currentNote.authorTopic);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 transition px-2 py-1 rounded-xl hover:bg-amber-100/70"
                  title="محادثة خاصة مع صاحب الملاحظة"
                >
                  <Send className="w-3.5 h-3.5 rotate-180 text-slate-700" />
                  <span>رسالة</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* Comments button -> Opens Story-style Comments Sheet */}
                  <button
                    type="button"
                    onClick={() => setShowCommentsSheet(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition shadow-xs bg-[#f1e6cd] hover:bg-[#e9dcbe] text-slate-800"
                    title="عرض التعليقات"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{currentTotalComments}</span>
                  </button>

                  {/* Like button */}
                  <button
                    type="button"
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition shadow-xs active:scale-95 ${
                      activeLike.liked
                        ? "bg-rose-100 text-rose-600 hover:bg-rose-200"
                        : "bg-[#f1e6cd] hover:bg-[#e9dcbe] text-slate-800"
                    }`}
                    title={activeLike.liked ? "إلغاء الإعجاب" : "إعجاب"}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform ${
                        activeLike.liked ? "fill-rose-500 text-rose-500 scale-110" : ""
                      }`}
                    />
                    <span>{activeLike.count}</span>
                  </button>
                </div>
              </div>

              {/* Comment Input Box (Matching Reference Image 3) */}
              <form onSubmit={handleSendComment} className="relative flex items-center">
                <input
                  type="text"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onClick={() => setShowCommentsSheet(true)}
                  placeholder="أضف تعليقاً..."
                  className="w-full bg-[#f4ebd5] hover:bg-[#f0e4ca] focus:bg-white text-slate-800 text-xs rounded-full pl-9 pr-4 py-2 border border-amber-300/60 focus:border-amber-400 outline-none transition placeholder:text-slate-500 cursor-pointer"
                />
                <button
                  type="submit"
                  className="absolute left-1.5 w-7 h-7 rounded-full bg-slate-300/80 hover:bg-slate-400/90 text-slate-700 flex items-center justify-center transition"
                  title="إرسال التعليق"
                >
                  <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Pagination / Swiper below card: < 2 / 59 > (Matching Reference Image 3) */}
        <div className="w-full max-w-sm flex items-center justify-center gap-6 pb-2 text-white">
          <button
            type="button"
            onClick={handlePrev}
            className="p-2 rounded-full hover:bg-white/20 active:scale-90 transition text-white/90"
            title="الملاحظة السابقة"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <span className="text-xs font-mono font-bold tracking-wider text-white/90 dir-ltr">
            {currentIndex + 1} / {filteredNotes.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            className="p-2 rounded-full hover:bg-white/20 active:scale-90 transition text-white/90"
            title="الملاحظة التالية"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Story-Style Dedicated Comments Sheet (Identical UI to Stories Comments) */}
      <NoteCommentsSheet
        dark={dark}
        open={showCommentsSheet}
        noteNid={currentNote.nid || currentNote.id}
        noteAuthorTopic={currentNote.authorTopic}
        noteAuthorPic={currentNote.authorPic}
        noteAuthorVerified={currentNote.authorVerified}
        noteAuthorUid={currentNote.uid}
        noteTag={currentNote.tag}
        noteType={currentNote.type}
        commentsCount={currentTotalComments}
        onClose={() => setShowCommentsSheet(false)}
      />
    </>
  );
}
