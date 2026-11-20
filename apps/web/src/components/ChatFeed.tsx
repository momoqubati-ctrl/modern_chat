import { memo, useCallback, useEffect, useRef, useState } from "react";
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
import {
  adjustColorForTheme,
  formatTimeArabic,
  normalizeHexColor,
  resolveAssetUrl,
} from "../lib/mediaUrl.js";
import { hasRoleFlag } from "../lib/permissions.js";
import { AttachmentRenderer, detectAttachmentTypeFromPath, SafeRichText } from "../lib/richContent.js";
import { playSoundCue } from "../lib/soundFx.js";
import { getUserGiftIco, getUserIco } from "../lib/userCosmetics.js";
import { MemberAvatar } from "./MemberAvatar.js";
import { VerifiedBadge, isUserVerified } from "./VerifiedBadge.js";

interface ChatFeedProps {
  dark: boolean;
  onReply: (message: RoomMessagePayload) => void;
  onSelectUser: (user: OnlineUserSnapshot) => void;
  stageLayoutMode?: "hidden" | "collapsed" | "expanded";
}

type ChatRowMessage = RoomMessagePayload & {
  actionType?: string;
  targetRoomId?: string;
  targetRoomTopic?: string;
};

interface ChatMessageRowProps {
  m: ChatRowMessage;
  dark: boolean;
  isBubbleMode: boolean;
  canDeleteMessages: boolean;
  replyEnabled: boolean;
  isMine: boolean;
  isMentioningMe: boolean;
  isVerified: boolean;
  replyVerified: boolean;
  speaking: boolean;
  senderIco: string;
  senderGiftIco: string;
  likeAnimating: boolean;
  onSenderClick: (msg: RoomMessagePayload) => void;
  onReply: (msg: RoomMessagePayload) => void;
  onLike: (msg: RoomMessagePayload) => void;
  onDelete: (msg: RoomMessagePayload) => void;
  onJoinRoom: (roomId: string) => void;
}

/**
 * A single chat message row — memoized.
 *
 * All props are either primitives or stable references, so a row only
 * re-renders when its own message object, its speaking/mention state, or the
 * like-animation flag actually changes. Incoming messages, typing indicators,
 * presence updates and mic pulses no longer repaint the whole visible feed.
 */
