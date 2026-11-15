import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import sharp from "sharp";
import { eq, getDb, getRedis, REDIS_KEYS, resolveLiveKitRuntimeConfig, rooms } from "@newchat/db";
import {
  MIC_SLOT_COUNT,
  UPLOAD_SUBDIRS,
  isLegacyHostingSuperPower,
  verAdminPanel,
  verOwner,
} from "@newchat/shared";
import { apiConfig } from "../config.js";
import { getImageQueue } from "../lib/queues.js";
import {
  extractRequestParams,
  extractRequestToken,
  getHostSettingRow,
  getPowersList,
  getRequestRealIp,
  invalidateCatalogScopes,
  resolveUserActorByToken,
  safeJsonParse,
  savestate,
} from "../lib/runtime.js";

const IMAGE_UPLOAD_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "avif",
  "ico",
]);

const MEDIA_UPLOAD_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "avif",
  "mp3",
  "wav",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "mp4",
  "webm",
  "mov",
  "avi",
  "3gp",
  "3gp2",
]);

const SITE_SCRIPT_UPLOAD_EXTENSIONS = new Set(["json"]);

const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  "svg",
  "html",
  "htm",
  "js",
  "mjs",
  "cjs",
  "ts",
  "php",
  "phtml",
  "exe",
  "bat",
  "cmd",
  "ps1",
  "sh",
  "xml",
  "xhtml",
  "asp",
  "aspx",
  "jsp",
]);

const UPLOAD_SUBDIR_SET = new Set<string>(UPLOAD_SUBDIRS);
const WEBP_OPTIMIZED_SUBDIRS = new Set([
  "pic",
  "picroom",
  "pic2",
  "cover",
  "sico",
  "site",
  "bot-pic",
]);

const MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "image/avif": "avif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg",
  "application/json": "json",
  "text/json": "json",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/oga": "oga",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/3gpp": "3gp",
  "video/3gpp2": "3gp2",
};

const ATTACHMENT_EXTS = new Set([
  ".svg",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".json",
  ".xml",
  ".xhtml",
]);

const MEDIA_CACHE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".mp3",
  ".wav",
  ".ogg",
  ".mp4",
  ".webm",
]);

function ensureSubdir(subDir: string): string {
  const safeRoot = path.resolve(apiConfig.uploadDir);
  const target = subDir ? path.resolve(safeRoot, subDir) : safeRoot;
  if (target !== safeRoot && !target.startsWith(safeRoot + path.sep)) {
    throw new Error("Invalid upload subdirectory");
  }
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function normalizeAssetBaseName(value: unknown): string {
  const safeName = path.basename(String(value || "").split("?")[0] || "").trim();
  if (!safeName || safeName === "." || safeName === ".." || safeName.includes("\0")) {
    return "";
  }
  return safeName;
}

function resolveUploadedExtension(
  rawFilename: string,
  mimeType: string,
  allowedExtensions: Set<string>,
): { rawExt: string; normalizedExt: string } {
  const cleanMime = String(mimeType || "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  const fromMime = cleanMime ? MIME_TYPES[cleanMime] || "" : "";
  const fromName = path
    .extname(path.basename(String(rawFilename || "")))
    .replace(/^\./, "")
    .toLowerCase();

  let rawExt = fromMime || fromName;
  if (!rawExt && fromName) {
    rawExt = fromName;
  }
  if (!rawExt || BLOCKED_UPLOAD_EXTENSIONS.has(rawExt) || !allowedExtensions.has(rawExt)) {
    return { rawExt: "", normalizedExt: "" };
  }
  // Never trust dangerous extensions even if MIME spoofed
  if (fromName && BLOCKED_UPLOAD_EXTENSIONS.has(fromName)) {
    return { rawExt: "", normalizedExt: "" };
  }

  const normalizedExt = rawExt === "png" || rawExt === "jpeg" ? "jpg" : rawExt;
  return { rawExt, normalizedExt };
}

async function readMultipartBuffer(req: FastifyRequest): Promise<{
  buffer: Buffer;
  filename: string;
  mimetype: string;
} | null> {
  const filePart = await req.file();
  if (!filePart) {
    return null;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of filePart.file) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > apiConfig.maxUploadBytes) {
      throw new Error("FILE_TOO_LARGE");
    }
    chunks.push(buf);
  }
  if (filePart.file.truncated) {
    throw new Error("FILE_TOO_LARGE");
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) {
    return null;
  }
  return {
    buffer,
    filename: String(filePart.filename || ""),
    mimetype: String(filePart.mimetype || ""),
  };
}

