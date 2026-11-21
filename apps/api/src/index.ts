import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { closeDb, closeRedis, ensureAllDatabaseTablesExist } from "@newchat/db";
import { startGateway } from "@newchat/gateway";
import { apiConfig } from "./config.js";
import { closeQueues } from "./lib/queues.js";
import { ddosConsumeRequest, getRequestCountry, getRequestRealIp } from "./lib/runtime.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCpRoutes } from "./routes/cp.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerHostingRoutes } from "./routes/hosting.js";
import { registerMediaRoutes } from "./routes/media.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerWalletRoutes } from "./routes/wallet.js";
import { registerFeedRoutes } from "./routes/feed.js";

const DDOS_BYPASS_PATHS = new Set(["/health", "/ping", "/healthz", "/readyz"]);

async function start() {
  fs.mkdirSync(apiConfig.uploadDir, { recursive: true });
  await ensureAllDatabaseTablesExist();

  const app = Fastify({
    logger: {
      level: apiConfig.nodeEnv === "production" ? "info" : "debug",
    },
    trustProxy: apiConfig.trustProxyEnabled,
  });

  app.addHook("onRequest", async (req, reply) => {
    const cleanPath = (req.raw.url || req.url || "/").split("?")[0] || "/";
    const isStaticOrAsset =
      cleanPath === "/" ||
      cleanPath.startsWith("/assets/") ||
      cleanPath.startsWith("/uploads/") ||
      cleanPath.startsWith("/carrom-game/") ||
      cleanPath.startsWith("/ejm/") ||
      cleanPath.startsWith("/flag/") ||
      cleanPath.startsWith("/fonts/") ||
      cleanPath.startsWith("/imgs/") ||
      cleanPath.endsWith(".js") ||
      cleanPath.endsWith(".css") ||
      cleanPath.endsWith(".png") ||
      cleanPath.endsWith(".webp") ||
      cleanPath.endsWith(".ico") ||
      cleanPath.endsWith(".svg") ||
      cleanPath.endsWith(".mp3") ||
      cleanPath.endsWith(".ogg") ||
      cleanPath.endsWith(".ttf");

    if (DDOS_BYPASS_PATHS.has(cleanPath) || isStaticOrAsset) {
      return;
    }
    const result = await ddosConsumeRequest(
      getRequestRealIp(req),
      cleanPath,
      getRequestCountry(req),
    );
    if (!result.allowed) {
      const retrySec = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
      reply.header("Retry-After", String(retrySec));
      return reply.code(result.statusCode).send({
        ok: false,
        err: true,
        msg: result.message,
        retry_after_ms: result.retryAfterMs,
      });
    }
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  await app.register(cors, {
    origin: apiConfig.corsOrigins === "*"
      ? true
      : apiConfig.corsOrigins.split(",").map((s) => s.trim()).filter(Boolean),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  await app.register(multipart, {
    limits: {
      fileSize: apiConfig.maxUploadBytes,
      files: 1,
    },
  });

  await app.register(fastifyStatic, {
    root: apiConfig.uploadDir,
    prefix: "/uploads/",
    decorateReply: true,
    etag: true,
    lastModified: true,
    maxAge: "7d",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=604800");
    },
  });

  await registerHealthRoutes(app);
  await registerPublicRoutes(app);
  await registerAuthRoutes(app);
  await registerMediaRoutes(app);
  await registerWalletRoutes(app);
  await registerCpRoutes(app);
  await registerHostingRoutes(app);
  await registerFeedRoutes(app);

  if (fs.existsSync(apiConfig.webDistDir)) {
    await app.register(fastifyStatic, {
      root: apiConfig.webDistDir,
      prefix: "/",
      decorateReply: false,
    });

    app.setNotFoundHandler((req, reply) => {
      const cleanPath = (req.raw.url || req.url || "/").split("?")[0] || "/";
      if (
        req.method === "GET" &&
        !cleanPath.startsWith("/uploads/") &&
        !cleanPath.startsWith("/health") &&
        !cleanPath.startsWith("/ping") &&
        !cleanPath.startsWith("/auth/") &&
        !cleanPath.startsWith("/public/") &&
        !cleanPath.startsWith("/wallet/") &&
        !cleanPath.startsWith("/cp/") &&
        !cleanPath.startsWith("/media/") &&
        !cleanPath.startsWith("/api/feed/")
      ) {
        const indexPath = path.join(apiConfig.webDistDir, "index.html");
        if (fs.existsSync(indexPath)) {
          reply.type("text/html; charset=utf-8");
          return reply.sendFile("index.html");
        }
      }
      reply.code(404).send({
        ok: false,
        err: true,
        message: `Route ${req.method}:${cleanPath} not found`,
        statusCode: 404,
      });
    });
  }

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "Unhandled API error");
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === "number" &&
      (err as { statusCode: number }).statusCode >= 400 &&
      (err as { statusCode: number }).statusCode < 500
        ? (err as { statusCode: number }).statusCode
        : 500;
    if (!reply.sent) {
      return reply.code(statusCode).send({
        ok: false,
        err: true,
        msg: statusCode < 500 ? "طلب غير صالح" : "حدث خطأ في الخادم",
      });
    }
    return reply;
  });

  let gatewayShutdown: (() => Promise<void>) | null = null;
  try {
    const gw = await startGateway(app.server);
    gatewayShutdown = gw.shutdown;
    app.log.info("[Gateway] Embedded Socket.IO real-time gateway mounted onto Fastify HTTP server");
  } catch (err) {
    app.log.error({ err }, "[Gateway] Failed to mount embedded Socket.IO gateway");
  }

  const shutdown = async () => {
    if (gatewayShutdown) {
      await gatewayShutdown().catch(() => {});
    }
    await app.close();
    await closeQueues();
    await closeRedis();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: apiConfig.port, host: apiConfig.host });
  app.log.info(`NewChat Fastify API listening on http://${apiConfig.host}:${apiConfig.port}`);
}

start().catch((err) => {
  console.error("[API] Fatal startup error:", err);
  process.exit(1);
});
