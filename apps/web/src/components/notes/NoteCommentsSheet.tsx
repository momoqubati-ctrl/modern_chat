import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Heart,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { NoteCommentRecord } from "@newchat/shared";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { canAccessControlPanel } from "../../lib/permissions.js";
import { formatNoteRelativeAge } from "./noteTypes.js";

const QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"] as const;

export interface NoteCommentsSheetProps {
  dark: boolean;
  open: boolean;
  noteNid: string;
  noteAuthorTopic: string;
  noteAuthorPic?: string;
  noteAuthorVerified?: boolean;
  noteAuthorUid?: string;
  noteTag?: string;
  noteType?: "text" | "audio";
  commentsCount: number;
  onClose: () => void;
}

export function NoteCommentsSheet({
  dark,
  open,
  noteNid,
  noteAuthorTopic,
  noteAuthorPic,
  noteAuthorVerified = false,
  noteAuthorUid = "",
  noteTag,
  noteType,
  commentsCount,
  onClose,
}: NoteCommentsSheetProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const noteCommentsMap = useChatStore((s) => s.noteCommentsMap);
  const fetchNoteComments = useChatStore((s) => s.fetchNoteComments);
  const addNoteComment = useChatStore((s) => s.addNoteComment);
  const toggleNoteCommentLike = useChatStore((s) => s.toggleNoteCommentLike);
  const deleteNoteComment = useChatStore((s) => s.deleteNoteComment);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [sortMode, setSortMode] = useState<"newest" | "top">("newest");
  const [expandedHeight, setExpandedHeight] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});
  const [openMenuCid, setOpenMenuCid] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ parentCid: string; topic: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isMember = me?.islogin === "عضو" && Boolean(me?.uid);
  const isAdmin = canAccessControlPanel(me, powers);
  const rawComments = noteCommentsMap[noteNid] || [];

  useEffect(() => {
    if (!open || !noteNid) return;
    fetchNoteComments(noteNid);
  }, [open, noteNid, fetchNoteComments]);

  useEffect(() => {
    if (!open) {
      setReplyTarget(null);
      setOpenMenuCid(null);
    }
  }, [open]);

  const { roots, repliesByParent } = useMemo(() => {
    const parentList: NoteCommentRecord[] = [];
    const childMap: Record<string, NoteCommentRecord[]> = {};

    for (const c of rawComments) {
      const parentCid = c.parentCid || c.parent_cid;
      if (!parentCid) {
        parentList.push(c);
      } else {
        if (!childMap[parentCid]) childMap[parentCid] = [];
        childMap[parentCid]!.push(c);
      }
    }

    // Sort roots
    if (sortMode === "top") {
      parentList.sort((a, b) => {
        const likesA = Number(a.likesCount ?? a.likes_count ?? 0);
        const likesB = Number(b.likesCount ?? b.likes_count ?? 0);
        return likesB - likesA;
      });
    } else {
      parentList.sort(
        (a, b) =>
          Number(b.createdAt ?? b.created_at ?? 0) - Number(a.createdAt ?? a.created_at ?? 0)
      );
    }

    // Sort replies oldest->newest chronologically inside each parent thread
    for (const pid of Object.keys(childMap)) {
      childMap[pid]!.sort(
        (a, b) =>
          Number(a.createdAt ?? a.created_at ?? 0) - Number(b.createdAt ?? b.created_at ?? 0)
      );
    }

    return { roots: parentList, repliesByParent: childMap };
  }, [rawComments, sortMode]);

  if (!open) return null;

  const displayTotal = Math.max(commentsCount, rawComments.length);

  const handleReplyClick = (parentCid: string, authorTopic: string) => {
    setReplyTarget({ parentCid, topic: authorTopic });
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const handleSend = () => {
    const body = inputText.trim();
    if (!body) return;
    if (!isMember) {
      pushNotice("التعليق متاح للأعضاء المسجلين فقط", { force: 1 });
      return;
    }
    addNoteComment(
      noteNid,
      body,
      replyTarget?.parentCid || undefined,
      replyTarget?.topic || undefined
    );
    setInputText("");
    if (replyTarget?.parentCid) {
      setCollapsedParents((prev) => ({ ...prev, [replyTarget.parentCid]: false }));
    }
    setReplyTarget(null);
  };

  const toggleParentCollapse = (cid: string) => {
    setCollapsedParents((prev) => ({ ...prev, [cid]: !prev[cid] }));
  };

  const canDeleteComment = (c: NoteCommentRecord) => {
    const authorUid = c.authorUid || c.author_uid;
    return Boolean(me?.uid && (me.uid === authorUid || me.uid === noteAuthorUid || isAdmin));
  };

  const renderReplyMentionBody = (comment: NoteCommentRecord) => {
    const cleanTopic = (comment.replyToTopic || comment.reply_to_topic || "").trim();
    const parentCid = comment.parentCid || comment.parent_cid;
    return (
      <p
        dir="auto"
        className={`text-[13px] leading-relaxed break-words ${
          dark ? "text-slate-100" : "text-slate-900"
        }`}
      >
        {cleanTopic && parentCid ? (
          <>
            <span className="text-pink-500 font-bold ms-1">@{cleanTopic}</span>{" "}
            <span>{comment.body}</span>
          </>
        ) : (
          comment.body
        )}
      </p>
    );
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="تعليقات الملاحظة"
        className={`w-full max-w-md flex flex-col shadow-2xl border transition-all duration-200 rounded-t-3xl sm:rounded-3xl overflow-hidden ${
          expandedHeight ? "h-[90dvh] sm:h-[85vh]" : "h-[68dvh] sm:h-[72vh]"
        } ${
          dark
            ? "bg-slate-950 border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Top Handle Pill */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className={`w-10 h-1 rounded-full ${dark ? "bg-slate-700" : "bg-slate-300"}`} />
        </div>

        {/* Sheet Header: التعليقات + count + Sort + Expand + Close */}
        <div
          className={`px-4 pb-3 pt-1 flex items-center justify-between border-b shrink-0 ${
            dark ? "border-slate-800" : "border-slate-100"
          }`}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black">التعليقات</h3>
            <span
              className={`text-sm font-extrabold ${
                dark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              {displayTotal}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSortMode((s) => (s === "newest" ? "top" : "newest"))}
              title={sortMode === "newest" ? "الأحدث أولاً" : "الأكثر إعجاباً"}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold transition ${
                dark
                  ? "text-slate-300 hover:bg-slate-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">
                {sortMode === "newest" ? "الأحدث" : "الأفضل"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setExpandedHeight((v) => !v)}
              title={expandedHeight ? "تصغير النافذة" : "توسيع النافذة"}
              className={`rounded-full p-1.5 transition ${
                dark
                  ? "text-slate-300 hover:bg-slate-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {expandedHeight ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق التعليقات"
              className={`rounded-full p-1.5 transition ${
                dark
                  ? "text-slate-300 hover:bg-slate-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Author Summary Row (Matching Instagram & Story Style) */}
        <div
          className={`px-4 py-2.5 flex items-center gap-3 border-b shrink-0 ${
            dark ? "border-slate-800/80 bg-slate-900/40" : "border-slate-100 bg-slate-50/70"
          }`}
        >
          <img
            src={resolveAssetUrl(noteAuthorPic || "pic.png", "pic", "/pic.png")}
            alt={noteAuthorTopic}
            className="w-10 h-10 rounded-full object-cover border border-slate-500/30 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span dir="auto" className="text-sm font-extrabold truncate">
                {noteAuthorTopic || "عضو"}
              </span>
              {noteAuthorVerified && (
                <BadgeCheck className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
              )}
            </div>
            <div className={`text-xs font-semibold ${dark ? "text-slate-400" : "text-slate-500"}`}>
              {noteTag || (noteType === "audio" ? "ملاحظة صوتية" : "ملاحظة نصية")}
            </div>
          </div>
        </div>

        {/* Scrollable Hierarchical Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 chat-scroll">
          {roots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className={`text-sm font-bold ${dark ? "text-slate-400" : "text-slate-500"}`}>
                لا توجد تعليقات بعد
              </p>
              <p className={`text-xs mt-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                كن أول من يضيف تعليقاً على هذه الملاحظة
              </p>
            </div>
          ) : (
            roots.map((parent) => {
              const children = repliesByParent[parent.cid] || [];
              const hasReplies = children.length > 0;
              const isCollapsed = Boolean(collapsedParents[parent.cid]);
              const showTreeTrunk = hasReplies && !isCollapsed;
              const parentTopic = parent.authorTopic || parent.author_topic || "عضو";
              const parentPic = parent.authorPic || parent.author_pic;
              const parentUcol = parent.authorUcol || parent.author_ucol;
              const parentVerified = parent.authorVerified || parent.author_verified;
              const parentLiked = parent.likedByMe || parent.liked_by_me;
              const parentLikesCount = Number(parent.likesCount ?? parent.likes_count ?? 0);
              const parentTime = parent.createdAt ?? parent.created_at;

              return (
                <div key={parent.cid} className="relative">
                  {/* Parent Comment Row */}
                  <div className="flex items-stretch gap-2.5">
                    {/* Right Column (Avatar + Tree Line down into children) */}
                    <div className="relative flex flex-col items-center w-9 shrink-0">
                      <img
                        src={resolveAssetUrl(parentPic || "pic.png", "pic", "/pic.png")}
                        alt={parentTopic}
                        className="w-9 h-9 rounded-full object-cover border border-slate-500/30 z-10 shrink-0"
                      />
                      {showTreeTrunk && (
                        <div
                          aria-hidden="true"
                          className={`w-[1.5px] flex-1 mt-1 ${
                            dark ? "bg-slate-700" : "bg-slate-300"
                          }`}
                        />
                      )}
                    </div>

                    {/* Parent Content & Actions */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          dir="auto"
                          className="text-xs font-extrabold truncate"
                          style={
                            parentUcol && (!dark || parentUcol.toLowerCase() !== "#000000")
                              ? { color: parentUcol }
                              : undefined
                          }
                        >
                          {parentTopic}
                        </span>
                        {parentVerified && (
                          <BadgeCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                        )}
                      </div>

                      <div className="mt-0.5">{renderReplyMentionBody(parent)}</div>

                      {/* Parent Action Row: رد pill + Heart + Time + ... */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleReplyClick(parent.cid, parentTopic)}
                            className={`px-3 py-0.5 rounded-full text-[11px] font-bold transition ${
                              dark
                                ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            رد
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const willLike = !parentLiked;
                              toggleNoteCommentLike(noteNid, parent.cid);
                              pushNotice(
                                willLike
                                  ? "تم التفاعل والإعجاب بالتعليق ❤️"
                                  : "تم إلغاء الإعجاب بالتعليق",
                                { topic: "إعجاب" }
                              );
                            }}
                            className={`inline-flex items-center gap-1 text-xs font-bold transition active:scale-90 ${
                              parentLiked
                                ? "text-rose-500 animate-action-pop"
                                : dark
                                  ? "text-slate-400 hover:text-rose-400"
                                  : "text-slate-500 hover:text-rose-500"
                            }`}
                          >
                            <Heart
                              className={`w-4 h-4 ${parentLiked ? "fill-rose-500 text-rose-500" : ""}`}
                            />
                            {parentLikesCount > 0 && <span>{parentLikesCount}</span>}
                          </button>

                          <span
                            className={`text-[11px] font-semibold ${
                              dark ? "text-slate-500" : "text-slate-400"
                            }`}
                          >
                            {formatNoteRelativeAge(parentTime)}
                          </span>
                        </div>

                        {canDeleteComment(parent) && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuCid((cur) => (cur === parent.cid ? null : parent.cid))
                              }
                              aria-label="خيارات التعليق"
                              className={`px-2 py-0.5 rounded-full transition ${
                                dark
                                  ? "bg-slate-800/80 text-slate-400 hover:text-white"
                                  : "bg-slate-100 text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                            {openMenuCid === parent.cid && (
                              <button
                                type="button"
                                onClick={() => {
                                  deleteNoteComment(noteNid, parent.cid);
                                  setOpenMenuCid(null);
                                }}
                                className="absolute left-0 bottom-7 z-20 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg whitespace-nowrap"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف التعليق</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replies Thread with Curve L-Connector Lines */}
                  {hasReplies && (
                    <div className="relative">
                      {/* Collapse / Expand Replies Pill Row connected to Parent Trunk */}
                      <div className="relative flex items-center pr-9 py-1.5">
                        {!isCollapsed && (
                          <div
                            aria-hidden="true"
                            className={`absolute right-[17px] top-0 bottom-0 w-[1.5px] ${
                              dark ? "bg-slate-700" : "bg-slate-300"
                            }`}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => toggleParentCollapse(parent.cid)}
                          className={`inline-flex items-center gap-1.5 text-xs font-bold transition ${
                            dark
                              ? "text-slate-400 hover:text-slate-200"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <span>
                            {isCollapsed
                              ? children.length === 1
                                ? "عرض رد واحد"
                                : `عرض ${children.length} ردود`
                              : "إخفاء الردود"}
                          </span>
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                              dark ? "bg-slate-800 text-slate-200" : "bg-slate-900 text-white"
                            }`}
                          >
                            {isCollapsed ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronUp className="w-3 h-3" />
                            )}
                          </span>
                        </button>
                      </div>

                      {/* Nested Child Comments */}
                      {!isCollapsed && (
                        <div>
                          {children.map((child, cIdx) => {
                            const isLastChild = cIdx === children.length - 1;
                            const childTopic = child.authorTopic || child.author_topic || "عضو";
                            const childPic = child.authorPic || child.author_pic;
                            const childUcol = child.authorUcol || child.author_ucol;
                            const childVerified = child.authorVerified || child.author_verified;
                            const childLiked = child.likedByMe || child.liked_by_me;
                            const childLikesCount = Number(child.likesCount ?? child.likes_count ?? 0);
                            const childTime = child.createdAt ?? child.created_at;

                            return (
                              <div key={child.cid} className="relative flex items-stretch pr-9 pb-2.5">
                                {!isLastChild && (
                                  <div
                                    aria-hidden="true"
                                    className={`absolute right-[17px] top-0 bottom-0 w-[1.5px] ${
                                      dark ? "bg-slate-700" : "bg-slate-300"
                                    }`}
                                  />
                                )}
                                <div
                                  aria-hidden="true"
                                  className={`absolute right-[17px] top-0 w-4 h-[18px] rounded-br-xl border-r-[1.5px] border-b-[1.5px] ${
                                    dark ? "border-slate-700" : "border-slate-300"
                                  }`}
                                />

                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <img
                                    src={resolveAssetUrl(childPic || "pic.png", "pic", "/pic.png")}
                                    alt={childTopic}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-500/30 shrink-0 mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span
                                        dir="auto"
                                        className="text-xs font-extrabold truncate"
                                        style={
                                          childUcol && (!dark || childUcol.toLowerCase() !== "#000000")
                                            ? { color: childUcol }
                                            : undefined
                                        }
                                      >
                                        {childTopic}
                                      </span>
                                      {childVerified && (
                                        <BadgeCheck className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                                      )}
                                    </div>

                                    <div className="mt-0.5">{renderReplyMentionBody(child)}</div>

                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2.5">
                                        <button
                                          type="button"
                                          onClick={() => handleReplyClick(parent.cid, childTopic)}
                                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition ${
                                            dark
                                              ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                          }`}
                                        >
                                          رد
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const willLike = !childLiked;
                                            toggleNoteCommentLike(noteNid, child.cid);
                                            pushNotice(
                                              willLike
                                                ? "تم التفاعل والإعجاب بالرد ❤️"
                                                : "تم إلغاء الإعجاب بالرد",
                                              { topic: "إعجاب" }
                                            );
                                          }}
                                          className={`inline-flex items-center gap-1 text-xs font-bold transition active:scale-90 ${
                                            childLiked
                                              ? "text-rose-500 animate-action-pop"
                                              : dark
                                                ? "text-slate-400 hover:text-rose-400"
                                                : "text-slate-500 hover:text-rose-500"
                                          }`}
                                        >
                                          <Heart
                                            className={`w-3.5 h-3.5 ${
                                              childLiked ? "fill-rose-500 text-rose-500" : ""
                                            }`}
                                          />
                                          {childLikesCount > 0 && <span>{childLikesCount}</span>}
                                        </button>

                                        <span
                                          className={`text-[11px] font-semibold ${
                                            dark ? "text-slate-500" : "text-slate-400"
                                          }`}
                                        >
                                          {formatNoteRelativeAge(childTime)}
                                        </span>
                                      </div>

                                      {canDeleteComment(child) && (
                                        <div className="relative">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setOpenMenuCid((cur) =>
                                                cur === child.cid ? null : child.cid
                                              )
                                            }
                                            aria-label="خيارات الرد"
                                            className={`px-2 py-0.5 rounded-full transition ${
                                              dark
                                                ? "bg-slate-800/80 text-slate-400 hover:text-white"
                                                : "bg-slate-100 text-slate-500 hover:text-slate-800"
                                            }`}
                                          >
                                            <MoreHorizontal className="w-3.5 h-3.5" />
                                          </button>
                                          {openMenuCid === child.cid && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                deleteNoteComment(noteNid, child.cid);
                                                setOpenMenuCid(null);
                                              }}
                                              className="absolute left-0 bottom-7 z-20 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg whitespace-nowrap"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              <span>حذف الرد</span>
                                            </button>
                                          )}
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
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Sticky Quick Emoji Bar + Comment Composer */}
        <div
          className={`border-t px-3 pt-2 pb-3 space-y-2 shrink-0 ${
            dark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"
          }`}
        >
          {replyTarget && (
            <div
              className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-xs ${
                dark ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-700"
              }`}
            >
              <span>
                الرد على <strong className="text-pink-500">@{replyTarget.topic}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="text-slate-400 hover:text-rose-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Emoji Strip */}
          <div className="flex items-center justify-around px-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setInputText((prev) => `${prev}${emoji}`);
                  inputRef.current?.focus();
                }}
                className="text-xl leading-none transition-transform hover:scale-125 active:scale-95 p-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input & Send */}
          {isMember ? (
            <div className="flex items-center gap-2">
              <img
                src={resolveAssetUrl(me?.pic || "pic.png", "pic", "/pic.png")}
                alt={me?.topic || ""}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-500/30"
              />
              <div
                className={`flex-1 flex items-center rounded-full border px-3.5 py-2 ${
                  dark
                    ? "bg-slate-900 border-slate-800 focus-within:border-sky-500"
                    : "bg-slate-100 border-slate-200 focus-within:border-sky-500"
                }`}
              >
                <input
                  ref={inputRef}
                  type="text"
                  dir="auto"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  maxLength={500}
                  placeholder={
                    replyTarget
                      ? `اكتب رداً على ${replyTarget.topic}...`
                      : "...اكتب تعليقاً"
                  }
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputText.trim()}
                aria-label="إرسال التعليق"
                className="p-2.5 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white transition shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              className={`rounded-2xl py-2 px-3 text-center text-xs font-bold ${
                dark ? "bg-slate-900 text-amber-300" : "bg-amber-50 text-amber-700"
              }`}
            >
              التعليق متاح للأعضاء المسجلين فقط
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
