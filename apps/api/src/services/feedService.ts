import crypto from "node:crypto";
import {
  getDb,
  feed_posts,
  feed_post_media,
  feed_post_likes,
  feed_comments,
  feed_comment_likes,
  feed_bookmarks,
  users,
  followers,
  executeWithIdempotency,
  sql,
  eq,
  and,
  desc,
  asc,
  inArray,
} from "@newchat/db";

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

export interface FeedPostDto {
  id: number;
  postId: string;
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
  createdAt: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isFollowing?: boolean;
}

export interface FeedCommentDto {
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
  replies?: FeedCommentDto[];
}

export async function getFeedPosts(params: {
  userUid?: string;
  cursor?: number;
  limit?: number;
}): Promise<{ posts: FeedPostDto[]; nextCursor?: number; hasMore: boolean }> {
  const { db } = getDb();
  const limit = Math.min(25, Math.max(1, params.limit || 10));
  const cursor = params.cursor && params.cursor > 0 ? params.cursor : undefined;

  let query = db
    .select()
    .from(feed_posts)
    .where(cursor ? sql`${feed_posts.created_at} < ${cursor}` : sql`1=1`)
    .orderBy(desc(feed_posts.created_at))
    .limit(limit + 1);

  const postRows = await query;
  const hasMore = postRows.length > limit;
  const slicedPosts = hasMore ? postRows.slice(0, limit) : postRows;

  if (slicedPosts.length === 0) {
    return { posts: [], hasMore: false };
  }

  const postIds = slicedPosts.map((p) => p.post_id);
  const authorUids = Array.from(new Set(slicedPosts.map((p) => p.author_uid)));

  // 1. Fetch authors
  const authorRows = await db
    .select({
      uid: users.uid,
      idreg: users.idreg,
      topic: users.topic,
      username: users.username,
      pic: users.pic,
      documentationc: users.documentationc,
    })
    .from(users)
    .where(inArray(users.uid, authorUids));

  const authorMap = new Map<string, FeedAuthor>();
  for (const a of authorRows) {
    if (a.uid) {
      authorMap.set(a.uid, {
        uid: a.uid,
        idreg: Number(a.idreg || 0),
        topic: a.topic || "عضو",
        username: a.username || "",
        pic: a.pic || "pic.png",
        documentationc: Number(a.documentationc || 0),
      });
    }
  }

  // 2. Fetch media items
  const mediaRows = await db
    .select()
    .from(feed_post_media)
    .where(inArray(feed_post_media.post_id, postIds))
    .orderBy(asc(feed_post_media.sort_order));

  const mediaMap = new Map<string, FeedMediaItem[]>();
  for (const m of mediaRows) {
    const list = mediaMap.get(m.post_id) || [];
    list.push({
      id: m.id,
      postId: m.post_id,
      mediaType: (m.media_type as "image" | "video") || "image",
      url: m.url,
      thumbnailUrl: m.thumbnail_url || undefined,
      width: m.width || undefined,
      height: m.height || undefined,
      duration: m.duration || undefined,
      sortOrder: m.sort_order,
    });
    mediaMap.set(m.post_id, list);
  }

  // 3. User interaction flags if userUid provided
  const likedSet = new Set<string>();
  const bookmarkedSet = new Set<string>();
  const followingSet = new Set<string>();

  if (params.userUid) {
    const [likes, bookmarks, followings] = await Promise.all([
      db
        .select({ postId: feed_post_likes.post_id })
        .from(feed_post_likes)
        .where(
          and(
            eq(feed_post_likes.user_uid, params.userUid),
            inArray(feed_post_likes.post_id, postIds),
          ),
        ),
      db
        .select({ postId: feed_bookmarks.post_id })
        .from(feed_bookmarks)
        .where(
          and(
            eq(feed_bookmarks.user_uid, params.userUid),
            inArray(feed_bookmarks.post_id, postIds),
          ),
        ),
      db
        .select({ followingId: followers.following_id })
        .from(followers)
        .where(
          and(
            eq(followers.follower_id, params.userUid),
            inArray(followers.following_id, authorUids),
          ),
        ),
    ]);

    for (const l of likes) likedSet.add(l.postId);
    for (const b of bookmarks) bookmarkedSet.add(b.postId);
    for (const f of followings) followingSet.add(f.followingId);
  }

  const posts: FeedPostDto[] = slicedPosts.map((p) => {
    const author = authorMap.get(p.author_uid) || {
      uid: p.author_uid,
      idreg: p.author_idreg || 0,
      topic: "مستخدم",
      username: "",
      pic: "pic.png",
      documentationc: 0,
    };

    return {
      id: p.id,
      postId: p.post_id,
      author,
      caption: p.caption || "",
      mediaType: (p.media_type as "image" | "carousel" | "video") || "image",
      mediaItems: mediaMap.get(p.post_id) || [],
      musicTitle: p.music_title || "",
      likesCount: p.likes_count,
      commentsCount: p.comments_count,
      repostsCount: p.reposts_count,
      sharesCount: p.shares_count,
      viewsCount: p.views_count,
      createdAt: p.created_at,
      isLiked: likedSet.has(p.post_id),
      isBookmarked: bookmarkedSet.has(p.post_id),
      isFollowing: followingSet.has(p.author_uid),
    };
  });

  const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1]!.createdAt : undefined;
  return { posts, nextCursor, hasMore };
}

