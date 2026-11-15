import { Maximize2, Mic, MicOff, Radio, Users, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { useMicStageAudio } from "../../hooks/useMicStageAudio.js";

interface LiveAudioMiniPlayerProps {
  dark?: boolean;
  onExpand: () => void;
  onClose: () => void;
}

export function LiveAudioMiniPlayer({
  dark,
  onExpand,
  onClose,
}: LiveAudioMiniPlayerProps) {
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const listenersCount = useChatStore((s) => s.listenersCount);
  const speakingUsers = useChatStore((s) => s.speakingUsers);

  const activeRoom = rooms.find((r) => r.id === currentRoomId);
  const { mySlotNumber, isSelfMuted, toggleSelfMute, slots } = useMicStageAudio();

  if (!activeRoom) return null;

  const anySpeaking = slots.some((s) => s.active && s.speaking && !s.muted);

  return (
    <div
      dir="rtl"
      className={`fixed bottom-4 left-4 z-40 flex items-center gap-3 px-3 py-2 rounded-2xl border shadow-2xl backdrop-blur-md animate-slide-up select-none transition group ${
        dark
          ? "bg-slate-900/95 border-slate-700/80 text-white hover:border-sky-500/50"
          : "bg-white/95 border-slate-200 text-slate-900 hover:border-sky-400 shadow-slate-300/50"
      }`}
    >
      {/* Host Avatar with animated pulse */}
      <div className="relative cursor-pointer" onClick={onExpand}>
        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#FE2C55] bg-slate-900 shrink-0">
          <img
            src={resolveAssetUrl(activeRoom.pic || "pic.png", "room", "/default-avatar.png")}
            alt={activeRoom.topic}
            className="w-full h-full object-cover"
          />
        </div>
        {anySpeaking && (
          <span className="absolute -inset-1 rounded-full border-2 border-[#FE2C55] animate-ping pointer-events-none opacity-75" />
        )}
        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#FE2C55] flex items-center justify-center text-white text-[9px] shadow-sm">
          <Radio className="w-2.5 h-2.5 animate-pulse" />
        </div>
      </div>

      {/* Room Details (Click to Expand) */}
      <div
        className="flex flex-col min-w-0 cursor-pointer pr-1"
        onClick={onExpand}
        title="انقر لتكبير البث المباشر"
      >
        <span
          className={`text-xs font-extrabold truncate max-w-[140px] transition ${
            dark ? "text-white group-hover:text-rose-400" : "text-slate-900 group-hover:text-sky-600"
          }`}
        >
          {activeRoom.topic}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-0.5 text-rose-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            بث مباشر
          </span>
          <span>•</span>
          <span className="flex items-center gap-0.5">
            <Users className="w-2.5 h-2.5" />
            {listenersCount}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div
        className={`flex items-center gap-1 shrink-0 border-r pr-2 ${
          dark ? "border-white/10" : "border-slate-200"
        }`}
      >
        {mySlotNumber > 0 && (
          <button
            type="button"
            onClick={toggleSelfMute}
            className={`p-1.5 rounded-xl border transition ${
              isSelfMuted
                ? "bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
                : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
            }`}
            title={isSelfMuted ? "إلغاء كتم المايك" : "كتم المايك"}
          >
            {isSelfMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={onExpand}
          className={`p-1.5 rounded-xl transition ${
            dark
              ? "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
              : "bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900"
          }`}
          title="تكبير الغرفة الصوتية"
          aria-label="تكبير الغرفة الصوتية"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-xl transition ${
            dark
              ? "bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
              : "bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600"
          }`}
          title="مغادرة البث"
          aria-label="مغادرة البث"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