const ChatMessageRow = memo(function ChatMessageRow({
  m,
  dark,
  isBubbleMode,
  canDeleteMessages,
  replyEnabled,
  isMine,
  isMentioningMe,
  isVerified,
  replyVerified,
  speaking,
  senderIco,
  senderGiftIco,
  likeAnimating,
  onSenderClick,
  onReply,
  onLike,
  onDelete,
  onJoinRoom,
}: ChatMessageRowProps) {
  const messageId = m.mi || m.id || "";
  const cls = String(m.class || "");
  const isHmsg = cls === "hmsg";
  const isWelcome = cls === "room-welcome-msg";
  const isWinner = cls === "brb-winner-msg";
  const isBot = cls === "brb-bot-msg" || m.uid === "bot_competition";
  const replyObj = (m.reply || m.replyTo) as
    | { topic?: string; msg?: string }
    | null
    | undefined;
  const likesCount = Array.isArray(m.likes) ? m.likes.length : 0;
  const hasAudioAttachment = Boolean(
    m.file && (m.fileType === "audio" || detectAttachmentTypeFromPath(m.file) === "audio"),
  );

  return isHmsg ? (
    <div dir="ltr" className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onSenderClick(m)}
        className="shrink-0 mt-0.5"
      >
        <MemberAvatar pic={m.pic} topic={m.topic} size="md" showStatus={false} />
      </button>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {/* 1. Gift Icon before banner/name (matching chetos216-08-2024 umsg) */}
            {senderGiftIco && (
              <img
                src={senderGiftIco}
                alt="هدية"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="w-[18px] h-[18px] min-w-[18px] max-h-[18px] object-contain shrink-0"
              />
            )}
            {/* 2. Banner (u-ico: natural width, proper height, object-contain, matching chetos216-08-2024) */}
            {senderIco && (
              <img
                src={senderIco}
                alt=""
                title="بنر العضو"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="h-[18px] max-h-[20px] w-auto max-w-[140px] object-contain shrink-0"
              />
            )}
            {/* 3. Name */}
            <button
              type="button"
              onClick={() => onSenderClick(m)}
              dir="auto"
              className={`text-xs font-extrabold hover:underline truncate ${
                dark ? "text-sky-400" : "text-sky-800"
              }`}
            >
              {m.topic}
            </button>
            {/* 4. Verified Badge */}
            {isVerified && <VerifiedBadge size="xs" />}
          </div>
          {m.time && (
            <span className={`ms-auto text-[10px] font-semibold shrink-0 ${
              dark ? "text-slate-400" : "text-slate-600"
            }`}>
              {formatTimeArabic(m.time)}
            </span>
          )}
        </div>

        <div
          className={`inline-flex flex-wrap items-center gap-2 rounded-2xl rounded-tl-none px-3 py-1.5 border text-xs ${
            dark
              ? "bg-teal-950/50 border-teal-500/30 text-teal-200"
              : "bg-teal-50 border-teal-200 text-teal-900 font-medium"
          }`}
        >
          <span dir="auto">{m.msg}</span>
          {m.targetRoomTopic && m.targetRoomId && (
            <button
              type="button"
              onClick={() => onJoinRoom(m.targetRoomId!)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 font-bold transition"
            >
              <DoorOpen className="w-3 h-3" />
              <span>{m.targetRoomTopic}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  ) : isWelcome ? (
    <div dir="ltr" className="flex items-start gap-3">
      <img
        src={resolveAssetUrl(m.pic, "picroom", "/room.png")}
        alt={m.topic}
        className="w-11 h-11 rounded-full object-cover border border-teal-500/30 shrink-0 mt-0.5"
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div dir="auto" className={`font-extrabold text-xs flex items-center gap-1.5 ${
            dark ? "text-teal-400" : "text-teal-800"
          }`}>
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>رسالة ترحيب • {m.topic}</span>
          </div>
          {m.time && (
            <span className={`ms-auto text-[10px] font-semibold shrink-0 ${
              dark ? "text-slate-400" : "text-slate-600"
            }`}>
              {formatTimeArabic(m.time)}
            </span>
          )}
        </div>
        <div
          dir="auto"
          className={`inline-block max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-tl-none px-3.5 py-2 border text-xs leading-relaxed break-words ${
            dark
              ? "bg-teal-500/10 border-teal-500/30 text-teal-200"
              : "bg-teal-50 border-teal-300 text-teal-950 font-medium"
          }`}
        >
          <SafeRichText text={m.msg} dark={dark} />
        </div>
      </div>
    </div>
  ) : isBot || isWinner ? (
    <div dir="ltr" className="flex items-start gap-3">
      <img
        src={resolveAssetUrl(m.pic || "/imgs/brb-bot.svg", "imgs", "/pic.png")}
        alt={m.topic}
        className="w-11 h-11 rounded-full object-cover border border-amber-500/40 shrink-0 mt-0.5"
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span dir="auto" className={`text-xs font-extrabold inline-flex items-center gap-1 ${
            dark ? "text-amber-400" : "text-amber-800"
          }`}>
            {isWinner && <Trophy className="w-3.5 h-3.5" />}
            {m.topic || "مسابقة الغرفة"}
          </span>
          {m.time && (
            <span className={`ms-auto text-[10px] font-semibold shrink-0 ${
              dark ? "text-slate-400" : "text-slate-600"
            }`}>
              {formatTimeArabic(m.time)}
            </span>
          )}
        </div>
        <div
          dir="auto"
          className={`inline-block max-w-[90%] sm:max-w-[82%] rounded-2xl rounded-tl-none px-3.5 py-2 border text-sm font-bold leading-relaxed break-words ${
            isWinner
              ? "bg-gradient-to-l from-amber-500/20 to-emerald-500/15 border-amber-500/40"
              : dark
                ? "bg-amber-500/10 border-amber-500/25 text-amber-200"
                : "bg-amber-50 border-amber-300 text-amber-950 font-semibold"
          }`}
        >
          <SafeRichText text={m.msg} dark={dark} />
        </div>
      </div>
    </div>
  ) : (
    <div dir="ltr" className="flex items-start gap-3 group">
      <button
        type="button"
        onClick={() => onSenderClick(m)}
        className="shrink-0 mt-0.5"
      >
        <MemberAvatar
          pic={m.pic}
          topic={m.topic}
          speaking={speaking}
          size="md"
          showStatus={false}
        />
      </button>

      <div className="min-w-0 flex-1 text-left">
        {/* Sender Row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {/* 1. Gift Icon before banner/name (matching chetos216-08-2024 umsg) */}
            {senderGiftIco && (
              <img
                src={senderGiftIco}
                alt="هدية"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="w-[18px] h-[18px] min-w-[18px] max-h-[18px] object-contain shrink-0"
              />
            )}
            {/* 2. Banner (u-ico: natural width, proper height, object-contain, matching chetos216-08-2024) */}
            {senderIco && (
              <img
                src={senderIco}
                alt=""
                title="بنر العضو"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="h-[18px] max-h-[20px] w-auto max-w-[140px] object-contain shrink-0"
              />
            )}
            {/* 3. Name */}
            <button
              type="button"
              onClick={() => onSenderClick(m)}
              dir="auto"
              className="text-xs font-extrabold hover:underline truncate"
              style={{
                color: adjustColorForTheme(m.ucol, dark, {
                  fallbackDark: "#38bdf8",
                  fallbackLight: "#0369a1",
                }),
              }}
            >
              {m.topic}
            </button>
            {/* 4. Verified Badge */}
            {isVerified && <VerifiedBadge size="xs" />}
          </div>

          {m.time && (
            <span className={`ms-auto text-[10px] font-semibold shrink-0 ${
              dark ? "text-slate-400" : "text-slate-600"
            }`}>
              {formatTimeArabic(m.time)}
            </span>
          )}
        </div>

        {/* Bubble + Actions */}
        <div className="flex items-center gap-2">
          <div
            className={`${
              hasAudioAttachment
                ? "block min-w-0 flex-1 max-w-full sm:max-w-[520px]"
                : "inline-block max-w-[88%] sm:max-w-[82%]"
            } rounded-2xl rounded-tl-none px-3.5 py-2 border transition ${
              isMentioningMe
                ? dark
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                  : "border-amber-400 bg-amber-50 text-amber-950"
                : isBubbleMode && isMine
                  ? dark
                    ? "bg-indigo-600/25 border-indigo-500/40 text-slate-100"
                    : "bg-indigo-50 border-indigo-200 text-slate-900"
                  : dark
                    ? "bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-100"
                    : "bg-white border-slate-200 shadow-xs text-slate-900"
            }`}
            style={{
              borderLeftWidth: m.bg && m.bg !== "#FFFFFF" ? "3px" : undefined,
              borderLeftColor:
                m.bg && m.bg !== "#FFFFFF"
                  ? adjustColorForTheme(m.bg, dark, { fallbackDark: "#38bdf8", fallbackLight: "#0284c7" })
                  : undefined,
            }}
          >
            {/* Quoted Reply */}
            {replyObj && (replyObj.topic || replyObj.msg) && (
              <div
                dir="auto"
                className={`mb-1.5 px-2.5 py-1.5 rounded-xl border-l-2 border-sky-500 text-[11px] ${
                  dark ? "bg-slate-950/70 text-slate-300" : "bg-slate-100 text-slate-800"
                }`}
              >
                <div className={`font-bold text-[10px] flex items-center gap-1 ${
                  dark ? "text-sky-400" : "text-sky-800"
                }`}>
                  <span>{replyObj.topic || "رد"}</span>
                  {replyVerified && <VerifiedBadge size="xs" />}
                </div>
                <div className={`truncate font-medium ${dark ? "opacity-85 text-slate-200" : "text-slate-700"}`}>
                  <SafeRichText text={replyObj.msg} dark={dark} />
                </div>
              </div>
            )}

            {/* Message Body */}
            {m.msg && (
              <div
                dir="auto"
                className="text-sm leading-relaxed break-words font-normal"
                style={{
                  color: m.mcol && m.mcol !== "#000000"
                    ? adjustColorForTheme(m.mcol, dark, {
                        fallbackDark: "#f1f5f9",
                        fallbackLight: "#0f172a",
                      })
                    : undefined,
                }}
              >
                <SafeRichText text={m.msg} dark={dark} />
              </div>
            )}

            {/* Media Attachment */}
            {m.file && <AttachmentRenderer file={m.file} fileType={m.fileType} dark={dark} />}
          </div>

          {/* Message Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-75 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
            {replyEnabled && (
              <button
                type="button"
                onClick={() => onReply(m)}
                title="رد على الرسالة"
                className={`p-1.5 rounded-full border transition ${
                  dark
                    ? "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-sky-400 hover:border-sky-500/40"
                    : "border-slate-200 bg-white text-slate-500 hover:text-sky-600"
                }`}
              >
                <Reply className="w-3 h-3" />
              </button>
            )}

            {messageId && (
              <button
                type="button"
                onClick={() => onLike(m)}
                title="إعجاب بالرسالة"
                className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded-full border text-[10px] transition active:scale-90 ${
                  likeAnimating ? "animate-action-pop" : ""
                } ${
                  likesCount > 0
                    ? "bg-rose-500/15 border-rose-500/35 text-rose-400 font-bold"
                    : dark
                      ? "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-rose-400 hover:border-rose-500/35"
                      : "border-slate-200 bg-white text-slate-500 hover:text-rose-500"
                }`}
              >
                <Heart className={`w-3 h-3 ${likeAnimating || likesCount > 0 ? "fill-rose-400" : ""}`} />
                {likesCount > 0 && <span>{likesCount}</span>}
              </button>
            )}

            {canDeleteMessages && messageId && (
              <button
                type="button"
                onClick={() => onDelete(m)}
                title="حذف الرسالة"
                className={`p-1.5 rounded-full border transition ${
                  dark
                    ? "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-rose-400 hover:border-rose-500/35"
                    : "border-slate-200 bg-white text-slate-500 hover:text-rose-600"
                }`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export function ChatFeed({
  dark,
  onReply,
  onSelectUser,
  stageLayoutMode = "hidden",
}: ChatFeedProps) {
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
  const pushNotice = useChatStore((s) => s.pushNotice);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [animatingMsgId, setAnimatingMsgId] = useState<string | null>(null);
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

  // Refs keep the memoized rows' callbacks stable even when props/state churn.
  const onlineMapRef = useRef(onlineMap);
  onlineMapRef.current = onlineMap;
  const onSelectUserRef = useRef(onSelectUser);
  onSelectUserRef.current = onSelectUser;
  const onReplyPropRef = useRef(onReply);
  onReplyPropRef.current = onReply;

  const handleSenderClick = useCallback((msg: RoomMessagePayload) => {
    const online = onlineMapRef.current;
    const matched =
      (msg.id && online[msg.id]) ||
      (msg.uid && Object.values(online).find((u) => u.uid === msg.uid || u.id === msg.uid)) ||
      null;
    if (matched) {
      onSelectUserRef.current(matched);
      return;
    }
    if (msg.uid === "bot_competition" || msg.class === "room-welcome-msg") return;
    onSelectUserRef.current({
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
      documents: isUserVerified(msg, online),
      documentationc: isUserVerified(msg, online),
    });
  }, []);

  const handleReplyClick = useCallback((msg: RoomMessagePayload) => {
    onReplyPropRef.current(msg);
  }, []);

  const handleLikeClick = useCallback(
    (msg: RoomMessagePayload) => {
      const messageId = msg.mi || msg.id || "";
      if (!messageId) return;
      setAnimatingMsgId(messageId);
      setTimeout(() => setAnimatingMsgId(null), 500);
      likeRoomMessage(messageId);
      pushNotice("تم التفاعل والإعجاب بالرسالة ❤️", { topic: "إعجاب" });
    },
    [likeRoomMessage, pushNotice],
  );

  const handleDeleteClick = useCallback(
    (msg: RoomMessagePayload) => {
      const messageId = msg.mi || msg.id || "";
      if (messageId) deleteRoomMessage(messageId);
    },
    [deleteRoomMessage],
  );

  const typingNames = Object.entries(typingUsers)
    .filter(([sid]) => sid !== me?.id)
    .map(([, name]) => name)
    .filter(Boolean);

  const feedVerticalPad =
    stageLayoutMode === "expanded"
      ? "pt-[118px] pb-3"
      : stageLayoutMode === "collapsed"
        ? "pt-14 pb-3"
        : "py-3";

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto chat-scroll px-3 sm:px-4 ${feedVerticalPad}`}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <MessageSquare className="w-9 h-9 opacity-35" />
            <span>أهلاً بك في {activeRoom?.topic || "الغرفة"} — ابدأ المحادثة الآن</span>
          </div>
        ) : (
          <div
            dir="ltr"
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((vRow) => {
              const m = messages[vRow.index] as ChatRowMessage;
              if (!m) return null;

              const messageId = m.mi || m.id || "";
              const senderUser =
                (m.id && onlineMap[m.id]) ||
                (m.uid && Object.values(onlineMap).find((u) => u.uid === m.uid || u.id === m.uid)) ||
                undefined;
              const senderIco =
                (m.ico && !m.ico.includes("dro3") ? resolveAssetUrl(m.ico, "sico", "") : "") ||
                (senderUser ? getUserIco(senderUser, powers) : "");
              const senderGiftIco =
                (m.gift_ico ? getUserGiftIco({ gift_ico: m.gift_ico }) : "") ||
                (m.ico && m.ico.includes("dro3") ? getUserGiftIco({ gift_ico: m.ico }) : "") ||
                (senderUser ? getUserGiftIco(senderUser) : "");
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
              const isVerified = isUserVerified(m, onlineMap);
              const replyVerified = replyObj ? isUserVerified(replyObj, onlineMap) : false;
              const speaking = Boolean(
                m.id &&
                  speakingUsers[m.id] &&
                  !stageMutedUsers[m.id] &&
                  !onlineMap[m.id]?.muted,
              );

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
                  className="pb-3"
                >
                  <ChatMessageRow
                    m={m}
                    dark={dark}
                    isBubbleMode={isBubbleMode}
                    canDeleteMessages={canDeleteMessages}
                    replyEnabled={siteFlags.reply !== false}
                    isMine={isMine}
                    isMentioningMe={isMentioningMe}
                    isVerified={isVerified}
                    replyVerified={replyVerified}
                    speaking={speaking}
                    senderIco={senderIco}
                    senderGiftIco={senderGiftIco}
                    likeAnimating={animatingMsgId !== null && animatingMsgId === messageId}
                    onSenderClick={handleSenderClick}
                    onReply={handleReplyClick}
                    onLike={handleLikeClick}
                    onDelete={handleDeleteClick}
                    onJoinRoom={joinRoom}
                  />
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
