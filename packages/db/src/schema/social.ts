import {
  pgTable,
  serial,
  bigserial,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const bars = pgTable(
  "bars",
  {
    id: serial("id").primaryKey(),
    bcc: text("bcc"),
    likes: varchar("likes", { length: 2000 }).default("[]"),
    bg: varchar("bg", { length: 255 }),
    bid: varchar("bid", { length: 255 }),
    lid: varchar("lid", { length: 255 }),
    mcol: varchar("mcol", { length: 255 }),
    msg: text("msg"),
    pic: varchar("pic", { length: 255 }),
    topic: varchar("topic", { length: 255 }),
    ucol: varchar("ucol", { length: 255 }),
    uid: varchar("uid", { length: 255 }),
  },
  (t) => [
    index("idx_bars_bid").on(t.bid),
    index("idx_bars_uid").on(t.uid),
    index("idx_bars_lid").on(t.lid),
    index("idx_bars_lid_bid").on(t.lid, t.bid),
  ]
);

export const storie = pgTable(
  "storie",
  {
    id: serial("id").primaryKey(),
    sid: varchar("sid", { length: 255 }).default(""),
    photo: varchar("photo", { length: 255 }).default(""),
    name: varchar("name", { length: 255 }).default(""),
    link: varchar("link", { length: 255 }).default(""),
    lastUpdated: varchar("lastUpdated", { length: 255 }).default(""),
    item: text("item").default("[]"),
    seen: boolean("seen").default(false),
    currentPreview: varchar("currentPreview", { length: 2000 }).default("[]"),
  },
  (t) => [index("idx_storie_sid").on(t.sid)]
);

export const storieview = pgTable(
  "storieview",
  {
    id: serial("id").primaryKey(),
    sid: varchar("sid", { length: 255 }).default(""),
    topic: varchar("topic", { length: 255 }).default(""),
    photo: varchar("photo", { length: 255 }).default(""),
    idsto: varchar("idsto", { length: 255 }).default(""),
    item: integer("item").default(0),
    time: text("time"),
  },
  (t) => [
    index("idx_storieview_sid").on(t.sid),
    index("idx_storieview_idsto").on(t.idsto),
  ]
);

export const story_likes = pgTable(
  "story_likes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    story_sid: varchar("story_sid", { length: 255 }).notNull(),
    item_id: varchar("item_id", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    topic: varchar("topic", { length: 255 }).default(""),
    photo: varchar("photo", { length: 255 }).default(""),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_story_likes_target").on(t.story_sid, t.item_id),
    index("idx_story_likes_user").on(t.story_sid, t.item_id, t.user_uid),
  ]
);

export const story_comments = pgTable(
  "story_comments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cid: varchar("cid", { length: 64 }).notNull(),
    story_sid: varchar("story_sid", { length: 255 }).notNull(),
    item_id: varchar("item_id", { length: 64 }).notNull(),
    parent_cid: varchar("parent_cid", { length: 64 }).default(""),
    reply_to_topic: varchar("reply_to_topic", { length: 255 }).default(""),
    author_uid: varchar("author_uid", { length: 255 }).notNull(),
    author_topic: varchar("author_topic", { length: 255 }).default(""),
    author_pic: varchar("author_pic", { length: 255 }).default(""),
    author_ucol: varchar("author_ucol", { length: 64 }).default(""),
    author_verified: boolean("author_verified").default(false),
    body: text("body").notNull(),
    likes_count: integer("likes_count").default(0),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_story_comments_target").on(t.story_sid, t.item_id, t.created_at),
    index("idx_story_comments_cid").on(t.cid),
    index("idx_story_comments_parent").on(t.parent_cid),
  ]
);

export const story_comment_likes = pgTable(
  "story_comment_likes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    comment_cid: varchar("comment_cid", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("idx_story_comment_likes_cid_user").on(t.comment_cid, t.user_uid)]
);

export const top10wall = pgTable(
  "top10wall",
  {
    id: serial("id").primaryKey(),
    uid: varchar("uid", { length: 255 }).default(""),
    otype: varchar("otype", { length: 255 }).default(""),
    pic: varchar("pic", { length: 255 }).default(""),
    topic: varchar("topic", { length: 255 }).default(""),
  },
  (t) => [
    index("idx_top10wall_uid").on(t.uid),
    index("idx_top10wall_otype").on(t.otype),
  ]
);