export async function createFeedPost(params: {
  authorUid: string;
  caption?: string;
  mediaType: "image" | "carousel" | "video";
  mediaItems: Array<{
    url: string;
    mediaType?: "image" | "video";
    width?: number;
    height?: number;
    duration?: number;
    thumbnailUrl?: string;
  }>;
  musicTitle?: string;
}): Promise<FeedPostDto> {
  const { db } = getDb();
  const authorUid = String(params.authorUid || "").trim();
  if (!authorUid) throw new Error("AUTHOR_REQUIRED");
  if (!params.mediaItems || params.mediaItems.length === 0) {
    throw new Error("MEDIA_REQUIRED");
  }

  // Get author idreg
  const [authorRow] = await db
    .select({
      idreg: users.idreg,
      topic: users.topic,
      username: users.username,
      pic: users.pic,
      documentationc: users.documentationc,
    })
    .from(users)
    .where(eq(users.uid, authorUid))
    .limit(1);

  if (!authorRow) throw new Error("AUTHOR_NOT_FOUND");

  const now = Date.now();
  const postId = `post_${now}_${crypto.randomBytes(4).toString("hex")}`;
  const mediaType =
    params.mediaItems.length > 1
      ? "carousel"
      : params.mediaType === "video"
        ? "video"
        : "image";

  return await db.transaction(async (tx) => {
    await tx.insert(feed_posts).values({
      post_id: postId,
      author_uid: authorUid,
      author_idreg: authorRow.idreg,
      caption: String(params.caption || "").trim(),
      media_type: mediaType,
      music_title: String(params.musicTitle || "").trim(),
      likes_count: 0,
      comments_count: 0,
      reposts_count: 0,
      shares_count: 0,
      views_count: 0,
      visibility: "public",
      created_at: now,
      updated_at: now,
    });

    const mediaValues = params.mediaItems.map((item, index) => ({
      post_id: postId,
      media_type: item.mediaType || (mediaType === "video" ? "video" : "image"),
      url: item.url,
      thumbnail_url: item.thumbnailUrl || "",
      width: item.width || 0,
      height: item.height || 0,
      duration: item.duration || 0,
      sort_order: index,
      created_at: now,
    }));

    await tx.insert(feed_post_media).values(mediaValues);

    return {
      id: 0,
      postId,
      author: {
        uid: authorUid,
        idreg: authorRow.idreg,
        topic: authorRow.topic,
        username: authorRow.username,
        pic: authorRow.pic || "pic.png",
        documentationc: Number(authorRow.documentationc || 0),
      },
      caption: String(params.caption || "").trim(),
      mediaType,
      mediaItems: mediaValues.map((m, idx) => ({
        id: idx,
        postId,
        mediaType: m.media_type as "image" | "video",
        url: m.url,
        thumbnailUrl: m.thumbnail_url,
        width: m.width,
        height: m.height,
        duration: m.duration,
        sortOrder: m.sort_order,
      })),
      musicTitle: String(params.musicTitle || "").trim(),
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      sharesCount: 0,
      viewsCount: 0,
      createdAt: now,
      isLiked: false,
      isBookmarked: false,
      isFollowing: false,
    };
  });
}

