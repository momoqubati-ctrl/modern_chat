import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Mic,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { isMediaCaptureSupported, requestUserMediaWithFallback } from "../../lib/mediaPermissions.js";

interface CreateNoteModalProps {
  dark: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const QUICK_EMOJIS = ["🤍", "✨", "🌸", "🤲", "☕", "🔥", "🌙", "🎵", "🕊️", "🌹"];

export function CreateNoteModal({ dark, isOpen, onClose, onSuccess }: CreateNoteModalProps) {
  const [noteKind, setNoteKind] = useState<"text" | "audio">("text");

  // Text Note state
  const [textContent, setTextContent] = useState("");

  // Voice Note state
  const [audioTitle, setAudioTitle] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const publishNote = useChatStore((s) => s.publishNote);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);
  const me = useChatStore((s) => s.me);
  const notes = useChatStore((s) => s.notes);

  const hasActiveNote = Boolean(me?.uid && notes.some((n) => n.uid === me.uid));

  // Clear preview URL on unmount or reset
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [audioPreviewUrl]);

  // Clean up when closed
  const handleClose = () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setRecordedBlob(null);
    setIsRecording(false);
    setRecordingSeconds(0);
    setTextContent("");
    setAudioTitle("");
    onClose();
  };

  // Start voice recording
  const handleStartRecording = async () => {
    if (!isMediaCaptureSupported()) {
      pushNotice("الميكروفون غير مدعوم في هذا المتصفح", { force: 1 });
      return;
    }

    try {
      const stream = await requestUserMediaWithFallback({ audio: true, video: false });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 30) {
            handleStopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      pushNotice("تعذر الوصول إلى الميكروفون. يرجى منح الإذن.", { force: 1 });
    }
  };

  // Stop voice recording
  const handleStopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Toggle preview playback
  const handleTogglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play().then(() => setIsPreviewPlaying(true)).catch(() => setIsPreviewPlaying(false));
    }
  };

  // Handle local audio file selection
  const handleAudioFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      pushNotice("حجم الملف الصوتي كبير جداً (الحد الأقصى 15 ميجابايت)", { force: 1 });
      return;
    }

    setRecordedBlob(file);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    const url = URL.createObjectURL(file);
    setAudioPreviewUrl(url);
  };

  // Submit note (Text or Voice)
  const handleSubmit = async () => {
    if (hasActiveNote) {
      pushNotice("لديك ملاحظة نشطة بالفعل لم تنتهِ بعد. يرجى حذفها أولاً لتتمكن من نشر ملاحظة جديدة.", { force: 1 });
      return;
    }

    if (noteKind === "text") {
      const trimmed = textContent.trim();
      if (!trimmed) {
        pushNotice("يرجى كتابة نص الملاحظة", { force: 1 });
        return;
      }

      publishNote({
        type: "text",
        caption: trimmed,
        text: trimmed,
      });

      pushNotice("تم نشر الملاحظة بنجاح ✨", { force: 1 });
      handleClose();
      onSuccess?.();
    } else {
      if (!recordedBlob) {
        pushNotice("يرجى تسجيل صوت أو اختيار ملف صوتي أولاً", { force: 1 });
        return;
      }
      if (!audioTitle.trim()) {
        pushNotice("يرجى إدخال عنوان أو وسم للملاحظة الصوتية", { force: 1 });
        return;
      }

      setUploading(true);
      try {
        let finalAudioUrl = "";
        try {
          const file =
            recordedBlob instanceof File
              ? recordedBlob
              : new File([recordedBlob], `voice_note_${Date.now()}.webm`, {
                  type: recordedBlob.type || "audio/webm",
                });
          finalAudioUrl = (await getApiClient().uploadMediaFile(file, file.name)).trim();
        } catch {
          // If upload endpoint encounters issue, convert to base64 data url fallback
          finalAudioUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(recordedBlob);
          });
        }

        if (!finalAudioUrl) {
          throw new Error("Empty audio payload");
        }

        publishNote({
          type: "audio",
          audioUrl: finalAudioUrl,
          caption: audioTitle.trim() || "موسيقى",
          tag: audioTitle.trim() || "موسيقى",
          duration: Math.max(3, recordingSeconds || 15),
        });

        pushNotice("تم نشر الملاحظة الصوتية بنجاح 🎵", { force: 1 });
        handleClose();
        onSuccess?.();
      } catch {
        pushNotice("تعذر نشر الملاحظة الصوتية، يرجى المحاولة مرة أخرى", { force: 1 });
      } finally {
        setUploading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className={`relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
          dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">إضافة ملاحظة جديدة</h3>
              <p className="text-[11px] text-slate-400">ستظهر الملاحظة لأصدقائك في شريط المحادثات</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active note warning banner */}
        {hasActiveNote && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>لديك ملاحظة نشطة بالفعل لم تنتهِ بعد (تنتهي بعد 24 ساعة). يمكنك حذف ملاحظتك السابقة أولاً لتتمكن من نشر ملاحظة جديدة.</span>
          </div>
        )}

        {/* Tab switch between Text and Voice */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setNoteKind("text")}
              className={`py-2 text-xs font-bold rounded-xl transition ${
                noteKind === "text"
                  ? "bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              📝 ملاحظة نصية
            </button>

            <button
              type="button"
              onClick={() => setNoteKind("audio")}
              className={`py-2 text-xs font-bold rounded-xl transition ${
                noteKind === "audio"
                  ? "bg-white dark:bg-slate-700 text-pink-600 dark:text-pink-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              🎙️ ملاحظة صوتية
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-4">
          {noteKind === "text" ? (
            /* TEXT NOTE CREATOR */
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  name="note_text_content"
                  id="note_text_content"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value.slice(0, 120))}
                  placeholder="اكتب ما يدور في بالك (حكمة، دعاء، فكرة، أو شعور)..."
                  rows={3}
                  className={`w-full rounded-2xl p-3.5 text-xs border outline-none resize-none transition ${
                    dark
                      ? "bg-slate-950 border-slate-800 focus:border-pink-500 text-slate-100"
                      : "bg-slate-50 border-slate-200 focus:border-pink-500 text-slate-900"
                  }`}
                />
                <span className="absolute bottom-2 left-3 text-[10px] text-slate-400">
                  {textContent.length} / 120
                </span>
              </div>

              {/* Quick Emojis */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setTextContent((prev) => (prev + emoji).slice(0, 120))}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Preview bubble */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-400 mb-2">معاينة الملاحظة</span>
                <div className="relative px-3 py-1.5 rounded-2xl border-2 border-amber-300 bg-white text-slate-800 text-xs font-bold shadow-xs max-w-[200px] text-center truncate">
                  {textContent.trim() || "ألا بذكر الله تطمئن القلوب 🤍"}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r-2 border-b-2 border-amber-300 bg-white" />
                </div>
              </div>
            </div>
          ) : (
            /* VOICE NOTE CREATOR */
            <div className="space-y-4">
              {/* Audio tag / caption input */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  عنوان أو وسم الملاحظة (مثال: موسيقى، طرب، خاطرة):
                </label>
                <input
                  type="search"
                  name="note_audio_title"
                  id="note_audio_title"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value.slice(0, 30))}
                  placeholder="موسيقى، طرب... 😅✨"
                  className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                    dark
                      ? "bg-slate-950 border-slate-800 focus:border-pink-500"
                      : "bg-slate-50 border-slate-200 focus:border-pink-500"
                  }`}
                />
              </div>

              {/* Voice Recorder & Player Box */}
              <div className="p-4 rounded-2xl border border-dashed border-pink-300 dark:border-pink-800/60 bg-pink-50/40 dark:bg-pink-950/20 flex flex-col items-center justify-center gap-3">
                {audioPreviewUrl ? (
                  /* Audio Recorded Preview */
                  <div className="w-full space-y-3 flex flex-col items-center">
                    <audio
                      ref={previewAudioRef}
                      src={audioPreviewUrl}
                      onEnded={() => setIsPreviewPlaying(false)}
                      className="hidden"
                    />

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePreviewPlay}
                        className="w-12 h-12 rounded-full bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center shadow-md transition"
                        title={isPreviewPlaying ? "إيقاف مؤقت" : "استماع للتسجيل"}
                      >
                        {isPreviewPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                          setAudioPreviewUrl(null);
                          setRecordedBlob(null);
                          setRecordingSeconds(0);
                        }}
                        className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition"
                        title="حذف وإعادة التسجيل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      جاهز للنشر • {recordingSeconds || 15} ثانية
                    </div>
                  </div>
                ) : isRecording ? (
                  /* Live Recording View */
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-rose-600 animate-ping opacity-25 absolute" />
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="relative z-10 w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg transition"
                        title="إيقاف التسجيل"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                      <span>جارٍ التسجيل: 00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 00:30</span>
                    </div>
                  </div>
                ) : (
                  /* Idle State: Click to record or pick file */
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleStartRecording()}
                      className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 hover:brightness-105 text-white flex items-center justify-center shadow-lg transition active:scale-95"
                      title="بدء التسجيل الصوتي"
                    >
                      <Mic className="w-6 h-6" />
                    </button>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      انقر لبدء تسجيل صوتك (حتى 30 ثانية)
                    </span>

                    <span className="text-[10px] text-slate-400">أو</span>

                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-pink-500" />
                      <span>اختر ملف صوتي من جهازك</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-950/30">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={uploading || hasActiveNote || (noteKind === "text" ? !textContent.trim() : (!recordedBlob || !audioTitle.trim()))}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:brightness-105 disabled:opacity-40 text-white text-xs font-extrabold shadow-md transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{uploading ? "جارٍ النشر..." : "مشاركة الملاحظة"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
