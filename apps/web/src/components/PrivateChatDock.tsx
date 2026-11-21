import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  CheckCheck,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  MicOff,
  MoreVertical,
  Paperclip,
  Pause,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Play,
  Search,
  Send,
  Settings,
  Smile,
  Square,
  Trash2,
  Video,
  X,
  Youtube,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { usePmWebRtcCall } from "../hooks/usePmWebRtcCall.js";
import { EMOJI_IMAGE_CLASS, emojiShortcut, applyTextShortcuts } from "../lib/emojiShortcuts.js";
import { formatTimeArabic, resolveAssetUrl } from "../lib/mediaUrl.js";
import {
  explainMediaAccessError,
  isMediaCaptureSupported,
  requestUserMediaWithFallback,
  stashCallMediaStream,
  unlockBrowserAudioContext,
} from "../lib/mediaPermissions.js";
import { detectAttachmentTypeFromPath, SafeRichText, AttachmentRenderer } from "../lib/richContent.js";
import { playSoundCue } from "../lib/soundFx.js";
import { getUserGiftIco, getUserIco, resolvePowerIco } from "../lib/userCosmetics.js";
import { MemberAvatar } from "./MemberAvatar.js";
import { VoiceNotePlayer } from "./media/VoiceNotePlayer.js";
import { VoiceRecordingBar } from "./media/VoiceRecordingBar.js";
import { VerifiedBadge, isUserVerified } from "./VerifiedBadge.js";
import { NotesStripBar } from "./notes/NotesStripBar.js";
import { NoteViewerModal } from "./notes/NoteViewerModal.js";
import { CreateNoteModal } from "./notes/CreateNoteModal.js";
import { normalizeUserNotes, type UserNote } from "./notes/noteTypes.js";

interface PrivateChatDockProps {
  dark: boolean;
  open: boolean;
  onClose: () => void;
  onOpenMail?: () => void;
  onOpenSettings?: () => void;
}

