import { create } from "zustand";

export interface FeedAuthor {
  uid: string;
  idreg: number;
  topic: string;
  username: string;
  pic: string;
  documentationc: number;
}

export interface FeedMediaItem {
  id: number;
  postId: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  sortOrder: number;
}

export interface FeedPost {
  id: number;
  postId: string;
  feedItemId?: string;
  author: FeedAuthor;
  caption: string;
  mediaType: "image" | "carousel" | "video";
  mediaItems: FeedMediaItem[];
  musicTitle: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  sharesCount: number;
  viewsCount: number;
  giftsCount: number;
  createdAt: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isReposted?: boolean;
  isFollowing?: boolean;
  repostAuthor?: FeedAuthor | null;
  repostedAt?: number;
}

export interface PostGiftSenderItem {
  sender: FeedAuthor;
  giftFile: string;
  totalQuantity: number;
  totalCoins: number;
  lastSentAt: number;
}

export interface PostGiftsData {
  postId: string;
  totalGiftsCount: number;
  gifts: PostGiftSenderItem[];
}

export interface FeedComment {
  id: number;
  commentId: string;
  postId: string;
  parentCommentId: string;
  replyToUid: string;
  replyToUsername: string;
  author: FeedAuthor;
  content: string;
  likesCount: number;
  repliesCount: number;
  createdAt: number;
  isLiked?: boolean;
  replies?: FeedComment[];
}

export interface ReplyingToTarget {
  commentId: string;
  authorTopic: string;
  authorUsername: string;
  authorUid: string;
}

