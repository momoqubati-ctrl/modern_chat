import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  DoorOpen,
  Heart,
  MessageSquare,
  Reply,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot, RoomMessagePayload } from "@newchat/shared";
import { formatTimeArabic, normalizeHexColor, resolveAssetUrl } from "../lib/mediaUrl.js";
import { hasRoleFlag } from "../lib/permissions.js";
import { AttachmentRenderer, SafeRichText } from "../lib/richContent.js";
import { playSoundCue } from "../lib/soundFx.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface ChatFeedProps {
  dark: boolean;
  onReply: (message: RoomMessagePayload) => void;
  onSelectUser: (user: OnlineUserSnapshot) => void;
}

export function ChatFeed({ dark, onReply, onSelectUser }: ChatFeedProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const speakingUsers = useChatStore((s) => s.speakingUsers);
  const stageState = useChatStore((s) => s.stageState);
  const messages = useChatStore((s) => s.messages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const site = useChatStore((s) => s.site);
  const siteFlags = useChatStore((s) => s.siteFlags);

  const joinRoom = useChatStore((s) => s.joinRoom);
  const likeRoomMessage = useChatStore((s) => s.likeRoomMessage);
  const deleteRoomMessage = useChatStore((s) => s.deleteRoomMessage);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevLenRef = useRef(messages.length);

  const activeRoom = rooms.find((r) => r.id === currentRoomId);
  const stageMutedUsers =
    stageState.mutedUsers && typeof stageState.mutedUsers === "object"
      ? (stageState.mutedUsers as Record<string, boolean>)
      : {};
  const canDeleteMessages = hasRoleFlag(me, powers, "delmsg", myPowerRole);
  const isBubbleMode = site?.roomMessageTheme === "bubble";

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 86,
    overscan: 14,
  });

  // Reset scroll tracker on room switch
  useEffect(() => {
    prevLenRef.current = messages.length;
    setAtBottom(true);
    setUnreadCount(0);
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
      });
    }
  }, [currentRoomId]);

  // Sticky auto-scroll + mention / winner cues
  useEffect(() => {
    const prevLen = prevLenRef.current;
    prevLenRef.current = messages.length;
    if (messages.length <= prevLen) return;

    const latest = messages[messages.length - 1];
    if (latest) {
      if (latest.class === "brb-winner-msg") {
        playSoundCue("win");
      } else if (
        me?.idreg &&
        latest.uid !== me.uid &&
        latest.id !== me.id &&
        typeof latest.msg === "string" &&
        latest.msg.includes(`@${me.idreg}`)
      ) {
        playSoundCue("mention");
      }
    }

    if (atBottom) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
      });
    } else {
      setUnreadCount((c) => c + (messages.length - prevLen));
    }
  }, [messages.length, atBottom, me?.idreg, me?.uid, me?.id, virtualizer]);

  const handleScroll = () => {
    const el = parentRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 120;
    setAtBottom(nearBottom);
    if (nearBottom && unreadCount > 0) {
      setUnreadCount(0);
    }
  };

  const scrollToBottom = () => {
    setUnreadCount(0);
    setAtBottom(true);
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  };

  const handleSenderClick = (msg: RoomMessagePayload) => {
    const matched =
      (msg.id && onlineMap[msg.id]) ||
      (msg.uid && Object.values(onlineMap).find((u) => u.uid === msg.uid || u.id === msg.uid)) ||
      null;
    if (matched) {
      onSelectUser(matched);
      return;
    }
    if (msg.uid === "bot_competition" || msg.class === "room-welcome-msg") return;
    onSelectUser({
      id: String(msg.uid || msg.id || "offline"),
      uid: msg.uid,
      lid: msg.lid,
      topic: msg.topic || "عضو",
      pic: msg.pic || "pic.png",
      msg: "",
      power: msg.power || "",
      bg: msg.bg || "#FFFFFF",
      gcol: msg.gcol || "#FFFFFF",
      ucol: msg.ucol || "#000000",
      mcol: msg.mcol || "#000000",
      stat: 0,
      offline: true,
      ico: msg.ico,
      gift_ico: msg.gift_ico,
    });
  };

  const typingNames = Object.entries(typingUsers)
    .filter(([sid]) => sid !== me?.id)
    .map(([, name]) => name)
    .filter(Boolean);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto chat-scroll px-3 py-3 sm:px-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <MessageSquare className="w-9 h-9 opacity-35" />
            <span>أهلاً بك في {activeRoom?.topic || "الغرفة"} — ابدأ المحادثة الآن</span>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((vRow) => {
              const m = messages[vRow.index] as RoomMessagePayload & {
                actionType?: string;
                targetRoomId?: string;
                targetRoomTopic?: string;
              };
              if (!m) return null;

              const messageId = m.mi || m.id || "";
              const cls = String(m.class || "");
              const isHmsg = cls === "hmsg";
              const isWelcome = cls === "room-welcome-msg";
              const isWinner = cls === "brb-winner-msg";
              const isBot = cls === "brb-bot-msg" || m.uid === "bot_competition";
              const isMine = Boolean(
                (me?.uid && m.uid === me.uid) || (me?.id && (m.uid === me.id || m.id === me.id)),
              );
              const isMentioningMe = Boolean(
                me?.idreg && typeof m.msg === "string" && m.msg.includes(`@${me.idreg}`),
              );
              const replyObj = (m.reply || m.replyTo) as
                | { topic?: string; msg?: string }
                | null
                | undefined;
              const likesCount = Array.isArray(m.likes) ? m.likes.length : 0;

              return (
                <div
                  key={vRow.key}
                  data-index={vRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`,
                  }}
                  className="pb-2.5"
                >
                  {isHmsg ? (
                    <div
                      className={`rounded-2xl px-3 py-2 border text-xs flex flex-wrap items-center justify-between gap-2 ${
                        dark
                          ? "bg-slate-900/70 border-slate-800/80 text-slate-300"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MemberAvatar pic={m.pic} topic={m.topic} size="xs" showStatus={false} />
                        <button
                          type="button"
                          onClick={() => handleSenderClick(m)}
                          className="font-extrabold text-sky-400 hover:underline truncate"
                        >
                          {m.topic}
                        </button>
                        <span className="text-slate-400">{m.msg}</span>
                        {m.targetRoomTopic && m.targetRoomId && (
                          <button
                            type="button"
                            onClick={() => joinRoom(m.targetRoomId!)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 font-bold transition"
                          >
                            <DoorOpen className="w-3 h-3" />
                            <span>{m.targetRoomTopic}</span>
                          </button>
                        )}
                      </div>
                      {m.time && (
                        <span className="text-[10px] text-slate-500">{formatTimeArabic(m.time)}</span>
                      )}
                    </div>
                  ) : isWelcome ? (
                    <div
                      className={`rounded-2xl p-3 border text-xs flex items-start gap-3 ${
                        dark
                          ? "bg-teal-500/10 border-teal-500/30 text-teal-200"
                          : "bg-teal-50 border-teal-200 text-teal-900"
                      }`}
                    >
                      <img
                        src={resolveAssetUrl(m.pic, "picroom", "/room.png")}
                        alt={m.topic}
                        className="w-10 h-10 rounded-xl object-cover border border-teal-500/30 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-extrabold text-teal-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>رسالة ترحيب • {m.topic}</span>
                        </div>
                        <div className="leading-relaxed break-words">
                          <SafeRichText text={m.msg} />
                        </div>
                      </div>
                    </div>
                  ) : isBot || isWinner ? (
                    <div
                      className={`rounded-2xl p-3 border text-xs flex items-start gap-3 ${
                        isWinner
                          ? "bg-gradient-to-l from-amber-500/20 to-emerald-500/15 border-amber-500/40"
                          : dark
                            ? "bg-amber-500/10 border-amber-500/25"
                            : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <img
                        src={resolveAssetUrl(m.pic || "/imgs/brb-bot.svg", "imgs", "/pic.png")}
                        alt={m.topic}
                        className="w-9 h-9 rounded-full object-cover border border-amber-500/40 shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-amber-400 inline-flex items-center gap-1">
                            {isWinner && <Trophy className="w-3.5 h-3.5" />}
                            {m.topic || "مسابقة الغرفة"}
                          </span>
                          {m.time && (
                            <span className="text-[10px] text-slate-400">{formatTimeArabic(m.time)}</span>
                          )}
                        </div>
                        <div className="text-sm font-bold leading-relaxed break-words">
                          <SafeRichText text={m.msg} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex ${isBubbleMode && isMine ? "justify-start" : ""}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 border transition ${
                          isBubbleMode ? "max-w-[92%] sm:max-w-[82%]" : "w-full"
                        } ${
                          isMentioningMe
                            ? "border-amber-500/60 bg-amber-500/10"
                            : isBubbleMode && isMine
                              ? dark
                                ? "bg-indigo-600/20 border-indigo-500/35"
                                : "bg-indigo-50 border-indigo-200"
                              : dark
                                ? "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                                : "bg-white border-slate-200 shadow-xs"
                        }`}
                        style={{
                          borderRightWidth: m.bg && m.bg !== "#FFFFFF" ? "4px" : undefined,
                          borderRightColor:
                            m.bg && m.bg !== "#FFFFFF" ? normalizeHexColor(m.bg, "#38bdf8") : undefined,
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleSenderClick(m)}
                            className="shrink-0 mt-0.5"
                          >
                            <MemberAvatar
                              pic={m.pic}
                              topic={m.topic}
                              speaking={Boolean(
                                m.id &&
                                  speakingUsers[m.id] &&
                                  !stageMutedUsers[m.id] &&
                                  !onlineMap[m.id]?.muted,
                              )}
                              size="sm"
                              showStatus={false}
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            {/* Sender Row */}
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                {m.ico && (
                                  <img
                                    src={resolveAssetUrl(m.ico, "sico", "")}
                                    alt=""
                                    className="w-4 h-4 object-contain shrink-0"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleSenderClick(m)}
                                  className="text-xs font-extrabold hover:underline truncate"
                                  style={{
                                    color:
                                      m.ucol && m.ucol !== "#000000"
                                        ? normalizeHexColor(m.ucol, "#38bdf8")
                                        : undefined,
                                  }}
                                >
                                  {m.topic}
                                </button>
                                {m.gift_ico && (
                                  <img
                                    src={resolveAssetUrl(m.gift_ico, "gifts_git", "")}
                                    alt="هدية"
                                    className="w-4 h-4 object-contain shrink-0"
                                  />
                                )}
                                {m.time && (
                                  <span className="text-[10px] text-slate-500">
                                    {formatTimeArabic(m.time)}
                                  </span>
                                )}
                              </div>

                              {/* Message Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {siteFlags.reply !== false && (
                                  <button
                                    type="button"
                                    onClick={() => onReply(m)}
                                    title="رد على الرسالة"
                                    className="p-1 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition"
                                  >
                                    <Reply className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {messageId && (
                                  <button
                                    type="button"
                                    onClick={() => likeRoomMessage(messageId)}
                                    title="إعجاب بالرسالة"
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] transition ${
                                      likesCount > 0
                                        ? "bg-rose-500/15 text-rose-400 font-bold"
                                        : "text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                                    }`}
                                  >
                                    <Heart className="w-3 h-3" />
                                    {likesCount > 0 && <span>{likesCount}</span>}
                                  </button>
                                )}

                                {canDeleteMessages && messageId && (
                                  <button
                                    type="button"
                                    onClick={() => deleteRoomMessage(messageId)}
                                    title="حذف الرسالة"
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Quoted Reply */}
                            {replyObj && (replyObj.topic || replyObj.msg) && (
                              <div
                                className={`mb-1.5 px-2.5 py-1.5 rounded-xl border-r-2 border-sky-500 text-[11px] ${
                                  dark ? "bg-slate-950/70 text-slate-300" : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                <div className="font-bold text-sky-400 text-[10px]">{replyObj.topic || "رد"}</div>
                                <div className="truncate opacity-85">{replyObj.msg}</div>
                              </div>
                            )}

                            {/* Message Body */}
                            {m.msg && (
                              <div
                                className="text-sm leading-relaxed break-words"
                                style={{
                                  color:
                                    m.mcol && m.mcol !== "#000000" && !dark
                                      ? normalizeHexColor(m.mcol)
                                      : undefined,
                                }}
                              >
                                <SafeRichText text={m.msg} />
                              </div>
                            )}

                            {/* Media Attachment */}
                            {m.file && <AttachmentRenderer file={m.file} fileType={m.fileType} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Typing Bar */}
      {typingNames.length > 0 && (
        <div
          className={`px-4 py-1 text-[11px] text-sky-400 font-medium border-t shrink-0 ${
            dark ? "bg-slate-900/70 border-slate-800/60" : "bg-slate-50 border-slate-200"
          }`}
        >
          {typingNames.slice(0, 3).join("، ")} {typingNames.length === 1 ? "يكتب الآن..." : "يكتبون الآن..."}
        </div>
      )}

      {/* Jump to Latest Button */}
      {!atBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 left-4 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg transition"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>{unreadCount > 0 ? `رسائل جديدة (${unreadCount})` : "الأسفل"}</span>
        </button>
      )}
    </div>
  );
}
