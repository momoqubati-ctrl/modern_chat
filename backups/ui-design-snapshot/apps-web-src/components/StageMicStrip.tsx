import { useEffect, useRef, useState } from "react";
import {
  Eye,
  Lock,
  LogOut,
  Mic,
  MicOff,
  Radio,
  Unlock,
  UserX,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot } from "@newchat/shared";
import { useMicStageAudio } from "../hooks/useMicStageAudio.js";
import { isSafeLinkUrl, resolveAssetUrl } from "../lib/mediaUrl.js";
import { unlockBrowserAudioContext } from "../lib/mediaPermissions.js";
import { canUseRoomManagement } from "../lib/permissions.js";

interface StageMicStripProps {
  dark: boolean;
  onSelectUser: (user: OnlineUserSnapshot) => void;
}

export function StageMicStrip({ dark, onSelectUser }: StageMicStripProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const listenersCount = useChatStore((s) => s.listenersCount);
  const site = useChatStore((s) => s.site);
  const siteFlags = useChatStore((s) => s.siteFlags);

  const {
    micProvider,
    micCount,
    slots,
    mySlotNumber,
    isSelfMuted,
    isJitsiMode,
    jitsiEmbedUrl,
    stageStatus,
    audioEnabled,
    setAudioEnabled,
    toggleLocalMuteUser,
    takeSlot,
    leaveSlot,
    toggleSelfMute,
    toggleUserMute,
    toggleSlotLock,
    kickFromStage,
  } = useMicStageAudio();

  const [activeSlotMenu, setActiveSlotMenu] = useState<number | null>(null);
  const [radioOpen, setRadioOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = rooms.find((r) => r.id === currentRoomId) ?? null;
  const radioStreamUrl = String(siteFlags.tv || site?.radio || site?.tv || "").trim();
  const hasRadioStream = Boolean(radioStreamUrl && isSafeLinkUrl(radioStreamUrl));
  const isBroadcastRoom = Boolean(activeRoom?.broadcast && micCount > 0);
  const isStaff = canUseRoomManagement(me, powers);

  // Close slot menu on outside click or room switch
  useEffect(() => {
    setActiveSlotMenu(null);
  }, [currentRoomId]);

  useEffect(() => {
    if (activeSlotMenu === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (shellRef.current && !shellRef.current.contains(e.target as Node)) {
        setActiveSlotMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveSlotMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeSlotMenu]);

  if (!isBroadcastRoom && !hasRadioStream) {
    return null;
  }

  return (
    <div
      className={`border-b px-0 sm:px-3 py-1 sm:py-1.5 space-y-1.5 shrink-0 ${
        dark ? "bg-slate-900/75 border-slate-800" : "bg-slate-50 border-slate-200"
      }`}
    >
      {/* Radio / TV Bar */}
      {hasRadioStream && (
        <div
          className={`mx-2 sm:mx-0 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs ${
            dark ? "bg-slate-950/70 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700"
          }`}
        >
          <div className="inline-flex items-center gap-2 min-w-0">
            <Radio className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-bold truncate">البث المباشر / الراديو</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {radioOpen && (
              <audio controls autoPlay src={radioStreamUrl} className="h-7 max-w-[200px]" />
            )}
            <button
              type="button"
              onClick={() => setRadioOpen((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 font-bold text-[11px]"
            >
              {radioOpen ? "إيقاف" : "تشغيل"}
            </button>
          </div>
        </div>
      )}

      {/* Reference-Matched Circular Voice Stage */}
      {isBroadcastRoom && (
        <div ref={shellRef} className="space-y-1.5">
          <div className="voice-stage-dock">
            <div className="voice-stage-shell">
              {/* 5 Circular Mic Slots Track */}
              <div className="voice-stage-track">
                {slots.map((slot) => {
                  const occupant = slot.occupantId ? onlineMap[slot.occupantId] : undefined;
                  const isMine = mySlotNumber === slot.slot;
                  const showMenu = activeSlotMenu === slot.slot;
                  const avatarSrc = occupant
                    ? resolveAssetUrl(occupant.pic, "pic", "/pic.png")
                    : "";

                  const stateClasses = [
                    "voice-slot-orb",
                    slot.active
                      ? "voice-slot-orb--occupied"
                      : slot.locked
                        ? "voice-slot-orb--locked"
                        : "voice-slot-orb--empty",
                    isMine ? "voice-slot-orb--mine" : "",
                    slot.active && slot.muted ? "voice-slot-orb--muted" : "",
                    slot.active && slot.speaking && !slot.muted ? "voice-slot-orb--speaking" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const slotLabel = slot.active
                    ? occupant?.topic || `مايك ${slot.slot}`
                    : slot.locked
                      ? "مغلق"
                      : "فارغ";

                  return (
                    <div key={slot.slot} className="voice-slot-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (slot.active && occupant) {
                            if (isMine) {
                              toggleSelfMute();
                            } else {
                              setActiveSlotMenu(showMenu ? null : slot.slot);
                            }
                          } else if (slot.locked) {
                            if (isStaff) {
                              setActiveSlotMenu(showMenu ? null : slot.slot);
                            }
                          } else {
                            if (isStaff && activeSlotMenu === slot.slot) {
                              setActiveSlotMenu(null);
                            } else {
                              takeSlot(slot.slot);
                            }
                          }
                        }}
                        onContextMenu={(e) => {
                          if (!isStaff && !slot.active) return;
                          e.preventDefault();
                          setActiveSlotMenu(showMenu ? null : slot.slot);
                        }}
                        title={
                          slot.active
                            ? `${slotLabel}${slot.muted ? " (مكتوم)" : ""}`
                            : slot.locked
                              ? "مقعد مقفل"
                              : `صعود على المايك ${slot.slot}`
                        }
                        className={stateClasses}
                      >
                        {/* Top-Right Slot Number Badge */}
                        <span className="voice-slot-number">{slot.slot}</span>

                        {/* Slot Visual Content */}
                        {slot.active ? (
                          <div className="voice-slot-avatar-clip">
                            <img
                              src={avatarSrc}
                              alt={slotLabel}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : slot.locked ? (
                          <Lock className="w-4 h-4 sm:w-5 sm:h-5 relative z-2" />
                        ) : (
                          <Mic className="w-4 h-4 sm:w-5 sm:h-5 relative z-2 text-white/95" />
                        )}

                        {/* Diagonal Mute Slash on Muted Speakers or Locally Muted Speaker */}
                        {(slot.active && (slot.muted || slot.locallyMuted)) && (
                          <span className="voice-mute-slash" aria-hidden="true" />
                        )}

                        {/* Overlapping Pill Label at Bottom */}
                        <span className="voice-slot-name">{slotLabel}</span>
                      </button>

                      {/* Floating Slot Context / Action Menu */}
                      {showMenu && (slot.active || isStaff) && (
                        <div
                          dir="rtl"
                          className={`absolute top-full mt-4 left-1/2 -translate-x-1/2 z-40 w-40 rounded-xl border p-1.5 shadow-2xl space-y-1 text-[11px] ${
                            dark
                              ? "bg-slate-900 border-slate-700 text-slate-100"
                              : "bg-white border-slate-200 text-slate-800"
                          }`}
                        >
                          {occupant && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectUser(occupant);
                                setActiveSlotMenu(null);
                              }}
                              className="w-full text-right px-2 py-1 rounded-lg hover:bg-sky-500/15 font-bold"
                            >
                              فتح البروفايل
                            </button>
                          )}

                          {slot.active && slot.occupantId && !isMine && (
                            <button
                              type="button"
                              onClick={() => {
                                toggleLocalMuteUser(slot.occupantId);
                                setActiveSlotMenu(null);
                              }}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg font-bold ${
                                slot.locallyMuted
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "hover:bg-slate-500/15"
                              }`}
                            >
                              {slot.locallyMuted ? (
                                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <VolumeX className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>{slot.locallyMuted ? "إلغاء كتمه عندي" : "كتم من جهتي"}</span>
                            </button>
                          )}

                          {isStaff && slot.active && slot.occupantId && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  toggleUserMute(slot.occupantId, !slot.muted);
                                  setActiveSlotMenu(null);
                                }}
                                className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-amber-500/15 text-amber-400 font-bold"
                              >
                                {slot.muted ? (
                                  <Mic className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <MicOff className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>{slot.muted ? "فك كتم المايك" : "كتم المايك"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  kickFromStage(slot.occupantId);
                                  setActiveSlotMenu(null);
                                }}
                                className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-rose-500/15 text-rose-400 font-bold"
                              >
                                <UserX className="w-3.5 h-3.5 shrink-0" />
                                <span>إنزال من المايك</span>
                              </button>
                            </>
                          )}

                          {isStaff && (
                            <button
                              type="button"
                              onClick={() => {
                                toggleSlotLock(slot.slot, !slot.locked);
                                setActiveSlotMenu(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-500/15 font-bold border-t border-slate-700/20 pt-1"
                            >
                              {slot.locked ? (
                                <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              )}
                              <span>{slot.locked ? "فتح المقعد" : "قفل المقعد"}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Side Summary Column: Master Audio Toggle + Listener Count */}
              <div className="voice-stage-summary">
                <button
                  type="button"
                  onClick={() => {
                    if (!audioEnabled) unlockBrowserAudioContext();
                    setAudioEnabled(!audioEnabled);
                  }}
                  title={
                    audioEnabled
                      ? `كتم أو تشغيل جميع الأصوات (${micProvider})${stageStatus === "connected" ? " • متصل" : stageStatus === "unavailable" ? " • غير مهيأ" : ""}`
                      : `تشغيل جميع الأصوات (${micProvider})`
                  }
                  className={`voice-stage-master-btn ${
                    !audioEnabled ? "voice-stage-master-btn--muted" : ""
                  }`}
                >
                  {audioEnabled ? (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="voice-mute-slash" aria-hidden="true" />
                    </>
                  )}
                </button>

                <div className="voice-stage-listeners" title="عدد المستمعين الآن">
                  <Eye className="w-3.5 h-3.5 text-indigo-100" />
                  <strong>{listenersCount}</strong>
                  <small>مستمع</small>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Self-Speaker Control Strip when seated */}
          {mySlotNumber > 0 && (
            <div className="flex items-center justify-center gap-2 px-2 pb-0.5 text-[11px]">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border shadow-xs ${
                  dark
                    ? "bg-slate-950/90 border-slate-800 text-slate-200"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>على المايك #{mySlotNumber}</span>
                </span>

                <button
                  type="button"
                  onClick={toggleSelfMute}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-white transition ${
                    isSelfMuted
                      ? "bg-rose-600 hover:bg-rose-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {isSelfMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  <span>{isSelfMuted ? "مكتوم (افتح)" : "المايك مفتوح"}</span>
                </button>

                <button
                  type="button"
                  onClick={leaveSlot}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 font-bold transition"
                >
                  <LogOut className="w-3 h-3" />
                  <span>نزول</span>
                </button>

                <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-[10px] font-bold opacity-80">
                  {micProvider === "WEBRTC" ? "WebRTC" : micProvider === "JITSI" ? "Jitsi" : "LiveKit"}
                </span>
              </div>
            </div>
          )}

          {/* Hidden Off-Screen Audio Bridge ONLY when Admin explicitly switches provider to JITSI */}
          {isJitsiMode && jitsiEmbedUrl && audioEnabled && (
            <iframe
              src={jitsiEmbedUrl}
              title="Stage Audio Bridge"
              aria-hidden="true"
              allow="microphone; autoplay"
              style={{
                position: "fixed",
                left: "-9999px",
                top: "-9999px",
                width: "1px",
                height: "1px",
                border: 0,
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
