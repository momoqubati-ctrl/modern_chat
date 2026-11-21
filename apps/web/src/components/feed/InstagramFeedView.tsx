import { useEffect, useState, useRef, useMemo } from "react";
import { Plus, Sparkles, Loader2, Gift, Coins, X, Check } from "lucide-react";
import { useChatStore, useFeedStore, type FeedPost } from "@newchat/core-client";
import { resolveApiBaseUrl, resolveAssetUrl } from "../../lib/mediaUrl.js";
import { FeedTopHeader } from "./FeedTopHeader.js";
import { FeedStoriesBar } from "./FeedStoriesBar.js";
import { FeedPostCard } from "./FeedPostCard.js";
import { FeedCommentsSheet } from "./FeedCommentsSheet.js";
import { FeedCreatePostModal } from "./FeedCreatePostModal.js";
import { FeedPostGiftsModal } from "./FeedPostGiftsModal.js";
import { CreateStoryModal } from "../stories/CreateStoryModal.js";
import { StoryViewerModal } from "../stories/StoryViewerModal.js";

interface InstagramFeedViewProps {
  dark: boolean;
  onBack?: () => void;
}

function createFeedGiftIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function InstagramFeedView({ dark, onBack }: InstagramFeedViewProps) {
  const me = useChatStore((s) => s.me);
  const token = useChatStore((s) => s.sessionToken) || undefined;
  const gifts = useChatStore((s) => s.gifts);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const posts = useFeedStore((s) => s.posts);
  const isLoading = useFeedStore((s) => s.isLoading);
  const isLoadingMore = useFeedStore((s) => s.isLoadingMore);
  const hasMore = useFeedStore((s) => s.hasMore);
  const activeCommentsPostId = useFeedStore((s) => s.activeCommentsPostId);
  const comments = useFeedStore((s) => s.comments);
  const isLoadingComments = useFeedStore((s) => s.isLoadingComments);
  const replyingTo = useFeedStore((s) => s.replyingTo);
  const isPostingComment = useFeedStore((s) => s.isPostingComment);

  const loadPosts = useFeedStore((s) => s.loadPosts);
  const loadMorePosts = useFeedStore((s) => s.loadMorePosts);
  const toggleLikePost = useFeedStore((s) => s.toggleLikePost);
  const toggleBookmarkPost = useFeedStore((s) => s.toggleBookmarkPost);
  const toggleRepost = useFeedStore((s) => s.toggleRepost);
  const toggleFollow = useFeedStore((s) => s.toggleFollow);
  const createPost = useFeedStore((s) => s.createPost);
  const openComments = useFeedStore((s) => s.openComments);
  const closeComments = useFeedStore((s) => s.closeComments);
  const setReplyingTo = useFeedStore((s) => s.setReplyingTo);
  const addComment = useFeedStore((s) => s.addComment);
  const toggleCommentLike = useFeedStore((s) => s.toggleCommentLike);
  const sendPostGift = useFeedStore((s) => s.sendPostGift);

  const isViewingGiftsModal = useFeedStore((s) => s.isViewingGiftsModal);
  const viewingGiftsData = useFeedStore((s) => s.viewingGiftsData);
  const isLoadingGifts = useFeedStore((s) => s.isLoadingGifts);
  const openGiftsModal = useFeedStore((s) => s.openGiftsModal);
  const closeGiftsModal = useFeedStore((s) => s.closeGiftsModal);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [giftingPost, setGiftingPost] = useState<FeedPost | null>(null);
  const [selectedGiftFile, setSelectedGiftFile] = useState<string>("");
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [isSendingGift, setIsSendingGift] = useState(false);

  // Stories Modals State
  const [isStoryCreatorOpen, setIsStoryCreatorOpen] = useState(false);
  const [storyViewerPos, setStoryViewerPos] = useState<{
    storyIdx: number;
    slideIdx: number;
  } | null>(null);

  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const feedGiftAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const apiUrl = resolveApiBaseUrl();

  // Load feed on mount
  useEffect(() => {
    void loadPosts(apiUrl, token);
  }, [loadPosts, apiUrl, token]);

  // Infinite scroll trigger
  useEffect(() => {
    if (!bottomSentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          void loadMorePosts(apiUrl, token);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(bottomSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, loadMorePosts, apiUrl, token]);

  const activeCommentsPost = useMemo(() => {
    return posts.find((p) => p.postId === activeCommentsPostId);
  }, [posts, activeCommentsPostId]);

  const currentAuthor = useMemo(() => {
    if (!me?.uid) return undefined;
    return {
      uid: String(me.uid),
      idreg: Number(me.idreg || 0),
      topic: me.topic || "أنت",
      username: me.username || "",
      pic: me.pic || "pic.png",
      documentationc: Number(me.documentationc || 0),
    };
  }, [me]);

  // Handle uploading media for create post
  const handleUploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${apiUrl}/api/feed/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (data.ok) {
      return {
        url: data.url,
        mediaType: data.mediaType as "image" | "video",
        width: data.width,
        height: data.height,
      };
    }
    return null;
  };

  const handleSendGiftSubmit = async () => {
    if (!giftingPost || !selectedGiftFile || isSendingGift) return;
    const selectedGift = gifts.find((g) => g.file === selectedGiftFile);
    if (!selectedGift) return;

    const unitCoin = Number(selectedGift.coin || 1);
    const myCoins = Number(me?.coins ?? me?.coin ?? 0);
    const totalCost = unitCoin * giftQuantity;

    if (myCoins < totalCost) {
      pushNotice("رصيدك من الكوينز غير كافٍ لإرسال هذه الهدية", { topic: "الهدايا", force: 1 });
      return;
    }

    const fingerprint = JSON.stringify([
      giftingPost.postId,
      selectedGiftFile,
      giftQuantity,
    ]);
    if (feedGiftAttemptRef.current?.fingerprint !== fingerprint) {
      feedGiftAttemptRef.current = {
        fingerprint,
        key: createFeedGiftIdempotencyKey(),
      };
    }

    setIsSendingGift(true);
    try {
      const ok = await sendPostGift(
        {
          postId: giftingPost.postId,
          giftFile: selectedGiftFile,
          quantity: giftQuantity,
          idempotencyKey: feedGiftAttemptRef.current.key,
        },
        apiUrl,
        token
      );

      if (ok) {
        feedGiftAttemptRef.current = null;
        pushNotice(`تم إرسال هدية ${selectedGift.name || "الهدية"} بنجاح لصاحب المنشور! 🎁`, { topic: "الهدايا" });
        setGiftingPost(null);
        setSelectedGiftFile("");
        setGiftQuantity(1);
      } else {
        pushNotice("فشل إرسال الهدية، يرجى المحاولة لاحقاً", { topic: "الهدايا", force: 1 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر إرسال الهدية";
      pushNotice(msg, { topic: "الهدايا", force: 1 });
    } finally {
      setIsSendingGift(false);
    }
  };

  return (
    <div
      dir="rtl"
      className={`min-h-screen flex flex-col transition-colors ${
        dark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* 1. Header */}
      <FeedTopHeader
        dark={dark}
        onOpenCreate={() => setIsCreateModalOpen(true)}
        onBack={onBack}
      />

      {/* 2. Stories Bar */}
      <FeedStoriesBar
        dark={dark}
        onOpenCreator={() => setIsStoryCreatorOpen(true)}
        onOpenViewer={(sIdx, slIdx) => setStoryViewerPos({ storyIdx: sIdx, slideIdx: slIdx ?? 0 })}
      />

      {/* 3. Main Feed Posts Container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-2 py-4 flex flex-col items-center">
        {isLoading && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <div className="w-10 h-10 rounded-full border-3 border-rose-500 border-t-transparent animate-spin" />
            <span className="text-sm font-bold">جارٍ تحميل آخر المنشورات...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center max-w-sm">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 flex items-center justify-center text-white mb-4 shadow-xl">
              <Sparkles className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-black mb-1">أهلاً بك في Instagram Feed!</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              شارك لحظاتك وصورك ومقاطع الفيديو مع الجميع، أو كن أول من ينشر الآن.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 shadow-md hover:opacity-95 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منشورك الأول</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {posts.map((post) => (
              <FeedPostCard
                key={post.postId}
                post={post}
                dark={dark}
                currentUid={me?.uid ? String(me.uid) : undefined}
                onLike={(pId) => toggleLikePost(pId, apiUrl, token)}
                onBookmark={(pId) => toggleBookmarkPost(pId, apiUrl, token)}
                onRepost={(pId) => toggleRepost(pId, apiUrl, token)}
                onFollow={(authorUid) => toggleFollow(authorUid, apiUrl, token)}
                onOpenComments={(pId) => openComments(pId, apiUrl, token)}
                onViewGifts={(pId) => openGiftsModal(pId, apiUrl, token)}
                onOpenGiftModal={(p) => {
                  setGiftingPost(p);
                  if (gifts.length > 0 && !selectedGiftFile) {
                    setSelectedGiftFile(gifts[0]!.file);
                  }
                }}
              />
            ))}

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={bottomSentinelRef} className="w-full py-6 flex justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                  <span>جارٍ جلب المزيد من المنشورات...</span>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <span className="text-xs text-slate-400 font-medium">وصلت إلى نهاية المنشورات ✨</span>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 4. Comments Bottom Sheet */}
      {activeCommentsPostId && (
        <FeedCommentsSheet
          dark={dark}
          postId={activeCommentsPostId}
          postAuthor={activeCommentsPost?.author}
          postViewsCount={activeCommentsPost?.viewsCount}
          comments={comments}
          isLoading={isLoadingComments}
          replyingTo={replyingTo}
          isPosting={isPostingComment}
          currentAuthor={currentAuthor}
          onClose={closeComments}
          onSetReplyingTo={setReplyingTo}
          onAddComment={(text) => addComment(text, apiUrl, token, currentAuthor)}
          onLikeComment={(commId) => toggleCommentLike(commId, apiUrl, token)}
        />
      )}

      {/* 5. Create Post Modal */}
      {isCreateModalOpen && (
        <FeedCreatePostModal
          dark={dark}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(params) => createPost(params, apiUrl, token)}
          onUploadFile={handleUploadFile}
        />
      )}

      {/* 6. Feed In-Post Gift Modal (Unified Economy Engine) */}
      {giftingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setGiftingPost(null)} />
          <div
            dir="rtl"
            className={`relative w-full max-w-sm rounded-2xl shadow-2xl border p-4 z-10 transition-colors ${
              dark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold">إرسال هدية للمنشور</h3>
              </div>
              <button
                type="button"
                onClick={() => setGiftingPost(null)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3">
              <div className="flex items-center justify-between text-xs mb-3 font-semibold text-slate-400">
                <span>المستلم: <strong className="text-slate-200">{giftingPost.author.topic}</strong></span>
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <Coins className="w-3.5 h-3.5" />
                  <span>رصيدك: {me?.coins ?? me?.coin ?? 0}</span>
                </span>
              </div>

              {/* Gift Grid */}
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 chat-scroll">
                {gifts.map((g) => {
                  const isSelected = selectedGiftFile === g.file;
                  return (
                    <button
                      key={g.file}
                      type="button"
                      onClick={() => setSelectedGiftFile(g.file)}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10 shadow-sm"
                          : "border-slate-200/60 dark:border-slate-800 hover:border-slate-400"
                      }`}
                    >
                      <img
                        src={resolveAssetUrl(g.file.startsWith("/gifts_git/") ? g.file : `/gifts_git/${g.file}`)}
                        alt={g.name}
                        className="w-10 h-10 object-contain mb-1"
                      />
                      <span className="text-[10px] font-bold truncate max-w-full">{g.name}</span>
                      <span className="text-[9px] font-extrabold text-amber-500 flex items-center gap-0.5">
                        <Coins className="w-2.5 h-2.5" />
                        <span>{g.coin}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quantity selector */}
              <div className="flex items-center justify-between mt-3 px-1 text-xs">
                <span className="font-bold text-slate-400">الكمية:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 5, 10, 50].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setGiftQuantity(qty)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        giftQuantity === qty
                          ? "bg-amber-500 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      x{qty}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendGiftSubmit}
              disabled={isSendingGift || !selectedGiftFile}
              className="w-full mt-2 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-95 shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {isSendingGift ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ تحويل الكوينز بأمان...</span>
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>إرسال الهدية الآن</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 7. Stories Modals */}
      <CreateStoryModal
        dark={dark}
        open={isStoryCreatorOpen}
        onClose={() => setIsStoryCreatorOpen(false)}
      />

      {storyViewerPos !== null && (
        <StoryViewerModal
          dark={dark}
          storyIdx={storyViewerPos.storyIdx}
          slideIdx={storyViewerPos.slideIdx}
          onChangePosition={(sIdx, slIdx) =>
            setStoryViewerPos({ storyIdx: sIdx, slideIdx: slIdx })
          }
          onClose={() => setStoryViewerPos(null)}
        />
      )}

      {/* 8. Post Gifts List Modal (Lazy loaded for author) */}
      <FeedPostGiftsModal
        dark={dark}
        isOpen={isViewingGiftsModal}
        isLoading={isLoadingGifts}
        giftsData={viewingGiftsData}
        onClose={closeGiftsModal}
      />
    </div>
  );
}

export default InstagramFeedView;
