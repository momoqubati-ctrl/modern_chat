import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Bookmark,
  Gift,
  MoreHorizontal,
  Music,
  Trash2,
  Share2,
} from "lucide-react";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { VerifiedBadge } from "../VerifiedBadge.js";
import { FeedMediaViewer } from "./FeedMediaViewer.js";
import { HashtagText } from "./HashtagText.js";
import type { FeedPostCardProps } from "./feedTypes.js";

function formatRelativeTimeArabic(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 3600000);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} ${days === 1 ? "يوم" : days === 2 ? "يومين" : "أيام"}`;
  const months = Math.floor(days / 30);
  return `منذ ${months} شهر`;
}

export function FeedPostCard({
  post,
  dark,
  currentUid,
  onLike,
  onBookmark,
  onFollow,
  onOpenComments,
  onRepost,
  onOpenShareModal,
  onOpenGiftModal,
  onViewGifts,
  onDeletePost,
  canDelete = false,
}: FeedPostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isHeartBouncing, setIsHeartBouncing] = useState(false);

  const isMyPost = currentUid && post.author.uid === currentUid;
  const caption = post.caption || "";
  const isCaptionLong = caption.length > 120;
  const displayedCaption = isExpanded || !isCaptionLong ? caption : caption.slice(0, 120) + "...";

  const handleLikeClick = () => {
    setIsHeartBouncing(true);
    setTimeout(() => setIsHeartBouncing(false), 400);
    onLike(post.postId);
  };

  const handleShareClick = () => {
    if (onOpenShareModal) {
      onOpenShareModal(post);
    } else if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: `منشور ${post.author.topic}`,
        text: post.caption,
        url: window.location.href,
      }).catch(() => {});
    }
  };

  return (
    <article
      dir="rtl"
      className={`feed-post-item w-full max-w-xl mx-auto mb-3.5 sm:mb-4 border rounded-2xl overflow-hidden shadow-sm transition-colors ${
        dark
          ? "bg-slate-950/70 border-slate-800/80 text-white"
          : "bg-white border-slate-200/80 text-slate-900"
      }`}
    >
      {/* 0. Repost Attribution Header: Shows the Sender (المرسل) with Repost Icon beside their name */}
      {post.repostAuthor && (
        <div className="flex items-center justify-between px-3.5 pt-2.5 pb-2 text-xs border-b border-slate-100 dark:border-slate-800/60 bg-emerald-500/10 dark:bg-emerald-500/5">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={resolveAssetUrl(post.repostAuthor.pic)}
              alt={post.repostAuthor.topic}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500/40 shrink-0"
            />
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                {post.repostAuthor.topic}
              </span>
              {Boolean(post.repostAuthor.documentationc) && <VerifiedBadge size="xs" />}
              {/* Repost Badge BESIDE SENDER'S NAME */}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Repeat2 className="w-3 h-3 stroke-[2.5]" />
                <span>مشاركة</span>
              </span>
            </div>
          </div>
          {post.repostedAt && (
            <span className="text-[10px] text-slate-400 font-medium shrink-0">
              {formatRelativeTimeArabic(post.repostedAt)}
            </span>
          )}
        </div>
      )}

      {/* 1. Header (Avatar, Author Info, Audio, Follow button, Options) */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar with Instagram-style gradient ring (NO REPOST BADGE ON AUTHOR AVATAR) */}
          <div className="relative shrink-0">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600">
              <img
                src={resolveAssetUrl(post.author.pic)}
                alt={post.author.topic}
                loading="lazy"
                decoding="async"
                className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-950"
              />
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {post.repostAuthor && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium">
                  صاحب المنشور
                </span>
              )}
              <span className="text-sm font-bold truncate">{post.author.topic}</span>
              {Boolean(post.author.documentationc) && <VerifiedBadge size="xs" />}
              <span className="text-xs text-slate-400 font-normal">@{post.author.username}</span>
            </div>

            {/* Audio Track Line */}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 truncate">
              <Music className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="truncate">
                {post.musicTitle || `المقطع الصوتي الأصلي · ${post.author.username || post.author.topic}`}
              </span>
            </div>
          </div>
        </div>

        {/* Follow button & Options Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {!isMyPost && (
            <button
              type="button"
              onClick={() => onFollow(post.author.uid)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 ${
                post.isFollowing
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  : "bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white hover:opacity-95 shadow-sm"
              }`}
            >
              {post.isFollowing ? "مُتابَع" : "+ متابعة"}
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="خيارات"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showMenu && (
              <div
                className={`absolute end-0 top-8 w-40 rounded-xl shadow-xl py-1.5 border z-20 ${
                  dark ? "bg-slate-900 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    handleShareClick();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة المنشور</span>
                </button>

                {(isMyPost || canDelete) && onDeletePost && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDeletePost(post.postId);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف المنشور</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Text / Caption at the BEGINNING with Pink Hashtags */}
      {caption && (
        <div className="px-3.5 pt-0.5 pb-2.5 text-xs leading-relaxed">
          <span className="font-bold me-1.5">{post.author.topic}</span>
          <HashtagText text={displayedCaption} className="whitespace-pre-wrap" />
          {isCaptionLong && !isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="ms-1.5 text-slate-400 hover:text-slate-200 font-bold"
            >
              المزيد
            </button>
          )}
        </div>
      )}

      {/* 3. Media Viewer (Single Image, Carousel, or Video) */}
      {post.mediaItems.length > 0 && (
        <FeedMediaViewer
          mediaItems={post.mediaItems}
          mediaType={post.mediaType}
          dark={dark}
        />
      )}

      {/* 4. Action Bar (Like, Comment, Repost, Share, Gift, Bookmark) */}
      <div className="flex items-center justify-between px-3.5 py-2">
        <div className="flex items-center gap-4">
          {/* Like Heart Button */}
          <button
            type="button"
            onClick={handleLikeClick}
            className={`flex items-center gap-1.5 text-xs font-bold transition-all ${
              post.isLiked ? "text-rose-500" : "text-slate-700 dark:text-slate-300 hover:text-rose-500"
            }`}
          >
            <Heart
              className={`w-6 h-6 transition-transform ${
                isHeartBouncing ? "scale-125" : "scale-100"
              } ${post.isLiked ? "fill-rose-500" : ""}`}
            />
            {post.likesCount > 0 && <span>{post.likesCount}</span>}
          </button>

          {/* Comment Bubble Button */}
          <button
            type="button"
            onClick={() => onOpenComments(post.postId)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-500 transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
            {post.commentsCount > 0 && <span>{post.commentsCount}</span>}
          </button>

          {/* Repost / Share Button */}
          <button
            type="button"
            onClick={handleShareClick}
            className={`flex items-center gap-1.5 text-xs font-bold transition-all active:scale-125 ${
              post.isReposted
                ? "text-emerald-500"
                : "text-slate-700 dark:text-slate-300 hover:text-emerald-500"
            }`}
            title={post.isReposted ? "إلغاء مشاركة المنشور" : "مشاركة المنشور"}
          >
            <Repeat2 className={`w-6 h-6 ${post.isReposted ? "stroke-[2.5]" : ""}`} />
            {post.repostsCount > 0 && <span>{post.repostsCount}</span>}
          </button>

          {/* Share Link Button */}
          <button
            type="button"
            onClick={handleShareClick}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-fuchsia-500 transition-colors"
            title="مشاركة المنشور"
          >
            <Send className="w-5 h-5 -rotate-45" />
            {post.sharesCount > 0 && <span>{post.sharesCount}</span>}
          </button>
        </div>

        {/* Right Action Icons: Gift & Bookmark */}
        <div className="flex items-center gap-2.5">
          {/* Gift Button: Owner views gifts list; Others send gift */}
          {isMyPost ? (
            <button
              type="button"
              onClick={() => onViewGifts && onViewGifts(post.postId)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all active:scale-95 shadow-sm"
              title="عرض سجل الداعمين والهدايا لهذا المنشور"
            >
              <Gift className="w-4 h-4" />
              <span>{post.giftsCount > 0 ? `${post.giftsCount} هدية` : "الهدايا"}</span>
            </button>
          ) : (
            onOpenGiftModal && (
              <button
                type="button"
                onClick={() => onOpenGiftModal(post)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all active:scale-95 shadow-sm"
                title="إرسال هدية للمنشور"
              >
                <Gift className="w-4 h-4" />
                <span>{post.giftsCount > 0 ? `${post.giftsCount} هدية` : "هدية"}</span>
              </button>
            )
          )}

          {/* Bookmark Ribbon Button */}
          <button
            type="button"
            onClick={() => onBookmark(post.postId)}
            className={`p-1 text-slate-700 dark:text-slate-300 hover:text-amber-500 transition-colors active:scale-125 ${
              post.isBookmarked ? "text-amber-500" : ""
            }`}
            aria-label="حفظ المنشور"
          >
            <Bookmark className={`w-6 h-6 ${post.isBookmarked ? "fill-amber-500 text-amber-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* 5. Quick Comments link & Relative Date */}
      <div className="px-3.5 pb-2.5 pt-0.5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
        {post.commentsCount > 0 ? (
          <button
            type="button"
            onClick={() => onOpenComments(post.postId)}
            className="hover:text-slate-200 transition-colors"
          >
            عرض جميع التعليقات ({post.commentsCount})
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenComments(post.postId)}
            className="hover:text-slate-200 transition-colors"
          >
            أضف تعليقاً...
          </button>
        )}

        <span>{formatRelativeTimeArabic(post.createdAt)}</span>
      </div>
    </article>
  );
}
