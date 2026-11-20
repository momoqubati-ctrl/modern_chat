import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Reply,
  Send,
  Smile,
  Square,
  ThumbsUp,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { BroadcastWallPost } from "@newchat/shared";
import { EMOJI_IMAGE_CLASS, emojiShortcut, applyTextShortcuts } from "../lib/emojiShortcuts.js";
import { adjustColorForTheme, formatTimeArabic, resolveAssetUrl } from "../lib/mediaUrl.js";
import {
  explainMediaAccessError,
  isMediaCaptureSupported,
  requestUserMediaWithFallback,
} from "../lib/mediaPermissions.js";
import { hasRoleFlag } from "../lib/permissions.js";
import { detectAttachmentTypeFromPath, extractYoutubeVideoId, SafeRichText } from "../lib/richContent.js";
import { MemberAvatar } from "./MemberAvatar.js";
import { VoiceNotePlayer } from "./media/VoiceNotePlayer.js";
import { VoiceRecordingBar } from "./media/VoiceRecordingBar.js";
import { VerifiedBadge, isUserVerified } from "./VerifiedBadge.js";

interface WallPanelProps {
  dark: boolean;
}

interface WallVoicePreview {
  blob: Blob;
  previewUrl: string;
  durationSec: number;
}

export function WallPanel({ dark }: WallPanelProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const wallPosts = useChatStore((s) => s.wallPosts);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const sendWallPost = useChatStore((s) => s.sendWallPost);
  const deleteWallPost = useChatStore((s) => s.deleteWallPost);
  const commentWallPost = useChatStore((s) => s.commentWallPost);
  const likeWallPost = useChatStore((s) => s.likeWallPost);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);
  const youtubeResults = useChatStore((s) => s.youtubeResults);
  const searchYoutube = useChatStore((s) => s.searchYoutube);
  const emos = useChatStore((s) => s.emos);
  const shortcuts = useChatStore((s) => s.shortcuts);

  const [draft, setDraft] = useState("");
  const postInputRef = useRef<HTMLInputElement | null>(null);
  const [commentPickerBid, setCommentPickerBid] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isCardMode, setIsCardMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Wall Voice Recording & Preview State
  const [wallRecording, setWallRecording] = useState(false);
  const [wallRecordingSec, setWallRecordingSec] = useState(0);
  const [wallVoicePreview, setWallVoicePreview] = useState<WallVoicePreview | null>(null);

  const wallMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wallRecordedChunksRef = useRef<BlobPart[]>([]);
  const wallRecordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wallRecordingSecRef = useRef(0);
  const cancelRecordingRef = useRef(false);

  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [ytQuery, setYtQuery] = useState("");
  const [ytMode, setYtMode] = useState<"videos" | "shorts">("videos");

  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyTargets, setReplyTargets] = useState<Record<string, { cid: string; topic: string } | null>>({});

  const canModDelete = hasRoleFlag(me, powers, "delbc", myPowerRole);
  const actorKey = me?.uid || me?.lid || me?.id || "";

  const startWallRecordingTimer = () => {
    setWallRecordingSec(0);
    wallRecordingSecRef.current = 0;
    if (wallRecordingTimerRef.current) clearInterval(wallRecordingTimerRef.current);
    wallRecordingTimerRef.current = setInterval(() => {
      wallRecordingSecRef.current += 1;
      setWallRecordingSec(wallRecordingSecRef.current);
    }, 1000);
  };

  const stopWallRecordingTimer = () => {
    if (wallRecordingTimerRef.current) {
      clearInterval(wallRecordingTimerRef.current);
      wallRecordingTimerRef.current = null;
    }
  };

  const toggleWallRecording = async () => {
    if (wallRecording && wallMediaRecorderRef.current) {
      wallMediaRecorderRef.current.stop();
      stopWallRecordingTimer();
      setWallRecording(false);
      return;
    }
    if (!isMediaCaptureSupported()) {
      pushNotice(explainMediaAccessError(null, "mic"), { force: 1 });
      return;
    }
    try {
      const stream = await requestUserMediaWithFallback({ audio: true, video: false });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      cancelRecordingRef.current = false;
      wallRecordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) wallRecordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopWallRecordingTimer();
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          setWallRecordingSec(0);
          return;
        }
        const blob = new Blob(wallRecordedChunksRef.current, { type: mime });
        if (blob.size < 400) return;
        const previewUrl = URL.createObjectURL(blob);
        setWallVoicePreview({
          blob,
          previewUrl,
          durationSec: Math.max(1, wallRecordingSecRef.current),
        });
        setWallRecording(false);
      };
      wallMediaRecorderRef.current = recorder;
      recorder.start();
      setWallRecording(true);
      startWallRecordingTimer();
    } catch (err) {
      stopWallRecordingTimer();
      pushNotice(explainMediaAccessError(err, "mic"), { force: 1 });
    }
  };

  const handleCancelWallRecording = () => {
    cancelRecordingRef.current = true;
    wallMediaRecorderRef.current?.stop();
    stopWallRecordingTimer();
    setWallRecording(false);
    setWallRecordingSec(0);
    wallRecordingSecRef.current = 0;
  };

  const handleDiscardWallVoice = () => {
    if (wallVoicePreview?.previewUrl) {
      URL.revokeObjectURL(wallVoicePreview.previewUrl);
    }
    setWallVoicePreview(null);
  };

  const insertPostToken = (token: string, keepPickerOpen = false) => {
    const input = postInputRef.current;
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
      postInputRef.current?.focus();
    }
    if (!keepPickerOpen) {
      setPickerOpen(false);
    }
  };

  const handlePublish = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() && !linkInput.trim() && !wallVoicePreview) return;

    let effectiveLink = linkInput.trim() || undefined;

    // Upload voice recording if present
    if (wallVoicePreview) {
      setUploading(true);
      try {
        const ext = wallVoicePreview.blob.type.includes("ogg") ? "ogg" : "webm";
        const file = new File([wallVoicePreview.blob], `wall_voice_${Date.now()}.${ext}`, {
          type: wallVoicePreview.blob.type || "audio/webm",
        });
        effectiveLink = (await getApiClient().uploadMediaFile(file, file.name)).trim();
      } catch {
        pushNotice("تعذر رفع التسجيل الصوتي للحائط", { force: 1 });
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    const expanded = applyTextShortcuts(draft.trim(), shortcuts);
    sendWallPost(expanded, {
      link: effectiveLink,
      card: isCardMode || Boolean(effectiveLink),
    });

    setDraft("");
    setLinkInput("");
    setShowLinkInput(false);
    setPickerOpen(false);
    handleDiscardWallVoice();
    if (wallVoicePreview) {
      pushNotice("تم نشر التسجيل الصوتي على الحائط بنجاح");
    }
  };

  const handleYoutubeSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!ytQuery.trim()) return;
    searchYoutube(ytQuery.trim(), ytMode);
  };

  const handleSelectYoutubeVideo = (
    shareUrl: string,
    title?: string,
    mode: "publish" | "attach" = "publish",
  ) => {
    if (mode === "attach") {
      setLinkInput(shareUrl);
      setIsCardMode(true);
      setShowLinkInput(true);
      if (!draft.trim() && title) {
        setDraft(title);
      }
      setYtModalOpen(false);
      pushNotice("تم إرفاق مقطع يوتيوب بالمنشور");
      return;
    }

    const caption = draft.trim() || title || shareUrl;
    sendWallPost(caption, {
      link: shareUrl,
      card: true,
    });
    setDraft("");
    setLinkInput("");
    setShowLinkInput(false);
    setYtModalOpen(false);
    pushNotice("تم نشر مقطع يوتيوب على الحائط");
  };

  const handleUploadMedia = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploadedUrl = (await getApiClient().uploadMediaFile(file, file.name)).trim();
      if (uploadedUrl) {
        setLinkInput(uploadedUrl);
        setIsCardMode(true);
        setShowLinkInput(true);
        pushNotice("تم إرفاق الملف بالمنشور");
      }
    } catch {
      pushNotice("تعذر رفع الملف المرفق", { force: 1 });
    } finally {
      setUploading(false);
    }
  };

  const handleSendWallSticker = (link: string) => {
    const caption = draft.trim();
    sendWallPost(caption, { link, card: true });
    if (caption) setDraft("");
    setPickerOpen(false);
  };

  const handleSendComment = (bid: string) => {
    const rawText = (commentDrafts[bid] || "").trim();
    if (!rawText) return;
    const expanded = applyTextShortcuts(rawText, shortcuts);
    const replyTo = replyTargets[bid];
    commentWallPost(bid, expanded, replyTo?.cid);
    setCommentDrafts((prev) => ({ ...prev, [bid]: "" }));
    setReplyTargets((prev) => ({ ...prev, [bid]: null }));
    setCommentPickerBid(null);
  };

  const renderLikesInfo = (p: BroadcastWallPost) => {
    const arr = Array.isArray(p.likes) ? p.likes : [];
    let state1 = 0;
    let state2 = 0;
    let myState: 0 | 1 | 2 = 0;
    for (const raw of arr) {
      const val = String(raw);
      if (val.endsWith(":2")) {
        state2 += 1;
        if (actorKey && val === `${actorKey}:2`) myState = 2;
      } else {
        state1 += 1;
        if (actorKey && (val === actorKey || val === `${actorKey}:1`)) myState = 1;
      }
    }
    return { state1, state2, myState };
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Wall Post Composer */}
      <form onSubmit={handlePublish} className="p-3 border-b border-slate-800/30 space-y-2 shrink-0">
        <div className="flex gap-2">
          <input
            ref={postInputRef}
            type="text"
            dir="rtl"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="شارك لحظتك على الحائط..."
            disabled={uploading}
            className={`flex-1 rounded-xl px-3 py-2 text-xs border outline-none text-right ${
              dark
                ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-500 focus:border-sky-500"
            }`}
          />
          <button
            type="submit"
            disabled={uploading || (!draft.trim() && !linkInput.trim() && !wallVoicePreview)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold shrink-0 transition"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>رفع...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>نشر</span>
              </>
            )}
          </button>
        </div>

        {/* Live Recording Indicator Banner */}
        {wallRecording && (
          <VoiceRecordingBar
            dark={dark}
            seconds={wallRecordingSec}
            label="جارٍ تسجيل صوتي للحائط..."
            onCancel={handleCancelWallRecording}
            onStop={() => void toggleWallRecording()}
          />
        )}

        {/* Audio Preview Before Publishing to Wall */}
        {wallVoicePreview && (
          <div
            className={`p-3 rounded-2xl border flex flex-col gap-2.5 ${
              dark ? "bg-slate-950/80 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-rose-500">
                <Mic className="w-4 h-4" />
                معاينة التسجيل قبل النشر على الحائط
              </span>
              <button
                type="button"
                onClick={handleDiscardWallVoice}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                  dark
                    ? "text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"
                    : "text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                }`}
                title="حذف التسجيل وإعادة التسجيل"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>

            <VoiceNotePlayer
              src={wallVoicePreview.previewUrl}
              dark={dark}
              durationSec={wallVoicePreview.durationSec}
              className="w-full"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1 shrink-0">
            {/* Emoji / stickers button (same as room composer) */}
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

            {/* Attachment upload */}
            <label
              title={uploading ? "جارٍ رفع الملف..." : "إرسال صورة / ملف / فيديو"}
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
                onChange={handleUploadMedia}
                className="hidden"
              />
            </label>

            {/* Voice recording button */}
            <button
              type="button"
              onClick={() => void toggleWallRecording()}
              title={wallRecording ? "إيقاف ومعاينة التسجيل الصوتي" : "تسجيل بصمة صوتية للحائط"}
              className={`p-2 rounded-xl border transition ${
                wallRecording
                  ? "bg-rose-600 border-rose-500 text-white animate-pulse"
                  : dark
                    ? "border-slate-800 hover:bg-slate-800 text-rose-400"
                    : "border-slate-200 hover:bg-slate-100 text-rose-600"
              }`}
            >
              {wallRecording ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* YouTube button */}
            <button
              type="button"
              onClick={() => setYtModalOpen(true)}
              title="بحث وإرسال مقطع يوتيوب على الحائط"
              className={`p-2 rounded-xl border transition ${
                dark
                  ? "border-slate-800 hover:bg-slate-800 text-rose-400"
                  : "border-slate-200 hover:bg-slate-100 text-rose-600"
              }`}
            >
              <Youtube className="w-4 h-4" />
            </button>
          </div>

          <label className={`inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold shrink-0 ${
            dark ? "text-slate-300" : "text-slate-700"
          }`}>
            <input
              type="checkbox"
              checked={isCardMode}
              onChange={(e) => setIsCardMode(e.target.checked)}
              className="rounded"
            />
            <span>بطاقة غنية</span>
          </label>
        </div>

        {/* Smiley Picker */}
        {pickerOpen && (
          <div
            className={`rounded-2xl border shadow-xl overflow-hidden ${
              dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
          >
            <div
              className={`flex items-center justify-between px-3 py-2 border-b ${
                dark ? "border-slate-800" : "border-slate-200"
              }`}
            >
              <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-600 text-white">
                سمايلات ({emos.length})
              </span>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className={`transition ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 max-h-52 overflow-y-auto chat-scroll grid grid-cols-5 gap-1.5">
              {emos.map((file, index) => (
                <button
                  key={file}
                  type="button"
                  onClick={() => insertPostToken(emojiShortcut(index), true)}
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

        {showLinkInput && (
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="الصق رابط صورة / فيديو / يوتيوب..."
            className={`w-full rounded-xl px-3 py-1.5 text-xs border outline-none ${
              dark
                ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
                : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
            }`}
          />
        )}

        {linkInput.trim() && (
          <div
            className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
              dark
                ? "bg-slate-950/70 border-slate-800 text-slate-200"
                : "bg-slate-50 border-slate-200 text-slate-800 shadow-2xs"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {extractYoutubeVideoId(linkInput) ? (
                <div className="flex items-center gap-1.5 text-rose-500 font-bold truncate">
                  <Youtube className="w-4 h-4 shrink-0" />
                  <span className="truncate">معاينة يوتيوب قبل النشر</span>
                </div>
              ) : detectAttachmentTypeFromPath(linkInput) === "image" ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={linkInput}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover bg-black shrink-0 border border-slate-700/30"
                  />
                  <span className="truncate font-semibold text-[11px]">معاينة الصورة المرفقة</span>
                </div>
              ) : detectAttachmentTypeFromPath(linkInput) === "video" ? (
                <div className="flex items-center gap-2 min-w-0">
                  <video
                    src={linkInput}
                    className="w-12 h-10 rounded-lg object-cover bg-black shrink-0 border border-slate-700/30"
                  />
                  <span className="truncate font-semibold text-[11px]">معاينة الفيديو المرفق</span>
                </div>
              ) : detectAttachmentTypeFromPath(linkInput) === "audio" ? (
                <div className="flex items-center gap-2 min-w-0 w-full">
                  <VoiceNotePlayer
                    src={linkInput}
                    dark={dark}
                    compact
                    className="w-full max-w-[320px]"
                  />
                  <span className="truncate font-semibold text-[11px] shrink-0">صوت مرفق</span>
                </div>
              ) : (
                <span className="truncate font-medium text-[11px]">معاينة الرابط المرفق: {linkInput}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setLinkInput("");
                setShowLinkInput(false);
              }}
              title="إلغاء وإزالة المرفق"
              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 shrink-0 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </form>

      {/* Wall Posts Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 chat-scroll">
        {wallPosts.length === 0 ? (
          <div className={`text-center text-xs py-8 font-medium ${
            dark ? "text-slate-400" : "text-slate-600"
          }`}>
            لا توجد منشورات على الحائط حالياً
          </div>
        ) : (
          wallPosts.map((p) => {
            const canDelete =
              canModDelete ||
              (me?.uid && p.uid === me.uid) ||
              (me?.lid && p.lid === me.lid);
            const { state1, state2, myState } = renderLikesInfo(p);
            const comments = Array.isArray(p.bcc) ? p.bcc : [];
            const commentsVisible = Boolean(openComments[p.bid]);
            const replyTarget = replyTargets[p.bid];

            return (
              <article
                key={p.bid}
                dir="ltr"
                className={`rounded-2xl p-3 border text-xs space-y-2.5 text-left ${
                  dark ? "bg-slate-900/80 border-slate-800 text-slate-100" : "bg-white border-slate-200 shadow-xs text-slate-900"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar pic={p.pic} topic={p.topic} size="md" showStatus={false} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span
                          dir="auto"
                          className="font-extrabold truncate"
                          style={{
                            color: adjustColorForTheme(p.ucol, dark, {
                              fallbackDark: "#38bdf8",
                              fallbackLight: "#0369a1",
                            }),
                          }}
                        >
                          {p.topic}
                        </span>
                        {isUserVerified(p, onlineMap) && <VerifiedBadge size="xs" />}
                      </div>
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteWallPost(p.bid)}
                      className={`p-1 hover:text-rose-400 shrink-0 ${
                        dark ? "text-slate-400" : "text-slate-500"
                      }`}
                      title="حذف المنشور"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div
                  dir="rtl"
                  className="leading-relaxed break-words font-normal text-right"
                  style={{
                    color: p.mcol && p.mcol.toLowerCase() !== "#000000"
                      ? adjustColorForTheme(p.mcol, dark, {
                          fallbackDark: "#f1f5f9",
                          fallbackLight: "#0f172a",
                        })
                      : undefined,
                  }}
                >
                  <SafeRichText text={p.msg} dark={dark} />
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/30">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        likeWallPost(p.bid, 1);
                        pushNotice(myState === 1 ? "تم إلغاء الإعجاب بمنشور الحائط" : "تم التفاعل والإعجاب بمنشور الحائط 👍", { topic: "إعجاب" });
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition active:scale-90 font-medium ${
                        myState === 1
                          ? "bg-sky-500/20 text-sky-500 font-bold animate-action-pop"
                          : dark
                            ? "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                            : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                      }`}
                      title="إعجاب"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{state1}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        likeWallPost(p.bid, 2);
                        pushNotice(myState === 2 ? "تم إلغاء التفاعل مع المنشور" : "تم التفاعل بقلب مع منشور الحائط ❤️", { topic: "إعجاب" });
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition active:scale-90 font-medium ${
                        myState === 2
                          ? "bg-rose-500/20 text-rose-500 font-bold animate-action-pop"
                          : dark
                            ? "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                            : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                      }`}
                      title="حب / تفاعل الحائط"
                    >
                      {myState === 2 ? <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> : <Flame className="w-3.5 h-3.5" />}
                      <span>{state2}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setOpenComments((prev) => ({ ...prev, [p.bid]: !prev[p.bid] }))
                    }
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition ${
                      dark
                        ? "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                        : "hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span dir="auto">تعليقات ({comments.length})</span>
                  </button>
                </div>

                {/* Comments Section */}
                {commentsVisible && (
                  <div className="pt-2 space-y-2 border-t border-slate-800/30">
                    <div className="space-y-1.5 max-h-48 overflow-y-auto chat-scroll">
                      {comments.map((c, idx) => {
                        const cid = String(c.cid || idx);
                        const cTopic = String(c.topic || "عضو");
                        const cCol = String(c.ucol || "");
                        const parentComment = c.replyToCid
                          ? comments.find((parent) => String(parent.cid || "") === String(c.replyToCid))
                          : null;
                        const cidStr = typeof (c as any).id === "string" ? String((c as any).id) : "";
                        const cPic = String(
                          c.pic ||
                          (cidStr && (onlineMap as Record<string, any>)[cidStr]?.pic) ||
                          (c.uid && Object.values(onlineMap).find((u) => u.uid === c.uid || u.id === c.uid)?.pic) ||
                          "pic.png"
                        );
                        const cCover = String(
                          (c as any).cover ||
                          (cidStr && (onlineMap as Record<string, any>)[cidStr]?.cover) ||
                          (c.uid && Object.values(onlineMap).find((u) => u.uid === c.uid || u.id === c.uid)?.cover) ||
                          ""
                        );

                        return (
                          <div
                            key={cid}
                            dir="rtl"
                            className={`rounded-xl px-2.5 py-1.5 text-right flex items-start gap-2 ${
                              c.replyToCid ? "mr-4 border-r-2 border-sky-500/50 pr-2" : ""
                            } ${
                              dark
                                ? "bg-slate-950/70 text-slate-100"
                                : "bg-slate-50 border border-slate-200/70 text-slate-900"
                            }`}
                          >
                            <div className="shrink-0 mt-0.5">
                              <MemberAvatar
                                pic={cPic}
                                cover={cCover}
                                topic={cTopic}
                                size="xs"
                                showStatus={false}
                              />
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              {parentComment && (
                                <div dir="rtl" className={`text-[10px] mb-0.5 truncate flex items-center gap-1 font-semibold text-right ${
                                  dark ? "text-sky-400" : "text-sky-800"
                                }`}>
                                  <span>رداً على {String(parentComment.topic || "")}</span>
                                  {isUserVerified(parentComment, onlineMap) && <VerifiedBadge size="xs" />}
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1 min-w-0">
                                  <span
                                    dir="rtl"
                                    className="font-bold text-[11px] truncate text-right"
                                    style={{
                                      color: adjustColorForTheme(cCol, dark, {
                                        fallbackDark: "#38bdf8",
                                        fallbackLight: "#0369a1",
                                      }),
                                    }}
                                  >
                                    {cTopic}
                                  </span>
                                  {isUserVerified(c, onlineMap) && <VerifiedBadge size="xs" />}
                                </span>
                                <div className={`flex items-center gap-1.5 text-[10px] font-semibold shrink-0 ${
                                  dark ? "text-slate-400" : "text-slate-600"
                                }`}>
                                  {c.time ? <span>{formatTimeArabic(c.time)}</span> : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReplyTargets((prev) => ({
                                        ...prev,
                                        [p.bid]: { cid, topic: cTopic },
                                      }))
                                    }
                                    className={`hover:underline inline-flex items-center gap-0.5 font-bold ${
                                      dark ? "text-sky-400" : "text-sky-700"
                                    }`}
                                  >
                                    <Reply className="w-2.5 h-2.5" />
                                    <span>رد</span>
                                  </button>
                                </div>
                              </div>
                              <div dir="rtl" className="mt-0.5 break-words font-medium text-right leading-relaxed">
                                <SafeRichText text={c.msg} dark={dark} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {replyTarget && (
                      <div dir="rtl" className="flex items-center justify-between text-[10px] bg-sky-500/10 text-sky-500 font-semibold px-2.5 py-1 rounded-lg">
                        <span className="flex items-center gap-1">
                          <span>الرد على: {replyTarget.topic}</span>
                          {isUserVerified(replyTarget, onlineMap) && <VerifiedBadge size="xs" />}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setReplyTargets((prev) => ({ ...prev, [p.bid]: null }))
                          }
                          className="font-bold text-sm leading-none"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div dir="rtl" className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCommentPickerBid((cur) => (cur === p.bid ? null : p.bid))}
                        title="الفيسات (سمايلات)"
                        className={`p-1.5 rounded-xl border transition shrink-0 ${
                          commentPickerBid === p.bid
                            ? "bg-sky-600 border-sky-500 text-white"
                            : dark
                              ? "border-slate-800 hover:bg-slate-800 text-slate-300"
                              : "border-slate-200 hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        dir="rtl"
                        value={commentDrafts[p.bid] || ""}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [p.bid]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSendComment(p.bid);
                          }
                        }}
                        placeholder="اكتب تعليقاً..."
                        className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs border outline-none text-right ${
                          dark
                            ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendComment(p.bid)}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition shrink-0"
                      >
                        تعليق
                      </button>
                    </div>

                    {commentPickerBid === p.bid && (
                      <div
                        className={`p-2 rounded-xl border max-h-40 overflow-y-auto chat-scroll grid grid-cols-5 gap-1 ${
                          dark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
                        }`}
                      >
                        {emos.map((file, index) => (
                          <button
                            key={file}
                            type="button"
                            onClick={() => {
                              const token = emojiShortcut(index);
                              setCommentDrafts((prev) => {
                                const cur = prev[p.bid] || "";
                                const needSpace = cur.length > 0 && !cur.endsWith(" ");
                                return { ...prev, [p.bid]: `${cur}${needSpace ? " " : ""}${token} ` };
                              });
                            }}
                            title={emojiShortcut(index)}
                            className={`p-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition ${
                              dark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                            }`}
                          >
                            <img src={resolveAssetUrl(file, "emo", "")} alt="" className={EMOJI_IMAGE_CLASS} />
                            <span className="text-[8px] font-bold opacity-70" dir="rtl">
                              {emojiShortcut(index)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* YouTube Modal for Wall */}
      {ytModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="px-4 py-3 bg-rose-600 text-white flex items-center justify-between text-xs font-extrabold shrink-0">
              <span className="flex items-center gap-1.5">
                <Youtube className="w-4 h-4" />
                <span>إرسال مقطع يوتيوب إلى الحائط</span>
              </span>
              <button
                type="button"
                onClick={() => setYtModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleYoutubeSearch}
              className={`p-3 border-b space-y-2 shrink-0 ${
                dark ? "border-slate-800" : "border-slate-200 bg-slate-50/50"
              }`}
            >
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setYtMode("videos")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    ytMode === "videos"
                      ? "bg-rose-600 text-white"
                      : dark
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  فيديو
                </button>
                <button
                  type="button"
                  onClick={() => setYtMode("shorts")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    ytMode === "shorts"
                      ? "bg-rose-600 text-white"
                      : dark
                        ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
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
                  placeholder="ابحث باسم المقطع أو الأغنية أو الصق رابط يوتيوب..."
                  className={`flex-1 rounded-xl px-3 py-2 text-xs border outline-none ${
                    dark
                      ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                  }`}
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 transition"
                >
                  بحث
                </button>
              </div>
            </form>

            <div className="p-3 overflow-y-auto chat-scroll space-y-2 flex-1 min-h-0">
              {youtubeResults.length === 0 ? (
                <div className={`py-12 text-center text-xs ${dark ? "text-slate-400" : "text-slate-500 font-medium"}`}>
                  ابحث عن أي فيديو أو مقطع شورتس لاختياره وإرساله مباشرة على الحائط
                </div>
              ) : (
                youtubeResults.map((item, idx) => {
                  const vid = String(item.id || "");
                  const isShort = Boolean(item.isShort) || ytMode === "shorts";
                  const shareUrl = isShort
                    ? `https://www.youtube.com/shorts/${vid}`
                    : `https://www.youtube.com/watch?v=${vid}`;
                  const title = String(item.title || vid);
                  const channel = String(item.channelTitle || "YouTube");
                  return (
                    <div
                      key={`${vid}-${idx}`}
                      className={`w-full rounded-xl p-2.5 border flex items-center justify-between gap-3 transition ${
                        dark
                          ? "bg-slate-950/70 border-slate-800 hover:border-rose-500/50"
                          : "bg-slate-50 border-slate-200 hover:border-rose-400 hover:bg-rose-50/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectYoutubeVideo(shareUrl, title, "publish")}
                        className="flex items-center gap-3 min-w-0 flex-1 text-right"
                      >
                        <img
                          src={String(item.thumbnail || "")}
                          alt=""
                          className="w-24 h-14 rounded-lg object-cover bg-black shrink-0 border border-slate-700/30"
                        />
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold line-clamp-2 ${dark ? "text-slate-100" : "text-slate-900"}`}>
                            {title}
                          </div>
                          <div className={`text-[10px] mt-1 ${dark ? "text-slate-400" : "text-slate-500 font-medium"}`}>
                            {channel}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectYoutubeVideo(shareUrl, title, "attach")}
                          title="إرفاق بالمسودة دون إرسال فوري"
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                            dark
                              ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              : "border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                          }`}
                        >
                          إرفاق
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectYoutubeVideo(shareUrl, title, "publish")}
                          title="إرسال ونشر على الحائط فوراً"
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>نشر</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
