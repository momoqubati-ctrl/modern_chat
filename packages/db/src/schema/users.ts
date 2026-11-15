import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    idreg: serial("idreg").primaryKey(),
    bg: varchar("bg", { length: 255 }).default("#FFFFFF"),
    mcol: varchar("mcol", { length: 255 }).default("#000000"),
    ucol: varchar("ucol", { length: 255 }).default("#000000"),
    evaluation: integer("evaluation").default(0),
    ico: varchar("ico", { length: 255 }).default(""),
    ip: varchar("ip", { length: 255 }).default(""),
    fp: varchar("fp", { length: 255 }).default(""),
    id: varchar("id", { length: 255 }),
    lid: varchar("lid", { length: 255 }),
    uid: varchar("uid", { length: 255 }),
    msg: varchar("msg", { length: 255 }).default("(عضو جديد)"),
    pic: varchar("pic", { length: 255 }).default("pic.png"),
    pich: varchar("pich", { length: 255 }).default("pich.png"),
    power: varchar("power", { length: 255 }).default(""),
    rep: bigint("rep", { mode: "number" }).default(0),
    topic: varchar("topic", { length: 255 }).notNull(),
    username: varchar("username", { length: 50 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    youtub: varchar("youtub", { length: 255 }).default(""),
    them: varchar("them", { length: 255 }).default(""),
    cover: varchar("cover", { length: 255 }).default(""),
    loginG: boolean("loginG").default(false),
    muted: boolean("muted").default(false),
    documentationc: integer("documentationc").default(0),
    lastssen: text("lastssen"),
    joinuser: text("joinuser"),
    site_badge_id: varchar("site_badge_id", { length: 255 }).default(""),
    site_badge: text("site_badge"),
    coins: bigint("coins", { mode: "number" }).default(0),
    gift_ico: varchar("gift_ico", { length: 255 }).default(""),
    gcol: varchar("gcol", { length: 255 }).default("#FFFFFF"),
    last_eval_login_day: varchar("last_eval_login_day", { length: 20 }).default(""),
    auto_power: varchar("auto_power", { length: 255 }).default(""),
    wall_post_likes: bigint("wall_post_likes", { mode: "number" }).default(0),
    gifts_received_count: bigint("gifts_received_count", { mode: "number" }).default(0),
    eval_awards_json: text("eval_awards_json"),
    busy: boolean("busy").default(false),
    alerts: boolean("alerts").default(false),
    nopmcall: boolean("nopmcall").default(false),
    nopmvideocall: boolean("nopmvideocall").default(false),
  },
  (t) => [
    uniqueIndex("uniq_users_username").on(t.username),
    index("idx_users_uid").on(t.uid),
    index("idx_users_lid").on(t.lid),
    index("idx_users_token").on(t.token),
    index("idx_users_ip").on(t.ip),
    index("idx_users_fp").on(t.fp),
    index("idx_users_topic").on(t.topic),
    index("idx_users_eval_desc").on(t.evaluation),
    index("idx_users_rep_desc").on(t.rep),
  ]
);

export const names = pgTable(
  "names",
  {
    id: serial("id").primaryKey(),
    iduser: varchar("iduser", { length: 255 }),
    fp: varchar("fp", { length: 255 }),
    ip: varchar("ip", { length: 255 }),
    topic: varchar("topic", { length: 255 }),
    username: varchar("username", { length: 255 }),
  },
  (t) => [
    index("idx_names_iduser").on(t.iduser),
    index("idx_names_fp").on(t.fp),
    index("idx_names_ip").on(t.ip),
  ]
);

export const followers = pgTable(
  "followers",
  {
    id: serial("id").primaryKey(),
    follower_id: varchar("follower_id", { length: 255 }).notNull(),
    following_id: varchar("following_id", { length: 255 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_followers_follower").on(t.follower_id),
    index("idx_followers_following").on(t.following_id),
    uniqueIndex("uniq_followers_pair").on(t.follower_id, t.following_id),
  ]
);

export const profile_visits = pgTable(
  "profile_visits",
  {
    id: serial("id").primaryKey(),
    owner_id: varchar("owner_id", { length: 255 }),
    visitor_id: varchar("visitor_id", { length: 255 }),
    visitor_name: varchar("visitor_name", { length: 255 }),
    visitor_pic: varchar("visitor_pic", { length: 255 }),
    seen: integer("seen").default(0),
    time: bigint("time", { mode: "number" }),
    visitor_type: varchar("visitor_type", { length: 20 }).default("عضو"),
  },
  (t) => [
    index("idx_profile_visits_owner").on(t.owner_id),
    index("idx_profile_visits_visitor").on(t.visitor_id),
    index("idx_profile_visits_owner_seen").on(t.owner_id, t.seen, t.time),
  ]
);

export const sub = pgTable(
  "sub",
  {
    id: serial("id").primaryKey(),
    iduser: varchar("iduser", { length: 255 }),
    sub: varchar("sub", { length: 255 }),
    topic: varchar("topic", { length: 255 }),
    topic1: varchar("topic1", { length: 255 }),
    timestart: varchar("timestart", { length: 255 }),
    timefinish: varchar("timefinish", { length: 255 }),
    timeis: varchar("timeis", { length: 255 }),
  },
  (t) => [
    index("idx_sub_iduser").on(t.iduser),
    index("idx_sub_sub").on(t.sub),
    index("idx_sub_timefinish").on(t.timefinish),
  ]
);
