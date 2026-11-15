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
        url.includes("sslmode=require") ||
        url.includes("pooler.supabase.com")));

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
