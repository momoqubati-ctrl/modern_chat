import type { FeedAuthor, FeedMediaItem, FeedPost, FeedComment, ReplyingToTarget } from "@newchat/core-client";

export type { FeedAuthor, FeedMediaItem, FeedPost, FeedComment, ReplyingToTarget };

export interface FeedPostCardProps {
  post: FeedPost;
  dark: boolean;
  currentUid?: string;
  onLike: (postId: string) => void;
  onBookmark: (postId: string) => void;
  onFollow: (authorUid: string) => void;
  onOpenComments: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onOpenShareModal?: (post: FeedPost) => void;
  onOpenGiftModal?: (post: FeedPost) => void;
  onViewGifts?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  canDelete?: boolean;
}

export interface FeedCommentsSheetProps {
  dark: boolean;
  postId: string | null;
  postAuthor?: FeedAuthor;
  postViewsCount?: number;
  comments: FeedComment[];
  isLoading: boolean;
  replyingTo: ReplyingToTarget | null;
  isPosting: boolean;
  currentAuthor?: FeedAuthor;
  onClose: () => void;
  onSetReplyingTo: (target: ReplyingToTarget | null) => void;
  onAddComment: (content: string) => Promise<boolean>;
  onLikeComment: (commentId: string) => void;
}