export const internal_mail = pgTable(
  "internal_mail",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    from_uid: varchar("from_uid", { length: 255 }).notNull(),
    from_username: varchar("from_username", { length: 255 }).default(""),
    from_topic: varchar("from_topic", { length: 255 }).default(""),
    from_pic: varchar("from_pic", { length: 255 }).default(""),
    to_uid: varchar("to_uid", { length: 255 }).notNull(),
    to_username: varchar("to_username", { length: 255 }).default(""),
    to_topic: varchar("to_topic", { length: 255 }).default(""),
    to_pic: varchar("to_pic", { length: 255 }).default(""),
    body: text("body"),
    is_read: boolean("is_read").default(false),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    read_at: bigint("read_at", { mode: "number" }).default(0),
  },
  (t) => [
    index("idx_mail_from_uid").on(t.from_uid),
    index("idx_mail_to_uid").on(t.to_uid, t.is_read, t.created_at),
  ]
);

export const intromsg = pgTable(
  "intromsg",
  {
    id: serial("id").primaryKey(),
    category: varchar("category", { length: 255 }),
    adresse: varchar("adresse", { length: 255 }),
    msg: varchar("msg", { length: 255 }),
  },
  (t) => [index("idx_intromsg_category").on(t.category)]
);

// ---------- Dedicated Member Notes System (Separated from Stories) ----------

export const user_notes = pgTable(
  "user_notes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    nid: varchar("nid", { length: 64 }).notNull(),
    uid: varchar("uid", { length: 255 }).notNull(),
    author_topic: varchar("author_topic", { length: 255 }).default(""),
    author_pic: varchar("author_pic", { length: 255 }).default(""),
    author_ucol: varchar("author_ucol", { length: 64 }).default(""),
    author_verified: boolean("author_verified").default(false),
    type: varchar("type", { length: 32 }).notNull().default("text"), // "text" | "audio"
    text: text("text").default(""),
    caption: varchar("caption", { length: 500 }).default(""),
    audio_url: varchar("audio_url", { length: 500 }).default(""),
    duration: integer("duration").default(0),
    tag: varchar("tag", { length: 64 }).default(""),
    likes_count: integer("likes_count").default(0),
    comments_count: integer("comments_count").default(0),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_user_notes_nid").on(t.nid),
    index("idx_user_notes_uid").on(t.uid),
    index("idx_user_notes_created_at").on(t.created_at),
  ]
);

export const note_likes = pgTable(
  "note_likes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    note_nid: varchar("note_nid", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    topic: varchar("topic", { length: 255 }).default(""),
    photo: varchar("photo", { length: 255 }).default(""),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_note_likes_target").on(t.note_nid),
    index("idx_note_likes_user").on(t.note_nid, t.user_uid),
  ]
);

export const note_comments = pgTable(
  "note_comments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cid: varchar("cid", { length: 64 }).notNull(),
    note_nid: varchar("note_nid", { length: 64 }).notNull(),
    parent_cid: varchar("parent_cid", { length: 64 }).default(""),
    reply_to_topic: varchar("reply_to_topic", { length: 255 }).default(""),
    author_uid: varchar("author_uid", { length: 255 }).notNull(),
    author_topic: varchar("author_topic", { length: 255 }).default(""),
    author_pic: varchar("author_pic", { length: 255 }).default(""),
    author_ucol: varchar("author_ucol", { length: 64 }).default(""),
    author_verified: boolean("author_verified").default(false),
    body: text("body").notNull(),
    likes_count: integer("likes_count").default(0),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_note_comments_target").on(t.note_nid, t.created_at),
    index("idx_note_comments_cid").on(t.cid),
    index("idx_note_comments_parent").on(t.parent_cid),
  ]
);

export const note_comment_likes = pgTable(
  "note_comment_likes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    comment_cid: varchar("comment_cid", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("idx_note_comment_likes_cid_user").on(t.comment_cid, t.user_uid)]
);
