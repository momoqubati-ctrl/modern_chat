import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

export function createDbPool(connectionString?: string) {
  const url =
    connectionString ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:5432/newchat";

  const max = Math.max(10, parseInt(process.env.PG_POOL_MAX || "30", 10) || 30);

  const isSslRequired =
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_SSL === "1" ||
    (process.env.DATABASE_SSL !== "false" &&
      (url.includes("supabase.com") ||
        url.includes("pooler.supabase.com") ||
        url.includes("render.com") ||
        url.includes("dpg-") ||
        url.includes("sslmode=require")));

  const ssl = isSslRequired ? { rejectUnauthorized: false } : undefined;

  return new Pool({
    connectionString: url,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl,
  });
}

let cachedPool: pg.Pool | null = null;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let giftTablesEnsurePromise: Promise<void> | null = null;

export function getDb() {
  if (!cachedPool || !cachedDb) {
    cachedPool = createDbPool();
    cachedDb = drizzle(cachedPool, { schema });
  }
  return { db: cachedDb, pool: cachedPool };
}

export async function closeDb() {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
    cachedDb = null;
  }
}

export async function ensureNotesTablesExist(): Promise<void> {
  const { pool } = getDb();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notes (
      id BIGSERIAL PRIMARY KEY,
      nid VARCHAR(64) NOT NULL,
      uid VARCHAR(255) NOT NULL,
      author_topic VARCHAR(255) DEFAULT '',
      author_pic VARCHAR(255) DEFAULT '',
      author_ucol VARCHAR(64) DEFAULT '',
      author_verified BOOLEAN DEFAULT FALSE,
      type VARCHAR(32) NOT NULL DEFAULT 'text',
      text TEXT DEFAULT '',
      caption VARCHAR(500) DEFAULT '',
      audio_url VARCHAR(500) DEFAULT '',
      duration INTEGER DEFAULT 0,
      tag VARCHAR(64) DEFAULT '',
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_notes_nid ON user_notes (nid);
    CREATE INDEX IF NOT EXISTS idx_user_notes_uid ON user_notes (uid);
    CREATE INDEX IF NOT EXISTS idx_user_notes_created_at ON user_notes (created_at DESC);

    CREATE TABLE IF NOT EXISTS note_likes (
      id BIGSERIAL PRIMARY KEY,
      note_nid VARCHAR(64) NOT NULL,
      user_uid VARCHAR(255) NOT NULL,
      topic VARCHAR(255) DEFAULT '',
      photo VARCHAR(255) DEFAULT '',
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_note_likes_target ON note_likes (note_nid);
    CREATE INDEX IF NOT EXISTS idx_note_likes_user ON note_likes (note_nid, user_uid);

    CREATE TABLE IF NOT EXISTS note_comments (
      id BIGSERIAL PRIMARY KEY,
      cid VARCHAR(64) NOT NULL,
      note_nid VARCHAR(64) NOT NULL,
      parent_cid VARCHAR(64) DEFAULT '',
      reply_to_topic VARCHAR(255) DEFAULT '',
      author_uid VARCHAR(255) NOT NULL,
      author_topic VARCHAR(255) DEFAULT '',
      author_pic VARCHAR(255) DEFAULT '',
      author_ucol VARCHAR(64) DEFAULT '',
      author_verified BOOLEAN DEFAULT FALSE,
      body TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      created_at BIGINT NOT NULL
    );
    ALTER TABLE note_comments ADD COLUMN IF NOT EXISTS parent_cid VARCHAR(64) DEFAULT '';
    ALTER TABLE note_comments ADD COLUMN IF NOT EXISTS reply_to_topic VARCHAR(255) DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_note_comments_target ON note_comments (note_nid, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_note_comments_cid ON note_comments (cid);
    CREATE INDEX IF NOT EXISTS idx_note_comments_parent ON note_comments (parent_cid);

    CREATE TABLE IF NOT EXISTS note_comment_likes (
      id BIGSERIAL PRIMARY KEY,
      comment_cid VARCHAR(64) NOT NULL,
      user_uid VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_note_comment_likes_cid_user ON note_comment_likes (comment_cid, user_uid);
  `);
}

export async function ensureGiftSystemTablesExist(): Promise<void> {
  if (!giftTablesEnsurePromise) {
    const { pool } = getDb();
    const readDefault = (name: string, fallback: number, min: number, max: number) => {
      const value = Number.parseInt(process.env[name] || "", 10);
      return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
    };
    const defaultMaxQty = readDefault("GIFT_DEFAULT_MAX_QTY", 100, 1, 100);
    const defaultRateLimitMax = readDefault("GIFT_DEFAULT_RATE_LIMIT_MAX", 6, 1, 100);
    const defaultRateLimitWindowMs = readDefault(
      "GIFT_DEFAULT_RATE_LIMIT_WINDOW_MS",
      15_000,
      1000,
      60_000,
    );
    giftTablesEnsurePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS gift_fee_slabs (
          id BIGSERIAL PRIMARY KEY,
          slab_min_coin INTEGER NOT NULL,
          slab_max_coin INTEGER,
          platform_fee_bps SMALLINT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          CONSTRAINT chk_gift_fee_slabs_bps CHECK (platform_fee_bps BETWEEN 0 AND 5000),
          CONSTRAINT chk_gift_fee_slabs_range CHECK (
            slab_min_coin >= 1 AND (slab_max_coin IS NULL OR slab_max_coin >= slab_min_coin)
          )
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_gift_fee_slabs_min ON gift_fee_slabs (slab_min_coin);
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_coin_ledger_txid_event_user
          ON coin_ledger (txid, event_type, user_idreg) WHERE txid <> '';

        CREATE TABLE IF NOT EXISTS gift_settings (
          key VARCHAR(64) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at BIGINT NOT NULL,
          updated_by INTEGER REFERENCES users(idreg) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS site_funding_log (
          id BIGSERIAL PRIMARY KEY,
          amount_coins BIGINT NOT NULL,
          external_ref VARCHAR(255) NOT NULL,
          note TEXT DEFAULT '',
          funded_by VARCHAR(255) NOT NULL DEFAULT 'hosting_owner',
          idempotency_key VARCHAR(128) NOT NULL,
          created_at BIGINT NOT NULL,
          CONSTRAINT chk_site_funding_positive CHECK (amount_coins > 0)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_site_funding_idempotency
          ON site_funding_log (idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_site_funding_created_at ON site_funding_log (created_at);

        CREATE TABLE IF NOT EXISTS hosting_owner_wallet (
          id INTEGER PRIMARY KEY DEFAULT 1,
          balance_coins BIGINT NOT NULL DEFAULT 0,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          CONSTRAINT chk_hosting_owner_wallet_singleton CHECK (id = 1)
        );

        CREATE TABLE IF NOT EXISTS hosting_owner_wallet_ledger (
          id BIGSERIAL PRIMARY KEY,
          txid VARCHAR(128) NOT NULL,
          event_type VARCHAR(64) NOT NULL,
          amount BIGINT NOT NULL,
          before_balance BIGINT NOT NULL,
          after_balance BIGINT NOT NULL,
          reference_table VARCHAR(128) DEFAULT '',
          reference_id BIGINT DEFAULT 0,
          note TEXT DEFAULT '',
          created_at BIGINT NOT NULL,
          CONSTRAINT chk_hosting_owner_wallet_ledger_amount CHECK (amount > 0)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_hosting_owner_wallet_ledger_txid
          ON hosting_owner_wallet_ledger (txid);
        CREATE INDEX IF NOT EXISTS idx_hosting_owner_wallet_ledger_created_at
          ON hosting_owner_wallet_ledger (created_at);
      `)
      .then(async () => {
        const now = Date.now();
        await pool.query(
          `INSERT INTO gift_fee_slabs (slab_min_coin, slab_max_coin, platform_fee_bps, created_at, updated_at)
           VALUES (1, 10, 500, $1, $1), (11, 100, 1000, $1, $1), (101, NULL, 1500, $1, $1)
           ON CONFLICT (slab_min_coin) DO NOTHING`,
          [now],
        );
        await pool.query(
          `INSERT INTO gift_settings (key, value, updated_at) VALUES
            ('max_qty', $2, $1),
            ('rate_limit_max', $3, $1),
            ('rate_limit_window_ms', $4, $1),
            ('gift_enabled', 'true', $1)
           ON CONFLICT (key) DO NOTHING`,
          [now, String(defaultMaxQty), String(defaultRateLimitMax), String(defaultRateLimitWindowMs)],
        );
        await pool.query(
          `INSERT INTO hosting_owner_wallet (id, balance_coins, status, created_at, updated_at)
           VALUES (1, 0, 'active', $1, $1)
           ON CONFLICT (id) DO NOTHING`,
          [now],
        );
      })
      .catch((err: unknown) => {
        giftTablesEnsurePromise = null;
        throw err;
      });
  }
  await giftTablesEnsurePromise;
}

let feedTablesEnsurePromise: Promise<void> | null = null;

export async function ensureFeedTablesExist(): Promise<void> {
  if (!feedTablesEnsurePromise) {
    const { pool } = getDb();
    feedTablesEnsurePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS idempotency_records (
          user_uid VARCHAR(255) NOT NULL,
          idempotency_key VARCHAR(128) NOT NULL,
          source_type VARCHAR(64) NOT NULL,
          payload_hash VARCHAR(128) NOT NULL,
          status VARCHAR(32) DEFAULT 'pending' NOT NULL,
          owner_token VARCHAR(64) NOT NULL,
          lease_expires_at BIGINT NOT NULL,
          locked_unit_coin BIGINT NOT NULL,
          txid VARCHAR(128) DEFAULT '',
          response_json TEXT,
          error_message TEXT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL,
          CONSTRAINT pk_idempotency_records PRIMARY KEY (user_uid, idempotency_key),
          CONSTRAINT chk_idem_status CHECK (status IN ('pending', 'completed', 'failed'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_idem_txid ON idempotency_records (txid) WHERE txid <> '';
        CREATE INDEX IF NOT EXISTS idx_idem_status_lease ON idempotency_records (status, lease_expires_at);

        CREATE TABLE IF NOT EXISTS feed_posts (
          id BIGSERIAL PRIMARY KEY,
          post_id VARCHAR(64) NOT NULL,
          author_uid VARCHAR(255) NOT NULL,
          author_idreg INTEGER DEFAULT 0,
          caption TEXT DEFAULT '',
          media_type VARCHAR(32) DEFAULT 'image' NOT NULL,
          music_title VARCHAR(255) DEFAULT '',
          likes_count INTEGER DEFAULT 0 NOT NULL,
          comments_count INTEGER DEFAULT 0 NOT NULL,
          reposts_count INTEGER DEFAULT 0 NOT NULL,
          shares_count INTEGER DEFAULT 0 NOT NULL,
          views_count INTEGER DEFAULT 0 NOT NULL,
          gifts_count INTEGER DEFAULT 0 NOT NULL,
          visibility VARCHAR(32) DEFAULT 'public' NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS gifts_count INTEGER DEFAULT 0 NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_posts_post_id ON feed_posts (post_id);
        CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feed_posts_author ON feed_posts (author_uid, created_at DESC);

        CREATE TABLE IF NOT EXISTS feed_post_media (
          id BIGSERIAL PRIMARY KEY,
          post_id VARCHAR(64) NOT NULL,
          media_type VARCHAR(32) DEFAULT 'image' NOT NULL,
          url VARCHAR(1024) NOT NULL,
          thumbnail_url VARCHAR(1024) DEFAULT '',
          width INTEGER DEFAULT 0,
          height INTEGER DEFAULT 0,
          duration INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0 NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_feed_media_post_sort ON feed_post_media (post_id, sort_order ASC);

        CREATE TABLE IF NOT EXISTS feed_post_likes (
          id BIGSERIAL PRIMARY KEY,
          post_id VARCHAR(64) NOT NULL,
          user_uid VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_post_likes ON feed_post_likes (post_id, user_uid);
        CREATE INDEX IF NOT EXISTS idx_feed_post_likes_user ON feed_post_likes (user_uid);

        CREATE TABLE IF NOT EXISTS feed_comments (
          id BIGSERIAL PRIMARY KEY,
          comment_id VARCHAR(64) NOT NULL,
          post_id VARCHAR(64) NOT NULL,
          parent_comment_id VARCHAR(64) DEFAULT '',
          reply_to_uid VARCHAR(255) DEFAULT '',
          reply_to_username VARCHAR(255) DEFAULT '',
          author_uid VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          likes_count INTEGER DEFAULT 0 NOT NULL,
          replies_count INTEGER DEFAULT 0 NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_comments_id ON feed_comments (comment_id);
        CREATE INDEX IF NOT EXISTS idx_feed_comments_post_created ON feed_comments (post_id, created_at ASC);
        CREATE INDEX IF NOT EXISTS idx_feed_comments_parent ON feed_comments (parent_comment_id, created_at ASC);
        CREATE INDEX IF NOT EXISTS idx_feed_comments_author ON feed_comments (author_uid);

        CREATE TABLE IF NOT EXISTS feed_comment_likes (
          id BIGSERIAL PRIMARY KEY,
          comment_id VARCHAR(64) NOT NULL,
          user_uid VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_comment_likes ON feed_comment_likes (comment_id, user_uid);
        CREATE INDEX IF NOT EXISTS idx_feed_comment_likes_user ON feed_comment_likes (user_uid);

        CREATE TABLE IF NOT EXISTS feed_bookmarks (
          id BIGSERIAL PRIMARY KEY,
          post_id VARCHAR(64) NOT NULL,
          user_uid VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_bookmarks ON feed_bookmarks (post_id, user_uid);
        CREATE INDEX IF NOT EXISTS idx_feed_bookmarks_user ON feed_bookmarks (user_uid, created_at DESC);

        CREATE TABLE IF NOT EXISTS feed_post_reposts (
          id BIGSERIAL PRIMARY KEY,
          post_id VARCHAR(64) NOT NULL,
          user_uid VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_feed_post_reposts ON feed_post_reposts (post_id, user_uid);
        CREATE INDEX IF NOT EXISTS idx_feed_post_reposts_user ON feed_post_reposts (user_uid, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feed_post_reposts_post ON feed_post_reposts (post_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS feed_post_gifts (
          id BIGSERIAL PRIMARY KEY,
          post_id VARCHAR(64) NOT NULL,
          sender_uid VARCHAR(255) NOT NULL,
          gift_file VARCHAR(255) NOT NULL,
          quantity INTEGER DEFAULT 1 NOT NULL,
          unit_coin INTEGER DEFAULT 0 NOT NULL,
          total_coin INTEGER DEFAULT 0 NOT NULL,
          txid VARCHAR(128) DEFAULT '',
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_feed_post_gifts_post ON feed_post_gifts (post_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_feed_post_gifts_sender ON feed_post_gifts (sender_uid, created_at DESC);
      `)
      .then(() => {})
      .catch((err: unknown) => {
        feedTablesEnsurePromise = null;
        throw err;
      });
  }
  await feedTablesEnsurePromise;
}

let coreTablesEnsurePromise: Promise<void> | null = null;

export async function ensureCoreSocialAndRoomTablesExist(): Promise<void> {
  if (!coreTablesEnsurePromise) {
    const { pool } = getDb();
    coreTablesEnsurePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS rooms (
          idroom SERIAL PRIMARY KEY,
          about VARCHAR(255),
          "user" VARCHAR(255),
          pass VARCHAR(255),
          id VARCHAR(255),
          owner VARCHAR(255),
          topic VARCHAR(255),
          pic VARCHAR(255),
          rmli INTEGER DEFAULT 0,
          mic INTEGER DEFAULT 0,
          welcome VARCHAR(255),
          broadcast BOOLEAN DEFAULT FALSE,
          deleted BOOLEAN DEFAULT FALSE,
          needpass BOOLEAN DEFAULT FALSE,
          color VARCHAR(255) DEFAULT '#000000',
          max INTEGER DEFAULT 0,
          stage_count INTEGER DEFAULT 5,
          stage_state TEXT,
          room_owner_meta TEXT,
          message_mode VARCHAR(16) DEFAULT 'real'
        );
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS stage_count INTEGER DEFAULT 5;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS stage_state TEXT;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_owner_meta TEXT;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS message_mode VARCHAR(16) DEFAULT 'real';
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS broadcast BOOLEAN DEFAULT FALSE;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS needpass BOOLEAN DEFAULT FALSE;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS color VARCHAR(255) DEFAULT '#000000';
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max INTEGER DEFAULT 0;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rmli INTEGER DEFAULT 0;
        ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mic INTEGER DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_rooms_id ON rooms (id);
        CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms (owner);
        CREATE INDEX IF NOT EXISTS idx_rooms_topic ON rooms (topic);

        CREATE TABLE IF NOT EXISTS room_welcome_visits (
          id SERIAL PRIMARY KEY,
          room_id VARCHAR(255) NOT NULL,
          identity_key VARCHAR(255) NOT NULL,
          is_guest BOOLEAN DEFAULT FALSE,
          first_seen BIGINT DEFAULT 0,
          last_seen BIGINT DEFAULT 0,
          visits INTEGER DEFAULT 1
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_room_welcome_visit ON room_welcome_visits (room_id, identity_key);
        CREATE INDEX IF NOT EXISTS idx_room_welcome_room ON room_welcome_visits (room_id);

        CREATE TABLE IF NOT EXISTS storie (
          id SERIAL PRIMARY KEY,
          sid VARCHAR(255) DEFAULT '',
          photo VARCHAR(255) DEFAULT '',
          name VARCHAR(255) DEFAULT '',
          link VARCHAR(255) DEFAULT '',
          lastUpdated VARCHAR(255) DEFAULT '',
          item TEXT DEFAULT '[]',
          seen BOOLEAN DEFAULT FALSE,
          currentPreview VARCHAR(2000) DEFAULT '[]'
        );
        ALTER TABLE storie ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT FALSE;
        ALTER TABLE storie ADD COLUMN IF NOT EXISTS currentPreview VARCHAR(2000) DEFAULT '[]';
        CREATE INDEX IF NOT EXISTS idx_storie_sid ON storie (sid);

        CREATE TABLE IF NOT EXISTS storieview (
          id SERIAL PRIMARY KEY,
          sid VARCHAR(255) DEFAULT '',
          topic VARCHAR(255) DEFAULT '',
          photo VARCHAR(255) DEFAULT '',
          idsto VARCHAR(255) DEFAULT '',
          item INTEGER DEFAULT 0,
          time TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_storieview_sid ON storieview (sid);
        CREATE INDEX IF NOT EXISTS idx_storieview_idsto ON storieview (idsto);

        CREATE TABLE IF NOT EXISTS story_likes (
          id BIGSERIAL PRIMARY KEY,
          story_sid VARCHAR(255) NOT NULL,
          item_id VARCHAR(64) NOT NULL,
          user_uid VARCHAR(255) NOT NULL,
          topic VARCHAR(255) DEFAULT '',
          photo VARCHAR(255) DEFAULT '',
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_story_likes_target ON story_likes (story_sid, item_id);
        CREATE INDEX IF NOT EXISTS idx_story_likes_user ON story_likes (story_sid, item_id, user_uid);

        CREATE TABLE IF NOT EXISTS story_comments (
          id BIGSERIAL PRIMARY KEY,
          cid VARCHAR(64) NOT NULL,
          story_sid VARCHAR(255) NOT NULL,
          item_id VARCHAR(64) NOT NULL,
          parent_cid VARCHAR(64) DEFAULT '',
          reply_to_topic VARCHAR(255) DEFAULT '',
          author_uid VARCHAR(255) NOT NULL,
          author_topic VARCHAR(255) DEFAULT '',
          author_pic VARCHAR(255) DEFAULT '',
          author_ucol VARCHAR(64) DEFAULT '',
          author_verified BOOLEAN DEFAULT FALSE,
          body TEXT NOT NULL,
          likes_count INTEGER DEFAULT 0,
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_story_comments_target ON story_comments (story_sid, item_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_story_comments_cid ON story_comments (cid);
        CREATE INDEX IF NOT EXISTS idx_story_comments_parent ON story_comments (parent_cid);

        CREATE TABLE IF NOT EXISTS story_comment_likes (
          id BIGSERIAL PRIMARY KEY,
          comment_cid VARCHAR(64) NOT NULL,
          user_uid VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_story_comment_likes_cid_user ON story_comment_likes (comment_cid, user_uid);

        CREATE TABLE IF NOT EXISTS powers (
          id SERIAL PRIMARY KEY,
          powers TEXT
        );

        CREATE TABLE IF NOT EXISTS owner (
          id SERIAL PRIMARY KEY,
          bars BOOLEAN DEFAULT TRUE,
          "Vpn" BOOLEAN DEFAULT FALSE,
          "Gust" TEXT,
          datafinish TIMESTAMP DEFAULT NOW(),
          "MaxRep" INTEGER DEFAULT 3,
          "Tv" TEXT,
          "Vistor" TEXT,
          room VARCHAR(255),
          isbanner BOOLEAN DEFAULT FALSE,
          rc BOOLEAN DEFAULT FALSE,
          cooment BOOLEAN DEFAULT FALSE,
          offline BOOLEAN DEFAULT FALSE
        );
        CREATE INDEX IF NOT EXISTS idx_owner_room ON owner (room);

        CREATE TABLE IF NOT EXISTS site (
          id SERIAL PRIMARY KEY,
          banner VARCHAR(255),
          host VARCHAR(255),
          ids INTEGER,
          logo VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS settings (
          id SERIAL PRIMARY KEY,
          site TEXT,
          dro3 TEXT,
          them TEXT,
          cover TEXT,
          emo TEXT,
          sico TEXT,
          room_badges TEXT,
          site_badges TEXT,
          gifts_git TEXT,
          gift_categories TEXT
        );

        -- Synchronize sequences safely
        DO $$
        BEGIN
          IF pg_get_serial_sequence('rooms', 'idroom') IS NOT NULL THEN
            PERFORM setval(pg_get_serial_sequence('rooms', 'idroom'), COALESCE((SELECT MAX(idroom) FROM rooms), 0) + 1, false);
          END IF;
          IF pg_get_serial_sequence('storie', 'id') IS NOT NULL THEN
            PERFORM setval(pg_get_serial_sequence('storie', 'id'), COALESCE((SELECT MAX(id) FROM storie), 0) + 1, false);
          END IF;
          IF pg_get_serial_sequence('user_notes', 'id') IS NOT NULL THEN
            PERFORM setval(pg_get_serial_sequence('user_notes', 'id'), COALESCE((SELECT MAX(id) FROM user_notes), 0) + 1, false);
          END IF;
        END $$;

        -- Seed default room if empty
        INSERT INTO rooms (id, topic, about, welcome, "user", pass, needpass, broadcast, deleted, owner, pic, max, stage_count)
        SELECT 'general', 'الغرفة العامة', 'غرفة الدردشة العامة لجميع الأعضاء والزوار', 'أهلاً بكم في شات سمر، نرجو احترام القوانين وقضاء وقت ممتع!', 'الإدارة', '', false, false, false, '#1', 'pic.png', 100, 5
        WHERE NOT EXISTS (SELECT 1 FROM rooms);
      `)
      .then(() => {})
      .catch((err: unknown) => {
        coreTablesEnsurePromise = null;
        throw err;
      });
  }
  await coreTablesEnsurePromise;
}

export async function ensureAllDatabaseTablesExist(): Promise<void> {
  await Promise.all([
    ensureGiftSystemTablesExist(),
    ensureFeedTablesExist(),
    ensureNotesTablesExist(),
    ensureCoreSocialAndRoomTablesExist(),
  ]);
}
