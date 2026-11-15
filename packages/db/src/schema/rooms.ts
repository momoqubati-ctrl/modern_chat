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

export const rooms = pgTable(
  "rooms",
  {
    idroom: serial("idroom").primaryKey(),
    about: varchar("about", { length: 255 }),
    user: varchar("user", { length: 255 }),
    pass: varchar("pass", { length: 255 }),
    id: varchar("id", { length: 255 }),
    owner: varchar("owner", { length: 255 }),
    topic: varchar("topic", { length: 255 }),
    pic: varchar("pic", { length: 255 }),
    rmli: integer("rmli").default(0),
    mic: integer("mic").default(0),
    welcome: varchar("welcome", { length: 255 }),
    broadcast: boolean("broadcast").default(false),
    deleted: boolean("deleted").default(false),
    needpass: boolean("needpass").default(false),
    color: varchar("color", { length: 255 }).default("#000000"),
    max: integer("max").default(0),
    stage_count: integer("stage_count").default(5),
    stage_state: text("stage_state"),
    room_owner_meta: text("room_owner_meta"),
    message_mode: varchar("message_mode", { length: 16 }).default("real"),
  },
  (t) => [
    index("idx_rooms_id").on(t.id),
    index("idx_rooms_owner").on(t.owner),
    index("idx_rooms_topic").on(t.topic),
  ]
);

export const room_welcome_visits = pgTable(
  "room_welcome_visits",
  {
    id: serial("id").primaryKey(),
    room_id: varchar("room_id", { length: 255 }).notNull(),
    identity_key: varchar("identity_key", { length: 255 }).notNull(),
    is_guest: boolean("is_guest").default(false),
    first_seen: bigint("first_seen", { mode: "number" }).default(0),
    last_seen: bigint("last_seen", { mode: "number" }).default(0),
    visits: integer("visits").default(1),
  },
  (t) => [
    uniqueIndex("uniq_room_welcome_visit").on(t.room_id, t.identity_key),
    index("idx_room_welcome_room").on(t.room_id),
  ]
);

export const bots = pgTable(
  "bots",
  {
    idreg: serial("idreg").primaryKey(),
    msg: varchar("msg", { length: 255 }).default("(عضو جديد)"),
    pic: varchar("pic", { length: 255 }).default("pic.png"),
    power: varchar("power", { length: 255 }).default(""),
    country: varchar("country", { length: 255 }).default(""),
    room: varchar("room", { length: 255 }).default(""),
    ip: varchar("ip", { length: 255 }).default(""),
    id: varchar("id", { length: 255 }).default(""),
    stat: integer("stat").default(0),
    topic: varchar("topic", { length: 255 }).default(""),
  },
  (t) => [
    index("idx_bots_id").on(t.id),
    index("idx_bots_room").on(t.room),
    index("idx_bots_stat").on(t.stat),
  ]
);
