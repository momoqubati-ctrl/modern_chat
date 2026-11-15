import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Gift, MessageCircle, Search, UserCheck } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot } from "@newchat/shared";
import { MemberAvatar, MemberBadgesInline, MemberPrefixIcons, getStatusLabel } from "./MemberAvatar.js";
import { adjustColorForTheme, getCountryNameArabic, resolveCountryFlagUrl } from "../lib/mediaUrl.js";
import { getUserCover, getUserTheme } from "../lib/userCosmetics.js";

interface VirtualizedMembersListProps {
  dark: boolean;
  usersMap: Record<string, OnlineUserSnapshot>;
  userIds: string[];
  myId?: string;
  onSelectUser: (user: OnlineUserSnapshot) => void;
  onSelectPrivateChat: (user: OnlineUserSnapshot) => void;
  onSelectGift: (user: OnlineUserSnapshot) => void;
}

export function VirtualizedMembersList({
  dark,
  usersMap,
  userIds,
  myId,
  onSelectUser,
  onSelectPrivateChat,
  onSelectGift,
}: VirtualizedMembersListProps) {
  const [query, setQuery] = useState("");
  const parentRef = useRef<HTMLDivElement | null>(null);
  const powers = useChatStore((s) => s.powers);
  const speakingUsers = useChatStore((s) => s.speakingUsers);
  const stageState = useChatStore((s) => s.stageState);
  const stageMutedUsers =
    stageState.mutedUsers && typeof stageState.mutedUsers === "object"
      ? (stageState.mutedUsers as Record<string, boolean>)
      : {};

  const filteredIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return userIds;
    return userIds.filter((id) => {
      const u = usersMap[id];
      return (
        u &&
        (u.topic?.toLowerCase().includes(q) ||
          u.msg?.toLowerCase().includes(q) ||
          u.power?.toLowerCase().includes(q) ||
          String(u.idreg || "").includes(q))
      );
    });
  }, [query, userIds, usersMap]);

  const virtualizer = useVirtualizer({
    count: filteredIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 86,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-slate-800/30 shrink-0">
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
            dark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
          }`}
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`بحث في ${userIds.length} متواجد...`}
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto px-2 py-2 chat-scroll">
        {filteredIds.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-8">لا توجد نتائج مطابقة</div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const id = filteredIds[row.index]!;
              const u = usersMap[id];
              if (!u) return null;
              const isMe = u.id === myId;
              const isBot = u.islogin === "بوت";
              const userTheme = getUserTheme(u, powers);
              const userCover = getUserCover(u, powers) || u.cover;

              return (
                <div
                  key={row.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${row.size}px`,
                    transform: `translateY(${row.start}px)`,
                  }}
                  className="px-1 py-1"
                >
                  <div
                    dir="ltr"
                    onClick={() => onSelectUser(u)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelectUser(u);
                    }}
                    style={{
                      backgroundImage: userTheme ? `url("${userTheme}")` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    className={`h-full flex items-center gap-3 rounded-2xl px-2.5 py-2 border transition cursor-pointer relative overflow-hidden ${
                      isMe
                        ? dark
                          ? userTheme
                            ? "border-sky-500/50 shadow-xs"
                            : "bg-sky-500/10 border-sky-500/30"
                          : userTheme
                            ? "border-sky-400 shadow-xs"
                            : "bg-sky-50 border-sky-200"
                        : dark
                          ? userTheme
                            ? "border-slate-700/80 hover:border-sky-500/40"
                            : "bg-slate-900/70 border-slate-800/80 hover:border-sky-500/40"
                          : userTheme
                            ? "border-slate-300 hover:border-sky-300"
                            : "bg-white border-slate-200 hover:border-sky-300"
                    }`}
                  >
                    {userTheme && (
                      <div
                        className={`absolute inset-0 pointer-events-none transition-opacity ${
                          dark
                            ? isMe
                              ? "bg-gradient-to-r from-slate-950/85 via-slate-950/70 to-sky-950/50"
                              : "bg-gradient-to-r from-slate-950/80 via-slate-950/65 to-slate-950/45"
                            : isMe
                              ? "bg-gradient-to-r from-white/90 via-white/80 to-sky-50/65"
                              : "bg-gradient-to-r from-white/85 via-white/75 to-white/55"
                        }`}
                      />
                    )}
                    <div className="relative z-[1] shrink-0">
                      <MemberAvatar
                        pic={u.pic}
                        cover={userCover}
                        topic={u.topic}
                        stat={u.stat}
                        offline={u.offline}
                        speaking={Boolean(speakingUsers[u.id] && !stageMutedUsers[u.id] && !u.muted)}
                        size="lg"
                        statusPosition="right"
                      />
                    </div>

                    <div className="relative z-[1] min-w-0 flex-1 text-left flex flex-col justify-center gap-1">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* 1. Gift & Banner Prefix Icons (matching chetos216-08-2024 u-titleline) */}
                          <MemberPrefixIcons user={u} powers={powers} size="md" />

                          {/* 2. Username */}
                          <span
                            dir="auto"
                            className="text-xs font-extrabold truncate"
                            style={{
                              color: adjustColorForTheme(u.ucol, dark, {
                                fallbackDark: "#38bdf8",
                                fallbackLight: "#0369a1",
                              }),
                              backgroundColor:
                                u.bg && u.bg.toLowerCase() !== "#ffffff" && u.bg.toLowerCase() !== "none"
                                  ? u.bg
                                  : undefined,
                            }}
                          >
                            {u.topic}
                          </span>

                          {/* 3. Badges (Verified & SiteBadge after username) */}
                          <MemberBadgesInline user={u} showFlag={false} showIco={false} showGift={false} />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {resolveCountryFlagUrl(u.co) && (
                            <img
                              src={resolveCountryFlagUrl(u.co)}
                              alt={getCountryNameArabic(u.co)}
                              title={getCountryNameArabic(u.co)}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                              className="w-4.5 h-3 rounded-[2px] object-cover shrink-0 border border-slate-700/40 shadow-xs"
                            />
                          )}
                          {Number(u.idreg || 0) > 0 && (
                            <span className="text-[10px] font-bold text-slate-400">
                              #{u.idreg}
                            </span>
                          )}
                          {isMe && (
                            <span className="inline-flex items-center text-sky-400" title="أنت">
                              <UserCheck className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 min-w-0">
                          <span dir="auto" className="truncate">
                            {u.msg || getStatusLabel(u.stat, u.offline)}
                          </span>
                          {isBot && (
                            <span className="px-1.5 py-0 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold shrink-0">
                              بوت
                            </span>
                          )}
                        </div>

                        {!isMe && !isBot && (
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectPrivateChat(u)}
                              className="p-1 rounded-lg hover:bg-sky-500/15 text-sky-400 transition"
                              title="محادثة خاصة"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectGift(u)}
                              className="p-1 rounded-lg hover:bg-amber-500/15 text-amber-400 transition"
                              title="إرسال هدية"
                            >
                              <Gift className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