export async function deleteFeedPost(
  postId: string,
  actorUid: string,
  isSuperAdmin = false,
): Promise<boolean> {
  const { db } = getDb();
  const [post] = await db
    .select()
    .from(feed_posts)
    .where(eq(feed_posts.post_id, postId))
    .limit(1);

  if (!post) throw new Error("POST_NOT_FOUND");
  if (post.author_uid !== actorUid && !isSuperAdmin) {
    throw new Error("FORBIDDEN");
  }

  await db.transaction(async (tx) => {
    await tx.delete(feed_post_media).where(eq(feed_post_media.post_id, postId));
    await tx.delete(feed_post_likes).where(eq(feed_post_likes.post_id, postId));
    await tx.delete(feed_comments).where(eq(feed_comments.post_id, postId));
    await tx.delete(feed_bookmarks).where(eq(feed_bookmarks.post_id, postId));
    await tx.delete(feed_posts).where(eq(feed_posts.post_id, postId));
  });

  return true;
}

export async function togglePostLike(
  postId: string,
  userUid: string,
): Promise<{ liked: boolean; likesCount: number }> {
  const { db } = getDb();

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(feed_post_likes)
      .where(and(eq(feed_post_likes.post_id, postId), eq(feed_post_likes.user_uid, userUid)))
      .limit(1);

    if (existing) {
      await tx
        .delete(feed_post_likes)
        .where(and(eq(feed_post_likes.post_id, postId), eq(feed_post_likes.user_uid, userUid)));

      const [updated] = await tx
        .update(feed_posts)
        .set({ likes_count: sql`GREATEST(0, ${feed_posts.likes_count} - 1)` })
        .where(eq(feed_posts.post_id, postId))
        .returning({ likesCount: feed_posts.likes_count });

      return { liked: false, likesCount: updated?.likesCount ?? 0 };
    }

    await tx.insert(feed_post_likes).values({
      post_id: postId,
      user_uid: userUid,
      created_at: Date.now(),
    });

    const [updated] = await tx
      .update(feed_posts)
      .set({ likes_count: sql`${feed_posts.likes_count} + 1` })
      .where(eq(feed_posts.post_id, postId))
      .returning({ likesCount: feed_posts.likes_count });

    return { liked: true, likesCount: updated?.likesCount ?? 1 };
  });
}

export async function togglePostBookmark(
  postId: string,
  userUid: string,
): Promise<{ bookmarked: boolean }> {
  const { db } = getDb();

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(feed_bookmarks)
      .where(and(eq(feed_bookmarks.post_id, postId), eq(feed_bookmarks.user_uid, userUid)))
      .limit(1);

    if (existing) {
      await tx
        .delete(feed_bookmarks)
        .where(and(eq(feed_bookmarks.post_id, postId), eq(feed_bookmarks.user_uid, userUid)));
      return { bookmarked: false };
    }

    await tx.insert(feed_bookmarks).values({
      post_id: postId,
      user_uid: userUid,
      created_at: Date.now(),
    });
    return { bookmarked: true };
  });
}

export async function getPostComments(
  postId: string,
  userUid?: string,
): Promise<{ comments: FeedCommentDto[] }> {
  const { db } = getDb();

  const commentRows = await db
    .select()
    .from(feed_comments)
    .where(eq(feed_comments.post_id, postId))
    .orderBy(asc(feed_comments.created_at));

  if (commentRows.length === 0) {
    return { comments: [] };
  }

  const authorUids = Array.from(new Set(commentRows.map((c) => c.author_uid)));
  const commentIds = commentRows.map((c) => c.comment_id);

  const authorRows = await db
    .select({
      uid: users.uid,
      idreg: users.idreg,
      topic: users.topic,
      username: users.username,
      pic: users.pic,
      documentationc: users.documentationc,
    })
    .from(users)
    .where(inArray(users.uid, authorUids));

  const authorMap = new Map<string, FeedAuthor>();
  for (const a of authorRows) {
    if (a.uid) {
      authorMap.set(a.uid, {
        uid: a.uid,
        idreg: Number(a.idreg || 0),
        topic: a.topic || "عضو",
        username: a.username || "",
        pic: a.pic || "pic.png",
        documentationc: Number(a.documentationc || 0),
      });
    }
  }

  const likedCommentSet = new Set<string>();
  if (userUid) {
    const likes = await db
      .select({ commentId: feed_comment_likes.comment_id })
      .from(feed_comment_likes)
      .where(
        and(
          eq(feed_comment_likes.user_uid, userUid),
          inArray(feed_comment_likes.comment_id, commentIds),
        ),
      );
    for (const l of likes) likedCommentSet.add(l.commentId);
  }

  // Build tree: top-level comments and nested replies
  const topLevelComments: FeedCommentDto[] = [];
  const repliesMap = new Map<string, FeedCommentDto[]>();

  for (const c of commentRows) {
    const author = authorMap.get(c.author_uid) || {
      uid: c.author_uid,
      idreg: 0,
      topic: "مستخدم",
      username: "",
      pic: "pic.png",
      documentationc: 0,
    };

    const dto: FeedCommentDto = {
      id: c.id,
      commentId: c.comment_id,
      postId: c.post_id,
      parentCommentId: c.parent_comment_id || "",
      replyToUid: c.reply_to_uid || "",
      replyToUsername: c.reply_to_username || "",
      author,
      content: c.content,
      likesCount: c.likes_count,
      repliesCount: c.replies_count,
      createdAt: c.created_at,
      isLiked: likedCommentSet.has(c.comment_id),
      replies: [],
    };

    if (!c.parent_comment_id) {
      topLevelComments.push(dto);
    } else {
      const list = repliesMap.get(c.parent_comment_id) || [];
      list.push(dto);
      repliesMap.set(c.parent_comment_id, list);
    }
  }

  // Attach replies
  for (const top of topLevelComments) {
    top.replies = repliesMap.get(top.commentId) || [];
  }

  return { comments: topLevelComments };
}