async function createThumbnailsBestEffort(
  buffer: Buffer,
  targetDir: string,
  fileName: string,
  isGif: boolean,
): Promise<void> {
  try {
    const jpgThumbName = isGif
      ? fileName.replace(/\.gif$/i, ".jpg.jpg")
      : `${fileName}.jpg`;
    await sharp(buffer, { animated: false })
      .rotate()
      .resize({ width: 100, height: 100, fit: "cover" })
      .jpeg({ quality: 82 })
      .toFile(path.join(targetDir, jpgThumbName));

    await sharp(buffer, { animated: false })
      .rotate()
      .resize({ width: 100, height: 100, fit: "cover" })
      .webp({ quality: 80 })
      .toFile(path.join(targetDir, `${fileName}.webp`));
  } catch {
    // Non-fatal thumbnail error
  }
}

async function enqueueImagePostProcess(
  app: FastifyInstance,
  outPath: string,
  subDir: string,
  fileName: string,
): Promise<void> {
  try {
    await getImageQueue().add("post-process-upload", { outPath, subDir, fileName });
  } catch (err) {
    app.log.debug({ err }, "imageQueue enqueue skipped");
  }
}

async function saveImageUploadFile(
  app: FastifyInstance,
  buffer: Buffer,
  subDir: string,
  normalizedExt: string,
  rawExt: string,
  createThumbs = true,
  customFileName?: string,
): Promise<{ fileName: string; outPath: string }> {
  const targetDir = ensureSubdir(subDir);
  const fileName =
    customFileName ||
    `${Date.now()}_${crypto.randomBytes(3).toString("hex")}.${normalizedExt}`;
  const outPath = path.join(targetDir, fileName);

  const isGif = rawExt === "gif" || normalizedExt === "gif";
  const isIco = rawExt === "ico" || normalizedExt === "ico";

  if (isGif || isIco) {
    if (isGif) {
      await sharp(buffer, { animated: false }).metadata();
    }
    await fs.promises.writeFile(outPath, buffer);
    if (createThumbs && isGif) {
      await createThumbnailsBestEffort(buffer, targetDir, fileName, true);
    }
  } else {
    const image = sharp(buffer).rotate();
    await image.metadata();
    if (normalizedExt === "jpg") {
      await image.jpeg({ quality: 88, mozjpeg: true }).toFile(outPath);
    } else if (normalizedExt === "webp") {
      await image.webp({ quality: 84 }).toFile(outPath);
    } else if (normalizedExt === "avif") {
      await image.avif({ quality: 75 }).toFile(outPath);
    } else {
      await image.toFile(outPath);
    }
    if (createThumbs) {
      await createThumbnailsBestEffort(buffer, targetDir, fileName, false);
    }
  }

  await enqueueImagePostProcess(app, outPath, subDir, fileName);
  return { fileName, outPath };
}

function applyUploadSecurityHeaders(reply: FastifyReply, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  reply.header("X-Content-Type-Options", "nosniff");
  if (ATTACHMENT_EXTS.has(ext)) {
    reply.header("Content-Disposition", "attachment");
    reply.header("Cache-Control", "private, max-age=3600");
    return;
  }
  if (MEDIA_CACHE_EXTS.has(ext)) {
    reply.header("Cache-Control", "public, max-age=604800");
    return;
  }
  reply.header("Cache-Control", "public, max-age=86400");
}

