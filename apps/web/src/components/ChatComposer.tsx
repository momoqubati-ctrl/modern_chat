import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Dices,
  Film,
  Gamepad2,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  Trash2,
  Trophy,
  Video,
  X,
  Youtube,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { RoomMessagePayload } from "@newchat/shared";
import { EMOJI_IMAGE_CLASS, emojiShortcut, applyTextShortcuts } from "../lib/emojiShortcuts.js";
import { resolveAssetUrl } from "../lib/mediaUrl.js";
import {
  explainMediaAccessError,
  isMediaCaptureSupported,
  requestUserMediaWithFallback,
} from "../lib/mediaPermissions.js";
import { canUseCompetitionBots, hasRoleFlag } from "../lib/permissions.js";
import { detectAttachmentTypeFromPath } from "../lib/richContent.js";
import { VoiceNotePlayer } from "./media/VoiceNotePlayer.js";
import { VoiceRecordingBar } from "./media/VoiceRecordingBar.js";
import { VerifiedBadge, isUserVerified } from "./VerifiedBadge.js";

interface PendingMedia {
  kind: "file" | "voice";
  file?: File;
  blob?: Blob;
  type: "image" | "video" | "audio" | "file";
  previewUrl: string;
  name: string;
  size?: number;
  mime?: string;
  base64Data?: string;
}

interface ChatComposerProps {
  dark: boolean;
  replyTo: RoomMessagePayload | null;
  onClearReply: () => void;
  onOpenCarrom: () => void;
  onOpenLudo: () => void;
  onOpenCompetition: () => void;
  pendingInsertText?: string;
  onConsumeInsertText?: () => void;
}

