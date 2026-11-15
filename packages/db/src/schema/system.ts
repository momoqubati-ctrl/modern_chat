import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const owner = pgTable(
  "owner",
  {
    id: serial("id").primaryKey(),
    bars: boolean("bars").default(true),
    Vpn: boolean("Vpn").default(false),
    Gust: text("Gust"),
    datafinish: timestamp("datafinish").defaultNow(),
    MaxRep: integer("MaxRep").default(3),
    Tv: text("Tv"),
    Vistor: text("Vistor"),
    room: varchar("room", { length: 255 }),
    isbanner: boolean("isbanner").default(false),
    rc: boolean("rc").default(false),
    cooment: boolean("cooment").default(false),
    offline: boolean("offline").default(false),
  },
  (t) => [index("idx_owner_room").on(t.room)]
);

export const site = pgTable(
  "site",
  {
    id: serial("id").primaryKey(),
    banner: varchar("banner", { length: 255 }),
    host: varchar("host", { length: 255 }),
    ids: integer("ids"),
    logo: varchar("logo", { length: 255 }),
  },
  (t) => [
    index("idx_site_ids").on(t.ids),
    index("idx_site_host").on(t.host),
  ]
);

export const hosts = pgTable(
  "hosts",
  {
    id: serial("id").primaryKey(),
    hostname: varchar("hostname", { length: 255 }),
    setting: integer("setting"),
  },
  (t) => [
    index("idx_hosts_hostname").on(t.hostname),
    index("idx_hosts_setting").on(t.setting),
  ]
);

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  site: text("site"),
  dro3: text("dro3"),
  them: text("them"),
  cover: text("cover"),
  emo: text("emo"),
  sico: text("sico"),
  room_badges: text("room_badges"),
  site_badges: text("site_badges"),
  gifts_git: text("gifts_git"),
  gift_categories: text("gift_categories"),
});

export const powers = pgTable("powers", {
  id: serial("id").primaryKey(),
  powers: text("powers"),
});

export const band = pgTable(
  "band",
  {
    id: serial("id").primaryKey(),
    name_band: varchar("name_band", { length: 255 }),
    type: varchar("type", { length: 255 }),
    deccode: varchar("deccode", { length: 255 }),
    decoderDans: varchar("decoderDans", { length: 255 }),
    device_band: varchar("device_band", { length: 255 }),
    ip_band: varchar("ip_band", { length: 255 }),
    country_band: varchar("country_band", { length: 2 }),
    date: varchar("date", { length: 255 }).default("دائم"),
  },
  (t) => [
    index("idx_band_device_band").on(t.device_band),
    index("idx_band_ip_band").on(t.ip_band),
    index("idx_band_country_band").on(t.country_band),
    index("idx_band_decoderDans").on(t.decoderDans),
    index("idx_band_name_band").on(t.name_band),
  ]
);

export const bsb = pgTable("bsb", {
  id: serial("id").primaryKey(),
  systems: varchar("systems", { length: 255 }).default(""),
  browsers: varchar("browsers", { length: 255 }).default(""),
});

export const cuts = pgTable(
  "cuts",
  {
    id: serial("id").primaryKey(),
    text1: varchar("text1", { length: 255 }),
    text2: varchar("text2", { length: 255 }),
  },
  (t) => [index("idx_cuts_text1").on(t.text1)]
);

export const notext = pgTable(
  "notext",
  {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 255 }),
    path: varchar("path", { length: 255 }),
    v: varchar("v", { length: 255 }),
  },
  (t) => [
    index("idx_notext_type").on(t.type),
    index("idx_notext_path").on(t.path),
  ]
);

export const histletter = pgTable(
  "histletter",
  {
    id: serial("id").primaryKey(),
    ip: varchar("ip", { length: 255 }),
    msg: varchar("msg", { length: 255 }),
    topic: varchar("topic", { length: 255 }),
    v: varchar("v", { length: 255 }),
    time: varchar("time", { length: 255 }),
    target: varchar("target", { length: 255 }),
    source: varchar("source", { length: 255 }),
    path: varchar("path", { length: 255 }),
  },
  (t) => [
    index("idx_histletter_ip").on(t.ip),
    index("idx_histletter_topic").on(t.topic),
  ]
);

export const logs = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    state: varchar("state", { length: 255 }),
    topic: varchar("topic", { length: 255 }),
    username: varchar("username", { length: 255 }),
    ip: varchar("ip", { length: 255 }),
    code: varchar("code", { length: 255 }),
    device: varchar("device", { length: 255 }).default("en"),
    isin: varchar("isin", { length: 255 }),
    time: text("time"),
  },
  (t) => [
    index("idx_logs_ip").on(t.ip),
    index("idx_logs_state").on(t.state),
    index("idx_logs_lookup").on(t.ip, t.state, t.topic, t.username),
  ]
);

export const stats = pgTable(
  "stats",
  {
    id: serial("id").primaryKey(),
    state: varchar("state", { length: 255 }),
    topic: varchar("topic", { length: 255 }),
    username: varchar("username", { length: 255 }),
    room: varchar("room", { length: 255 }),
    ip: varchar("ip", { length: 255 }),
    time: varchar("time", { length: 255 }),
  },
  (t) => [
    index("idx_stats_room").on(t.room),
    index("idx_stats_ip").on(t.ip),
    index("idx_stats_time").on(t.time),
  ]
);
