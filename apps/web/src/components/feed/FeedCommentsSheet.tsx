import { useState, useRef, useEffect } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Heart,
  Send,
  CornerDownLeft,
  Smile,
  Mic,
  Eye,
  Check,
} from "lucide-react";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { VerifiedBadge } from "../VerifiedBadge.js";
import type { FeedCommentsSheetProps, FeedComment } from "./feedTypes.js";

const QUICK_EMOJIS = ["🎵", "😂", "😮", "😍", "😢", "👏", "🔥", "🙌", "❤️"];

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} ي`;
}

export function FeedCommentsSheet({
  dark,
  postId,
  postAuthor,
  postViewsCount = 0,
  comments,
  isLoading,
  replyingTo,
  isPosting,
  currentAuthor,
  onClose,
  onSetReplyingTo,
  onAddComment,
  onLikeComment,
}: FeedCommentsSheetProps) {
  const [content, setContent] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  if (!postId) return null;

  const toggleRepliesVisibility = (commentId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const handleSend = async () => {
    if (!content.trim() || isPosting) return;
    const textToSend = content;
    setContent("");
    const ok = await onAddComment(textToSend);
    if (!ok) {
      setContent(textToSend); // restore on failure
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleQuickEmojiClick = (emoji: string) => {
    setContent((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div
        dir="rtl"
        className={`relative w-full mx-auto max-w-xl flex flex-col rounded-t-3xl shadow-2xl transition-all duration-300 z-10 ${
          isFullscreen ? "h-[94vh]" : "h-[75vh]"
        } ${dark ? "bg-slate-900 text-slate-100 border-t border-slate-800" : "bg-white text-slate-900 border-t border-slate-200"}`}
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-400/40 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-slate-500"
              aria-label={isFullscreen ? "تصغير" : "تكبير"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          <h3 className="text-base font-bold text-center">
            التعليقات
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ms-1">
              ({comments.length})
            </span>
          </h3>

          <div className="w-10" />
        </div>

        {/* Pinned Post Author Snapshot (Matches Reference Image 2 & 3) */}
        {postAuthor && (
          <div
            className={`flex items-center justify-between px-4 py-2.5 mx-3 mt-2 rounded-xl text-xs font-medium border ${
              dark
                ? "bg-slate-950/40 border-slate-800/80 text-slate-300"
                : "bg-slate-50 border-slate-200/80 text-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <img
                src={resolveAssetUrl(postAuthor.pic)}
                alt={postAuthor.topic}
                className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700"
              />
              <span className="font-bold">{postAuthor.topic}</span>
              {Boolean(postAuthor.documentationc) && <VerifiedBadge size="xs" />}
              <span className="text-[11px] text-slate-400">@{postAuthor.username}</span>
            </div>

            {postViewsCount > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Eye className="w-3.5 h-3.5" />
                <span>{postViewsCount} مشاهدة</span>
              </div>
            )}
          </div>
        )}

        {/* Comments Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 chat-scroll">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-slate-400">
              <div className="w-7 h-7 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
              <span>جارٍ تحميل التعليقات...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <span className="text-4xl mb-2">💬</span>
              <h4 className="text-sm font-bold">لا توجد تعليقات بعد</h4>
              <p className="text-xs text-slate-400 mt-1">كن أول من يشارك برأيه على هذا المنشور</p>
            </div>
          ) : (
            comments.map((comment) => {
              const hasReplies = comment.replies && comment.replies.length > 0;
              const isRepliesOpen = expandedComments.has(comment.commentId);

              return (
                <div key={comment.commentId} className="flex flex-col gap-2">
                  {/* Top-Level Comment */}
                  <div className="flex items-start gap-3">
                    <img
                      src={resolveAssetUrl(comment.author.pic)}
                      alt={comment.author.topic}
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold">{comment.author.topic}</span>
                        {Boolean(comment.author.documentationc) && <VerifiedBadge size="xs" />}
                        <span className="text-[11px] text-slate-400">@{comment.author.username}</span>
                        <span className="text-[10px] text-slate-400">· {formatTimeAgo(comment.createdAt)}</span>
                      </div>

                      <p className="text-xs leading-relaxed mt-1 break-words">{comment.content}</p>

                      <div className="flex items-center gap-4 mt-1.5 text-[11px] font-semibold text-slate-400">
                        <button
                          type="button"
                          onClick={() =>
                            onSetReplyingTo({
                              commentId: comment.commentId,
                              authorTopic: comment.author.topic,
                              authorUsername: comment.author.username,
                              authorUid: comment.author.uid,
                            })
                          }
                          className="hover:text-rose-500 transition-colors"
                        >
                          رد
                        </button>
                      </div>
                    </div>

                    {/* Like Comment Heart */}
                    <button
                      type="button"
                      onClick={() => onLikeComment(comment.commentId)}
                      className={`flex flex-col items-center gap-0.5 p-1 shrink-0 transition-transform active:scale-125 ${
                        comment.isLiked ? "text-rose-500" : "text-slate-400 hover:text-slate-500"
                      }`}
                      aria-label="إعجاب بالتعليق"
                    >
                      <Heart className={`w-3.5 h-3.5 ${comment.isLiked ? "fill-rose-500" : ""}`} />
                      {comment.likesCount > 0 && (
                        <span className="text-[10px] font-bold">{comment.likesCount}</span>
                      )}
                    </button>
                  </div>

                  {/* Threaded Nested Replies */}
                  {hasReplies && (
                    <div className="ms-6 ps-3 border-s-2 border-slate-200 dark:border-slate-800 flex flex-col gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => toggleRepliesVisibility(comment.commentId)}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1 py-1"
                      >
                        <CornerDownLeft className="w-3 h-3 text-rose-500" />
                        <span>
                          {isRepliesOpen
                            ? "إخفاء الردود ▴"
                            : `عرض الردود (${comment.replies!.length}) ▾`}
                        </span>
                      </button>

                      {isRepliesOpen &&
                        comment.replies!.map((reply) => (
                          <div key={reply.commentId} className="flex items-start gap-2.5 pt-1.5">
                            <img
                              src={resolveAssetUrl(reply.author.pic)}
                              alt={reply.author.topic}
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-800"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold">{reply.author.topic}</span>
                                {Boolean(reply.author.documentationc) && <VerifiedBadge size="xs" />}
                                <span className="text-[10px] text-slate-400">· {formatTimeAgo(reply.createdAt)}</span>
                              </div>
                              <p className="text-xs leading-relaxed mt-0.5 break-words">
                                {reply.replyToUsername && (
                                  <span className="text-rose-500 font-bold me-1">
                                    @{reply.replyToUsername}
                                  </span>
                                )}
                                {reply.content}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-[10px] font-semibold text-slate-400">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetReplyingTo({
                                      commentId: comment.commentId,
                                      authorTopic: reply.author.topic,
                                      authorUsername: reply.author.username,
                                      authorUid: reply.author.uid,
                                    })
                                  }
                                  className="hover:text-rose-500 transition-colors"
                                >
                                  رد
                                </button>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onLikeComment(reply.commentId)}
                              className={`flex flex-col items-center gap-0.5 p-1 shrink-0 ${
                                reply.isLiked ? "text-rose-500" : "text-slate-400"
                              }`}
                            >
                              <Heart className={`w-3 h-3 ${reply.isLiked ? "fill-rose-500" : ""}`} />
                              {reply.likesCount > 0 && (
                                <span className="text-[9px] font-bold">{reply.likesCount}</span>
                              )}
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Quick Emoji Bar (Matches Reference Image 2 & 3) */}
        <div
          className={`flex items-center justify-between px-3 py-1.5 border-t border-slate-200/60 dark:border-slate-800/60 shrink-0 overflow-x-auto ${
            dark ? "bg-slate-950/60" : "bg-slate-50/80"
          }`}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleQuickEmojiClick(emoji)}
              className="text-lg p-1 hover:scale-125 transition-transform active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Replying Banner */}
        {replyingTo && (
          <div className="flex items-center justify-between px-4 py-1.5 bg-rose-500/10 border-t border-rose-500/20 text-xs font-semibold text-rose-500 shrink-0">
            <span>الرد على @{replyingTo.authorUsername || replyingTo.authorTopic}</span>
            <button
              type="button"
              onClick={() => onSetReplyingTo(null)}
              className="p-1 hover:text-rose-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Sticky Comment Input Bar */}
        <div
          className={`p-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2.5 shrink-0 ${
            dark ? "bg-slate-900" : "bg-white"
          }`}
        >
          {currentAuthor && (
            <img
              src={resolveAssetUrl(currentAuthor.pic)}
              alt="You"
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-300 dark:border-slate-700"
            />
          )}

          <div
            className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
              dark
                ? "bg-slate-950 border-slate-800 focus-within:border-rose-500"
                : "bg-slate-100 border-slate-300 focus-within:border-rose-500"
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyingTo ? `الرد على @${replyingTo.authorUsername}...` : "اكتب تعليقاً..."}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
              maxLength={1000}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={!content.trim() || isPosting}
              className={`p-1.5 rounded-full transition-transform active:scale-95 ${
                content.trim() && !isPosting
                  ? "bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white shadow-sm"
                  : "text-slate-400 opacity-50 cursor-not-allowed"
              }`}
              aria-label="إرسال"
            >
              <Send className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
