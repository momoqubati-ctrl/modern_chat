import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../.env") });

export default defineConfig({
  schema: [
    "./src/schema/users.ts",
    "./src/schema/rooms.ts",
    "./src/schema/social.ts",
    "./src/schema/economy.ts",
    "./src/schema/system.ts",
    "./src/schema/idempotency.ts",
    "./src/schema/feed.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/newchat",
  },
  verbose: true,
  strict: true,
});