export async function addPostComment(params: {
  postId: string;
  authorUid: string;
  content: string;
  parentCommentId?: string;
  replyToUid?: string;
  replyToUsername?: string;
}): Promise<FeedCommentDto> {
  const { db } = getDb();
  const content = String(params.content || "").trim();
  if (!content) throw new Error("CONTENT_REQUIRED");
  if (content.length > 1000) throw new Error("CONTENT_TOO_LONG");

  const [authorRow] = await db
    .select({
      idreg: users.idreg,
      topic: users.topic,
      username: users.username,
      pic: users.pic,
      documentationc: users.documentationc,
    })
    .from(users)
    .where(eq(users.uid, params.authorUid))
    .limit(1);

  if (!authorRow) throw new Error("AUTHOR_NOT_FOUND");

  const now = Date.now();
  const commentId = `comm_${now}_${crypto.randomBytes(4).toString("hex")}`;
  const parentCommentId = String(params.parentCommentId || "").trim();

  return await db.transaction(async (tx) => {
    await tx.insert(feed_comments).values({
      comment_id: commentId,
      post_id: params.postId,
      parent_comment_id: parentCommentId,
      reply_to_uid: String(params.replyToUid || "").trim(),
      reply_to_username: String(params.replyToUsername || "").trim(),
      author_uid: params.authorUid,
      content,
      likes_count: 0,
      replies_count: 0,
      created_at: now,
      updated_at: now,
    });

    // Increment post comments_count
    await tx
      .update(feed_posts)
      .set({ comments_count: sql`${feed_posts.comments_count} + 1` })
      .where(eq(feed_posts.post_id, params.postId));

    // If nested reply, increment parent replies_count
    if (parentCommentId) {
      await tx
        .update(feed_comments)
        .set({ replies_count: sql`${feed_comments.replies_count} + 1` })
        .where(eq(feed_comments.comment_id, parentCommentId));
    }

    return {
      id: 0,
      commentId,
      postId: params.postId,
      parentCommentId,
      replyToUid: String(params.replyToUid || "").trim(),
      replyToUsername: String(params.replyToUsername || "").trim(),
      author: {
        uid: params.authorUid,
        idreg: authorRow.idreg,
        topic: authorRow.topic,
        username: authorRow.username,
        pic: authorRow.pic || "pic.png",
        documentationc: Number(authorRow.documentationc || 0),
      },
      content,
      likesCount: 0,
      repliesCount: 0,
      createdAt: now,
      isLiked: false,
      replies: [],
    };
  });
}

