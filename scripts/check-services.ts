import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { closeDb, closeRedis, getDb, getRedis, sql } from "../packages/db/src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(here, "../.env");
if (fs.existsSync(rootEnv)) {
  loadDotenv({ path: rootEnv });
}

async function main() {
  try {
    const pong = await getRedis().ping();
    console.log("[Memurai/Redis 6379]:", pong === "PONG" ? "READY" : pong);
  } catch (err) {
    console.log("[Memurai/Redis 6379]: DOWN ->", err instanceof Error ? err.message : err);
  }

  if (!process.env.DATABASE_URL) {
    console.log("[PostgreSQL 5432]: .env / DATABASE_URL not configured yet.");
  } else {
    try {
      const { db } = getDb();
      await db.execute(sql`SELECT 1 AS ok`);
      console.log("[PostgreSQL 5432]: READY");
    } catch (err) {
      console.log("[PostgreSQL 5432]: AUTH/CONN ERROR ->", err instanceof Error ? err.message : err);
    }
  }

  await closeRedis();
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
