import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Paperclip,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Send,
  Square,
  Video,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { usePmWebRtcCall } from "../hooks/usePmWebRtcCall.js";
import { formatTimeArabic } from "../lib/mediaUrl.js";
import {
  explainMediaAccessError,
  isMediaCaptureSupported,
  requestUserMediaWithFallback,
  stashCallMediaStream,
  unlockBrowserAudioContext,
} from "../lib/mediaPermissions.js";
import { detectAttachmentTypeFromPath, SafeRichText, AttachmentRenderer } from "../lib/richContent.js";
import { playSoundCue } from "../lib/soundFx.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface PrivateChatDockProps {
  dark: boolean;
  open: boolean;
  onClose: () => void;
}

export function PrivateChatDock({ dark, open, onClose }: PrivateChatDockProps) {
  const me = useChatStore((s) => s.me);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const pmThreads = useChatStore((s) => s.pmThreads);
  const activePmTargetId = useChatStore((s) => s.activePmTargetId);
  const callState = useChatStore((s) => s.callState);

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

  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const lastPmTotalRef = useRef(0);

  const threadIds = useMemo(() => Object.keys(pmThreads), [pmThreads]);
  const selectedId = activePmTargetId || threadIds[0] || "";
  const activeUser = selectedId ? onlineMap[selectedId] : undefined;
  const messages = selectedId ? pmThreads[selectedId] ?? [] : [];

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

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

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

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    sendPrivateMessage(selectedId, draft);
    setDraft("");
  };

  const handleFileAttach = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;
    setUploading(true);
    try {
      const url = (await getApiClient().uploadMediaFile(file, file.name)).trim();
      if (url) {
        sendPrivateMessage(selectedId, "", {
          file: url,
          fileType: detectAttachmentTypeFromPath(url),
        });
      }
    } catch {
      pushNotice("تعذر رفع المرفق في الخاص", { force: 1 });
    } finally {
      setUploading(false);
    }
  };

  const toggleVoiceRecording = async () => {
    if (!selectedId) return;
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
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
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            sendVoiceNote(reader.result, mime, selectedId);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      pushNotice(explainMediaAccessError(err, "mic"), { force: 1 });
    }
  };

  const showWindow = open || callState.status !== "idle";
  if (!showWindow) return null;

  return (
    <div
      className={`fixed bottom-16 lg:bottom-4 left-3 right-3 sm:right-auto sm:w-[400px] z-40 rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[75vh] ${
        dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-800/30 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {activeUser ? (
            <MemberAvatar
              pic={activeUser.pic}
              cover={activeUser.cover}
              topic={activeUser.topic}
              stat={activeUser.stat}
              size="sm"
            />
          ) : null}
          <div className="min-w-0">
            <div className="text-xs font-extrabold truncate">
              {activeUser?.topic || messages[0]?.topic || "المحادثات الخاصة"}
            </div>
            <div className="text-[10px] text-slate-400">
              {callState.status === "active"
                ? `مكالمة جارية مع ${callState.peerTopic}`
                : activeUser?.power || "رسائل فورية خاصة"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedId && activeUser && callState.status === "idle" && (
            <>
              <button
                type="button"
                onClick={() => void handleStartCallWithPermission("audio")}
                title="مكالمة صوتية"
                className="p-1.5 rounded-xl hover:bg-emerald-500/15 text-emerald-400 transition"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleStartCallWithPermission("video")}
                title="مكالمة فيديو"
                className="p-1.5 rounded-xl hover:bg-sky-500/15 text-sky-400 transition"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800/50 text-slate-400"
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
                  <div className="text-xs font-extrabold truncate">{callState.peerTopic}</div>
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
                <span className="text-xs font-bold">جاري الاتصال بـ {callState.peerTopic}...</span>
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

      {/* Active Threads Bar */}
      {threadIds.length > 0 && (
        <div className="px-2.5 py-1.5 border-b border-slate-800/30 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {threadIds.map((id) => {
            const u = onlineMap[id];
            const lastMsg = pmThreads[id]?.[pmThreads[id]!.length - 1];
            const active = id === selectedId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActivePmTarget(id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                  active
                    ? "bg-sky-600 text-white"
                    : dark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {u?.topic || lastMsg?.topic || "مستخدم"}
              </button>
            );
          })}
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 chat-scroll min-h-[200px]">
        {!selectedId ? (
          <div className="text-center text-xs text-slate-400 py-10">
            اختر عضواً لبدء محادثة خاصة فورية
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-10">
            ابدأ المحادثة مع {activeUser?.topic || "العضو"}
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMine = Boolean(m.self || (me?.id && m.from === me.id));
            return (
              <div
                key={`${m.ts}-${idx}`}
                className={`flex flex-col ${isMine ? "items-start" : "items-end"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs shadow-xs ${
                    isMine
                      ? "bg-sky-600 text-white"
                      : dark
                        ? "bg-slate-800 text-slate-100"
                        : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {m.msg && <SafeRichText text={m.msg} />}
                  {m.file && <AttachmentRenderer file={m.file} fileType={m.fileType} />}
                  <div className="mt-1 text-[9px] opacity-70">{formatTimeArabic(m.ts)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Composer */}
      {selectedId && (
        <form
          onSubmit={handleSend}
          className="p-2.5 border-t border-slate-800/30 flex items-center gap-1.5 shrink-0"
        >
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

          <button
            type="button"
            onClick={() => void toggleVoiceRecording()}
            title={recording ? "إيقاف وإرسال البصمة الصوتية" : "تسجيل بصمة صوتية"}
            className={`p-2 rounded-xl border transition shrink-0 ${
              recording
                ? "bg-rose-600 border-rose-500 text-white animate-pulse"
                : dark
                  ? "border-slate-800 hover:bg-slate-800 text-slate-300"
                  : "border-slate-200 hover:bg-slate-100 text-slate-600"
            }`}
          >
            {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={uploading ? "جاري رفع الملف..." : "اكتب رسالة خاصة..."}
            disabled={uploading}
            className={`flex-1 rounded-xl px-3 py-2 text-xs border outline-none ${
              dark
                ? "bg-slate-950 border-slate-800 focus:border-sky-500"
                : "bg-slate-50 border-slate-200 focus:border-sky-500"
            }`}
          />

          <button
            type="submit"
            disabled={!draft.trim()}
            className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}
