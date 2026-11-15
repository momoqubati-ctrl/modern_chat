import {
  and,
  asc,
  desc,
  eq,
  getDb,
  gte,
  inArray,
  lt,
  note_comment_likes,
  note_comments,
  note_likes,
  sql,
  user_notes,
  users,
} from "@newchat/db";
import {
  sanitizeHtmlText,
  stringGen,
  verAdminPanel,
  type NoteCommentRecord,
  type UserNoteRecord,
} from "@newchat/shared";
import type { Socket } from "socket.io";
import { emitNotice } from "../lib/socketUtils.js";
import type { GatewayContext } from "../types/gateway.js";

const NOTE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours Lifetime

export async function loadInitialNotes(viewerUid = ""): Promise<UserNoteRecord[]> {
  try {
    const { db } = getDb();
    const cutoff = Date.now() - NOTE_TTL_MS;

    // Prune notes older than 24 hours in the background
    void db
      .delete(user_notes)
      .where(lt(user_notes.created_at, cutoff))
      .catch(() => undefined);

    // Only select notes within the last 24 hours
    const rows = await db
      .select()
      .from(user_notes)
      .where(gte(user_notes.created_at, cutoff))
      .orderBy(desc(user_notes.created_at))
      .limit(60);

    if (rows.length === 0) return [];

    // Ensure only the latest active note per user is displayed (prevent duplicate members)
    const uniqueUserRows: typeof rows = [];
    const seenUids = new Set<string>();
    for (const r of rows) {
      if (!r.uid || seenUids.has(r.uid)) continue;
      seenUids.add(r.uid);
      uniqueUserRows.push(r);
    }

    if (uniqueUserRows.length === 0) return [];

    const noteNids = uniqueUserRows.map((r) => r.nid).filter(Boolean);
    const authorUids = Array.from(new Set(uniqueUserRows.map((r) => r.uid).filter(Boolean)));
    const cleanViewer = String(viewerUid || "").trim();

    const [userLikesRows, userMetaRows] = await Promise.all([
      cleanViewer && noteNids.length > 0
        ? db
            .select({ note_nid: note_likes.note_nid })
            .from(note_likes)
            .where(and(inArray(note_likes.note_nid, noteNids), eq(note_likes.user_uid, cleanViewer)))
        : Promise.resolve([]),
      authorUids.length > 0
        ? db
            .select({
              uid: users.uid,
              topic: users.topic,
              pic: users.pic,
              ucol: users.ucol,
              documentationc: users.documentationc,
            })
            .from(users)
            .where(inArray(users.uid, authorUids))
        : Promise.resolve([]),
    ]);

    const myLikesSet = new Set<string>();
    for (const l of userLikesRows) {
      myLikesSet.add(l.note_nid);
    }

    const userMetaMap = new Map<
      string,
      { topic: string; pic: string; ucol: string; verified: boolean }
    >();
    for (const u of userMetaRows) {
      if (u.uid) {
        userMetaMap.set(u.uid, {
          topic: String(u.topic || ""),
          pic: String(u.pic || ""),
          ucol: String(u.ucol || ""),
          verified: Number(u.documentationc || 0) === 1,
        });
      }
    }

    return uniqueUserRows.map((r) => {
      const meta = userMetaMap.get(r.uid);
      const authorTopic = meta?.topic || r.author_topic || "عضو";
      const authorPic = meta?.pic || r.author_pic || "";
      const authorUcol = meta?.ucol || r.author_ucol || "";
      const authorVerified = meta ? meta.verified : Boolean(r.author_verified);

      return {
        id: r.id,
        nid: r.nid,
        uid: r.uid,
        authorTopic: authorTopic.startsWith("@") ? authorTopic : `@${authorTopic}`,
        authorPic,
        authorUcol,
        authorVerified,
        type: (r.type === "audio" ? "audio" : "text") as "text" | "audio",
        text: r.text || "",
        caption: r.caption || "",
        audioUrl: r.audio_url || "",
        duration: r.duration || 0,
        tag: r.tag || (r.type === "audio" ? "موسيقى" : ""),
        likesCount: Number(r.likes_count || 0),
        commentsCount: Number(r.comments_count || 0),
        likedByMe: myLikesSet.has(r.nid),
        createdAt: Number(r.created_at || Date.now()),
      };
    });
  } catch (err) {
    console.error("[notesHandlers] loadInitialNotes error:", err);
    return [];
  }
}