export function PrivateChatDock({
  dark,
  open,
  onClose,
  onOpenMail,
  onOpenSettings,
}: PrivateChatDockProps) {
  const me = useChatStore((s) => s.me);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const pmThreads = useChatStore((s) => s.pmThreads);
  const pmReadState = useChatStore((s) => s.pmReadState);
  const activePmTargetId = useChatStore((s) => s.activePmTargetId);
  const callState = useChatStore((s) => s.callState);
  const rawNotes = useChatStore((s) => s.notes);
  const fetchNotes = useChatStore((s) => s.fetchNotes);
  const toggleNoteLike = useChatStore((s) => s.toggleNoteLike);
  const addNoteComment = useChatStore((s) => s.addNoteComment);
  const powers = useChatStore((s) => s.powers);
  const emos = useChatStore((s) => s.emos);
  const shortcuts = useChatStore((s) => s.shortcuts);
  const pmTypingUsers = useChatStore((s) => s.pmTypingUsers);
  const sendTyping = useChatStore((s) => s.sendTyping);
  const searchYoutube = useChatStore((s) => s.searchYoutube);
  const youtubeResults = useChatStore((s) => s.youtubeResults);

  const setActivePmTarget = useChatStore((s) => s.setActivePmTarget);
  const sendPrivateMessage = useChatStore((s) => s.sendPrivateMessage);
  const sendVoiceNote = useChatStore((s) => s.sendVoiceNote);
  const requestCall = useChatStore((s) => s.requestCall);
  const acceptCall = useChatStore((s) => s.acceptCall);
  const rejectCall = useChatStore((s) => s.rejectCall);
  const endCall = useChatStore((s) => s.endCall);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const {
    localStream,
    remoteStream,
    micMuted,
    cameraOff,
    mediaError,
    toggleMic,
    toggleCamera,
  } = usePmWebRtcCall();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Notes Modals State
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [viewerNote, setViewerNote] = useState<UserNote | null>(null);

  // Chat message composition state
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  // YouTube search modal state
  const [ytModalOpen, setYtModalOpen] = useState(false);
  const [ytQuery, setYtQuery] = useState("");
  const [ytMode, setYtMode] = useState<"videos" | "shorts">("videos");

  interface PendingPmMedia {
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

  const [pendingMedia, setPendingMedia] = useState<PendingPmMedia | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecRef = useRef(0);
  const cancelRecordingRef = useRef(false);
  const lastTypingEmitRef = useRef(0);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastPmTotalRef = useRef(0);

  // Fetch notes on mount/open
  useEffect(() => {
    if (open) {
      fetchNotes();
    }
  }, [open, fetchNotes]);

  // Extract structured notes (with graceful fallback sample notes)
  const notesList = useMemo(() => {
    return normalizeUserNotes(rawNotes);
  }, [rawNotes]);

  const threadIds = useMemo(
    () => Object.keys(pmThreads).filter((id) => id && id !== me?.id && id !== me?.uid),
    [pmThreads, me?.id, me?.uid]
  );

  // Selected conversation ID — normalized to the peer's STABLE uid so threads
  // survive reconnects (socket ids change on reconnect; uids don't).
  const rawPmTarget = activePmTargetId || "";
  const selectedId = useMemo(() => {
    if (!rawPmTarget) return "";
    const t = onlineMap[rawPmTarget];
    return t?.uid || t?.lid || rawPmTarget;
  }, [rawPmTarget, onlineMap]);
  const messages = selectedId ? pmThreads[selectedId] ?? [] : [];
  const markPmThreadRead = useChatStore((s) => s.markPmThreadRead);

  // Read receipts: while the thread is open, notify the peer → their ✓ turns ✓✓
  useEffect(() => {
    if (selectedId) markPmThreadRead(selectedId);
  }, [selectedId, messages.length, markPmThreadRead]);

  // Robust partner resolution across onlineMap, UIDs, handles and thread messages
  const activeUser = useMemo(() => {
    if (!selectedId) return undefined;
    if (onlineMap[selectedId]) return onlineMap[selectedId];
    for (const u of Object.values(onlineMap)) {
      if (u.id === selectedId || u.uid === selectedId || u.topic === selectedId) {
        return u;
      }
    }
    const thread = pmThreads[selectedId] || [];
    const lastFromPartner = [...thread].reverse().find((m) => !m.self) as any;
    if (lastFromPartner) {
      return {
        id: lastFromPartner.from || selectedId,
        uid: lastFromPartner.uid || selectedId,
        topic: lastFromPartner.topic || selectedId,
        pic: lastFromPartner.pic || "pic.png",
        ucol: lastFromPartner.ucol,
        bg: lastFromPartner.bg,
        stat: "متصل",
      } as any;
    }
    return undefined;
  }, [selectedId, onlineMap, pmThreads]);

  const partnerRoleName = activeUser?.rank || activeUser?.power;
  const partnerRole = partnerRoleName && powers ? powers.find((p) => p.name === partnerRoleName) : null;
  const partnerRoleIco = partnerRole?.ico ? resolvePowerIco(partnerRole.ico) : "";
  const partnerBanner = useMemo(() => getUserIco(activeUser, powers), [activeUser, powers]);
  const partnerGift = useMemo(() => getUserGiftIco(activeUser), [activeUser]);
  const partnerIsVerified = useMemo(
    () => isUserVerified(activeUser || messages[0], onlineMap),
    [activeUser, messages, onlineMap]
  );

  const isPartnerTyping = Boolean(
    selectedId &&
      (pmTypingUsers[selectedId] ||
        (activeUser?.id && pmTypingUsers[activeUser.id]) ||
        (activeUser?.uid && pmTypingUsers[activeUser.uid]))
  );

  // Play sound on new incoming PM
  useEffect(() => {
    let total = 0;
    let latestIncoming = false;
    for (const list of Object.values(pmThreads)) {
      total += list.length;
      const last = list[list.length - 1];
      if (last && !last.self) latestIncoming = true;
    }
    if (total > lastPmTotalRef.current && latestIncoming) {
      playSoundCue("pm");
    }
    lastPmTotalRef.current = total;
  }, [pmThreads]);

  // Scroll to bottom of active conversation
  useEffect(() => {
    if (selectedId) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, selectedId]);

  // WebRTC video attachments
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      void localVideoRef.current.play().catch(() => undefined);
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      void remoteVideoRef.current.play().catch(() => undefined);
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      void remoteAudioRef.current.play().catch(() => undefined);
    }
  }, [remoteStream]);

  // WebRTC Call actions
  const handleStartCallWithPermission = async (callType: "audio" | "video") => {
    if (!selectedId) return;
    unlockBrowserAudioContext();
    if (!isMediaCaptureSupported()) {
      pushNotice(explainMediaAccessError(null, callType === "video" ? "both" : "mic"), { force: 1 });
      return;
    }
    try {
      const stream = await requestUserMediaWithFallback({
        audio: true,
        video: callType === "video",
      });
      stashCallMediaStream(callType, stream);
      requestCall(selectedId, callType);
    } catch (err) {
      pushNotice(explainMediaAccessError(err, callType === "video" ? "both" : "mic"), { force: 1 });
    }
  };

  const handleAcceptCallWithPermission = async () => {
    unlockBrowserAudioContext();
    const callKind = callState.callType === "video" ? "both" : "mic";
    if (!isMediaCaptureSupported()) {
      pushNotice(explainMediaAccessError(null, callKind), { force: 1 });
      return;
    }
    try {
      const stream = await requestUserMediaWithFallback({
        audio: true,
        video: callState.callType === "video",
      });
      stashCallMediaStream(callState.callType, stream);
      acceptCall();
    } catch (err) {
      pushNotice(explainMediaAccessError(err, callKind), { force: 1 });
    }
  };

  const startRecordingTimer = () => {
    setRecordingSec(0);
    recordingSecRef.current = 0;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => {
      recordingSecRef.current += 1;
      setRecordingSec(recordingSecRef.current);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const handleDraftChange = (text: string) => {
    setDraft(text);
    if (!selectedId) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2500) {
      lastTypingEmitRef.current = now;
      sendTyping(true, selectedId);
    }
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      sendTyping(false, selectedId);
    }, 3000);
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

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    sendTyping(false, selectedId);
    const expanded = applyTextShortcuts(draft.trim(), shortcuts);
    sendPrivateMessage(selectedId, expanded);
    setDraft("");
  };

  const handleYoutubeSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!ytQuery.trim()) return;
    searchYoutube(ytQuery.trim(), ytMode);
  };

  const handleFileAttach = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;

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

  const toggleVoiceRecording = async () => {
    if (!selectedId) return;
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      stopRecordingTimer();
      setRecording(false);
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
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopRecordingTimer();
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          setRecordingSec(0);
          return;
        }
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const previewUrl = URL.createObjectURL(blob);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            setPendingMedia({
              kind: "voice",
              type: "audio",
              previewUrl,
              blob,
              name: `تسجيل صوتي خاص (${recordingSecRef.current || 1} ثانية)`,
              mime,
              base64Data: reader.result,
            });
            setMediaCaption(draft.trim());
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      startRecordingTimer();
    } catch (err) {
      stopRecordingTimer();
      pushNotice(explainMediaAccessError(err, "mic"), { force: 1 });
    }
  };

  const handleCancelRecording = () => {
    cancelRecordingRef.current = true;
    mediaRecorderRef.current?.stop();
    stopRecordingTimer();
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
    if (!pendingMedia || !selectedId || uploading) return;
    setUploading(true);
    try {
      if (pendingMedia.kind === "voice") {
        let voiceUrl = "";
        if (pendingMedia.blob) {
          const ext = pendingMedia.mime?.includes("ogg") ? "ogg" : "webm";
          const file = new File([pendingMedia.blob], `voice_${Date.now()}.${ext}`, {
            type: pendingMedia.mime || "audio/webm",
          });
          voiceUrl = (await getApiClient().uploadMediaFile(file, file.name)).trim();
        }
        if (voiceUrl) {
          sendPrivateMessage(selectedId, mediaCaption.trim(), {
            file: voiceUrl,
            fileType: "audio",
          });
          pushNotice("تم إرسال التسجيل الصوتي بنجاح");
        } else if (pendingMedia.base64Data) {
          sendVoiceNote(pendingMedia.base64Data, pendingMedia.mime || "audio/webm", selectedId);
          if (mediaCaption.trim()) {
            sendPrivateMessage(selectedId, mediaCaption.trim());
          }
          pushNotice("تم إرسال التسجيل الصوتي");
        }
      } else if (pendingMedia.file) {
        const url = (await getApiClient().uploadMediaFile(pendingMedia.file, pendingMedia.file.name)).trim();
        if (url) {
          sendPrivateMessage(selectedId, mediaCaption.trim(), {
            file: url,
            fileType: pendingMedia.type,
          });
          pushNotice("تم إرسال المرفق بنجاح");
        }
      }
      handleCancelPendingMedia();
      setDraft("");
    } catch {
      pushNotice("تعذر إرسال المرفق في الخاص", { force: 1 });
    } finally {
      setUploading(false);
    }
  };

  // Compile list of conversations & online members for the list view
  const conversationItems = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        topic: string;
        pic?: string;
        verified?: boolean;
        lastMsg?: string;
        lastTime?: string;
        isSelf?: boolean;
        isSeen?: boolean;
        unread?: number;
      }
    >();

    // Add active PM threads
    for (const [id, msgs] of Object.entries(pmThreads)) {
      if (!id || msgs.length === 0) continue;
      const last = msgs[msgs.length - 1];
      // Threads are keyed by the peer's stable uid — resolve their live profile
      // from onlineMap by socket id OR uid.
      const u = onlineMap[id] || Object.values(onlineMap).find((x) => x.uid === id || x.id === id);
      const topic = u?.topic || last?.topic || `@user_${id.slice(0, 4)}`;
      const cleanHandle = topic.startsWith("@") ? topic : `@${topic}`;
      const isVerified = isUserVerified(u || last, onlineMap);

      map.set(id, {
        id,
        topic: cleanHandle,
        pic: u?.pic,
        verified: isVerified,
        lastMsg: last?.file ? "مرفق 📎" : last?.msg || "أرسلت رسالة",
        lastTime: last ? formatTimeArabic(last.ts) : "الآن",
        isSelf: Boolean(last?.self),
        isSeen: Boolean(last?.seen),
        unread: msgs.filter((m) => !m.self && m.ts > (pmReadState[id] || 0)).length,
      });
    }

    // NOTE: online members who never messaged are intentionally NOT listed —
    // only real conversations appear here (new chats start via "إضافة عضوة").

    let list = Array.from(map.values());

    // Apply Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => c.topic.toLowerCase().includes(q) || (c.lastMsg && c.lastMsg.toLowerCase().includes(q)));
    }

    return list;
  }, [pmThreads, pmReadState, onlineMap, me?.id, searchQuery]);

  const showWindow = open || callState.status !== "idle";
  if (!showWindow) return null;

  return (
    <>
      <div
        className={`fixed inset-x-2 bottom-2 top-14 sm:inset-auto sm:bottom-4 sm:left-4 sm:w-[440px] md:w-[450px] sm:h-[85vh] sm:max-h-[780px] sm:min-h-[550px] z-40 rounded-[32px] border shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          dark ? "bg-slate-900 border-slate-700/80 text-slate-100" : "bg-white border-slate-200/90 text-slate-900"
        }`}
      >
        {/* ========================================================================= */}
        {/* VIEW 1: CONVERSATIONS & NOTES HUB (Matching Reference Images 1 & 2)       */}
        {/* ========================================================================= */}
        {!selectedId ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Top Header Bar */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0">
              {/* Title & Total count badge */}
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">المحادثات</h2>
                {conversationItems.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-200 text-xs font-bold shadow-xs">
                    {conversationItems.length}
                  </span>
                )}
              </div>

              {/* Action Icons: Settings, Mail, New Chat, Search */}
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setShowSearch((p) => !p)}
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                  title="بحث في المحادثات"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setCreateNoteOpen(true)}
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                  title="إضافة ملاحظة جديدة"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenMail?.()}
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                  title="البريد الداخلي"
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenSettings?.()}
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                  title="الإعدادات"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition ml-1"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Optional Expandable Search Input */}
            {showSearch && (
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن محادثة أو اسم مستخدم..."
                  autoFocus
                  className={`w-full rounded-2xl px-3.5 py-1.5 text-xs border outline-none ${
                    dark
                      ? "bg-slate-950 border-slate-800 text-slate-100"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            )}

            {/* Horizontal Notes Bar */}
            <div className="border-b border-slate-100 dark:border-slate-800/60 shrink-0">
              <NotesStripBar
                dark={dark}
                notes={notesList}
                myAvatar={me?.pic}
                myTopic={me?.topic}
                myUid={me?.uid}
                onOpenCreateNote={() => setCreateNoteOpen(true)}
                onSelectNote={(note) => setViewerNote(note)}
              />
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 chat-scroll">
              {conversationItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500">
                  <p className="text-xs font-bold">لا توجد محادثات نشطة حالياً</p>
                </div>
              ) : (
                conversationItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (onlineMap[item.id]) {
                        setActivePmTarget(item.id);
                      } else {
                        // Allow selecting thread directly
                        setActivePmTarget(item.id);
                      }
                    }}
                    className={`group relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs active:scale-[0.99] ${
                      dark
                        ? "bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-100"
                        : "bg-white hover:bg-slate-50 border-slate-100/90 text-slate-900"
                    }`}
                  >
                    {/* Left (RTL): Time & Unread status */}
                    <div className="flex flex-col items-start gap-1 shrink-0 text-left">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {item.lastTime}
                      </span>
                      {item.unread && item.unread > 0 ? (
                        <span className="min-w-[18px] h-4.5 px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {item.unread}
                        </span>
                      ) : null}
                    </div>

                    {/* Middle: User info & last message preview */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        {item.verified && <VerifiedBadge size="xs" />}
                        <span className="text-xs font-bold truncate dir-ltr">
                          {item.topic}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center justify-end gap-1">
                        {item.isSelf &&
                          (item.isSeen ? (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 inline" />
                          ))}
                        <span>{item.lastMsg}</span>
                      </div>
                    </div>

                    {/* Right (RTL): Avatar */}
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                      <MemberAvatar
                        pic={item.pic}
                        topic={item.topic}
                        size="md"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: ACTIVE PRIVATE CONVERSATION VIEW                                  */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Conversation Header with Back button */}
            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* Back button to return to conversations list and notes bar */}
                <button
                  type="button"
                  onClick={() => setActivePmTarget("")}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                  title="العودة لكافة المحادثات"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="relative shrink-0">
                  <MemberAvatar
                    pic={activeUser?.pic}
                    cover={activeUser?.cover}
                    topic={activeUser?.topic || selectedId}
                    stat={activeUser?.stat}
                    size="md"
                  />
                </div>

                <div className="min-w-0 text-right">
                  <div className="text-xs font-extrabold truncate flex items-center gap-1.5 flex-wrap">
                    {partnerGift && (
                      <img
                        src={partnerGift}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-[16px] h-[16px] object-contain shrink-0"
                      />
                    )}
                    {partnerRoleIco && (
                      <img
                        src={partnerRoleIco}
                        alt=""
                        title={partnerRole?.name || "رتبة"}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-[16px] h-[16px] object-contain shrink-0"
                      />
                    )}
                    {partnerBanner && (
                      <img
                        src={partnerBanner}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="h-[16px] max-h-[18px] w-auto max-w-[120px] object-contain shrink-0"
                      />
                    )}
                    <span
                      dir="auto"
                      style={{ color: activeUser?.ucol || undefined }}
                    >
                      {activeUser?.topic || messages[0]?.topic || selectedId}
                    </span>
                    {partnerIsVerified && <VerifiedBadge size="xs" />}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {callState.status === "active" ? (
                      <span className="text-sky-400 font-semibold">مكالمة جارية مع {callState.peerTopic}</span>
                    ) : isPartnerTyping ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        يكتب الآن...
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">
                        {activeUser?.power || "متصل الآن"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Call & Close actions */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedId && activeUser && callState.status === "idle" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleStartCallWithPermission("audio")}
                      title="مكالمة صوتية"
                      className="p-1.5 rounded-xl hover:bg-emerald-500/15 text-emerald-500 transition"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStartCallWithPermission("video")}
                      title="مكالمة فيديو"
                      className="p-1.5 rounded-xl hover:bg-sky-500/15 text-sky-500 transition"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Incoming / Outgoing / Active WebRTC Call Banner */}
            {callState.status !== "idle" && (
              <div className="p-3 bg-gradient-to-l from-sky-900/50 to-emerald-900/40 border-b border-slate-700/60 space-y-2.5 shrink-0">
                {callState.status === "incoming" && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <PhoneIncoming className="w-5 h-5 text-emerald-400 animate-bounce shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate flex items-center gap-1">
                          <span>{callState.peerTopic}</span>
                          {isUserVerified({ uid: callState.peerId, id: callState.peerId, topic: callState.peerTopic }, onlineMap) && (
                            <VerifiedBadge size="xs" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {callState.callType === "video" ? "مكالمة فيديو واردة..." : "مكالمة صوتية واردة..."}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleAcceptCallWithPermission()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
                      >
                        رد
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectCall("rejected")}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                )}

                {callState.status === "outgoing" && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-sky-400 animate-pulse" />
                      <span className="text-xs font-bold inline-flex items-center gap-1">
                        <span>جاري الاتصال بـ {callState.peerTopic}...</span>
                        {isUserVerified({ uid: callState.peerId, id: callState.peerId, topic: callState.peerTopic }, onlineMap) && (
                          <VerifiedBadge size="xs" />
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => endCall("cancelled")}
                      className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                {callState.status === "active" && (
                  <div className="space-y-2">
                    {callState.callType === "video" ? (
                      <div className="relative h-40 rounded-2xl overflow-hidden bg-black border border-slate-700">
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="absolute bottom-2 left-2 w-24 h-16 rounded-xl object-cover border border-white/30 bg-slate-900"
                        />
                      </div>
                    ) : (
                      <audio ref={remoteAudioRef} autoPlay className="hidden" />
                    )}

                    {mediaError && <div className="text-[11px] text-rose-300">{mediaError}</div>}

                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={toggleMic}
                        className={`p-2 rounded-xl text-xs font-bold ${
                          micMuted ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-200"
                        }`}
                      >
                        {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                      {callState.callType === "video" && (
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className={`p-2 rounded-xl text-xs font-bold ${
                            cameraOff ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-200"
                          }`}
                        >
                          {cameraOff ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => endCall("hangup")}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span>إنهاء</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active conversation threads pill switcher */}
            {threadIds.length > 1 && (
              <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto shrink-0">
                {threadIds.map((id) => {
                  const u = onlineMap[id] || Object.values(onlineMap).find((x) => x.uid === id || x.id === id);
                  const lastMsg = pmThreads[id]?.[pmThreads[id]!.length - 1];
                  const active = id === selectedId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActivePmTarget(id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition inline-flex items-center gap-1 ${
                        active
                          ? "bg-sky-600 text-white"
                          : dark
                            ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span>{u?.topic || lastMsg?.topic || "مستخدم"}</span>
                      {isUserVerified(u || lastMsg, onlineMap) && <VerifiedBadge size="xs" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 chat-scroll min-h-[220px]">
              {messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-12">
                  ابدأ المحادثة مع {activeUser?.topic || selectedId} ✨
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMine = Boolean(m.self || (me?.id && m.from === me.id));
                  const senderUser = (m.from && onlineMap[m.from]) || ((m as any).uid && onlineMap[(m as any).uid]) || activeUser;
                  const senderRoleName = senderUser?.rank || senderUser?.power;
                  const senderRole = senderRoleName && powers ? powers.find((p) => p.name === senderRoleName) : null;
                  const msgRole = !isMine && senderRole?.ico ? resolvePowerIco(senderRole.ico) : "";
                  const msgBanner = !isMine ? getUserIco(senderUser, powers) : "";
                  const msgGift = !isMine ? getUserGiftIco(senderUser) : "";
                  const msgVerified = !isMine && isUserVerified(senderUser || m, onlineMap);
                  const senderName = m.topic || senderUser?.topic || activeUser?.topic || selectedId;
                  const senderCol = senderUser?.ucol || activeUser?.ucol;

                  return (
                    <div
                      key={`${m.ts}-${idx}`}
                      className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                    >
                      {!isMine ? (
                        /* Incoming Partner Message with Avatar, Banner, Gift & Cosmetics (Matching Room Chat) */
                        <div className="flex items-start gap-2 max-w-[90%] sm:max-w-[84%]">
                          <div className="shrink-0 mt-1">
                            <MemberAvatar
                              pic={m.pic || senderUser?.pic || activeUser?.pic}
                              topic={senderName}
                              size="sm"
                              showStatus={false}
                            />
                          </div>

                          <div className="min-w-0 flex-1 text-right">
                            {/* Sender Header Line: Gift, Banner, Name, Verified, Time */}
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              {msgGift && (
                                <img
                                  src={msgGift}
                                  alt=""
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                  className="w-[16px] h-[16px] object-contain shrink-0"
                                />
                              )}
                              {msgRole && (
                                <img
                                  src={msgRole}
                                  alt=""
                                  title={senderRole?.name || "رتبة"}
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                  className="w-[16px] h-[16px] object-contain shrink-0"
                                />
                              )}
                              {msgBanner && (
                                <img
                                  src={msgBanner}
                                  alt=""
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                  className="h-[16px] max-h-[18px] w-auto max-w-[120px] object-contain shrink-0"
                                />
                              )}
                              <span
                                dir="auto"
                                className="text-xs font-extrabold truncate"
                                style={{ color: senderCol || undefined }}
                              >
                                {senderName}
                              </span>
                              {msgVerified && <VerifiedBadge size="xs" />}
                              <span className="text-[10px] text-slate-400 font-semibold dir-ltr mr-auto">
                                {formatTimeArabic(m.ts)}
                              </span>
                            </div>

                            {/* Bubble Body */}
                            <div
                              className={`rounded-2xl rounded-tr-none px-3.5 py-2.5 text-xs shadow-xs border ${
                                dark
                                  ? "bg-slate-800/90 border-slate-700/70 text-slate-100"
                                  : "bg-slate-100 border-slate-200/80 text-slate-900"
                              }`}
                            >
                              {m.msg && <SafeRichText text={m.msg} dark={dark} />}
                              {m.file && <AttachmentRenderer file={m.file} fileType={m.fileType} dark={dark} />}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Outgoing User Message */
                        <div className="max-w-[85%] text-left">
                          <div className="bg-gradient-to-tr from-sky-600 to-sky-500 text-white rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs shadow-xs">
                            {m.msg && <SafeRichText text={m.msg} dark={dark} />}
                            {m.file && <AttachmentRenderer file={m.file} fileType={m.fileType} dark={dark} />}
                            <div className="mt-1 text-[9px] opacity-80 text-left dir-ltr flex items-center gap-1">
                              {m.seen ? (
                                <CheckCheck className="w-3 h-3 text-sky-100" />
                              ) : (
                                <Check className="w-3 h-3 text-white/70" />
                              )}
                              <span>{formatTimeArabic(m.ts)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <div ref={scrollEndRef} />
            </div>

            {/* Partner Typing Indicator — pinned strip directly above the composer,
                so it is always visible and never buried under the footer. */}
            {isPartnerTyping && (
              <div
                className={`px-3.5 py-1.5 border-t flex items-center gap-2 shrink-0 animate-fade-in ${
                  dark ? "bg-slate-900/60 border-slate-800/60" : "bg-slate-50 border-slate-200"
                }`}
              >
                <MemberAvatar
                  pic={activeUser?.pic}
                  topic={activeUser?.topic || selectedId}
                  size="xs"
                  showStatus={false}
                />
                <span className={`text-[11px] font-bold truncate ${dark ? "text-slate-300" : "text-slate-600"}`}>
                  {activeUser?.topic || selectedId}
                </span>
                <span className="text-[11px] font-semibold text-sky-400 shrink-0">يكتب الآن</span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            )}

            {/* Live Voice Recording Bar Indicator */}
            {recording && (
              <div className="px-2.5 pt-2.5 shrink-0">
                <VoiceRecordingBar
                  dark={dark}
                  seconds={recordingSec}
                  label="جارٍ تسجيل رسالة خاصة..."
                  onCancel={handleCancelRecording}
                  onStop={() => void toggleVoiceRecording()}
                />
              </div>
            )}

            {/* Smiley Picker */}
            {pickerOpen && (
              <div
                className={`mx-2.5 mt-2.5 rounded-2xl border shadow-lg overflow-hidden shrink-0 ${
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
                    className={`transition ${
                      dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2.5 max-h-44 overflow-y-auto chat-scroll grid grid-cols-5 gap-1.5">
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

            {/* Shortcuts Strip */}
            {shortcuts.length > 0 && (
              <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto chat-scroll shrink-0 bg-slate-50/70 dark:bg-slate-950/40">
                {shortcuts.slice(0, 20).map((sc, idx) => (
                  <button
                    key={`${sc.text1}-${idx}`}
                    type="button"
                    onClick={() => insertToken(sc.text1, false)}
                    title={sc.text2 || sc.text1}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border shrink-0 transition ${
                      dark
                        ? "bg-slate-900 border-slate-800 hover:border-sky-500/50 text-slate-300"
                        : "bg-white border-slate-200 hover:border-sky-400 text-slate-700"
                    }`}
                  >
                    {sc.text1}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={handleSend}
              autoComplete="off"
              className="p-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 shrink-0 bg-slate-50/50 dark:bg-slate-950/20"
            >
              {/* Smiley Button */}
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                title="الفيسات (سمايلات)"
                className={`p-2 rounded-xl border transition shrink-0 ${
                  pickerOpen
                    ? "bg-sky-600 border-sky-500 text-white"
                    : dark
                      ? "border-slate-800 hover:bg-slate-800 text-slate-300"
                      : "border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <Smile className="w-4 h-4" />
              </button>

              {/* Attachment Button */}
              <label
                title="إرسال مرفق"
                className={`p-2 rounded-xl border cursor-pointer transition shrink-0 ${
                  dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <Paperclip className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*,audio/*,video/*"
                  onChange={(e) => void handleFileAttach(e)}
                  className="hidden"
                />
              </label>

              {/* YouTube Button */}
              <button
                type="button"
                onClick={() => setYtModalOpen(true)}
                title="مشاركة مقطع يوتيوب في الخاص"
                className={`p-2 rounded-xl border transition shrink-0 ${
                  dark
                    ? "border-slate-800 hover:bg-slate-800 text-rose-400"
                    : "border-slate-200 hover:bg-slate-100 text-rose-600"
                }`}
              >
                <Youtube className="w-4 h-4" />
              </button>

              {/* Voice Recording Button */}
              <button
                type="button"
                onClick={() => void toggleVoiceRecording()}
                title={recording ? "إيقاف ومعاينة التسجيل الصوتي" : "تسجيل بصمة صوتية"}
                className={`p-2 rounded-xl border transition shrink-0 ${
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

              {/* Text Input */}
              <input
                ref={inputRef}
                type="search"
                name="private_msg_input"
                id="private_msg_input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder={uploading ? "جاري رفع الملف..." : "اكتب رسالة خاصة..."}
                disabled={uploading}
                className={`flex-1 rounded-xl px-3.5 py-2 text-xs border outline-none ${
                  dark
                    ? "bg-slate-950 border-slate-800 focus:border-sky-500 text-slate-100"
                    : "bg-white border-slate-200 focus:border-sky-500 text-slate-900"
                }`}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!draft.trim()}
                className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white shrink-0 transition"
                title="إرسال"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* YouTube Search & Share Modal in Private Chat */}
      {ytModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="px-4 py-3 bg-rose-600 text-white flex items-center justify-between text-xs font-extrabold shrink-0">
              <span className="flex items-center gap-1.5">
                <Youtube className="w-4 h-4" />
                البحث في يوتيوب ومشاركة الفيديو في الخاص
              </span>
              <button type="button" onClick={() => setYtModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleYoutubeSearch} className="p-3 border-b border-slate-800/30 space-y-2 shrink-0">
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
                  placeholder="ابحث باسم المقطع أو الصق رابط يوتيوب..."
                  className={`flex-1 rounded-xl px-3 py-2 text-xs border outline-none ${
                    dark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">
                  بحث
                </button>
              </div>
              {ytQuery.includes("youtube.com") || ytQuery.includes("youtu.be") ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedId) return;
                    sendPrivateMessage(selectedId, ytQuery.trim());
                    setYtModalOpen(false);
                    setYtQuery("");
                  }}
                  className="w-full mt-1.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال الرابط المكتوب مباشرة في الخاص</span>
                </button>
              ) : null}
            </form>

            <div className="p-3 max-h-80 overflow-y-auto chat-scroll space-y-2 flex-1">
              {youtubeResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  اكتب كلمة البحث واضغط "بحث" أو الصق الرابط
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
                        if (!selectedId) return;
                        sendPrivateMessage(selectedId, shareUrl);
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

      {/* ========================================================================= */}
      {/* NOTE VIEWER MODAL (Matching Reference Image 3)                            */}
      {/* ========================================================================= */}
      {viewerNote && (
        <NoteViewerModal
          dark={dark}
          isOpen={Boolean(viewerNote)}
          onClose={() => setViewerNote(null)}
          notes={notesList}
          initialNoteId={viewerNote.id}
          onOpenDirectChat={(userUid) => {
            setViewerNote(null);
            setActivePmTarget(userUid);
          }}
          onToggleLikeNote={(noteNid) => {
            toggleNoteLike(noteNid);
          }}
          onAddCommentNote={(noteNid, comment) => {
            addNoteComment(noteNid, comment);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* CREATE NOTE MODAL (Text or Voice Note)                                    */}
      {/* ========================================================================= */}
      <CreateNoteModal
        dark={dark}
        isOpen={createNoteOpen}
        onClose={() => setCreateNoteOpen(false)}
        onSuccess={() => {
          fetchNotes();
        }}
      />

      {/* Private Chat Media Preview Modal Before Sending */}
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
                    ? "معاينة التسجيل الصوتي الخاص قبل الإرسال"
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
                      استمع إلى التسجيل للتأكد من وضوح الصوت قبل إرساله في المحادثة الخاصة
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

              {/* Optional Caption Field */}
              <div className="w-full space-y-1">
                <label className={`text-[11px] font-semibold block ${dark ? "text-slate-300" : "text-slate-700"}`}>
                  رسالة مرافقة (اختياري):
                </label>
                <input
                  type="search"
                  name="pm_media_caption"
                  id="pm_media_caption"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !uploading) {
                      e.preventDefault();
                      void handleConfirmSendMedia();
                    }
                  }}
                  disabled={uploading}
                  placeholder="اكتب رسالة مرافقة للمرفق هنا..."
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
    </>
  );
}
