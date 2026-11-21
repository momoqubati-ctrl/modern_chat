import { useState } from "react";
import { X, Repeat2, Link2, Check, Share2, Sparkles, Music } from "lucide-react";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { VerifiedBadge } from "../VerifiedBadge.js";
import type { FeedPost } from "./feedTypes.js";

interface FeedShareModalProps {
  dark: boolean;
  isOpen: boolean;
  post: FeedPost | null;
  onClose: () => void;
  onShareToFeed: (postId: string) => void;
}

export function FeedShareModal({
  dark,
  isOpen,
  post,
  onClose,
  onShareToFeed,
}: FeedShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !post) return null;

  const handleCopyLink = async () => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.postId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `منشور ${post.author.topic}`,
          text: post.caption || "شاهد هذا المنشور المميز",
          url: `${window.location.origin}${window.location.pathname}?post=${post.postId}`,
        });
      } catch {
        // user cancelled
      }
    }
  };

  const hasMedia = post.mediaItems.length > 0;
  const firstMedia = hasMedia ? post.mediaItems[0] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-sm rounded-3xl shadow-2xl border p-4 z-10 transition-all ${
          dark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500">
              <Share2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold">مشاركة المنشور</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Post Preview Card */}
        <div className="my-3.5 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 shrink-0">
              <img
                src={resolveAssetUrl(post.author.pic)}
                alt={post.author.topic}
                className="w-8 h-8 rounded-full object-cover border border-white dark:border-slate-950"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">{post.author.topic}</span>
                {Boolean(post.author.documentationc) && <VerifiedBadge size="xs" />}
              </div>
              <span className="text-[10px] text-slate-400 truncate">@{post.author.username}</span>
            </div>
          </div>

          {post.caption && (
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-2">
              {post.caption}
            </p>
          )}

          {hasMedia && firstMedia && (
            <div className="relative w-full h-28 rounded-xl overflow-hidden bg-black/40 border border-slate-200/40 dark:border-slate-800/60">
              {firstMedia.mediaType === "video" ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                  <div className="p-2 rounded-full bg-white/20 backdrop-blur-xs text-white">
                    <Music className="w-5 h-5" />
                  </div>
                </div>
              ) : (
                <img
                  src={resolveAssetUrl(firstMedia.url)}
                  alt="معاينة الوسائط"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}
        </div>

        {/* Actions List */}
        <div className="flex flex-col gap-2">
          {/* Main Action: Share / Repost to Feed */}
          <button
            type="button"
            onClick={() => {
              onShareToFeed(post.postId);
              onClose();
            }}
            className={`w-full py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-between gap-2 shadow-sm transition-all active:scale-[0.98] ${
              post.isReposted
                ? "bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20"
                : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-95 shadow-emerald-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <Repeat2 className={`w-4 h-4 ${post.isReposted ? "stroke-[2.5]" : ""}`} />
              <div className="flex flex-col text-start">
                <span>{post.isReposted ? "إلغاء مشاركة المنشور" : "مشاركة المنشور في خلاصتي"}</span>
                <span className="text-[10px] font-normal opacity-85">
                  {post.isReposted
                    ? "إزالة المنشور المعاد نشره من خلاصتك"
                    : "سيظهر المنشور باسمك مع علامة المشاركة"}
                </span>
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 opacity-80 shrink-0" />
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-colors ${
              copied
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                : "border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
              <span>{copied ? "تم نسخ الرابط بنجاح!" : "نسخ رابط المنشور"}</span>
            </div>
          </button>

          {/* External / Native Share if supported */}
          {typeof navigator !== "undefined" && Boolean(navigator.share) && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>مشاركة عبر تطبيقات أخرى...</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FeedShareModal;