export function createNotesHandlers(ctx: GatewayContext) {
  return {
    async handleGetNotes(socket: Socket): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      const viewerUid = session?.uid || "";
      const notes = await loadInitialNotes(viewerUid);
      socket.emit("msg", { cmd: "notes_list", data: notes });
    },

    async handlePublishNote(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.uid) {
        emitNotice(socket, "يرجى تسجيل الدخول لنشر ملاحظة");
        return;
      }
      if (session.ismuted || session.muted) {
        emitNotice(socket, "أنت مكتوم حالياً ولا يمكنك نشر ملاحظات");
        return;
      }

      if (!rawData || typeof rawData !== "object") {
        emitNotice(socket, "بيانات الملاحظة غير صالحة");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const rawType = String(d.type || "text").trim().toLowerCase();
      const noteType: "text" | "audio" = rawType === "audio" ? "audio" : "text";

      const rawText = sanitizeHtmlText(String(d.text || d.caption || "").trim()).slice(0, 500);
      const rawCaption = sanitizeHtmlText(String(d.caption || d.text || d.tag || "").trim()).slice(0, 100);
      const rawTag = sanitizeHtmlText(String(d.tag || (noteType === "audio" ? "موسيقى" : "")).trim()).slice(0, 40);
      const rawAudioUrl = sanitizeHtmlText(String(d.audioUrl || d.audio_url || d.src || d.link || "").trim()).slice(0, 500);
      const duration = Math.max(1, Math.min(300, Number(d.duration || d.length || 15) || 15));

      if (noteType === "text") {
        if (!rawText) {
          emitNotice(socket, "يرجى كتابة نص الملاحظة");
          return;
        }
        if (/https?:\/\/[^\s]+/i.test(rawText)) {
          emitNotice(socket, "لا يُسمح بإدراج روابط في الملاحظة");
          return;
        }
        if (ctx.catalogStore.scanProhibitedWords(rawText)) {
          emitNotice(socket, "تحتوي الملاحظة على كلمات غير مسموح بها");
          return;
        }
      } else {
        if (
          !rawAudioUrl ||
          (!rawAudioUrl.startsWith("/") &&
            !rawAudioUrl.startsWith("https://") &&
            !rawAudioUrl.startsWith("http://") &&
            !rawAudioUrl.startsWith("data:audio"))
        ) {
          emitNotice(socket, "يرجى تسجيل صوت صالح أو اختيار ملف صوتي");
          return;
        }
      }

      const { db } = getDb();
      const cutoff = Date.now() - NOTE_TTL_MS;

      // Prevent sending a note if member already has an active note (< 24 hours)
      const existingActive = await db
        .select({ nid: user_notes.nid })
        .from(user_notes)
        .where(and(eq(user_notes.uid, session.uid), gte(user_notes.created_at, cutoff)))
        .limit(1);

      if (existingActive.length > 0) {
        emitNotice(
          socket,
          "لديك ملاحظة نشطة بالفعل لم تنتهِ بعد. يمكنك نشر ملاحظة جديدة بعد مرور 24 ساعة أو حذف الملاحظة السابقة أولاً."
        );
        return;
      }

      const nid = `note_${stringGen(12)}`;
      const now = Date.now();

      await db.insert(user_notes).values({
        nid,
        uid: session.uid,
        author_topic: session.topic || "عضو",
        author_pic: session.pic || "",
        author_ucol: session.ucol || "",
        author_verified: Boolean(session.documents || session.documentationc),
        type: noteType,
        text: noteType === "text" ? rawText : "",
        caption: rawCaption || rawText || rawTag,
        audio_url: noteType === "audio" ? rawAudioUrl : "",
        duration: noteType === "audio" ? duration : 0,
        tag: rawTag,
        likes_count: 0,
        comments_count: 0,
        created_at: now,
      });

      // Broadcast fresh notes to all connected clients
      const [callerNotes, publicNotes] = await Promise.all([
        loadInitialNotes(session.uid),
        loadInitialNotes(),
      ]);

      socket.emit("msg", { cmd: "notes_list", data: callerNotes });
      socket.broadcast.emit("msg", { cmd: "notes_list", data: publicNotes });
      emitNotice(socket, noteType === "audio" ? "تم نشر الملاحظة الصوتية 🎵" : "تم نشر ملاحظتك بنجاح ✨");
    },

    async handleToggleNoteLike(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.uid) {
        emitNotice(socket, "يرجى تسجيل الدخول للتفاعل");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const noteNid = String(d?.noteNid || d?.nid || "").trim();
      if (!noteNid) return;

      const { db } = getDb();

      // Check existing like
      const existing = await db
        .select({ id: note_likes.id })
        .from(note_likes)
        .where(and(eq(note_likes.note_nid, noteNid), eq(note_likes.user_uid, session.uid)))
        .limit(1);

      let liked = false;
      if (existing.length > 0) {
        await db.delete(note_likes).where(eq(note_likes.id, existing[0].id));
        liked = false;
      } else {
        await db.insert(note_likes).values({
          note_nid: noteNid,
          user_uid: session.uid,
          topic: session.topic || "",
          photo: session.pic || "",
          created_at: Date.now(),
        });
        liked = true;
      }

      // Count total likes
      const countRes = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(note_likes)
        .where(eq(note_likes.note_nid, noteNid));
      const likesCount = Number(countRes[0]?.cnt || 0);

      // Update in user_notes
      await db
        .update(user_notes)
        .set({ likes_count: likesCount })
        .where(eq(user_notes.nid, noteNid));

      const payload = { noteNid, likesCount };
      socket.emit("msg", { cmd: "note_like_updated", data: { ...payload, liked } });
      socket.broadcast.emit("msg", { cmd: "note_like_updated", data: payload });
    },

    async handleAddNoteComment(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.uid) {
        emitNotice(socket, "يرجى تسجيل الدخول للتعليق");
        return;
      }
      if (session.ismuted || session.muted) {
        emitNotice(socket, "أنت مكتوم حالياً");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const noteNid = String(d?.noteNid || d?.nid || "").trim();
      const body = sanitizeHtmlText(String(d?.body || d?.comment || "").trim()).slice(0, 500);
      const parentCid = sanitizeHtmlText(String(d?.parentCid || d?.parent_cid || "").trim()).slice(0, 64);
      const replyToTopic = sanitizeHtmlText(String(d?.replyToTopic || d?.reply_to_topic || "").trim()).slice(0, 255);

      if (!noteNid || !body) {
        emitNotice(socket, "يرجى كتابة نص التعليق");
        return;
      }

      if (ctx.catalogStore.scanProhibitedWords(body)) {
        emitNotice(socket, "يحتوي التعليق على كلمات غير مسموح بها");
        return;
      }

      const { db } = getDb();
      const cid = `nc_${stringGen(12)}`;
      const now = Date.now();

      await db.insert(note_comments).values({
        cid,
        note_nid: noteNid,
        parent_cid: parentCid,
        reply_to_topic: replyToTopic,
        author_uid: session.uid,
        author_topic: session.topic || "عضو",
        author_pic: session.pic || "",
        author_ucol: session.ucol || "",
        author_verified: Boolean(session.documents || session.documentationc),
        body,
        likes_count: 0,
        created_at: now,
      });

      const countRes = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(note_comments)
        .where(eq(note_comments.note_nid, noteNid));
      const commentsCount = Number(countRes[0]?.cnt || 0);

      await db
        .update(user_notes)
        .set({ comments_count: commentsCount })
        .where(eq(user_notes.nid, noteNid));

      const commentRecord: NoteCommentRecord = {
        cid,
        noteNid,
        parent_cid: parentCid,
        parentCid,
        reply_to_topic: replyToTopic,
        replyToTopic,
        authorUid: session.uid,
        authorTopic: session.topic || "عضو",
        authorPic: session.pic || "",
        authorUcol: session.ucol || "",
        authorVerified: Boolean(session.documents || session.documentationc),
        author_pic: session.pic || "",
        author_topic: session.topic || "عضو",
        author_verified: Boolean(session.documents || session.documentationc),
        body,
        likesCount: 0,
        likes_count: 0,
        likedByMe: false,
        createdAt: now,
      };

      ctx.io.emit("msg", {
        cmd: "note_comment_added",
        data: { noteNid, comment: commentRecord, commentsCount },
      });
    },

    async handleGetNoteComments(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      const viewerUid = session?.uid || "";
      const noteNid =
        typeof rawData === "string"
          ? rawData.trim()
          : String((rawData as any)?.noteNid || (rawData as any)?.nid || "").trim();

      if (!noteNid) return;

      const { db } = getDb();
      const [rows, commentLikesRows] = await Promise.all([
        db
          .select()
          .from(note_comments)
          .where(eq(note_comments.note_nid, noteNid))
          .orderBy(asc(note_comments.created_at))
          .limit(100),
        viewerUid
          ? db
              .select({ comment_cid: note_comment_likes.comment_cid })
              .from(note_comment_likes)
              .where(eq(note_comment_likes.user_uid, viewerUid))
          : Promise.resolve([]),
      ]);

      const myLikedCids = new Set(commentLikesRows.map((r) => r.comment_cid));

      const comments: NoteCommentRecord[] = rows.map((r) => ({
        id: r.id,
        cid: r.cid,
        noteNid: r.note_nid,
        parent_cid: r.parent_cid || "",
        parentCid: r.parent_cid || "",
        reply_to_topic: r.reply_to_topic || "",
        replyToTopic: r.reply_to_topic || "",
        authorUid: r.author_uid,
        authorTopic: r.author_topic || "عضو",
        authorPic: r.author_pic || "",
        authorUcol: r.author_ucol || "",
        authorVerified: Boolean(r.author_verified),
        author_pic: r.author_pic || "",
        author_topic: r.author_topic || "عضو",
        author_verified: Boolean(r.author_verified),
        body: r.body,
        likesCount: Number(r.likes_count || 0),
        likes_count: Number(r.likes_count || 0),
        likedByMe: myLikedCids.has(r.cid),
        liked_by_me: myLikedCids.has(r.cid),
        createdAt: Number(r.created_at || Date.now()),
      }));

      socket.emit("msg", { cmd: "note_comments_list", data: { noteNid, comments } });
    },

    async handleToggleNoteCommentLike(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.uid) {
        emitNotice(socket, "يرجى تسجيل الدخول للإعجاب");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const noteNid = String(d?.noteNid || d?.nid || "").trim();
      const commentCid = String(d?.commentCid || d?.cid || "").trim();
      if (!commentCid) return;

      const { db } = getDb();
      const existing = await db
        .select({ id: note_comment_likes.id })
        .from(note_comment_likes)
        .where(and(eq(note_comment_likes.comment_cid, commentCid), eq(note_comment_likes.user_uid, session.uid)))
        .limit(1);

      let liked = false;
      if (existing.length > 0) {
        await db.delete(note_comment_likes).where(eq(note_comment_likes.id, existing[0].id));
        liked = false;
      } else {
        await db.insert(note_comment_likes).values({
          comment_cid: commentCid,
          user_uid: session.uid,
          created_at: Date.now(),
        });
        liked = true;
      }

      const countRes = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(note_comment_likes)
        .where(eq(note_comment_likes.comment_cid, commentCid));
      const likesCount = Number(countRes[0]?.cnt || 0);

      await db
        .update(note_comments)
        .set({ likes_count: likesCount })
        .where(eq(note_comments.cid, commentCid));

      const payload = { noteNid, commentCid, likesCount };
      socket.emit("msg", { cmd: "note_comment_like_updated", data: { ...payload, liked } });
      socket.broadcast.emit("msg", { cmd: "note_comment_like_updated", data: payload });
    },

    async handleDeleteNoteComment(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.uid) return;

      const d = rawData as Record<string, unknown>;
      const noteNid = String(d?.noteNid || d?.nid || "").trim();
      const commentCid = String(d?.commentCid || d?.cid || "").trim();
      if (!commentCid || !noteNid) return;

      const { db } = getDb();
      const existing = await db
        .select()
        .from(note_comments)
        .where(eq(note_comments.cid, commentCid))
        .limit(1);

      if (existing.length === 0) return;
      const c = existing[0];

      const isAdmin = verAdminPanel(ctx.catalogStore.getPowers(), session.rank || session.power);
      if (c.author_uid !== session.uid && !isAdmin) {
        emitNotice(socket, "ليس لديك صلاحية حذف هذا التعليق");
        return;
      }

      await Promise.all([
        db.delete(note_comments).where(eq(note_comments.cid, commentCid)),
        db.delete(note_comments).where(eq(note_comments.parent_cid, commentCid)),
        db.delete(note_comment_likes).where(eq(note_comment_likes.comment_cid, commentCid)),
      ]);

      const countRes = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(note_comments)
        .where(eq(note_comments.note_nid, noteNid));
      const commentsCount = Number(countRes[0]?.cnt || 0);

      await db
        .update(user_notes)
        .set({ comments_count: commentsCount })
        .where(eq(user_notes.nid, noteNid));

      ctx.io.emit("msg", {
        cmd: "note_comment_deleted",
        data: { noteNid, commentCid, commentsCount },
      });
      emitNotice(socket, "تم حذف التعليق");
    },

    async handleDeleteNote(socket: Socket, rawData: unknown): Promise<void> {
      const session = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!session || !session.uid) return;

      const d = rawData as Record<string, unknown>;
      const noteNid = String(d?.noteNid || d?.nid || "").trim();
      if (!noteNid) return;

      const { db } = getDb();
      const existing = await db
        .select()
        .from(user_notes)
        .where(eq(user_notes.nid, noteNid))
        .limit(1);

      if (existing.length === 0) return;
      const note = existing[0];

      // Only author or master can delete
      const isAdmin = verAdminPanel(ctx.catalogStore.getPowers(), session.rank || session.power);
      if (note.uid !== session.uid && !isAdmin) {
        emitNotice(socket, "ليس لديك صلاحية حذف هذه الملاحظة");
        return;
      }

      await Promise.all([
        db.delete(user_notes).where(eq(user_notes.nid, noteNid)),
        db.delete(note_likes).where(eq(note_likes.note_nid, noteNid)),
        db.delete(note_comments).where(eq(note_comments.note_nid, noteNid)),
      ]);

      ctx.io.emit("msg", { cmd: "note_deleted", data: { noteNid } });
      emitNotice(socket, "تم حذف الملاحظة");
    },
  };
}
