import type { FastifyInstance } from "fastify";
import { getDb, getRedis, sql } from "@newchat/db";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { ok: true, service: "newchat-api", status: "up", ts: Date.now() };
  });

  app.get("/ping", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { ok: true, pong: Date.now() };
  });

  app.get("/healthz", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { ok: true, service: "newchat-api", status: "up", ts: Date.now() };
  });

  app.get("/readyz", async (_req, reply) => {
    const startedAt = Date.now();
    reply.header("Cache-Control", "no-store");

    let dbUp = false;
    let redisUp = false;

    try {
      const { db } = getDb();
      await db.execute(sql`SELECT 1 AS ok`);
      dbUp = true;
    } catch {
      dbUp = false;
    }

    try {
      const pong = await getRedis().ping();
      redisUp = pong === "PONG";
    } catch {
      redisUp = false;
    }

    const ok = dbUp && redisUp;
    reply.code(ok ? 200 : 503);
    return {
      ok,
      service: "newchat-api",
      status: ok ? "ready" : "degraded",
      db: dbUp ? "up" : "down",
      redis: redisUp ? "up" : "down",
      latencyMs: Date.now() - startedAt,
      ts: Date.now(),
    };
  });
}
