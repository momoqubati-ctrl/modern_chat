import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sharp from "sharp";
import { apiConfig } from "../config.js";
import {
  extractRequestToken,
  getRequestRealIp,
  resolveUserActorByToken,
} from "../lib/runtime.js";
import {
  getFeedPosts,
  createFeedPost,
  deleteFeedPost,
  togglePostLike,
  togglePostBookmark,
  getPostComments,
  addPostComment,
  deletePostComment,
  toggleCommentLike,
  toggleFollowUser,
  sendFeedPostGift,
} from "../services/feedService.js";

async function resolveOptionalAuth(req: FastifyRequest) {
  const token = extractRequestToken(req);
  if (!token) return null;
  return await resolveUserActorByToken(token);
}

async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const user = await resolveOptionalAuth(req);
  if (!user || !user.uid) {
    reply.code(401).send({ ok: false, err: "UNAUTHORIZED", message: "يجب تسجيل الدخول أولاً" });
    return null;
  }
  return user;
}

export async function registerFeedRoutes(app: FastifyInstance) {
  const feedUploadDir = path.resolve(apiConfig.uploadDir, "feed");
  fs.mkdirSync(feedUploadDir, { recursive: true });

  // 1. Get Feed Posts (Paginated)
  app.get("/api/feed/posts", async (req, reply) => {
    try {
      const user = await resolveOptionalAuth(req);
      const query = req.query as { cursor?: string; limit?: string };
      const cursor = query.cursor ? Number(query.cursor) : undefined;
      const limit = query.limit ? Number(query.limit) : 10;

      const result = await getFeedPosts({
        userUid: user?.uid ? String(user.uid) : undefined,
        cursor,
        limit,
      });

      return reply.send({ ok: true, ...result });
    } catch (err: unknown) {
      req.log.error(err, "Error fetching feed posts");
      return reply.code(500).send({ ok: false, message: "تعذر جلب منشورات الحسابات" });
    }
  });

  // 2. Create Feed Post
  app.post("/api/feed/posts", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    try {
      const body = req.body as {
        caption?: string;
        mediaType?: "image" | "carousel" | "video";
        mediaItems?: Array<{
          url: string;
          mediaType?: "image" | "video";
          width?: number;
          height?: number;
          duration?: number;
          thumbnailUrl?: string;
        }>;
        musicTitle?: string;
      };

      if (!body.mediaItems || body.mediaItems.length === 0) {
        return reply.code(400).send({ ok: false, message: "يجب إرفاق وسائط (صورة أو فيديو) للمنشور" });
      }

      const post = await createFeedPost({
        authorUid: String(user.uid),
        caption: body.caption,
        mediaType: body.mediaType || (body.mediaItems.length > 1 ? "carousel" : "image"),
        mediaItems: body.mediaItems,
        musicTitle: body.musicTitle,
      });

      return reply.send({ ok: true, post });
    } catch (err: unknown) {
      req.log.error(err, "Error creating feed post");
      return reply.code(500).send({ ok: false, message: "تعذر نشر المنشور" });
    }
  });

  // 3. Delete Feed Post
  app.delete("/api/feed/posts/:postId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { postId } = req.params as { postId: string };
    try {
      const isSuperAdmin = user.power === "superadmin" || user.power === "admin";
      await deleteFeedPost(postId, String(user.uid), isSuperAdmin);
      return reply.send({ ok: true });
    } catch (err: unknown) {
      req.log.error(err, "Error deleting feed post");
      return reply.code(403).send({ ok: false, message: "غير مصرح بحذف هذا المنشور" });
    }
  });

  // 4. Toggle Like on Post
  app.post("/api/feed/posts/:postId/like", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { postId } = req.params as { postId: string };
    try {
      const result = await togglePostLike(postId, String(user.uid));
      return reply.send({ ok: true, ...result });
    } catch (err: unknown) {
      req.log.error(err, "Error toggling post like");
      return reply.code(500).send({ ok: false, message: "تعذر تحديث الإعجاب" });
    }
  });

  // 5. Toggle Bookmark on Post
  app.post("/api/feed/posts/:postId/bookmark", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { postId } = req.params as { postId: string };
    try {
      const result = await togglePostBookmark(postId, String(user.uid));
      return reply.send({ ok: true, ...result });
    } catch (err: unknown) {
      req.log.error(err, "Error toggling post bookmark");
      return reply.code(500).send({ ok: false, message: "تعذر حفظ المنشور" });
    }
  });

  // 6. Get Post Comments & Threaded Replies
  app.get("/api/feed/posts/:postId/comments", async (req, reply) => {
    try {
      const user = await resolveOptionalAuth(req);
      const { postId } = req.params as { postId: string };

      const result = await getPostComments(postId, user?.uid ? String(user.uid) : undefined);
      return reply.send({ ok: true, ...result });
    } catch (err: unknown) {
      req.log.error(err, "Error fetching post comments");
      return reply.code(500).send({ ok: false, message: "تعذر جلب التعليقات" });
    }
  });

  // 7. Add Comment or Nested Reply
  app.post("/api/feed/posts/:postId/comments", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { postId } = req.params as { postId: string };
    const body = req.body as {
      content: string;
      parentCommentId?: string;
      replyToUid?: string;
      replyToUsername?: string;
    };

    if (!body.content || !body.content.trim()) {
      return reply.code(400).send({ ok: false, message: "نص التعليق لا يمكن أن يكون فارغاً" });
    }

    try {
      const comment = await addPostComment({
        postId,
        authorUid: String(user.uid),
        content: body.content,
        parentCommentId: body.parentCommentId,
        replyToUid: body.replyToUid,
        replyToUsername: body.replyToUsername,
      });

      return reply.send({ ok: true, comment });
    } catch (err: unknown) {
      req.log.error(err, "Error adding comment");
      return reply.code(500).send({ ok: false, message: "تعذر إضافة التعليق" });
    }
  });

  // 8. Delete Comment
  app.delete("/api/feed/comments/:commentId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { commentId } = req.params as { commentId: string };
    try {
      const isSuperAdmin = user.power === "superadmin" || user.power === "admin";
      await deletePostComment(commentId, String(user.uid), isSuperAdmin);
      return reply.send({ ok: true });
    } catch (err: unknown) {
      req.log.error(err, "Error deleting comment");
      return reply.code(403).send({ ok: false, message: "غير مصرح بحذف هذا التعليق" });
    }
  });

  // 9. Toggle Comment Like
  app.post("/api/feed/comments/:commentId/like", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { commentId } = req.params as { commentId: string };
    try {
      const result = await toggleCommentLike(commentId, String(user.uid));
      return reply.send({ ok: true, ...result });
    } catch (err: unknown) {
      req.log.error(err, "Error toggling comment like");
      return reply.code(500).send({ ok: false, message: "تعذر تحديث إعجاب التعليق" });
    }
  });

  // 10. Toggle Follow User
  app.post("/api/feed/follow/:targetUid", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { targetUid } = req.params as { targetUid: string };
    try {
      const result = await toggleFollowUser(String(user.uid), targetUid);
      return reply.send({ ok: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ ok: false, message: msg === "CANNOT_FOLLOW_SELF" ? "لا يمكنك متابعة نفسك" : "تعذر تحديث المتابعة" });
    }
  });

  // 11. Send Gift to Post Author (Protected by Idempotency & Unified Economy Engine)
  app.post("/api/feed/gift", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = req.body as {
      postId: string;
      giftFile: string;
      quantity?: number;
      unitCoin: number;
      idempotencyKey?: string;
    };

    if (!body.postId || !body.giftFile || !body.unitCoin) {
      return reply.code(400).send({ ok: false, message: "بيانات الهدية غير مكتملة" });
    }

    const idempotencyKey =
      String(body.idempotencyKey || "").trim() ||
      `gift_feed_${body.postId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    try {
      const result = await sendFeedPostGift({
        senderUid: String(user.uid),
        senderIp: getRequestRealIp(req),
        postId: body.postId,
        giftFile: body.giftFile,
        quantity: Math.max(1, Number(body.quantity || 1)),
        unitCoin: Number(body.unitCoin),
        idempotencyKey,
      });

      return reply.send({ ok: true, transfer: result });
    } catch (err: unknown) {
      req.log.error(err, "Feed gift error");
      const msg = err instanceof Error ? err.message : "تعذر إرسال الهدية";
      return reply.code(400).send({ ok: false, message: msg });
    }
  });

  // 12. Upload Feed Media (Photos & Videos)
  app.post("/api/feed/upload", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    try {
      const filePart = await req.file();
      if (!filePart) {
        return reply.code(400).send({ ok: false, message: "لم يتم تحديد أي ملف" });
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of filePart.file) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > apiConfig.maxUploadBytes) {
          return reply.code(413).send({ ok: false, message: "حجم الملف يتجاوز الحد المسموح" });
        }
        chunks.push(buf);
      }

      const fileBuffer = Buffer.concat(chunks);
      const ext = path.extname(filePart.filename || "").toLowerCase().replace(/^\./, "");
      const isVideo = ext === "mp4" || ext === "webm" || ext === "mov";
      const filename = `feed_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${isVideo ? ext : "webp"}`;
      const targetPath = path.join(feedUploadDir, filename);

      let width = 0;
      let height = 0;

      if (!isVideo) {
        const metadata = await sharp(fileBuffer).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;

        await sharp(fileBuffer)
          .webp({ quality: 85 })
          .toFile(targetPath);
      } else {
        await fs.promises.writeFile(targetPath, fileBuffer);
      }

      const relativeUrl = `/uploads/feed/${filename}`;
      return reply.send({
        ok: true,
        url: relativeUrl,
        mediaType: isVideo ? "video" : "image",
        width,
        height,
      });
    } catch (err: unknown) {
      req.log.error(err, "Feed upload error");
      return reply.code(500).send({ ok: false, message: "تعذر رفع الملف" });
    }
  });
}
