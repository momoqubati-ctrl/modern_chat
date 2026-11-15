import { useRef } from "react";
import { ChevronLeft, ChevronRight, Music, Pause, Play, Plus } from "lucide-react";
import type { UserNote } from "./noteTypes.js";
import { MemberAvatar } from "../MemberAvatar.js";
import { VerifiedBadge } from "../VerifiedBadge.js";

interface NotesStripBarProps {
  dark: boolean;
  notes: UserNote[];
  myAvatar?: string;
  myTopic?: string;
  myUid?: string;
  activePlayingAudioId?: string | null;
  onTogglePlayAudio?: (note: UserNote) => void;
  onOpenCreateNote: () => void;
  onSelectNote: (note: UserNote) => void;
}

export function NotesStripBar({
  dark,
  notes,
  myAvatar,
  myTopic,
  myUid,
  activePlayingAudioId,
  onTogglePlayAudio,
  onOpenCreateNote,
  onSelectNote,
}: NotesStripBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -160, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 160, behavior: "smooth" });
  };

  const myCleanTopic = myTopic ? `@${myTopic.replace(/^@/, "").toLowerCase()}` : "";
  const myActiveNote = notes.find(
    (n) => (myUid && n.uid === myUid) || (myCleanTopic && n.authorTopic.toLowerCase() === myCleanTopic)
  );
  const otherNotes = notes.filter((n) => n !== myActiveNote);

  return (
    <div className="relative w-full py-2 px-1 select-none">
      <div
        ref={scrollContainerRef}
        className="flex items-start gap-4 overflow-x-auto no-scrollbar scroll-smooth px-3 py-1.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* User's Note Slot (Create Note if none, or view my active note) */}
        <div className="flex flex-col items-center shrink-0 group">
          {myActiveNote ? (
            /* User already has an active note */
            <>
              <div
                className="relative mb-1.5 flex items-center justify-center cursor-pointer"
                onClick={() => onSelectNote(myActiveNote)}
              >
                <div
                  className={`relative z-10 px-2.5 py-1 rounded-2xl border-2 text-[11px] font-bold shadow-sm max-w-[110px] truncate flex items-center gap-1 transition-all group-hover:scale-105 ${
                    myActiveNote.type === "audio"
                      ? "border-amber-400 bg-amber-50/90 text-amber-950 dark:bg-amber-950/40 dark:border-amber-400/80 dark:text-amber-200"
                      : "border-amber-300/90 bg-white/95 text-slate-800 dark:bg-slate-900/90 dark:border-amber-400/80 dark:text-slate-100"
                  }`}
                >
                  {myActiveNote.type === "audio" ? (
                    <>
                      <Music className="w-3 h-3 text-pink-500 shrink-0" />
                      <span className="truncate">{myActiveNote.caption || myActiveNote.tag || "ملاحظة صوتية"}</span>
                    </>
                  ) : (
                    <span className="truncate">{myActiveNote.text || myActiveNote.caption || "ملاحظتك"}</span>
                  )}
                </div>

                <div
                  className={`absolute -bottom-1.5 w-2 h-2 rotate-45 border-r-2 border-b-2 z-0 ${
                    myActiveNote.type === "audio"
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950 dark:border-amber-400"
                      : "border-amber-300 bg-white dark:bg-slate-900 dark:border-amber-400"
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={() => onSelectNote(myActiveNote)}
                className="relative focus:outline-none transition-transform active:scale-95"
                title="عرض ملاحظتك الحالية"
              >
                <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 shadow-sm flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center">
                    <MemberAvatar
                      pic={myAvatar}
                      topic={myTopic || "أنا"}
                      size="md"
                    />
                  </div>
                </div>
              </button>

              <span className="mt-2 text-[11px] font-bold text-pink-600 dark:text-pink-400 truncate max-w-[70px]">
                ملاحظتك
              </span>
            </>
          ) : (
            /* User has NO active note: Show "+ إضافة ملاحظة" */
            <>
              <div className="h-9 mb-1.5 flex items-center justify-center">
                <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">
                  مشاركتك
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenCreateNote}
                className="relative focus:outline-none transition-transform active:scale-95"
                title="إضافة ملاحظة جديدة (نص أو صوت)"
              >
                <div className="w-14 h-14 rounded-full p-0.5 border-2 border-dashed border-pink-400/70 hover:border-pink-500 flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm">
                  <MemberAvatar
                    pic={myAvatar}
                    topic={myTopic || "أنا"}
                    size="md"
                  />
                </div>
                {/* Pink + Badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-pink-600 to-rose-400 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900">
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </button>

              <span className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[70px]">
                إضافة ملاحظة
              </span>
            </>
          )}
        </div>

        {/* Small Navigation indicator arrow pill */}
        {otherNotes.length > 0 && (
          <div className="flex items-center self-center shrink-0 -mx-1">
            <button
              type="button"
              onClick={scrollRight}
              title="تمرير الملاحظات"
              className="w-5 h-8 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Other Members' Notes Items (Strictly 1 note per member) */}
        {otherNotes.map((note) => {
          const isAudio = note.type === "audio";
          const isPlaying = activePlayingAudioId === note.id;

          return (
            <div
              key={note.id}
              className="flex flex-col items-center shrink-0 group cursor-pointer"
              onClick={() => onSelectNote(note)}
            >
              {/* Speech / Audio Bubble */}
              <div className="relative mb-1.5 flex items-center justify-center">
                <div
                  className={`relative z-10 px-2.5 py-1 rounded-2xl border-2 text-[11px] font-bold shadow-sm max-w-[110px] truncate flex items-center gap-1 transition-all group-hover:scale-105 ${
                    isAudio
                      ? "border-amber-400 bg-amber-50/90 text-amber-950 dark:bg-amber-950/40 dark:border-amber-400/80 dark:text-amber-200"
                      : "border-amber-300/90 bg-white/95 text-slate-800 dark:bg-slate-900/90 dark:border-amber-400/80 dark:text-slate-100"
                  }`}
                >
                  {isAudio ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTogglePlayAudio) {
                            onTogglePlayAudio(note);
                          } else {
                            onSelectNote(note);
                          }
                        }}
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition ${
                          isPlaying
                            ? "bg-rose-500 text-white animate-pulse"
                            : "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-300"
                        }`}
                        title={isPlaying ? "إيقاف مؤقت" : "استماع"}
                      >
                        {isPlaying ? (
                          <Pause className="w-2.5 h-2.5 fill-current" />
                        ) : (
                          <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <span className="truncate">{note.caption || note.tag || "موسيقى"}</span>
                    </>
                  ) : (
                    <span className="truncate">{note.text || note.caption || "ملاحظة"}</span>
                  )}
                </div>

                {/* Speech Bubble Arrow pointing to avatar */}
                <div
                  className={`absolute -bottom-1.5 w-2 h-2 rotate-45 border-r-2 border-b-2 z-0 ${
                    isAudio
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950 dark:border-amber-400"
                      : "border-amber-300 bg-white dark:bg-slate-900 dark:border-amber-400"
                  }`}
                />
              </div>

              {/* Avatar with Story Ring */}
              <div
                className={`relative w-14 h-14 rounded-full p-0.5 transition-transform group-hover:scale-105 active:scale-95 ${
                  note.viewedByMe
                    ? "border-2 border-slate-300 dark:border-slate-700"
                    : "bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]"
                }`}
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center">
                  <MemberAvatar
                    pic={note.authorPic}
                    topic={note.authorTopic}
                    size="md"
                  />
                </div>
              </div>

              {/* Author Handle and Verified Badge */}
              <div className="mt-1 flex items-center gap-0.5 max-w-[80px] justify-center">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate dir-ltr">
                  {note.authorTopic}
                </span>
                {note.authorVerified && <VerifiedBadge size="xs" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
