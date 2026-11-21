import {
  pgTable,
  bigserial,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const feed_posts = pgTable(
  "feed_posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    post_id: varchar("post_id", { length: 64 }).notNull(),
    author_uid: varchar("author_uid", { length: 255 }).notNull(),
    author_idreg: integer("author_idreg").default(0),
    caption: text("caption").default(""),
    media_type: varchar("media_type", { length: 32 }).notNull().default("image"), // "image" | "carousel" | "video"
    music_title: varchar("music_title", { length: 255 }).default(""),
    likes_count: integer("likes_count").default(0).notNull(),
    comments_count: integer("comments_count").default(0).notNull(),
    reposts_count: integer("reposts_count").default(0).notNull(),
    shares_count: integer("shares_count").default(0).notNull(),
    views_count: integer("views_count").default(0).notNull(),
    gifts_count: integer("gifts_count").default(0).notNull(),
    visibility: varchar("visibility", { length: 32 }).default("public").notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_feed_posts_post_id").on(t.post_id),
    index("idx_feed_posts_created_at").on(t.created_at),
    index("idx_feed_posts_author").on(t.author_uid, t.created_at),
  ]
);

export const feed_post_media = pgTable(
  "feed_post_media",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    post_id: varchar("post_id", { length: 64 }).notNull(),
    media_type: varchar("media_type", { length: 32 }).notNull().default("image"), // "image" | "video"
    url: varchar("url", { length: 1024 }).notNull(),
    thumbnail_url: varchar("thumbnail_url", { length: 1024 }).default(""),
    width: integer("width").default(0),
    height: integer("height").default(0),
    duration: integer("duration").default(0),
    sort_order: integer("sort_order").default(0).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_feed_media_post_sort").on(t.post_id, t.sort_order),
  ]
);

export const feed_post_likes = pgTable(
  "feed_post_likes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    post_id: varchar("post_id", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_feed_post_likes").on(t.post_id, t.user_uid),
    index("idx_feed_post_likes_user").on(t.user_uid),
  ]
);

export const feed_comments = pgTable(
  "feed_comments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    comment_id: varchar("comment_id", { length: 64 }).notNull(),
    post_id: varchar("post_id", { length: 64 }).notNull(),
    parent_comment_id: varchar("parent_comment_id", { length: 64 }).default(""),
    reply_to_uid: varchar("reply_to_uid", { length: 255 }).default(""),
    reply_to_username: varchar("reply_to_username", { length: 255 }).default(""),
    author_uid: varchar("author_uid", { length: 255 }).notNull(),
    content: text("content").notNull(),
    likes_count: integer("likes_count").default(0).notNull(),
    replies_count: integer("replies_count").default(0).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_feed_comments_id").on(t.comment_id),
    index("idx_feed_comments_post_created").on(t.post_id, t.created_at),
    index("idx_feed_comments_parent").on(t.parent_comment_id, t.created_at),
    index("idx_feed_comments_author").on(t.author_uid),
  ]
);

export const feed_comment_likes = pgTable(
  "feed_comment_likes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    comment_id: varchar("comment_id", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_feed_comment_likes").on(t.comment_id, t.user_uid),
    index("idx_feed_comment_likes_user").on(t.user_uid),
  ]
);

export const feed_bookmarks = pgTable(
  "feed_bookmarks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    post_id: varchar("post_id", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_feed_bookmarks").on(t.post_id, t.user_uid),
    index("idx_feed_bookmarks_user").on(t.user_uid, t.created_at),
  ]
);

export const feed_post_reposts = pgTable(
  "feed_post_reposts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    post_id: varchar("post_id", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_feed_post_reposts").on(t.post_id, t.user_uid),
    index("idx_feed_post_reposts_user").on(t.user_uid, t.created_at),
    index("idx_feed_post_reposts_post").on(t.post_id, t.created_at),
  ]
);

export const feed_post_gifts = pgTable(
  "feed_post_gifts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    post_id: varchar("post_id", { length: 64 }).notNull(),
    sender_uid: varchar("sender_uid", { length: 255 }).notNull(),
    gift_file: varchar("gift_file", { length: 255 }).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unit_coin: integer("unit_coin").default(0).notNull(),
    total_coin: integer("total_coin").default(0).notNull(),
    txid: varchar("txid", { length: 128 }).default(""),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_feed_post_gifts_post").on(t.post_id, t.created_at),
    index("idx_feed_post_gifts_sender").on(t.sender_uid, t.created_at),
  ]
);

export type FeedPostRecord = typeof feed_posts.$inferSelect;
export type NewFeedPostRecord = typeof feed_posts.$inferInsert;
export type FeedPostMediaRecord = typeof feed_post_media.$inferSelect;
export type FeedCommentRecord = typeof feed_comments.$inferSelect;
export type FeedPostRepostRecord = typeof feed_post_reposts.$inferSelect;
export type FeedPostGiftRecord = typeof feed_post_gifts.$inferSelect;