async function handleOptimizedSiteVisual(
  baseName: string,
  siteDir: string,
  reply: FastifyReply,
) {
  const match = baseName.match(/\.(banner|logo)\.(webp|jpg)$/i);
  if (!match) {
    return reply.code(404).send("Not Found");
  }
  const variant = match[1]!.toLowerCase();
  const format = match[2]!.toLowerCase();
  const originalName = baseName.replace(/\.(banner|logo)\.(webp|jpg)$/i, "");
  const originalPath = path.join(siteDir, originalName);
  const optimizedPath = path.join(siteDir, baseName);

  if (!originalName || originalName === baseName || !fs.existsSync(originalPath)) {
    return reply.code(404).send("Not Found");
  }

  reply.header("Cache-Control", "public, max-age=2592000, immutable");
  reply.header("X-Content-Type-Options", "nosniff");

  if (!fs.existsSync(optimizedPath)) {
    const resizeOptions =
      variant === "logo"
        ? { width: 96, height: 96, fit: "cover" as const, withoutEnlargement: true }
        : { width: 864, height: 216, fit: "cover" as const, withoutEnlargement: true };

    try {
      let pipeline = sharp(originalPath, { animated: false }).resize(resizeOptions);
      if (format === "webp") {
        pipeline = pipeline.webp({ quality: 76, effort: 4 });
      } else {
        pipeline = pipeline.jpeg({ quality: 78, progressive: true, mozjpeg: true });
      }
      await pipeline.toFile(optimizedPath);
    } catch {
      if (format === "webp") {
        return reply.code(404).send("Not Found");
      }
      return reply.sendFile(originalName, siteDir);
    }
  }

  return reply.sendFile(baseName, siteDir);
}

async function handleOptimizedUploadWebp(
  baseName: string,
  subDirRoot: string,
  reply: FastifyReply,
) {
  const originalName = baseName.replace(/\.webp$/i, "");
  const originalExt = path.extname(originalName).toLowerCase();
  if (
    !originalName ||
    originalName === baseName ||
    ![".gif", ".png", ".jpg", ".jpeg", ".bmp", ".avif", ".webp"].includes(originalExt)
  ) {
    return reply.code(404).send("Not Found");
  }

  const originalPath = path.join(subDirRoot, originalName);
  const optimizedPath = path.join(subDirRoot, baseName);
  if (!fs.existsSync(originalPath)) {
    return reply.code(404).send("Not Found");
  }

  reply.header("Cache-Control", "public, max-age=2592000, immutable");
  reply.header("X-Content-Type-Options", "nosniff");

  if (!fs.existsSync(optimizedPath)) {
    try {
      await sharp(originalPath, { animated: false })
        .resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 76, effort: 4 })
        .toFile(optimizedPath);
    } catch {
      return reply.code(404).send("Not Found");
    }
  }

  return reply.sendFile(baseName, subDirRoot);
}