export function ChatComposer({
  dark,
  replyTo,
  onClearReply,
  onOpenCarrom,
  onOpenLudo,
  onOpenCompetition,
  pendingInsertText,
  onConsumeInsertText,
}: ChatComposerProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const shortcuts = useChatStore((s) => s.shortcuts);
  const emos = useChatStore((s) => s.emos);
  const youtubeResults = useChatStore((s) => s.youtubeResults);
  const lastTikTokResult = useChatStore((s) => s.lastTikTokResult);

  const sendRoomMessage = useChatStore((s) => s.sendRoomMessage);
  const sendTyping = useChatStore((s) => s.sendTyping);
  const sendVoiceNote = useChatStore((s) => s.sendVoiceNote);
  const sendPublicAnnouncement = useChatStore((s) => s.sendPublicAnnouncement);
  const searchYoutube = useChatStore((s) => s.searchYoutube);
  const resolveTikTok = useChatStore((s) => s.resolveTikTok);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);

  const [pickerOpen, setPickerOpen] = useState(false);

  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [ytQuery, setYtQuery] = useState("");
  const [ytMode, setYtMode] = useState<"videos" | "shorts">("videos");

  const [ttModalOpen, setTtModalOpen] = useState(false);
  const [ttUrl, setTtUrl] = useState("");

  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [announceHideSender, setAnnounceHideSender] = useState(false);

  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");

  const lastTypingEmitRef = useRef(0);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecRef = useRef(0);
  const cancelRecordingRef = useRef(false);
  const chunksRef = useRef<BlobPart[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canAnnounce =
    hasRoleFlag(me, powers, "publicmsg", myPowerRole) ||
    hasRoleFlag(me, powers, "publicmsghide", myPowerRole);
  const canHideSender = hasRoleFlag(me, powers, "publicmsghide", myPowerRole);
  const canBots = canUseCompetitionBots(me, powers, myPowerRole);

  useEffect(() => {
    if (!pendingInsertText) return;
    setDraft((prev) => (prev ? `${prev.trimEnd()} ${pendingInsertText} ` : `${pendingInsertText} `));
    inputRef.current?.focus();
    onConsumeInsertText?.();
  }, [pendingInsertText, onConsumeInsertText]);

  useEffect(() => {
    return () => {
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    };
  }, []);

  const handleDraftChange = (val: string) => {
    setDraft(val);
    const now = Date.now();
    if (val.trim()) {
      if (now - lastTypingEmitRef.current > 900) {
        lastTypingEmitRef.current = now;
        sendTyping(true);
      }
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = setTimeout(() => {
        sendTyping(false);
      }, 2200);
    } else {
      sendTyping(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;

    const reply = replyTo
      ? {
          reply: {
            id: replyTo.id || "",
            mi: replyTo.mi || "",
            topic: replyTo.topic || "",
            msg: (replyTo.msg || "").slice(0, 140),
          },
        }
      : undefined;

    const expanded = applyTextShortcuts(draft.trim(), shortcuts);
    sendRoomMessage(expanded, reply);
    setDraft("");
    sendTyping(false);
    onClearReply();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const detected = detectAttachmentTypeFromPath(file.name);
    const type: "image" | "video" | "audio" | "file" =
      detected !== "file"
        ? detected
        : file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : "file";

    const previewUrl = URL.createObjectURL(file);
    setPendingMedia({
      kind: "file",
      file,
      type,
      previewUrl,
      name: file.name,
      size: file.size,
      mime: file.type,
    });
    setMediaCaption(draft.trim());
  };

  const startComposerRecordingTimer = () => {
    setRecordingSec(0);
    recordingSecRef.current = 0;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      recordingSecRef.current += 1;
      setRecordingSec(recordingSecRef.current);
    }, 1000);
  };

  const stopComposerRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      stopComposerRecordingTimer();
      setRecording(false);
      return;
    }
    if (!isMediaCaptureSupported()) {
      pushNotice(explainMediaAccessError(null, "mic"), { force: 1 });
      return;
    }
    try {
      const stream = await requestUserMediaWithFallback({ audio: true, video: false });
      const rec = new MediaRecorder(stream);
      cancelRecordingRef.current = false;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopComposerRecordingTimer();
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          setRecordingSec(0);
          return;
        }
        // Chrome reports e.g. "audio/webm;codecs=opus"; keep a clean mime
        // so the data URL and the stored file use a known extension.
        const mime = (rec.mimeType || "audio/webm").split(";")[0]?.trim() || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 400) return;
        const previewUrl = URL.createObjectURL(blob);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            setPendingMedia({
              kind: "voice",
              type: "audio",
              previewUrl,
              blob,
              name: `تسجيل صوتي للغرفة (${recordingSecRef.current || 1} ثانية)`,
              mime,
              base64Data: reader.result,
            });
            setMediaCaption(draft.trim());
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      startComposerRecordingTimer();
    } catch (err) {
      stopComposerRecordingTimer();
      pushNotice(explainMediaAccessError(err, "mic"), { force: 1 });
    }
  };

  const handleCancelRecording = () => {
    cancelRecordingRef.current = true;
    mediaRecorderRef.current?.stop();
    stopComposerRecordingTimer();
    setRecording(false);
    setRecordingSec(0);
    recordingSecRef.current = 0;
  };

  const handleCancelPendingMedia = () => {
    if (pendingMedia?.previewUrl) {
      URL.revokeObjectURL(pendingMedia.previewUrl);
    }
    setPendingMedia(null);
    setMediaCaption("");
    setUploading(false);
  };

  const handleConfirmSendMedia = async () => {
    if (!pendingMedia || uploading) return;
    setUploading(true);
    try {
      if (pendingMedia.kind === "voice" && pendingMedia.base64Data) {
        sendVoiceNote(pendingMedia.base64Data, pendingMedia.mime || "audio/webm");
        if (mediaCaption.trim()) {
          sendRoomMessage(mediaCaption.trim(), {
            ...(replyTo
              ? {
                  reply: {
                    id: replyTo.id || "",
                    mi: replyTo.mi || "",
                    topic: replyTo.topic || "",
                    msg: (replyTo.msg || "").slice(0, 140),
                  },
                }
              : {}),
          });
        }
        pushNotice("تم إرسال التسجيل الصوتي بنجاح");
      } else if (pendingMedia.file) {
        const path = (await getApiClient().uploadMediaFile(pendingMedia.file, pendingMedia.file.name)).trim();
        const fileType = pendingMedia.type;
        sendRoomMessage(mediaCaption.trim(), {
          file: path,
          fileType,
          ...(replyTo
            ? {
                reply: {
                  id: replyTo.id || "",
                  mi: replyTo.mi || "",
                  topic: replyTo.topic || "",
                  msg: (replyTo.msg || "").slice(0, 140),
                },
              }
            : {}),
        });
        pushNotice("تم إرسال المرفق بنجاح");
      }
      handleCancelPendingMedia();
      setDraft("");
      onClearReply();
    } catch (err) {
      pushNotice(err instanceof Error ? err.message : "تعذر رفع وإرسال الملف", { force: 1 });
    } finally {
      setUploading(false);
    }
  };

  const insertToken = (token: string, keepPickerOpen = false) => {
    const input = inputRef.current;
    if (input && typeof input.selectionStart === "number" && typeof input.selectionEnd === "number") {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const before = draft.slice(0, start);
      const after = draft.slice(end);
      const needLead = before.length > 0 && !before.endsWith(" ");
      const needTrail = after.length === 0 || !after.startsWith(" ");
      const insert = `${needLead ? " " : ""}${token}${needTrail ? " " : ""}`;
      const nextVal = `${before}${insert}${after}`;
      setDraft(nextVal);
      requestAnimationFrame(() => {
        input.focus();
        const pos = start + insert.length;
        input.setSelectionRange(pos, pos);
      });
    } else {
      setDraft((prev) => (prev ? `${prev.trimEnd()} ${token} ` : `${token} `));
      inputRef.current?.focus();
    }
    if (!keepPickerOpen) {
      setPickerOpen(false);
    }
  };

  const handleYoutubeSearch = (e: FormEvent) => {
    e.preventDefault();
    searchYoutube(ytQuery.trim(), ytMode);
  };

  const handleSendAnnouncement = (e: FormEvent) => {
    e.preventDefault();
    if (!announceText.trim()) return;
    sendPublicAnnouncement(announceText.trim(), announceHideSender);
    setAnnounceText("");
    setAnnounceOpen(false);
  };

  const ttMeta = lastTikTokResult?.meta as Record<string, unknown> | undefined;

  return (
    <div
      className={`border-t shrink-0 relative ${
        dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      {/* Reply Banner */}
      {replyTo && (
        <div
          className={`px-3 py-1.5 border-b text-xs flex items-center justify-between gap-2 ${
            dark ? "bg-sky-500/10 border-slate-800 text-sky-300" : "bg-sky-50 border-slate-200 text-sky-800"
          }`}
        >
          <div className="min-w-0 truncate flex items-center gap-1">
            <span className="font-bold">رد على {replyTo.topic}: </span>
            {isUserVerified(replyTo) && <VerifiedBadge size="xs" />}
            <span className="opacity-80 truncate">{replyTo.msg || "مرفق"}</span>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="p-0.5 rounded hover:bg-black/20 shrink-0"
            title="إلغاء الرد"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Shortcuts Strip */}
      {shortcuts.length > 0 && (
        <div className="px-3 py-1.5 border-b border-slate-800/30 flex items-center gap-1.5 overflow-x-auto chat-scroll">
          {shortcuts.slice(0, 24).map((sc, idx) => (
            <button
              key={`${sc.text1}-${idx}`}
              type="button"
              onClick={() => insertToken(sc.text1)}
              title={sc.text2 || sc.text1}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border shrink-0 transition ${
                dark
                  ? "bg-slate-950 border-slate-800 hover:border-sky-500/50 text-slate-300"
                  : "bg-slate-50 border-slate-200 hover:border-sky-400 text-slate-700"
              }`}
            >
              {sc.text1}
            </button>
          ))}
        </div>
      )}

      {/* Smiley Picker Popover */}
      {pickerOpen && (
        <div
          className={`absolute bottom-full right-3 mb-2 z-30 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border shadow-2xl overflow-hidden ${
            dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/40">
            <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-600 text-white">
              سمايلات ({emos.length})
            </span>
            <button type="button" onClick={() => setPickerOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2.5 max-h-52 overflow-y-auto chat-scroll grid grid-cols-5 gap-1.5">
            {emos.map((file, index) => (
              <button
                key={file}
                type="button"
                onClick={() => {
                  insertToken(emojiShortcut(index), true);
                }}
                title={emojiShortcut(index)}
                className={`p-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition ${
                  dark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                <img src={resolveAssetUrl(file, "emo", "")} alt="" className={EMOJI_IMAGE_CLASS} />
                <span className="text-[9px] font-bold opacity-70" dir="rtl">
                  {emojiShortcut(index)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live Voice Recording Bar for Room */}
      {recording && (
        <div className="px-2.5 pt-2.5">
          <VoiceRecordingBar
            dark={dark}
            seconds={recordingSec}
            label="جارٍ تسجيل رسالة للغرفة..."
            onCancel={handleCancelRecording}
            onStop={() => void toggleRecording()}
          />
        </div>
      )}

      {/* Composer Row */}
      <form onSubmit={handleSubmit} className="p-2.5 flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            title="الفيسات (سمايلات)"
            className={`p-2 rounded-xl border transition ${
              pickerOpen
                ? "bg-sky-600 border-sky-500 text-white"
                : dark
                  ? "border-slate-800 hover:bg-slate-800 text-slate-300"
                  : "border-slate-200 hover:bg-slate-100 text-slate-600"
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>

          <label
            title="إرسال صورة / ملف / فيديو"
            className={`p-2 rounded-xl border cursor-pointer transition ${
              dark
                ? "border-slate-800 hover:bg-slate-800 text-slate-300"
                : "border-slate-200 hover:bg-slate-100 text-slate-600"
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              accept="image/*,audio/*,video/*"
              className="hidden"
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>

          <button
            type="button"
            onClick={() => void toggleRecording()}
            title={recording ? "إيقاف ومعاينة التسجيل الصوتي" : "تسجيل رسالة صوتية"}
            className={`p-2 rounded-xl border transition ${
              recording
                ? "bg-rose-600 border-rose-500 text-white animate-pulse"
                : dark
                  ? "border-slate-800 hover:bg-slate-800 text-rose-400"
                  : "border-slate-200 hover:bg-slate-100 text-rose-600"
            }`}
          >
            {recording ? (
              <Square className="w-4 h-4 fill-current" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setYtModalOpen(true)}
            title="بحث يوتيوب والشورتس"
            className={`p-2 rounded-xl border transition ${
              dark
                ? "border-slate-800 hover:bg-slate-800 text-rose-400"
                : "border-slate-200 hover:bg-slate-100 text-rose-600"
            }`}
          >
            <Youtube className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setTtModalOpen(true)}
            title="جلب ومشاركة فيديو تيك توك"
            className={`p-2 rounded-xl border transition ${
              dark
                ? "border-slate-800 hover:bg-slate-800 text-cyan-400"
                : "border-slate-200 hover:bg-slate-100 text-cyan-700"
            }`}
          >
            <Film className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenCarrom}
            title="طاولة الكيرم"
            className={`hidden md:inline-flex p-2 rounded-xl border transition ${
              dark
                ? "border-slate-800 hover:bg-slate-800 text-amber-400"
                : "border-slate-200 hover:bg-slate-100 text-amber-600"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenLudo}
            title="طاولة اللودو"
            className={`hidden md:inline-flex p-2 rounded-xl border transition ${
              dark
                ? "border-slate-800 hover:bg-slate-800 text-emerald-400"
                : "border-slate-200 hover:bg-slate-100 text-emerald-600"
            }`}
          >
            <Dices className="w-4 h-4" />
          </button>

          {canBots && (
            <button
              type="button"
              onClick={onOpenCompetition}
              title="بوت المسابقات"
              className={`hidden md:inline-flex p-2 rounded-xl border transition ${
                dark
                  ? "border-slate-800 hover:bg-slate-800 text-emerald-400"
                  : "border-slate-200 hover:bg-slate-100 text-emerald-600"
              }`}
            >
              <Trophy className="w-4 h-4" />
            </button>
          )}

          {canAnnounce && (
            <button
              type="button"
              onClick={() => setAnnounceOpen(true)}
              title="إعلان عام للجميع"
              className={`p-2 rounded-xl border transition ${
                dark
                  ? "border-slate-800 hover:bg-slate-800 text-violet-400"
                  : "border-slate-200 hover:bg-slate-100 text-violet-700"
              }`}
            >
              <Megaphone className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Message Input */}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          disabled={Boolean(me?.muted || me?.meiut)}
          placeholder={
            me?.muted || me?.meiut
              ? "أنت مكتوم حالياً..."
              : uploading
                ? "جارٍ رفع المرفق..."
                : "اكتب رسالتك في الغرفة..."
          }
          className={`flex-1 min-w-[160px] rounded-xl px-3.5 py-2 text-sm border outline-none ${
            dark
              ? "bg-slate-950 border-slate-800 focus:border-sky-500 text-slate-100"
              : "bg-slate-50 border-slate-200 focus:border-sky-500 text-slate-900"
          }`}
        />

        <button
          type="submit"
          disabled={!draft.trim() || uploading || Boolean(me?.muted || me?.meiut)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white px-4 py-2 text-sm font-bold transition shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">إرسال</span>
        </button>
      </form>

      {/* YouTube Search Modal */}
      {ytModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="px-4 py-3 bg-rose-600 text-white flex items-center justify-between text-xs font-extrabold">
              <span className="flex items-center gap-1.5">
                <Youtube className="w-4 h-4" />
                البحث في يوتيوب والشورتس
              </span>
              <button type="button" onClick={() => setYtModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleYoutubeSearch} className="p-3 border-b border-slate-800/30 space-y-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setYtMode("videos")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    ytMode === "videos" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  فيديو
                </button>
                <button
                  type="button"
                  onClick={() => setYtMode("shorts")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    ytMode === "shorts" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  Shorts
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ytQuery}
                  onChange={(e) => setYtQuery(e.target.value)}
                  placeholder="ابحث باسم الأغنية أو المقطع أو الصق الرابط..."
                  className={`flex-1 rounded-xl px-3 py-2 text-xs border outline-none ${
                    dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">
                  بحث
                </button>
              </div>
            </form>

            <div className="p-3 max-h-80 overflow-y-auto chat-scroll space-y-2">
              {youtubeResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  اكتب كلمة البحث واضغط "بحث" لعرض النتائج
                </div>
              ) : (
                youtubeResults.map((item, idx) => {
                  const vid = String(item.id || "");
                  const isShort = Boolean(item.isShort) || ytMode === "shorts";
                  const shareUrl = isShort
                    ? `https://www.youtube.com/shorts/${vid}`
                    : `https://www.youtube.com/watch?v=${vid}`;
                  return (
                    <button
                      key={`${vid}-${idx}`}
                      type="button"
                      onClick={() => {
                        sendRoomMessage(shareUrl);
                        setYtModalOpen(false);
                      }}
                      className={`w-full text-right rounded-xl p-2 border flex items-center gap-3 transition ${
                        dark
                          ? "bg-slate-950/70 border-slate-800 hover:border-rose-500/50"
                          : "bg-slate-50 border-slate-200 hover:border-rose-400"
                      }`}
                    >
                      <img
                        src={String(item.thumbnail || "")}
                        alt=""
                        className="w-24 h-14 rounded-lg object-cover bg-black shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold line-clamp-2">{String(item.title || vid)}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{String(item.channelTitle || "YouTube")}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TikTok Resolver Modal */}
      {ttModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="px-4 py-3 bg-cyan-600 text-white flex items-center justify-between text-xs font-extrabold">
              <span className="flex items-center gap-1.5">
                <Video className="w-4 h-4" />
                مشاركة مقطع تيك توك
              </span>
              <button type="button" onClick={() => setTtModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={ttUrl}
                  onChange={(e) => setTtUrl(e.target.value)}
                  placeholder="الصق رابط tiktok.com هنا..."
                  dir="ltr"
                  className={`flex-1 rounded-xl px-3 py-2 text-xs border outline-none ${
                    dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => resolveTikTok(ttUrl.trim(), `tt_${Date.now()}`)}
                  className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold"
                >
                  جلب
                </button>
              </div>

              {ttMeta && (
                <div
                  className={`rounded-xl p-3 border space-y-2 ${
                    dark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {Boolean(ttMeta.thumbnailUrl) && (
                      <img
                        src={String(ttMeta.thumbnailUrl)}
                        alt=""
                        className="w-16 h-20 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0 text-xs space-y-1">
                      <div className="font-bold line-clamp-2">{String(ttMeta.title || "مقطع تيك توك")}</div>
                      <div className="text-[11px] text-cyan-400">
                        {String(ttMeta.authorName || ttMeta.authorHandle || "")}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const shareLink = String(ttMeta.canonicalUrl || lastTikTokResult?.url || ttUrl);
                      sendRoomMessage(shareLink);
                      setTtModalOpen(false);
                      setTtUrl("");
                    }}
                    className="w-full py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold"
                  >
                    إرسال المقطع في الغرفة
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff Announcement Modal */}
      {announceOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSendAnnouncement}
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="px-4 py-3 bg-violet-600 text-white flex items-center justify-between text-xs font-extrabold">
              <span className="flex items-center gap-1.5">
                <Megaphone className="w-4 h-4" />
                إرسال إعلان عام لجميع الغرف
              </span>
              <button type="button" onClick={() => setAnnounceOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                rows={3}
                value={announceText}
                onChange={(e) => setAnnounceText(e.target.value)}
                placeholder="اكتب نص الإعلان الإداري..."
                className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
              {canHideSender && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={announceHideSender}
                    onChange={(e) => setAnnounceHideSender(e.target.checked)}
                    className="rounded"
                  />
                  <span>إخفاء اسم المرسل (إعلان إداري صامت)</span>
                </label>
              )}
              <button
                type="submit"
                disabled={!announceText.trim()}
                className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold"
              >
                بث الإعلان الآن
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Media Preview Modal Before Sending */}
      {pendingMedia && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between text-xs font-extrabold shrink-0 ${
                pendingMedia.type === "image"
                  ? "bg-sky-600 text-white"
                  : pendingMedia.type === "video"
                    ? "bg-emerald-600 text-white"
                    : "bg-rose-600 text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                {pendingMedia.type === "image" && <ImageIcon className="w-4 h-4" />}
                {pendingMedia.type === "video" && <Film className="w-4 h-4" />}
                {pendingMedia.type === "audio" && <Mic className="w-4 h-4" />}
                {pendingMedia.type === "file" && <Paperclip className="w-4 h-4" />}
                <span>
                  {pendingMedia.kind === "voice"
                    ? "معاينة التسجيل الصوتي قبل الإرسال"
                    : pendingMedia.type === "image"
                      ? "معاينة الصورة قبل الإرسال"
                      : pendingMedia.type === "video"
                        ? "معاينة الفيديو قبل الإرسال"
                        : "معاينة المرفق قبل الإرسال"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelPendingMedia}
                disabled={uploading}
                className="p-1 rounded-lg hover:bg-white/20 transition"
                title="إلغاء وإغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Media Preview */}
            <div className="p-4 overflow-y-auto chat-scroll space-y-3 flex-1 flex flex-col items-center justify-center min-h-0">
              {pendingMedia.type === "image" && (
                <div className="w-full flex flex-col items-center justify-center rounded-xl overflow-hidden bg-black/40 border border-slate-700/40 p-1">
                  <img
                    src={pendingMedia.previewUrl}
                    alt={pendingMedia.name}
                    className="max-h-72 w-auto max-w-full rounded-lg object-contain"
                  />
                </div>
              )}

              {pendingMedia.type === "video" && (
                <div className="w-full rounded-xl overflow-hidden bg-black border border-slate-700/40">
                  <video
                    src={pendingMedia.previewUrl}
                    controls
                    playsInline
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              )}

              {pendingMedia.type === "audio" && (
                <div
                  className={`w-full p-4 rounded-xl border flex flex-col items-center gap-3 ${
                    dark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 animate-pulse">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold">{pendingMedia.name}</div>
                    <div className={`text-[10px] mt-0.5 ${dark ? "text-slate-400" : "text-slate-500 font-medium"}`}>
                      استمع إلى التسجيل للتأكد من وضوح الصوت قبل مشاركته في الغرفة
                    </div>
                  </div>
                  <VoiceNotePlayer
                    src={pendingMedia.previewUrl}
                    dark={dark}
                    className="mt-1 w-full max-w-[460px]"
                  />
                </div>
              )}

              {pendingMedia.type === "file" && (
                <div
                  className={`w-full p-4 rounded-xl border flex items-center gap-3 ${
                    dark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <Paperclip className="w-8 h-8 text-sky-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{pendingMedia.name}</div>
                    {pendingMedia.size && (
                      <div className={`text-[10px] mt-0.5 ${dark ? "text-slate-400" : "text-slate-500 font-medium"}`}>
                        {(pendingMedia.size / 1024).toFixed(1)} كيلوبايت
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reply Quote Banner if replying */}
              {replyTo && (
                <div
                  dir="auto"
                  className={`w-full px-3 py-1.5 rounded-xl border-l-2 border-sky-500 text-[11px] ${
                    dark ? "bg-slate-950/70 text-slate-300" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className={`font-bold text-[10px] ${dark ? "text-sky-400" : "text-sky-800"}`}>
                    رد على {replyTo.topic || "رسالة"}
                  </div>
                  <div className="truncate opacity-80">{replyTo.msg}</div>
                </div>
              )}

              {/* Optional Caption Field */}
              <div className="w-full space-y-1">
                <label className={`text-[11px] font-semibold block ${dark ? "text-slate-300" : "text-slate-700"}`}>
                  رسالة أو تعليق مع المرفق (اختياري):
                </label>
                <input
                  type="text"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !uploading) {
                      e.preventDefault();
                      void handleConfirmSendMedia();
                    }
                  }}
                  disabled={uploading}
                  placeholder="اكتب رسالة مرافقة هنا..."
                  className={`w-full rounded-xl px-3.5 py-2 text-xs border outline-none ${
                    dark
                      ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                      : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
                  }`}
                />
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div
              className={`p-3 border-t flex items-center justify-between gap-2 shrink-0 ${
                dark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <button
                type="button"
                onClick={handleCancelPendingMedia}
                disabled={uploading}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                  dark
                    ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                    : "border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>إلغاء</span>
              </button>

              <button
                type="button"
                onClick={() => void handleConfirmSendMedia()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>إرسال الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