interface FeedState {
  posts: FeedPost[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  nextCursor: number | null;
  error: string | null;

  // Comments Bottom Sheet State
  activeCommentsPostId: string | null;
  comments: FeedComment[];
  isLoadingComments: boolean;
  replyingTo: ReplyingToTarget | null;
  isPostingComment: boolean;

  // Actions
  loadPosts: (apiUrl?: string, token?: string) => Promise<void>;
  loadMorePosts: (apiUrl?: string, token?: string) => Promise<void>;
  toggleLikePost: (postId: string, apiUrl?: string, token?: string) => Promise<void>;
  toggleBookmarkPost: (postId: string, apiUrl?: string, token?: string) => Promise<void>;
  toggleRepost: (postId: string, apiUrl?: string, token?: string, currentAuthor?: FeedAuthor) => Promise<boolean>;
  toggleFollow: (targetUid: string, apiUrl?: string, token?: string) => Promise<void>;
  createPost: (
    params: {
      caption?: string;
      mediaType?: "image" | "carousel" | "video";
      mediaItems: Array<{ url: string; mediaType?: "image" | "video"; width?: number; height?: number }>;
      musicTitle?: string;
    },
    apiUrl?: string,
    token?: string
  ) => Promise<boolean>;
  openComments: (postId: string, apiUrl?: string, token?: string) => Promise<void>;
  closeComments: () => void;
  setReplyingTo: (target: ReplyingToTarget | null) => void;
  addComment: (
    content: string,
    apiUrl?: string,
    token?: string,
    meAuthor?: FeedAuthor
  ) => Promise<boolean>;
  toggleCommentLike: (commentId: string, apiUrl?: string, token?: string) => Promise<void>;
  sendPostGift: (
    params: {
      postId: string;
      giftFile: string;
      quantity?: number;
      idempotencyKey: string;
    },
    apiUrl?: string,
    token?: string
  ) => Promise<boolean>;

  // Post Gifts Modal State (Lazy Loaded)
  isViewingGiftsModal: boolean;
  viewingGiftsPostId: string | null;
  viewingGiftsData: PostGiftsData | null;
  isLoadingGifts: boolean;
  openGiftsModal: (postId: string, apiUrl?: string, token?: string) => Promise<void>;
  closeGiftsModal: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  nextCursor: null,
  error: null,

  activeCommentsPostId: null,
  comments: [],
  isLoadingComments: false,
  replyingTo: null,
  isPostingComment: false,

  isViewingGiftsModal: false,
  viewingGiftsPostId: null,
  viewingGiftsData: null,
  isLoadingGifts: false,

  loadPosts: async (apiUrl = "", token = "") => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${apiUrl}/api/feed/posts?limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.ok) {
        set({
          posts: data.posts || [],
          nextCursor: data.nextCursor || null,
          hasMore: Boolean(data.hasMore),
          isLoading: false,
        });
      } else {
        set({ error: data.message || "فشل جلب المنشورات", isLoading: false });
      }
    } catch {
      set({ error: "فشل الاتصال بالخادم", isLoading: false });
    }
  },

  loadMorePosts: async (apiUrl = "", token = "") => {
    const { nextCursor, isLoadingMore, hasMore, posts } = get();
    if (!hasMore || isLoadingMore || !nextCursor) return;

    set({ isLoadingMore: true });
    try {
      const res = await fetch(`${apiUrl}/api/feed/posts?limit=10&cursor=${nextCursor}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.ok) {
        set({
          posts: [...posts, ...(data.posts || [])],
          nextCursor: data.nextCursor || null,
          hasMore: Boolean(data.hasMore),
          isLoadingMore: false,
        });
      } else {
        set({ isLoadingMore: false });
      }
    } catch {
      set({ isLoadingMore: false });
    }
  },

  toggleLikePost: async (postId: string, apiUrl = "", token = "") => {
    if (!token) return;

    // Optimistic update
    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.postId !== postId) return p;
        const nextLiked = !p.isLiked;
        return {
          ...p,
          isLiked: nextLiked,
          likesCount: nextLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
        };
      }),
    }));

    try {
      const res = await fetch(`${apiUrl}/api/feed/posts/${postId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.postId === postId
              ? { ...p, isLiked: data.liked, likesCount: data.likesCount }
              : p
          ),
        }));
      }
    } catch {
      // Revert if error
      get().loadPosts(apiUrl, token);
    }
  },

  toggleBookmarkPost: async (postId: string, apiUrl = "", token = "") => {
    if (!token) return;

    // Optimistic update
    set((state) => ({
      posts: state.posts.map((p) =>
        p.postId === postId ? { ...p, isBookmarked: !p.isBookmarked } : p
      ),
    }));

    try {
      const res = await fetch(`${apiUrl}/api/feed/posts/${postId}/bookmark`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.postId === postId ? { ...p, isBookmarked: data.bookmarked } : p
          ),
        }));
      }
    } catch {
      // Revert if error
      get().loadPosts(apiUrl, token);
    }
  },

  toggleRepost: async (postId: string, apiUrl = "", token = "", currentAuthor?: FeedAuthor) => {
    if (!token) return false;

    // Optimistic toggle
    let willRepost = true;
    set((state) => {
      const targetPost = state.posts.find((p) => p.postId === postId);
      willRepost = targetPost ? !targetPost.isReposted : true;

      // Update all instances of this post in store
      let nextPosts = state.posts.map((p) => {
        if (p.postId !== postId) return p;
        return {
          ...p,
          isReposted: willRepost,
          repostsCount: willRepost ? p.repostsCount + 1 : Math.max(0, p.repostsCount - 1),
        };
      });

      // If user is reposting and currentAuthor is available, prepend optimistic shared post
      if (willRepost && targetPost && currentAuthor) {
        const optimisticSharedPost: FeedPost = {
          ...targetPost,
          feedItemId: `repost_client_${Date.now()}_${targetPost.postId}`,
          repostAuthor: currentAuthor,
          repostedAt: Date.now(),
          isReposted: true,
          repostsCount: targetPost.repostsCount + 1,
        };
        nextPosts = [optimisticSharedPost, ...nextPosts];
      } else if (!willRepost && currentAuthor) {
        // If un-reposting, filter out any repost entry by current user
        nextPosts = nextPosts.filter(
          (p) => !(p.postId === postId && p.repostAuthor?.uid === currentAuthor.uid)
        );
      }

      return { posts: nextPosts };
    });

    try {
      const res = await fetch(`${apiUrl}/api/feed/posts/${postId}/repost`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.postId === postId
              ? { ...p, isReposted: data.reposted, repostsCount: data.repostsCount }
              : p
          ),
        }));
        return Boolean(data.reposted);
      }
      return false;
    } catch {
      // Revert if error
      get().loadPosts(apiUrl, token);
      return false;
    }
  },

  toggleFollow: async (targetUid: string, apiUrl = "", token = "") => {
    if (!token) return;

    // Optimistic toggle for all posts by this author
    set((state) => ({
      posts: state.posts.map((p) =>
        p.author.uid === targetUid ? { ...p, isFollowing: !p.isFollowing } : p
      ),
    }));

    try {
      const res = await fetch(`${apiUrl}/api/feed/follow/${targetUid}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.author.uid === targetUid ? { ...p, isFollowing: data.following } : p
          ),
        }));
      }
    } catch {
      get().loadPosts(apiUrl, token);
    }
  },

  createPost: async (params, apiUrl = "", token = "") => {
    if (!token) return false;
    try {
      const res = await fetch(`${apiUrl}/api/feed/posts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.ok && data.post) {
        set((state) => ({ posts: [data.post, ...state.posts] }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  openComments: async (postId: string, apiUrl = "", token = "") => {
    set({
      activeCommentsPostId: postId,
      comments: [],
      isLoadingComments: true,
      replyingTo: null,
    });

    try {
      const res = await fetch(`${apiUrl}/api/feed/posts/${postId}/comments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.ok) {
        set({ comments: data.comments || [], isLoadingComments: false });
      } else {
        set({ isLoadingComments: false });
      }
    } catch {
      set({ isLoadingComments: false });
    }
  },

  closeComments: () => {
    set({ activeCommentsPostId: null, comments: [], replyingTo: null });
  },

  setReplyingTo: (target) => {
    set({ replyingTo: target });
  },

  addComment: async (content: string, apiUrl = "", token = "", meAuthor) => {
    const { activeCommentsPostId, replyingTo } = get();
    if (!token || !activeCommentsPostId || !content.trim()) return false;

    set({ isPostingComment: true });

    // Optimistic comment creation
    const tempCommentId = `temp_${Date.now()}`;
    const newComment: FeedComment = {
      id: 0,
      commentId: tempCommentId,
      postId: activeCommentsPostId,
      parentCommentId: replyingTo?.commentId || "",
      replyToUid: replyingTo?.authorUid || "",
      replyToUsername: replyingTo?.authorUsername || "",
      author: meAuthor || {
        uid: "me",
        idreg: 0,
        topic: "أنت",
        username: "me",
        pic: "pic.png",
        documentationc: 0,
      },
      content: content.trim(),
      likesCount: 0,
      repliesCount: 0,
      createdAt: Date.now(),
      isLiked: false,
      replies: [],
    };

    if (!replyingTo) {
      set((state) => ({ comments: [...state.comments, newComment] }));
    } else {
      set((state) => ({
        comments: state.comments.map((c) =>
          c.commentId === replyingTo.commentId
            ? { ...c, repliesCount: c.repliesCount + 1, replies: [...(c.replies || []), newComment] }
            : c
        ),
      }));
    }

    // Also optimistically increment post comments_count in feed list
    set((state) => ({
      posts: state.posts.map((p) =>
        p.postId === activeCommentsPostId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      ),
    }));

    try {
      const res = await fetch(`${apiUrl}/api/feed/posts/${activeCommentsPostId}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content.trim(),
          parentCommentId: replyingTo?.commentId,
          replyToUid: replyingTo?.authorUid,
          replyToUsername: replyingTo?.authorUsername,
        }),
      });
      const data = await res.json();
      if (data.ok && data.comment) {
        // Replace temp comment with server response
        if (!replyingTo) {
          set((state) => ({
            comments: state.comments.map((c) => (c.commentId === tempCommentId ? data.comment : c)),
            isPostingComment: false,
            replyingTo: null,
          }));
        } else {
          set((state) => ({
            comments: state.comments.map((c) =>
              c.commentId === replyingTo.commentId
                ? {
                    ...c,
                    replies: (c.replies || []).map((r) =>
                      r.commentId === tempCommentId ? data.comment : r
                    ),
                  }
                : c
            ),
            isPostingComment: false,
            replyingTo: null,
          }));
        }
        return true;
      }
      set({ isPostingComment: false });
      return false;
    } catch {
      set({ isPostingComment: false });
      return false;
    }
  },

  toggleCommentLike: async (commentId: string, apiUrl = "", token = "") => {
    if (!token) return;

    // Helper to toggle in tree
    const updateCommentInTree = (list: FeedComment[]): FeedComment[] => {
      return list.map((c) => {
        if (c.commentId === commentId) {
          const nextLiked = !c.isLiked;
          return {
            ...c,
            isLiked: nextLiked,
            likesCount: nextLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
          };
        }
        if (c.replies && c.replies.length > 0) {
          return { ...c, replies: updateCommentInTree(c.replies) };
        }
        return c;
      });
    };

    set((state) => ({ comments: updateCommentInTree(state.comments) }));

    try {
      const res = await fetch(`${apiUrl}/api/feed/comments/${commentId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        const syncCommentInTree = (list: FeedComment[]): FeedComment[] => {
          return list.map((c) => {
            if (c.commentId === commentId) {
              return { ...c, isLiked: data.liked, likesCount: data.likesCount };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: syncCommentInTree(c.replies) };
            }
            return c;
          });
        };
        set((state) => ({ comments: syncCommentInTree(state.comments) }));
      }
    } catch {
      // Revert if error
    }
  },

  sendPostGift: async (params, apiUrl = "", token = "") => {
    if (!token) return false;
    try {
      const res = await fetch(`${apiUrl}/api/feed/gift`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.ok) {
        const qty = params.quantity ?? 1;
        set((state) => ({
          posts: state.posts.map((p) =>
            p.postId === params.postId ? { ...p, giftsCount: (p.giftsCount || 0) + qty } : p
          ),
        }));
      }
      return Boolean(data.ok);
    } catch {
      return false;
    }
  },

  openGiftsModal: async (postId: string, apiUrl = "", token = "") => {
    set({
      isViewingGiftsModal: true,
      viewingGiftsPostId: postId,
      isLoadingGifts: true,
      viewingGiftsData: null,
    });

    if (!token) {
      set({ isLoadingGifts: false });
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/feed/posts/${postId}/gifts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        set({ viewingGiftsData: data, isLoadingGifts: false });
      } else {
        set({ isLoadingGifts: false });
      }
    } catch {
      set({ isLoadingGifts: false });
    }
  },

  closeGiftsModal: () => {
    set({
      isViewingGiftsModal: false,
      viewingGiftsPostId: null,
      viewingGiftsData: null,
      isLoadingGifts: false,
    });
  },
}));