export async function registerMediaRoutes(app: FastifyInstance) {
  for (const sub of UPLOAD_SUBDIRS) {
    ensureSubdir(sub);
  }

  // Every upload must come from an authenticated session (token via query param,
  // form field or Authorization header). Anonymous uploads are rejected.
  // Members resolve against the users table; live gateway sessions (incl. guests)
  // resolve against the Redis session registry.
  const resolveUploadActor = async (req: FastifyRequest) => {
    const token = extractRequestToken(req);
    if (!token) return null;
    const user = await resolveUserActorByToken(token);
    if (user) return user;
    try {
      const rawSession = await getRedis().hget("newchat:session:tokens", token);
      if (rawSession) {
        const sess = safeJsonParse<Record<string, unknown> | null>(rawSession, null);
        if (sess && !sess.kicked) {
          return sess;
        }
      }
    } catch {
      // redis optional
    }
    return null;
  };

  // Serve static Carrom assets without conflicting with /uploads/ reply decoration
  const carromDir = path.join(apiConfig.publicDir, "carrom-game");
  if (fs.existsSync(carromDir)) {
    await app.register(fastifyStatic, {
      root: carromDir,
      prefix: "/carrom-game/",
      decorateReply: false,
      etag: true,
      lastModified: true,
      maxAge: "30d",
    });
  }

  app.get("/fonts/fontawesome-webfont.woff2", async (_req, reply) => {
    const fontsDir = path.join(apiConfig.publicDir, "fonts");
    const fontPath = path.join(fontsDir, "fontawesome-webfont3295.woff2");
    if (!fs.existsSync(fontPath)) {
      return reply.code(404).send("Not Found");
    }
    reply.header("Cache-Control", "public, max-age=2592000, immutable");
    return reply.sendFile("fontawesome-webfont3295.woff2", fontsDir);
  });

  app.all("/public/*", async (req, reply) => {
    const rawUrl = req.raw.url || req.url || "/";
    const suffix = rawUrl.replace(/^\/public/, "");
    const candidate = suffix && suffix.length ? suffix : "/";
    // Same-origin redirect only: block protocol-relative ("//host"), backslashes and control chars.
    const decoded = candidate.replace(/[\u0000-\u001F\u007F]/g, "");
    const isSafeRelative =
      decoded.startsWith("/") && !decoded.startsWith("//") && !decoded.includes("\\");
    return reply.redirect(isSafeRelative ? decoded : "/", 301);
  });

  // Legacy root upload folders (/pic/*, /picroom/*, /site/*, /entry_slides/*, /topup_receipts/*, etc.)
  for (const sub of UPLOAD_SUBDIRS) {
    app.get(`/${sub}/*`, async (req, reply) => {
      const wildcard = String((req.params as { "*": string })["*"] || "")
        .split("?")[0]
        ?.replace(/^\/+/, "");
      if (!wildcard || wildcard.includes("\0")) {
        return reply.code(404).send("Not Found");
      }

      const subdirRoot = path.resolve(apiConfig.uploadDir, sub);
      const resolved = path.resolve(subdirRoot, wildcard);
      if (!resolved.startsWith(subdirRoot + path.sep)) {
        return reply.code(404).send("Not Found");
      }

      const relPosix = path.relative(subdirRoot, resolved).replace(/\\/g, "/");

      if (
        sub === "site" &&
        !relPosix.includes("/") &&
        /^[^/]+\.(?:banner|logo)\.(?:webp|jpg)$/i.test(relPosix)
      ) {
        return handleOptimizedSiteVisual(relPosix, subdirRoot, reply);
      }

      if (
        WEBP_OPTIMIZED_SUBDIRS.has(sub) &&
        !relPosix.includes("/") &&
        /^[^/]+\.(?:gif|png|jpe?g|bmp|avif|webp)\.webp$/i.test(relPosix)
      ) {
        return handleOptimizedUploadWebp(relPosix, subdirRoot, reply);
      }

      try {
        const stat = await fs.promises.stat(resolved);
        if (!stat.isFile()) {
          return reply.code(404).send("Not Found");
        }
      } catch {
        return reply.code(404).send("Not Found");
      }

      applyUploadSecurityHeaders(reply, resolved);
      return reply.sendFile(relPosix, subdirRoot);
    });
  }

  app.post("/picroom", async (req, reply) => {
    try {
      const actor = await resolveUploadActor(req);
      if (!actor) {
        return reply.code(401).send("Unauthorized");
      }
      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.code(401).send("Unauthorized");
      }
      const { rawExt, normalizedExt } = resolveUploadedExtension(
        file.filename,
        file.mimetype,
        IMAGE_UPLOAD_EXTENSIONS,
      );
      if (!normalizedExt) {
        return reply.code(401).send("Unsupported file type");
      }
      const saved = await saveImageUploadFile(
        app,
        file.buffer,
        "picroom",
        normalizedExt,
        rawExt,
        true,
      );
      if (normalizedExt !== "gif" && normalizedExt !== "ico") {
        const picDir = ensureSubdir("pic");
        await fs.promises.copyFile(saved.outPath, path.join(picDir, saved.fileName)).catch(() => {});
      }
      return reply.send(`picroom/${saved.fileName}`);
    } catch {
      return reply.code(401).send("Upload failed");
    }
  });

  app.post("/pic", async (req, reply) => {
    try {
      const actor = await resolveUploadActor(req);
      if (!actor) {
        return reply.code(401).send("Unauthorized");
      }
      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.code(401).send("Unauthorized");
      }
      const { rawExt, normalizedExt } = resolveUploadedExtension(
        file.filename,
        file.mimetype,
        IMAGE_UPLOAD_EXTENSIONS,
      );
      if (!normalizedExt) {
        return reply.code(401).send("Unsupported file type");
      }
      const saved = await saveImageUploadFile(
        app,
        file.buffer,
        "pic",
        normalizedExt,
        rawExt,
        true,
      );
      return reply.send(`/pic/${saved.fileName}`);
    } catch {
      return reply.code(401).send("Upload failed");
    }
  });

  app.post("/bot-pic", async (req, reply) => {
    try {
      const actor = await resolveUploadActor(req);
      if (!actor) {
        return reply.code(401).send("Unauthorized");
      }
      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.code(401).send("Unauthorized");
      }
      const { rawExt, normalizedExt } = resolveUploadedExtension(
        file.filename,
        file.mimetype,
        IMAGE_UPLOAD_EXTENSIONS,
      );
      if (!normalizedExt) {
        return reply.code(401).send("Unsupported file type");
      }
      const saved = await saveImageUploadFile(
        app,
        file.buffer,
        "bot-pic",
        normalizedExt,
        rawExt,
        true,
      );
      return reply.send(`/bot-pic/${saved.fileName}`);
    } catch {
      return reply.code(401).send("Upload failed");
    }
  });

  app.post("/pic2", async (req, reply) => {
    try {
      const actor = await resolveUploadActor(req);
      if (!actor) {
        return reply.code(401).send("Unauthorized");
      }
      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.code(401).send("Unauthorized");
      }
      const { rawExt, normalizedExt } = resolveUploadedExtension(
        file.filename,
        file.mimetype,
        IMAGE_UPLOAD_EXTENSIONS,
      );
      if (!normalizedExt) {
        return reply.code(401).send("Unsupported file type");
      }
      const saved = await saveImageUploadFile(
        app,
        file.buffer,
        "pic2",
        normalizedExt,
        rawExt,
        true,
      );
      return reply.send(`/pic2/${saved.fileName}`);
    } catch {
      return reply.code(401).send("Upload failed");
    }
  });

  app.post("/cp/pic", async (req, reply) => {
    try {
      const token = extractRequestToken(req);
      const actor = token ? await resolveUserActorByToken(token) : null;
      if (!actor) {
        return reply.code(401).send("no");
      }
      const powersList = await getPowersList();
      if (!verAdminPanel(powersList, actor.power)) {
        return reply.code(403).send("no");
      }
      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.code(401).send("Unauthorized");
      }
      const { rawExt, normalizedExt } = resolveUploadedExtension(
        file.filename,
        file.mimetype,
        IMAGE_UPLOAD_EXTENSIONS,
      );
      if (!normalizedExt) {
        return reply.code(401).send("Unsupported file type");
      }
      const saved = await saveImageUploadFile(
        app,
        file.buffer,
        "picroom",
        normalizedExt,
        rawExt,
        false,
      );
      return reply.send({ err: false, msg: `picroom/${saved.fileName}` });
    } catch {
      return reply.code(401).send("Upload failed");
    }
  });

  app.post("/cp/site", async (req, reply) => {
    try {
      const token = extractRequestToken(req);
      const actor = await resolveUserActorByToken(token);
      if (!actor) {
        return reply.code(401).send("no");
      }
      const powersList = await getPowersList();
      if (!verOwner(powersList, actor.power) && !isLegacyHostingSuperPower(actor.power)) {
        return reply.send("no");
      }

      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.code(400).send({ err: true, msg: "لم يتم إرفاق ملف" });
      }
      const { normalizedExt } = resolveUploadedExtension(
        file.filename,
        file.mimetype,
        SITE_SCRIPT_UPLOAD_EXTENSIONS,
      );
      if (normalizedExt !== "json") {
        return reply.code(401).send("Unsupported file type");
      }

      const rawText = file.buffer.toString("utf8");
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return reply.code(400).send({ err: true, msg: "ملف JSON غير صالح" });
      }

      const scriptVal = String(parsed.settscr || "");
      if (
        scriptVal.includes("socket.emit") ||
        scriptVal.includes("setInterval") ||
        scriptVal.includes("socket.on") ||
        scriptVal.includes("socket")
      ) {
        return reply.code(401).send("Unauthorized");
      }

      const fileName = `${Date.now()}_${crypto.randomBytes(3).toString("hex")}.json`;
      const outPath = path.join(ensureSubdir(""), fileName);
      await fs.promises.writeFile(outPath, rawText, "utf8");
      await invalidateCatalogScopes(["site", "settings"]);
      return reply.send({ msg: "ok", value: fileName });
    } catch {
      return reply.code(400).send({ err: true, msg: "تعذر معالجة الملف" });
    }
  });

  app.post("/upload", async (req, reply) => {
    const query = req.query as { secid?: string; token?: string; state?: string };
    try {
      const uploadActor = await resolveUploadActor(req);
      if (!uploadActor) {
        return reply.code(401).send({ error: true, msg: "ليس لديك الصلاحية" });
      }

      if (String(query.secid || "") === "u") {
        const file = await readMultipartBuffer(req);
        if (!file) {
          return reply.code(401).send("Unauthorized");
        }
        const { rawExt, normalizedExt } = resolveUploadedExtension(
          file.filename,
          file.mimetype,
          MEDIA_UPLOAD_EXTENSIONS,
        );
        if (!normalizedExt) {
          return reply.code(401).send("Unsupported file type");
        }

        if (IMAGE_UPLOAD_EXTENSIONS.has(rawExt)) {
          const saved = await saveImageUploadFile(
            app,
            file.buffer,
            "sendfile",
            normalizedExt,
            rawExt,
            false,
          );
          return reply.type("text/plain; charset=utf-8").send(`/sendfile/${saved.fileName}`);
        }

        const targetDir = ensureSubdir("sendfile");
        const fileName = `${Date.now()}_${crypto.randomBytes(3).toString("hex")}.${normalizedExt}`;
        await fs.promises.writeFile(path.join(targetDir, fileName), file.buffer);
        return reply.type("text/plain; charset=utf-8").send(`/sendfile/${fileName}`);
      }

      // Admin branch requires a real DB member (for power checks).
      const token = extractRequestToken(req);
      const actor = token ? await resolveUserActorByToken(token) : null;
      if (!actor) {
        return reply.send({ error: true, msg: "ليس لديك الصلاحية" });
      }
      const powersList = await getPowersList();
      if (
        !verAdminPanel(powersList, actor.power) ||
        (!verOwner(powersList, actor.power) && !isLegacyHostingSuperPower(actor.power))
      ) {
        return reply.send({ error: true, msg: "ليس لديك الصلاحية" });
      }

      const rawState = String(query.state || "").trim();
      const folder = rawState === "banner" || rawState === "logo" ? "site" : rawState;
      if (!UPLOAD_SUBDIR_SET.has(folder)) {
        return reply.code(400).send({ err: true, msg: "مجلد الرفع غير مسموح به" });
      }

      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.code(401).send("Unauthorized");
      }
      const { rawExt, normalizedExt } = resolveUploadedExtension(
        file.filename,
        file.mimetype,
        IMAGE_UPLOAD_EXTENSIONS,
      );
      if (!normalizedExt) {
        return reply.code(401).send("Unsupported file type");
      }

      if (rawState === "entry_slides") {
        const saved = await saveImageUploadFile(
          app,
          file.buffer,
          "entry_slides",
          normalizedExt,
          rawExt,
          false,
        );
        await savestate({
          state: "رفع صورة وضع الابتوب",
          topic: actor.topic || actor.username,
          topic1: actor.username,
          room: "",
          ip: getRequestRealIp(req) || actor.ip || "",
          time: Date.now(),
        });
        await invalidateCatalogScopes(["site", "settings"]);
        return reply.send({ err: false, msg: saved.fileName });
      }

      const saved = await saveImageUploadFile(
        app,
        file.buffer,
        folder,
        normalizedExt,
        rawExt,
        true,
      );
      return reply.send({ err: false, msg: saved.fileName });
    } catch {
      return reply.code(401).send("Upload failed");
    }
  });

  app.post("/wallet/topup-upload", async (req, reply) => {
    try {
      const token = extractRequestToken(req);
      if (!token) {
        return reply.send({ err: true, msg: "غير مصرح" });
      }
      const userRow = await resolveUserActorByToken(token);
      if (!userRow || !userRow.uid) {
        return reply.send({ err: true, msg: "يجب تسجيل الدخول أولاً" });
      }

      const file = await readMultipartBuffer(req);
      if (!file) {
        return reply.send({ err: true, msg: "لم يتم اختيار ملف صالح" });
      }

      const mimeType = String(file.mimetype || "").toLowerCase();
      const { rawExt, normalizedExt } = resolveUploadedExtension(
        file.filename,
        mimeType,
        IMAGE_UPLOAD_EXTENSIONS,
      );
      const allowedReceiptExt = /^(jpg|jpeg|gif|png|bmp|webp)$/i;
      if (
        (mimeType && !mimeType.startsWith("image/")) ||
        !normalizedExt ||
        !allowedReceiptExt.test(normalizedExt)
      ) {
        return reply.send({ err: true, msg: "يجب رفع صورة سند بصيغة مدعومة" });
      }

      const receiptName = `topup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${normalizedExt}`;
      await saveImageUploadFile(
        app,
        file.buffer,
        "topup_receipts",
        normalizedExt,
        rawExt,
        false,
        receiptName,
      );

      return reply.send({
        err: false,
        msg: "تم رفع سند الدفع",
        data: {
          receipt_path: `/topup_receipts/${receiptName}`,
          receipt_uploaded_at: Date.now(),
        },
      });
    } catch {
      return reply.send({ err: true, msg: "تعذر رفع سند الدفع" });
    }
  });

  const issueLiveKitStageToken = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = extractRequestParams(req);
      const tokenStr = extractRequestToken(req);
      if (!tokenStr) {
        return reply.code(401).send({ ok: false, msg: "جلسة غير صالحة أو منتهية" });
      }

      const requestedRoomId = String(params.room || "").trim().slice(0, 128);
      if (!requestedRoomId) {
        return reply.code(400).send({ ok: false, msg: "معرف الغرفة مطلوب" });
      }

      const redis = getRedis();
      let sessionObj: {
        id?: string;
        uid?: string;
        username?: string;
        topic?: string;
        roomid?: string;
        fp?: string;
        kicked?: boolean;
        offline?: boolean;
        muted?: boolean;
        ismuted?: boolean;
      } | null = null;

      const rawSession = await redis.hget("newchat:session:tokens", tokenStr).catch(() => null);
      if (rawSession) {
        try {
          sessionObj = JSON.parse(rawSession);
        } catch {
          sessionObj = null;
        }
      }

      if (!sessionObj?.id) {
        const actor = await resolveUserActorByToken(tokenStr);
        if (actor?.uid) {
          const allOnline = await redis.hvals("newchat:presence:users").catch(() => []);
          for (const rawUser of allOnline) {
            try {
              const candidate = JSON.parse(rawUser);
              if (candidate?.uid === actor.uid && candidate?.id) {
                sessionObj = candidate;
                break;
              }
            } catch {
              // skip invalid record
            }
          }
        }
      }

      if (!sessionObj?.id || sessionObj.kicked || sessionObj.offline) {
        return reply.code(401).send({ ok: false, msg: "يجب الاتصال بالدردشة أولاً" });
      }

      if (String(sessionObj.roomid || "") !== requestedRoomId) {
        return reply.code(403).send({ ok: false, msg: "يجب الانضمام إلى الغرفة أولاً" });
      }

      if (sessionObj.fp) {
        const roomBan = await redis
          .get(`newchat:room_ban:${requestedRoomId}:${sessionObj.fp}`)
          .catch(() => null);
        if (roomBan) {
          return reply.code(403).send({ ok: false, msg: "تم طردك من هذه الغرفة" });
        }
      }

      const hostSetting = await getHostSettingRow(req.hostname);
      const rawSiteJson = safeJsonParse<Record<string, unknown>>(hostSetting?.site, {});
      const liveKitCfg = resolveLiveKitRuntimeConfig(rawSiteJson, {
        wsUrl: apiConfig.livekitWsUrl,
        apiKey: apiConfig.livekitApiKey,
        apiSecret: apiConfig.livekitApiSecret,
        nodeEnv: apiConfig.nodeEnv,
      });

      if (!liveKitCfg.ready) {
        return reply.code(503).send({
          ok: false,
          msg: "LiveKit credentials are not configured.",
        });
      }

      const apiKey = liveKitCfg.apiKey;
      const apiSecret = liveKitCfg.apiSecret;
      const livekitWsUrl = liveKitCfg.wsUrl;

      const { db } = getDb();
      const roomRows = await db
        .select({ id: rooms.id, broadcast: rooms.broadcast })
        .from(rooms)
        .where(eq(rooms.id, requestedRoomId))
        .limit(1);
      const roomRecord = roomRows[0];
      if (!roomRecord || !roomRecord.broadcast) {
        return reply.code(403).send({ ok: false, msg: "البث الصوتي غير مفعل في هذه الغرفة" });
      }

      // Enforce server-side least privilege: listeners receive subscribe-only grants.
      let canPublish = false;
      const isAccountMuted = Boolean(sessionObj.muted || sessionObj.ismuted);
      if (!isAccountMuted) {
        const rawStage = await redis.get(REDIS_KEYS.roomMicsPrefix + requestedRoomId).catch(() => null);
        if (rawStage) {
          try {
            const stage = JSON.parse(rawStage) as {
              data?: Record<string, { id?: string; ev?: boolean }>;
              lockedSlots?: Record<string, number | boolean>;
              mutedUsers?: Record<string, boolean>;
            };
            const isSlotMuted = Boolean(stage.mutedUsers?.[sessionObj.id]);
            if (!isSlotMuted && stage.data) {
              for (let i = 1; i <= MIC_SLOT_COUNT; i += 1) {
                const slot = stage.data[String(i)];
                if (slot?.ev && slot.id === sessionObj.id && !stage.lockedSlots?.[String(i)]) {
                  canPublish = true;
                  break;
                }
              }
            }
          } catch {
            canPublish = false;
          }
        }
      }

      const verifiedIdentity = String(sessionObj.id).slice(0, 128);
      const displayName = String(sessionObj.topic || sessionObj.username || "عضو").slice(0, 128);
      const grant = new AccessToken(apiKey, apiSecret, {
        identity: verifiedIdentity,
        name: displayName,
        ttl: "10m",
      });
      grant.addGrant({
        roomJoin: true,
        room: requestedRoomId,
        canSubscribe: true,
        canPublish,
        canPublishSources: canPublish ? [TrackSource.MICROPHONE] : [],
        canPublishData: false,
      });
      const jwtToken = await grant.toJwt();

      return {
        ok: true,
        wsUrl: livekitWsUrl,
        url: livekitWsUrl,
        room: requestedRoomId,
        identity: verifiedIdentity,
        canPublish,
        token: jwtToken,
      };
    } catch {
      return reply.code(500).send({ ok: false, msg: "Failed to generate LiveKit token." });
    }
  };

  app.get("/livekit/token", issueLiveKitStageToken);
  app.post("/livekit/token", issueLiveKitStageToken);
}

export { normalizeAssetBaseName };