export async function deletePostComment(
  commentId: string,
  actorUid: string,
  isSuperAdmin = false,
): Promise<boolean> {
  const { db } = getDb();
  const [comm] = await db
    .select()
    .from(feed_comments)
    .where(eq(feed_comments.comment_id, commentId))
    .limit(1);

  if (!comm) throw new Error("COMMENT_NOT_FOUND");
  if (comm.author_uid !== actorUid && !isSuperAdmin) {
    throw new Error("FORBIDDEN");
  }

  await db.transaction(async (tx) => {
    // Decrement post comments_count
    await tx
      .update(feed_posts)
      .set({ comments_count: sql`GREATEST(0, ${feed_posts.comments_count} - 1)` })
      .where(eq(feed_posts.post_id, comm.post_id));

    // If had parent, decrement parent replies_count
    if (comm.parent_comment_id) {
      await tx
        .update(feed_comments)
        .set({ replies_count: sql`GREATEST(0, ${feed_comments.replies_count} - 1)` })
        .where(eq(feed_comments.comment_id, comm.parent_comment_id));
    }

    await tx.delete(feed_comment_likes).where(eq(feed_comment_likes.comment_id, commentId));
    await tx.delete(feed_comments).where(eq(feed_comments.comment_id, commentId));
  });

  return true;
}

export async function toggleCommentLike(
  commentId: string,
  userUid: string,
): Promise<{ liked: boolean; likesCount: number }> {
  const { db } = getDb();

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(feed_comment_likes)
      .where(and(eq(feed_comment_likes.comment_id, commentId), eq(feed_comment_likes.user_uid, userUid)))
      .limit(1);

    if (existing) {
      await tx
        .delete(feed_comment_likes)
        .where(and(eq(feed_comment_likes.comment_id, commentId), eq(feed_comment_likes.user_uid, userUid)));

      const [updated] = await tx
        .update(feed_comments)
        .set({ likes_count: sql`GREATEST(0, ${feed_comments.likes_count} - 1)` })
        .where(eq(feed_comments.comment_id, commentId))
        .returning({ likesCount: feed_comments.likes_count });

      return { liked: false, likesCount: updated?.likesCount ?? 0 };
    }

    await tx.insert(feed_comment_likes).values({
      comment_id: commentId,
      user_uid: userUid,
      created_at: Date.now(),
    });

    const [updated] = await tx
      .update(feed_comments)
      .set({ likes_count: sql`${feed_comments.likes_count} + 1` })
      .where(eq(feed_comments.comment_id, commentId))
      .returning({ likesCount: feed_comments.likes_count });

    return { liked: true, likesCount: updated?.likesCount ?? 1 };
  });
}

export async function toggleFollowUser(
  followerUid: string,
  targetUid: string,
): Promise<{ following: boolean }> {
  const { db } = getDb();
  if (followerUid === targetUid) throw new Error("CANNOT_FOLLOW_SELF");

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(followers)
      .where(
        and(
          eq(followers.follower_id, followerUid),
          eq(followers.following_id, targetUid),
        ),
      )
      .limit(1);

    if (existing) {
      await tx
        .delete(followers)
        .where(
          and(
            eq(followers.follower_id, followerUid),
            eq(followers.following_id, targetUid),
          ),
        );
      return { following: false };
    }

    await tx.insert(followers).values({
      follower_id: followerUid,
      following_id: targetUid,
      created_at: Date.now(),
    });
    return { following: true };
  });
}

export async function sendFeedPostGift(params: {
  senderUid: string;
  senderIp?: string;
  postId: string;
  giftFile: string;
  quantity?: number;
  unitCoin: number;
  idempotencyKey: string;
}) {
  const { db } = getDb();

  // Find post and author
  const [post] = await db
    .select({
      postId: feed_posts.post_id,
      authorUid: feed_posts.author_uid,
      authorIdreg: feed_posts.author_idreg,
    })
    .from(feed_posts)
    .where(eq(feed_posts.post_id, params.postId))
    .limit(1);

  if (!post) throw new Error("POST_NOT_FOUND");
  if (post.authorUid === params.senderUid) throw new Error("CANNOT_GIFT_SELF");

  // Get sender idreg
  const [sender] = await db
    .select({ idreg: users.idreg })
    .from(users)
    .where(eq(users.uid, params.senderUid))
    .limit(1);

  if (!sender) throw new Error("SENDER_NOT_FOUND");

  // Call the unified idempotent transfer engine
  return await executeWithIdempotency({
    senderIdreg: sender.idreg,
    senderUid: params.senderUid,
    senderIp: params.senderIp || "",
    receiverIdreg: post.authorIdreg || 0,
    receiverUid: post.authorUid,
    giftFile: params.giftFile,
    quantity: params.quantity || 1,
    unitCoin: params.unitCoin,
    userUid: params.senderUid,
    idempotencyKey: params.idempotencyKey,
    sourceType: "feed_post",
    targetId: params.postId,
    noteSender: `Gift on feed post ${params.postId}`,
  });
}
