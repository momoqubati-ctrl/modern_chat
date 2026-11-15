import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
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
  WifiOff,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot } from "@newchat/shared";
import { useMicStageAudio } from "../hooks/useMicStageAudio.js";
import { isSafeLinkUrl, resolveAssetUrl } from "../lib/mediaUrl.js";
import { unlockBrowserAudioContext } from "../lib/mediaPermissions.js";
import { canUseRoomManagement } from "../lib/permissions.js";

export type StageOverlayLayoutMode = "hidden" | "collapsed" | "expanded";

interface StageMicStripProps {
  dark: boolean;
  onSelectUser: (user: OnlineUserSnapshot) => void;
  onLayoutChange?: (mode: StageOverlayLayoutMode) => void;
}

export function StageMicStrip({
  dark,
  onSelectUser,
  onLayoutChange,
}: StageMicStripProps) {
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
  const [collapsed, setCollapsed] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = rooms.find((r) => r.id === currentRoomId) ?? null;
  const radioStreamUrl = String(siteFlags.tv || site?.radio || site?.tv || "").trim();
  const hasRadioStream = Boolean(radioStreamUrl && isSafeLinkUrl(radioStreamUrl));
  const isBroadcastRoom = Boolean(activeRoom?.broadcast && micCount > 0);
  const isStaff = canUseRoomManagement(me, powers);

  const activeCount = slots.filter((s) => s.active).length;
  const anySpeaking = slots.some((s) => s.active && s.speaking && !s.muted);

  const stageStatusLabel =
    stageStatus === "connected"
      ? "متصل"
      : stageStatus === "connecting"
        ? "جارٍ الاتصال..."
        : stageStatus === "unavailable"
          ? "غير مهيأ"
          : "خامل";

  const stageStatusDotClass =
    stageStatus === "connected"
      ? "bg-emerald-400"
      : stageStatus === "connecting"
        ? "bg-amber-400 animate-pulse"
        : stageStatus === "unavailable"
          ? "bg-rose-500"
          : "bg-slate-400";

  // Close slot menu on room switch
  useEffect(() => {
    setActiveSlotMenu(null);
  }, [currentRoomId]);

  // Report floating overlay layout mode so ChatFeed can adjust top clearance cleanly
  useEffect(() => {
    if (!onLayoutChange) return;
    if (!isBroadcastRoom && !hasRadioStream) {
      onLayoutChange("hidden");
    } else if (isBroadcastRoom && !collapsed) {
      onLayoutChange("expanded");
    } else {
      onLayoutChange("collapsed");
    }
  }, [isBroadcastRoom, hasRadioStream, collapsed, onLayoutChange]);

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

  const activeSlotObj =
    activeSlotMenu !== null ? slots.find((s) => s.slot === activeSlotMenu) ?? null : null;
  const activeOccupant = activeSlotObj?.occupantId
    ? onlineMap[activeSlotObj.occupantId]
    : undefined;
  const activeIsMine = Boolean(activeSlotObj && mySlotNumber === activeSlotObj.slot);

  return (
    <div dir="rtl" className="voice-stage-overlay">
      {/* Compact Floating Radio / TV Pill when configured */}
      {hasRadioStream && (
        <div
          className={`pointer-events-auto max-w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-full border text-xs backdrop-blur-md shadow-lg ${
            dark
              ? "bg-slate-900/90 border-slate-700/60 text-slate-200"
              : "bg-white/90 border-slate-200 text-slate-700"
          }`}
        >
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <Radio className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="font-bold truncate">البث المباشر / الراديو</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {radioOpen && (
              <audio controls autoPlay src={radioStreamUrl} className="h-7 max-w-[180px]" />
            )}
            <button
              type="button"
              onClick={() => setRadioOpen((v) => !v)}
              className="px-2.5 py-0.5 rounded-full bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 font-bold text-[11px] transition"
            >
              {radioOpen ? "إيقاف" : "تشغيل"}
            </button>
          </div>
        </div>
      )}

      {/* Floating Voice Stage Capsule */}
      {isBroadcastRoom && (
        <div ref={shellRef} className="w-full flex flex-col items-center gap-1.5">
          {collapsed ? (
            /* Collapsed Compact Floating Pill */
            <div
              className={`voice-stage-dock voice-stage-dock--collapsed ${
                dark ? "voice-stage-dock--dark" : "voice-stage-dock--light"
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  title="توسيع الاستيج الصوتي"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold transition ${
                    dark
                      ? "bg-slate-800/85 hover:bg-slate-700/90 text-slate-100"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      anySpeaking ? "bg-emerald-400 animate-pulse" : stageStatusDotClass
                    }`}
                  />
                  <Mic className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>الاستيج</span>
                  <span className="text-[11px] opacity-80">
                    {activeCount}/{micCount}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!audioEnabled) unlockBrowserAudioContext();
                    setAudioEnabled(!audioEnabled);
                  }}
                  title={audioEnabled ? "كتم صوت الاستيج" : "تشغيل صوت الاستيج"}
                  className={`p-1.5 rounded-full border transition ${
                    !audioEnabled
                      ? "border-rose-500/60 bg-rose-500/15 text-rose-400"
                      : dark
                        ? "border-slate-700/60 bg-slate-800/75 text-slate-200 hover:bg-slate-700"
                        : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {audioEnabled ? (
                    <Volume2 className="w-3.5 h-3.5" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                </button>

                <span
                  title={`المستمعون: ${listenersCount} • ${stageStatusLabel}`}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${
                    dark ? "bg-slate-800/70 text-slate-300" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <Eye className="w-3 h-3 text-sky-400" />
                  <span>{listenersCount}</span>
                </span>

                {mySlotNumber > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={toggleSelfMute}
                      title={isSelfMuted ? "فتح المايك" : "كتم المايك"}
                      className={`p-1.5 rounded-full text-white transition ${
                        isSelfMuted
                          ? "bg-rose-600 hover:bg-rose-500"
                          : "bg-emerald-600 hover:bg-emerald-500"
                      }`}
                    >
                      {isSelfMuted ? (
                        <MicOff className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={leaveSlot}
                      title="النزول من المقعد"
                      className="p-1.5 rounded-full bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Expanded Floating Capsule */
            <div
              className={`voice-stage-dock ${
                dark ? "voice-stage-dock--dark" : "voice-stage-dock--light"
              }`}
            >
              <div className="voice-stage-shell">
                {/* Flexible Circular Mic Slots Track */}
                <div className="voice-stage-track chat-scroll">
                  {slots.map((slot) => {
                    const occupant = slot.occupantId ? onlineMap[slot.occupantId] : undefined;
                    const isMine = mySlotNumber === slot.slot;
                    const isDisconnected = Boolean(slot.active && (!occupant || occupant.offline));
                    const showMenu = activeSlotMenu === slot.slot;
                    const avatarSrc = occupant
                      ? resolveAssetUrl(occupant.pic, "pic", "/pic.png")
                      : "";

                    const orbStateClasses = [
                      "voice-slot-orb",
                      slot.active
                        ? "voice-slot-orb--occupied"
                        : slot.locked
                          ? "voice-slot-orb--locked"
                          : "voice-slot-orb--empty",
                      isMine ? "voice-slot-orb--mine" : "",
                      slot.active && slot.muted ? "voice-slot-orb--muted" : "",
                      slot.active && slot.speaking && !slot.muted
                        ? "voice-slot-orb--speaking"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const slotLabel = slot.active
                      ? occupant?.topic || `مايك ${slot.slot}`
                      : slot.locked
                        ? "مغلق"
                        : "شاغر";

                    const nameStateClasses = [
                      "voice-slot-name",
                      slot.locked ? "voice-slot-name--locked" : "",
                      slot.active && slot.muted ? "voice-slot-name--muted" : "",
                      slot.active && slot.speaking && !slot.muted
                        ? "voice-slot-name--speaking"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

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
                              ? `${slotLabel}${slot.muted ? " (مكتوم)" : " (المايك مفتوح)"}${
                                  isDisconnected ? " • غير متصل" : ""
                                }`
                              : slot.locked
                                ? "مقعد مقفل"
                                : `صعود على المقعد ${slot.slot}`
                          }
                          className="voice-slot-btn"
                        >
                          <div className={orbStateClasses}>
                            {/* Top-Right Slot Number Badge */}
                            <span className="voice-slot-number">{slot.slot}</span>

                            {/* Real Connection Issue Indicator when occupant offline */}
                            {isDisconnected && (
                              <span
                                className="voice-slot-conn-badge"
                                title="انقطع اتصال المستخدم"
                              >
                                <WifiOff className="w-2.5 h-2.5" />
                              </span>
                            )}

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
                              <Lock className="w-4 h-4 sm:w-[18px] sm:h-[18px] relative z-2" />
                            ) : (
                              <Mic className="w-4 h-4 sm:w-[18px] sm:h-[18px] relative z-2 opacity-85" />
                            )}

                            {/* Corner Mic Status Badge on Occupied Seats */}
                            {slot.active && (
                              <span
                                className={`voice-slot-mic-badge ${
                                  slot.locallyMuted
                                    ? "voice-slot-mic-badge--local-muted"
                                    : slot.muted
                                      ? "voice-slot-mic-badge--muted"
                                      : "voice-slot-mic-badge--open"
                                }`}
                                aria-label={
                                  slot.locallyMuted
                                    ? "مكتوم من جهتك"
                                    : slot.muted
                                      ? "المايك مكتوم"
                                      : "المايك مفتوح"
                                }
                              >
                                {slot.locallyMuted ? (
                                  <VolumeX className="w-2.5 h-2.5" />
                                ) : slot.muted ? (
                                  <MicOff className="w-2.5 h-2.5" />
                                ) : (
                                  <Mic className="w-2.5 h-2.5" />
                                )}
                              </span>
                            )}
                          </div>

                          {/* Slot Name / Status Pill */}
                          <span className={nameStateClasses}>{slotLabel}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Side Controls Column: Audio Toggle + Collapse + Listeners + Stage Status */}
                <div className="voice-stage-summary">
                  <div className="voice-stage-actions-row">
                    <button
                      type="button"
                      onClick={() => {
                        if (!audioEnabled) unlockBrowserAudioContext();
                        setAudioEnabled(!audioEnabled);
                      }}
                      title={
                        audioEnabled
                          ? `كتم أو تشغيل جميع الأصوات (${micProvider}) • ${stageStatusLabel}`
                          : `تشغيل جميع الأصوات (${micProvider})`
                      }
                      className={`voice-stage-master-btn ${
                        !audioEnabled ? "voice-stage-master-btn--muted" : ""
                      }`}
                    >
                      {audioEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveSlotMenu(null);
                        setCollapsed(true);
                      }}
                      title="طي الاستيج"
                      aria-label="طي الاستيج"
                      className="voice-stage-collapse-btn"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>

                  <div
                    className="voice-stage-listeners"
                    title={`عدد المستمعين الآن: ${listenersCount} • حالة الصوت: ${stageStatusLabel}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stageStatusDotClass}`} />
                    <Eye className="w-3 h-3 text-sky-400 shrink-0" />
                    <strong>{listenersCount}</strong>
                    <small>مستمع</small>
                  </div>
                </div>
              </div>

              {/* Dock-Anchored Slot Context / Action Menu (never clipped by track scroll) */}
              {activeSlotObj && (activeSlotObj.active || isStaff) && (
                <div
                  dir="rtl"
                  className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 z-40 w-48 rounded-2xl border p-1.5 shadow-2xl space-y-1 text-[11px] backdrop-blur-xl ${
                    dark
                      ? "bg-slate-900/95 border-slate-700/80 text-slate-100"
                      : "bg-white/95 border-slate-200 text-slate-800"
                  }`}
                >
                  <div
                    className={`px-2 py-1 text-[10px] font-extrabold border-b truncate ${
                      dark
                        ? "border-slate-800 text-slate-400"
                        : "border-slate-100 text-slate-500"
                    }`}
                  >
                    مقعد #{activeSlotObj.slot}
                    {activeOccupant?.topic ? ` • ${activeOccupant.topic}` : ""}
                  </div>

                  {activeOccupant && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectUser(activeOccupant);
                        setActiveSlotMenu(null);
                      }}
                      className="w-full text-right px-2 py-1.5 rounded-xl hover:bg-sky-500/15 font-bold transition"
                    >
                      فتح البروفايل
                    </button>
                  )}

                  {activeSlotObj.active && activeSlotObj.occupantId && !activeIsMine && (
                    <button
                      type="button"
                      onClick={() => {
                        toggleLocalMuteUser(activeSlotObj.occupantId);
                        setActiveSlotMenu(null);
                      }}
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl font-bold transition ${
                        activeSlotObj.locallyMuted
                          ? "bg-amber-500/15 text-amber-400"
                          : "hover:bg-slate-500/15"
                      }`}
                    >
                      {activeSlotObj.locallyMuted ? (
                        <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {activeSlotObj.locallyMuted ? "إلغاء كتمه عندي" : "كتم من جهتي"}
                      </span>
                    </button>
                  )}

                  {isStaff && activeSlotObj.active && activeSlotObj.occupantId && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          toggleUserMute(activeSlotObj.occupantId, !activeSlotObj.muted);
                          setActiveSlotMenu(null);
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-amber-500/15 text-amber-400 font-bold transition"
                      >
                        {activeSlotObj.muted ? (
                          <Mic className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <MicOff className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{activeSlotObj.muted ? "فك كتم المايك" : "كتم المايك"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          kickFromStage(activeSlotObj.occupantId);
                          setActiveSlotMenu(null);
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-rose-500/15 text-rose-400 font-bold transition"
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
                        toggleSlotLock(activeSlotObj.slot, !activeSlotObj.locked);
                        setActiveSlotMenu(null);
                      }}
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-slate-500/15 font-bold border-t pt-1.5 transition ${
                        dark ? "border-slate-800" : "border-slate-100"
                      }`}
                    >
                      {activeSlotObj.locked ? (
                        <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span>{activeSlotObj.locked ? "فتح المقعد" : "قفل المقعد"}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Compact Self-Speaker Control Strip when seated & expanded */}
          {!collapsed && mySlotNumber > 0 && (
            <div className="pointer-events-auto flex items-center justify-center max-w-full px-1 text-[11px]">
              <div
                className={`inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full border shadow-lg backdrop-blur-md ${
                  dark
                    ? "bg-slate-900/90 border-slate-700/70 text-slate-200"
                    : "bg-white/92 border-slate-200 text-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-500">
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
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 font-bold transition"
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
