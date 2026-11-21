import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  and,
  asc,
  desc,
  eq,
  followers,
  getDb,
  inArray,
  internal_mail,
  bars,
  note_comments,
  note_likes,
  or,
  profile_visits,
  sql,
  storie,
  storieview,
  story_comment_likes,
  story_comments,
  story_likes,
  top10wall,
  user_notes,
  users,
} from "@newchat/db";
import {
  NO_NAMES,
  canActOnRank,
  canManageSiteBadges,
  getPowerDefinitionByName,
  sanitizeHtmlText,
  stringGen,
  verAdminPanel,
  verStealthPanel,
} from "@newchat/shared";
import type { Socket } from "socket.io";
import { gatewayConfig } from "../config.js";
import { hashPasswordSync, verifyPasswordAsync } from "../lib/password.js";
import { emitNotice, resolveContainedPath, safeJsonParse } from "../lib/socketUtils.js";
import type { GatewayContext, GatewaySession } from "../types/gateway.js";
import { loadInitialStories } from "./authHandlers.js";

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

async function syncMemberIdentity(
  ctx: GatewayContext,
  uid: string,
  fields: Partial<GatewaySession> & { verified?: boolean },
): Promise<void> {
  if (!uid) return;
  const { db } = getDb();
  const [member] = await db
    .select({
      topic: users.topic,
      username: users.username,
      pic: users.pic,
      ucol: users.ucol,
      documentationc: users.documentationc,
    })
    .from(users)
    .where(eq(users.uid, uid))
    .limit(1);
  if (!member) return;

  const topic = fields.topic ?? member.topic ?? "عضو";
  const pic = fields.pic ?? member.pic ?? "pic.png";
  const ucol = fields.ucol ?? member.ucol ?? "#000000";
  const verified = fields.verified ?? Boolean(member.documentationc);

  await Promise.all([
    db.update(story_comments).set({
      author_topic: topic,
      author_pic: pic,
      author_ucol: ucol,
      author_verified: verified,
    }).where(eq(story_comments.author_uid, uid)),
    db.update(note_comments).set({
      author_topic: topic,
      author_pic: pic,
      author_ucol: ucol,
      author_verified: verified,
    }).where(eq(note_comments.author_uid, uid)),
    db.update(user_notes).set({
      author_topic: topic,
      author_pic: pic,
      author_ucol: ucol,
      author_verified: verified,
    }).where(eq(user_notes.uid, uid)),
    db.update(story_likes).set({ topic, photo: pic }).where(eq(story_likes.user_uid, uid)),
    db.update(note_likes).set({ topic, photo: pic }).where(eq(note_likes.user_uid, uid)),
    db.update(storie).set({ name: topic, photo: pic }).where(eq(storie.sid, uid)),
    db.update(storieview).set({ topic, photo: pic }).where(eq(storieview.sid, uid)),
    db.update(profile_visits).set({ visitor_name: topic, visitor_pic: pic }).where(eq(profile_visits.visitor_id, uid)),
    db.update(bars).set({ topic, pic, ucol }).where(eq(bars.uid, uid)),
    db.update(top10wall).set({ topic, pic }).where(eq(top10wall.uid, uid)),
    db.update(internal_mail).set({ from_topic: topic, from_pic: pic, from_username: member.username }).where(eq(internal_mail.from_uid, uid)),
    db.update(internal_mail).set({ to_topic: topic, to_pic: pic, to_username: member.username }).where(eq(internal_mail.to_uid, uid)),
  ]);

  const socketIds = await ctx.presenceDirectory.getAllSocketIdsByUid(uid);
  await Promise.all(socketIds.map((socketId) =>
    ctx.presenceDirectory.patchSession(socketId, {
      ...fields,
      topic,
      pic,
      ucol,
      documentationc: verified,
    }),
  ));
}

function cleanColor(value: unknown, fallback: string): string {
  const c = sanitizeHtmlText(String(value ?? "").trim());
  return c ? c.slice(0, 64) : fallback;
}

export function createProfileSocialHandlers(ctx: GatewayContext) {
  return {
    async handleUnick(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const powers = ctx.catalogStore.getPowers();
      const powerDef = getPowerDefinitionByName(powers, actor.rank || actor.power);
      if (!powerDef || !Number(powerDef.unick || 0)) {
        emitNotice(socket, "لا تملك صلاحية تغيير أسماء الأعضاء");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const targetId = String(d.id || socket.id).trim();
      const newTopic = sanitizeHtmlText(String(d.topic || d.name || "").trim()).slice(0, 150);
      if (!newTopic) return;
      if (NO_NAMES.some((w) => w && newTopic.toLowerCase().includes(w.toLowerCase()))) {
        emitNotice(socket, "هذا الاسم غير مسموح به");
        return;
      }

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target) return;
      if (!canActOnRank(powers, actor.rank || actor.power, target.rank || target.power)) {
        emitNotice(socket, "لا يمكنك تعديل عضو أعلى منك في الرتبة");
        return;
      }

      if (target.islogin === "عضو" && target.uid) {
        const { db } = getDb();
        await db.update(users).set({ topic: newTopic }).where(eq(users.uid, target.uid));
        await syncMemberIdentity(ctx, target.uid, { topic: newTopic });
      } else {
        await ctx.presenceDirectory.patchSession(targetId, { topic: newTopic });
      }
      await ctx.securityGuard.recordModerationStat({
        state: "تغير الاسم",
        topic: actor.topic,
        targetTopic: `${target.topic} -> ${newTopic}`,
        room: target.roomid || "",
        ip: actor.ip,
      });
      emitNotice(socket, "تم تغيير الاسم بنجاح");
    },

    async handleSetPowerOn(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || actor.islogin !== "عضو" || !actor.uid) return;
      const powers = ctx.catalogStore.getPowers();
      if (!verStealthPanel(powers, actor.rank || actor.power)) return;

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const nextHiddenLogin = d.on !== undefined ? Boolean(d.on) : !actor.loginG;

      const { db } = getDb();
      await db.update(users).set({ loginG: nextHiddenLogin }).where(eq(users.uid, actor.uid));
      await ctx.presenceDirectory.patchSession(socket.id, {
        loginG: nextHiddenLogin,
        stealth: nextHiddenLogin,
      });
      emitNotice(socket, nextHiddenLogin ? "تم تفعيل الدخول المخفي" : "تم إلغاء الدخول المخفي");
    },

    async handleSetProfile(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const limits = ctx.catalogStore.getLimits();
      const powerDef = ctx.catalogStore.getPowerRole(actor.rank || actor.power);

      let nextTopic = actor.topic;
      if (d.topic !== undefined) {
        const candidate = sanitizeHtmlText(String(d.topic).trim()).slice(0, limits.lengthUserReg);
        if (candidate && candidate !== actor.topic) {
          if (actor.rep < limits.likeTopicEdit && !Number(powerDef?.mynick || 0)) {
            emitNotice(socket, `تحتاج إلى ${limits.likeTopicEdit} نقطة لتغيير الاسم`);
            return;
          }
          if (
            NO_NAMES.some((w) => w && candidate.toLowerCase().includes(w.toLowerCase())) ||
            ctx.catalogStore.scanProhibitedWords(candidate)
          ) {
            emitNotice(socket, "هذا الاسم غير مسموح به");
            return;
          }
          if (await ctx.presenceDirectory.isUsernameTakenGlobally(candidate, socket.id)) {
            emitNotice(socket, "الاسم مستخدم حالياً في الدردشة");
            return;
          }
          nextTopic = candidate;
        }
      }

      const nextMsg =
        d.msg !== undefined ? sanitizeHtmlText(String(d.msg).trim()).slice(0, 200) : actor.msg;
      const nextBg = d.bg !== undefined ? cleanColor(d.bg, actor.bg) : actor.bg;
      const nextUcol = d.ucol !== undefined ? cleanColor(d.ucol, actor.ucol) : actor.ucol;
      const nextMcol = d.mcol !== undefined ? cleanColor(d.mcol, actor.mcol) : actor.mcol;
      const nextGcol = d.gcol !== undefined ? cleanColor(d.gcol, actor.gcol) : actor.gcol;
      const nextYp = d.yp !== undefined ? sanitizeHtmlText(String(d.yp).trim()).slice(0, 250) : actor.yp;
      const nextPic = d.pic !== undefined ? sanitizeHtmlText(String(d.pic).trim()).slice(0, 250) || "pic.png" : actor.pic;

      if (actor.islogin === "عضو" && actor.uid) {
        const { db } = getDb();
        await db
          .update(users)
          .set({
            topic: nextTopic,
            msg: nextMsg,
            bg: nextBg,
            ucol: nextUcol,
            mcol: nextMcol,
            gcol: nextGcol,
            youtub: nextYp,
            pic: nextPic,
          })
          .where(eq(users.uid, actor.uid));
      }

      if (actor.islogin === "عضو" && actor.uid) {
        await syncMemberIdentity(ctx, actor.uid, {
          topic: nextTopic,
          pic: nextPic,
          ucol: nextUcol,
          msg: nextMsg,
          bg: nextBg,
          mcol: nextMcol,
          gcol: nextGcol,
          yp: nextYp,
        });
      } else {
        await ctx.presenceDirectory.patchSession(socket.id, {
          topic: nextTopic,
          msg: nextMsg,
          bg: nextBg,
          ucol: nextUcol,
          mcol: nextMcol,
          gcol: nextGcol,
          yp: nextYp,
          pic: nextPic,
        });
      }
      emitNotice(socket, "تم حفظ الملف الشخصي بنجاح");
    },

    async handleSetPic(socket: Socket, cmd: "setpic" | "setpic2", rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const limits = ctx.catalogStore.getLimits();
      if (actor.rep < limits.likeUpPic && actor.islogin === "عضو") {
        emitNotice(socket, `تحتاج إلى ${limits.likeUpPic} نقطة لتغيير الصورة`);
        return;
      }

      let publicPic = cmd === "setpic2" ? "pich.png" : "pic.png";
      if (!d.clear) {
        const rawInput = String(d.img || d.pic || d.file || "").trim();
        if (!rawInput) return;
        const dataUrlMatch = rawInput.match(/^data:([^;,]+);base64,(.+)$/is);
        if (dataUrlMatch?.[1] && dataUrlMatch[2]) {
          const mime = dataUrlMatch[1].toLowerCase().trim();
          const ext = IMAGE_MIME_TO_EXT[mime];
          if (!ext) {
            emitNotice(socket, "صيغة الصورة غير مدعومة");
            return;
          }
          const buffer = Buffer.from(dataUrlMatch[2], "base64");
          if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
            emitNotice(socket, "حجم الصورة يتجاوز الحد المسموح");
            return;
          }
          const folderName = cmd === "setpic2" ? "pic2" : "pic";
          const targetDir = path.join(gatewayConfig.uploadDir, folderName);
          await fs.mkdir(targetDir, { recursive: true });
          const fileName = `${actor.uid || actor.lid || socket.id}_${Date.now()}_${stringGen(6)}.${ext}`;
          const safePath = resolveContainedPath(targetDir, fileName);
          if (!safePath) return;
          await fs.writeFile(safePath, buffer);
          publicPic = `/${folderName}/${fileName}`;
        } else {
          publicPic = sanitizeHtmlText(rawInput).slice(0, 250);
        }
      }

      if (actor.islogin === "عضو" && actor.uid) {
        const { db } = getDb();
        await db
          .update(users)
          .set(cmd === "setpic2" ? { pich: publicPic } : { pic: publicPic })
          .where(eq(users.uid, actor.uid));
      }

      if (actor.islogin === "عضو" && actor.uid) {
        await syncMemberIdentity(
          ctx,
          actor.uid,
          cmd === "setpic2" ? { pich: publicPic } : { pic: publicPic },
        );
      } else {
        await ctx.presenceDirectory.patchSession(
          socket.id,
          cmd === "setpic2" ? { pich: publicPic } : { pic: publicPic },
        );
      }

      socket.emit("msg", { cmd: cmd === "setpic2" ? "savepic2" : "savepic", data: { pic: publicPic } });
      socket.emit("msg", { cmd: "savedone", data: { cmd, pic: publicPic } });
    },

    async handleChangePassword(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || actor.islogin !== "عضو" || !actor.uid || !rawData || typeof rawData !== "object") {
        if (actor && actor.islogin !== "عضو") {
          emitNotice(socket, "تغيير كلمة المرور متاح للأعضاء فقط");
        }
        return;
      }

      const d = rawData as Record<string, unknown>;
      const oldPass = String(d.oldpass || d.old || "");
      const newPass = String(d.newpass || d.pass || "");
      if (newPass.length < 3 || newPass.length > 128) {
        emitNotice(socket, "كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل");
        return;
      }

      const { db } = getDb();
      const rows = await db.select().from(users).where(eq(users.uid, actor.uid)).limit(1);
      const userRow = rows[0];
      if (!userRow) return;

      if (oldPass && !(await verifyPasswordAsync(oldPass, userRow.password))) {
        emitNotice(socket, "كلمة المرور الحالية غير صحيحة");
        return;
      }

      const nextHash = hashPasswordSync(newPass);
      // Rotate the session token so existing sessions/JWTs are invalidated.
      const nextToken = crypto.randomBytes(32).toString("hex");
      await db
        .update(users)
        .set({ password: nextHash, token: nextToken })
        .where(eq(users.idreg, userRow.idreg));
      actor.token = nextToken;
      emitNotice(socket, "تم تغيير كلمة المرور بنجاح");
      socket.emit("msg", { cmd: "sagin", data: { msg: "ok", ttoken: nextToken, sessionToken: nextToken } });
    },

    async handleSetLikes(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const powers = ctx.catalogStore.getPowers();
      const powerDef = getPowerDefinitionByName(powers, actor.rank || actor.power);
      if (!powerDef || !Number(powerDef.ulike || 0)) {
        emitNotice(socket, "لا تملك صلاحية تعديل اللايكات");
        return;
      }

      const d = rawData as Record<string, unknown>;
      const targetId = String(d.id || socket.id).trim();
      const val = Number(d.likes ?? d.rep ?? d.val ?? d.count);
      if (!Number.isSafeInteger(val) || val < 0 || val > Number.MAX_SAFE_INTEGER) {
        emitNotice(socket, "قيمة اللايكات غير صالحة");
        return;
      }

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target || target.islogin !== "عضو" || !target.uid) return;
      if (!canActOnRank(powers, actor.rank || actor.power, target.rank || target.power)) {
        emitNotice(socket, "لا يمكنك تعديل عضو أعلى منك في الرتبة");
        return;
      }

      const { db } = getDb();
      await db.update(users).set({ rep: val }).where(eq(users.uid, target.uid));
      await ctx.presenceDirectory.patchSession(targetId, { rep: val });
      await ctx.securityGuard.recordModerationStat({
        state: "تعديل الايكات",
        topic: actor.topic,
        targetTopic: `${target.topic} (${val})`,
        room: target.roomid || "",
        ip: actor.ip,
      });
    },

    async handleSetMsgStatus(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const targetId = String(d.id || socket.id).trim();
      const nextMsg = sanitizeHtmlText(String(d.msg || "").trim()).slice(0, 200);

      if (targetId !== socket.id) {
        const powerDef = ctx.catalogStore.getPowerRole(actor.rank || actor.power);
        if (!powerDef || !Number(powerDef.edituser || 0)) return;
      }

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target) return;
      if (target.islogin === "عضو" && target.uid) {
        const { db } = getDb();
        await db.update(users).set({ msg: nextMsg }).where(eq(users.uid, target.uid));
      }
      await ctx.presenceDirectory.patchSession(targetId, { msg: nextMsg });
    },

    async handleSetSiteBadge(socket: Socket, rawData: unknown): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || actor.islogin !== "عضو" || !actor.uid || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const badgeId = String(d.badgeId || d.site_badge_id || "").trim();
      const targetId = String(d.id || socket.id).trim();

      if (!canManageSiteBadges(ctx.catalogStore.getPowerRole(actor.rank || actor.power))) {
        emitNotice(socket, "لا تملك صلاحية التحكم بشارات العضوية");
        return;
      }

      const target = await ctx.presenceDirectory.getDistributedSession(targetId);
      if (!target || target.islogin !== "عضو" || !target.uid) return;

      const badge = badgeId ? ctx.catalogStore.getSiteBadgeById(badgeId) : null;
      if (badgeId && !badge) {
        emitNotice(socket, "شارة العضوية المحددة غير موجودة");
        return;
      }

      const { db } = getDb();
      await db
        .update(users)
        .set({
          site_badge_id: badge ? badge.id : "",
          site_badge: badge ? JSON.stringify(badge) : "",
        })
        .where(eq(users.uid, target.uid));
      await ctx.presenceDirectory.patchSession(targetId, {
        site_badge_id: badge ? badge.id : "",
        site_badge: badge || "",
      });
      socket.emit("msg", {
        cmd: "savedone",
        data: {
          cmd: "setSiteBadge",
          id: targetId,
          uid: target.uid,
          site_badge_id: badge ? badge.id : "",
          site_badge: badge || "",
        },
      });
      emitNotice(socket, badge ? "تم تحديث شارة العضوية" : "تمت إزالة شارة العضوية");
    },

    async handleCosmeticToggle(
      socket: Socket,
      cmd: "bnr" | "bnr-" | "uthem" | "uthem-" | "ucover" | "ucover-" | "udro3" | "udro3-",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || actor.islogin !== "عضو" || !actor.uid) return;

      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const targetSocketId = String(d.u2 || d.id || d.targetSocketId || socket.id).trim();
      const isTargetSelf = !targetSocketId || targetSocketId === socket.id;

      const powers = ctx.catalogStore.getPowers();
      const actorRole = getPowerDefinitionByName(powers, actor.rank || actor.power);

      let targetSession = isTargetSelf ? actor : await ctx.presenceDirectory.getDistributedSession(targetSocketId);
      if (!targetSession && !isTargetSelf && d.targetUid) {
        const sessions = ctx.presenceDirectory.getAllLocalSessions();
        targetSession = sessions.find((s) => s.uid === d.targetUid) || null;
      }

      if (!targetSession || targetSession.islogin !== "عضو" || !targetSession.uid) {
        if (!isTargetSelf) {
          emitNotice(socket, "العضو المطلوب غير متواجد أو ليس مسجلاً");
        }
        return;
      }

      if (!isTargetSelf) {
        const hasSetPower = Boolean(
          actorRole &&
            (Number(actorRole.setpower || 0) > 0 ||
              Number(actorRole.cp || 0) > 0 ||
              Number(actorRole.owner || 0) > 0),
        );
        if (!hasSetPower) {
          emitNotice(socket, "ليس لديك صلاحية منح أو تعديل مظاهر الأعضاء");
          return;
        }
        if (!canActOnRank(powers, actor.rank || actor.power, targetSession.rank || targetSession.power)) {
          emitNotice(socket, "لا يمكنك التعديل على عضو أعلى منك أو مساوٍ لك في الرتبة");
          return;
        }
      } else {
        if (cmd.startsWith("bnr")) {
          const canBanner = Boolean(
            actorRole &&
              (Number(actorRole.banner || 0) > 0 ||
                Number(actorRole.setpower || 0) > 0 ||
                Number(actorRole.owner || 0) > 0 ||
                Number(actorRole.cp || 0) > 0),
          );
          if (!canBanner) {
            emitNotice(socket, "لا تملك صلاحية استخدام بنر البروفايل");
            return;
          }
        } else if (cmd.startsWith("uthem")) {
          const canTheme = Boolean(
            actorRole &&
              (Number(actorRole.chattem || 0) > 0 ||
                Number(actorRole.custombg || 0) > 0 ||
                Number(actorRole.setpower || 0) > 0 ||
                Number(actorRole.owner || 0) > 0 ||
                Number(actorRole.cp || 0) > 0),
          );
          if (!canTheme) {
            emitNotice(socket, "لا تملك صلاحية استخدام ثيم البروفايل");
            return;
          }
        } else if (cmd.startsWith("ucover")) {
          const canCover = Boolean(
            actorRole &&
              (Number(actorRole.frame || 0) > 0 ||
                Number(actorRole.setpower || 0) > 0 ||
                Number(actorRole.owner || 0) > 0 ||
                Number(actorRole.cp || 0) > 0),
          );
          if (!canCover) {
            emitNotice(socket, "لا تملك صلاحية استخدام إطار الصورة");
            return;
          }
        } else if (cmd.startsWith("udro3")) {
          const canDro3 = Boolean(
            actorRole &&
              (Number(actorRole.gifticon || 0) > 0 ||
                Number(actorRole.banner || 0) > 0 ||
                Number(actorRole.setpower || 0) > 0 ||
                Number(actorRole.owner || 0) > 0 ||
                Number(actorRole.cp || 0) > 0),
          );
          if (!canDro3) {
            emitNotice(socket, "لا تملك صلاحية استخدام دروع وأيقونات الاسم");
            return;
          }
        }
      }

      const rawVal = cmd.endsWith("-")
        ? ""
        : sanitizeHtmlText(String(d.val || d.them || d.cover || d.bnr || d.ico || d.dro3 || "")).trim().slice(0, 250);

      let val = rawVal;
      if (val) {
        if (!val.startsWith("http://") && !val.startsWith("https://") && !val.startsWith("data:")) {
          const clean = val.replace(/^\/+/, "");
          if (cmd.startsWith("bnr")) {
            val = `sico/${clean.replace(/^sico\//, "")}`;
          } else if (cmd.startsWith("uthem")) {
            val = `them/${clean.replace(/^them\//, "")}`;
          } else if (cmd.startsWith("ucover")) {
            val = `cover/${clean.replace(/^cover\//, "")}`;
          } else if (cmd.startsWith("udro3")) {
            val = `dro3/${clean.replace(/^dro3\//, "")}`;
          } else {
            val = clean;
          }
        }
      }

      const { db } = getDb();
      if (cmd.startsWith("bnr")) {
        await db.update(users).set({ ico: val }).where(eq(users.uid, targetSession.uid));
      } else if (cmd.startsWith("uthem")) {
        await db.update(users).set({ them: val }).where(eq(users.uid, targetSession.uid));
      } else if (cmd.startsWith("udro3")) {
        await db.update(users).set({ gift_ico: val }).where(eq(users.uid, targetSession.uid));
      } else {
        await db.update(users).set({ cover: val }).where(eq(users.uid, targetSession.uid));
      }
      const cosmeticPatch: Partial<GatewaySession> = cmd.startsWith("bnr")
        ? { ico: val }
        : cmd.startsWith("uthem")
          ? { them: val }
          : cmd.startsWith("udro3")
            ? { gift_ico: val }
            : { cover: val };
      const targetSocketIds = await ctx.presenceDirectory.getAllSocketIdsByUid(targetSession.uid);
      await Promise.all(targetSocketIds.map((socketId) =>
        ctx.presenceDirectory.patchSession(socketId, cosmeticPatch),
      ));

      if (!isTargetSelf) {
        const itemLabel = cmd.startsWith("bnr")
          ? "البنر"
          : cmd.startsWith("uthem")
            ? "الثيم"
            : cmd.startsWith("udro3")
              ? "درع الاسم"
              : "الإطار";
        const actionMsg = val ? `تم منحك ${itemLabel} جديد` : `تم حذف ${itemLabel} الخاص بك`;
        emitNotice(socket, `تم تحديث ${itemLabel} بنجاح`);
        const targetSock = ctx.io.sockets.sockets.get(targetSession.id);
        if (targetSock) {
          emitNotice(targetSock, actionMsg);
        }
      }
    },

    async handleToggleAlerts(socket: Socket): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const next = !actor.alerts;
      if (actor.islogin === "عضو" && actor.uid) {
        const { db } = getDb();
        await db.update(users).set({ alerts: next }).where(eq(users.uid, actor.uid));
      }
      await ctx.presenceDirectory.patchSession(socket.id, { alerts: next });
    },

    async handleToggleBusy(socket: Socket): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const next = !actor.busy;
      if (actor.islogin === "عضو" && actor.uid) {
        const { db } = getDb();
        await db.update(users).set({ busy: next }).where(eq(users.uid, actor.uid));
      }
      await ctx.presenceDirectory.patchSession(socket.id, { busy: next, stat: next ? 2 : 0 });
    },

    async handleToggleCallSetting(
      socket: Socket,
      cmd: "pm-call-toggle" | "pm-video-call-toggle",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const { db } = getDb();

      if (cmd === "pm-call-toggle") {
        const next = d.enabled !== undefined ? !Boolean(d.enabled) : !actor.nopmcall;
        if (actor.islogin === "عضو" && actor.uid) {
          await db.update(users).set({ nopmcall: next }).where(eq(users.uid, actor.uid));
        }
        await ctx.presenceDirectory.patchSession(socket.id, { nopmcall: next });
      } else {
        const next = d.enabled !== undefined ? !Boolean(d.enabled) : !actor.nopmvideocall;
        if (actor.islogin === "عضو" && actor.uid) {
          await db.update(users).set({ nopmvideocall: next }).where(eq(users.uid, actor.uid));
        }
        await ctx.presenceDirectory.patchSession(socket.id, { nopmvideocall: next });
      }
    },

    async handleFollowAction(
      socket: Socket,
      cmd: "follow_user" | "unfollow_user" | "get_follow_info",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const targetUid = String(d.uid || d.targetUid || "").trim();
      const targetSocketId = String(d.id || "").trim();

      let resolvedUid = targetUid;
      if (!resolvedUid && targetSocketId) {
        const t = await ctx.presenceDirectory.getDistributedSession(targetSocketId);
        resolvedUid = String(t?.uid || "");
      }
      if (!resolvedUid) return;

      const { db } = getDb();
      if (cmd === "follow_user") {
        if (actor.islogin !== "عضو" || !actor.uid || actor.uid === resolvedUid) return;
        await db
          .insert(followers)
          .values({
            follower_id: actor.uid,
            following_id: resolvedUid,
            created_at: Date.now(),
          })
          .onConflictDoNothing();
      } else if (cmd === "unfollow_user") {
        if (actor.islogin !== "عضو" || !actor.uid) return;
        await db
          .delete(followers)
          .where(and(eq(followers.follower_id, actor.uid), eq(followers.following_id, resolvedUid)));
      }

      const [followerCountRows, followingCountRows, isFollowingRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(followers)
          .where(eq(followers.following_id, resolvedUid)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(followers)
          .where(eq(followers.follower_id, resolvedUid)),
        actor.uid
          ? db
              .select({ id: followers.id })
              .from(followers)
              .where(and(eq(followers.follower_id, actor.uid), eq(followers.following_id, resolvedUid)))
              .limit(1)
          : Promise.resolve([]),
      ]);

      const info = {
        uid: resolvedUid,
        followersCount: Number(followerCountRows[0]?.count || 0),
        followingCount: Number(followingCountRows[0]?.count || 0),
        isFollowing: isFollowingRows.length > 0,
      };
      socket.emit("msg", { cmd: cmd === "get_follow_info" ? "follow_info" : "follow_updated", data: info });
    },

    async handleInternalMail(
      socket: Socket,
      cmd: "mail_search_users" | "mail_inbox" | "mail_sent" | "mail_send" | "mail_mark_read",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || actor.islogin !== "عضو" || !actor.uid) {
        if (actor) {
          socket.emit("msg", { cmd: "mail_error", data: { msg: "البريد الداخلي متاح للأعضاء المسجلين فقط" } });
        }
        return;
      }
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const { db } = getDb();

      if (cmd === "mail_search_users") {
        const q = String(d.q || d.query || "").trim().toLowerCase();
        if (!q) {
          socket.emit("msg", { cmd: "mail_search_results", data: [] });
          return;
        }
        const rows = await db
          .select({
            uid: users.uid,
            username: users.username,
            topic: users.topic,
            pic: users.pic,
            documentationc: users.documentationc,
          })
          .from(users)
          .where(sql`LOWER(${users.username}) LIKE ${`%${q}%`} OR LOWER(${users.topic}) LIKE ${`%${q}%`}`)
          .limit(20);
        socket.emit("msg", {
          cmd: "mail_search_results",
          data: rows
            .filter((r) => r.uid !== actor.uid)
            .map((r) => ({
              ...r,
              documents: Number(r.documentationc || 0) === 1,
              documentationc: Number(r.documentationc || 0) === 1,
            })),
        });
        return;
      }

      if (cmd === "mail_inbox") {
        const rows = await db
          .select()
          .from(internal_mail)
          .where(eq(internal_mail.to_uid, actor.uid))
          .orderBy(desc(internal_mail.created_at))
          .limit(50);
        const fromUids = Array.from(new Set(rows.map((r) => r.from_uid).filter(Boolean)));
        const verifiedSet = new Set<string>();
        if (fromUids.length > 0) {
          const userRows = await db
            .select({ uid: users.uid, doc: users.documentationc })
            .from(users)
            .where(inArray(users.uid, fromUids));
          for (const u of userRows) {
            if (Number(u.doc || 0) === 1 && u.uid) verifiedSet.add(u.uid);
          }
        }
        const enriched = rows.map((r) => ({
          ...r,
          from_verified: verifiedSet.has(r.from_uid),
          to_verified: Boolean(actor.documentationc || actor.documents),
          documents: verifiedSet.has(r.from_uid),
          documentationc: verifiedSet.has(r.from_uid),
        }));
        socket.emit("msg", { cmd: "mail_inbox_list", data: enriched });
        return;
      }

      if (cmd === "mail_sent") {
        const rows = await db
          .select()
          .from(internal_mail)
          .where(eq(internal_mail.from_uid, actor.uid))
          .orderBy(desc(internal_mail.created_at))
          .limit(50);
        const toUids = Array.from(new Set(rows.map((r) => r.to_uid).filter(Boolean)));
        const verifiedSet = new Set<string>();
        if (toUids.length > 0) {
          const userRows = await db
            .select({ uid: users.uid, doc: users.documentationc })
            .from(users)
            .where(inArray(users.uid, toUids));
          for (const u of userRows) {
            if (Number(u.doc || 0) === 1 && u.uid) verifiedSet.add(u.uid);
          }
        }
        const enriched = rows.map((r) => ({
          ...r,
          from_verified: Boolean(actor.documentationc || actor.documents),
          to_verified: verifiedSet.has(r.to_uid),
          documents: verifiedSet.has(r.to_uid),
          documentationc: verifiedSet.has(r.to_uid),
        }));
        socket.emit("msg", { cmd: "mail_sent_list", data: enriched });
        return;
      }

      if (cmd === "mail_send") {
        const rate = await ctx.securityGuard.consumeRateSlot(`mail:${socket.id}`, 8, 30_000);
        if (!rate.ok) return;

        const toUid = String(d.to_uid || d.toUid || "").trim();
        const body = sanitizeHtmlText(String(d.body || d.msg || "").trim()).slice(0, 1500);
        if (!toUid || !body || toUid === actor.uid) {
          socket.emit("msg", { cmd: "mail_error", data: { msg: "بيانات الرسالة غير صالحة" } });
          return;
        }

        const recipientRows = await db.select().from(users).where(eq(users.uid, toUid)).limit(1);
        const recipient = recipientRows[0];
        if (!recipient) {
          socket.emit("msg", { cmd: "mail_error", data: { msg: "المستلم غير موجود" } });
          return;
        }

        const [inserted] = await db
          .insert(internal_mail)
          .values({
            from_uid: actor.uid,
            from_username: actor.username,
            from_topic: actor.topic,
            from_pic: actor.pic || "pic.png",
            to_uid: toUid,
            to_username: recipient.username,
            to_topic: recipient.topic,
            to_pic: recipient.pic || "pic.png",
            body,
            is_read: false,
            created_at: Date.now(),
            read_at: 0,
          })
          .returning();

        const enrichedInserted = {
          ...inserted,
          from_verified: Boolean(actor.documentationc || actor.documents),
          to_verified: Number(recipient.documentationc || 0) === 1,
          documents: Boolean(actor.documentationc || actor.documents),
          documentationc: Boolean(actor.documentationc || actor.documents),
        };

        socket.emit("msg", { cmd: "mail_sent_ok", data: enrichedInserted });

        const targetSockets = await ctx.presenceDirectory.getAllSocketIdsByUid(toUid);
        for (const sid of targetSockets) {
          ctx.io.to(sid).emit("msg", { cmd: "mail_new_message", data: enrichedInserted });
        }
        return;
      }

      if (cmd === "mail_mark_read") {
        const mailId = Number(d.id || 0);
        if (!mailId) return;
        const now = Date.now();
        const [updated] = await db
          .update(internal_mail)
          .set({ is_read: true, read_at: now })
          .where(and(eq(internal_mail.id, mailId), eq(internal_mail.to_uid, actor.uid)))
          .returning();
        if (updated) {
          socket.emit("msg", { cmd: "mail_message_read", data: { id: mailId, read_at: now } });
          for (const sid of await ctx.presenceDirectory.getAllSocketIdsByUid(updated.from_uid)) {
            ctx.io.to(sid).emit("msg", { cmd: "mail_read_receipt", data: { id: mailId, read_at: now } });
          }
        }
      }
    },

    async handleStorySocketEvent(
      socket: Socket,
      event: "stor" | "sviw" | "storvi" | "remstorv",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const { db } = getDb();
      const viewerKey = actor.uid || actor.lid || "";

      if (event === "stor") {
        const enriched = await loadInitialStories(viewerKey);
        socket.emit("msg", { cmd: "stori", data: enriched });
        return;
      }

      if (event === "sviw") {
        const sid = String(d.sid || d.id || "").trim();
        const itemId = String(d.itemId || "").trim();
        const itemIdx = d.item !== undefined && d.item !== null ? Number(d.item) : null;
        if (!sid) return;

        const [rawViewers, rawLikers] = await Promise.all([
          db
            .select()
            .from(storieview)
            .where(
              itemIdx !== null && !Number.isNaN(itemIdx)
                ? and(eq(storieview.idsto, sid), eq(storieview.item, itemIdx))
                : eq(storieview.idsto, sid),
            )
            .orderBy(desc(storieview.id))
            .limit(200),
          db
            .select()
            .from(story_likes)
            .where(
              itemId
                ? and(eq(story_likes.story_sid, sid), eq(story_likes.item_id, itemId))
                : eq(story_likes.story_sid, sid),
            )
            .orderBy(desc(story_likes.created_at))
            .limit(100),
        ]);

        // Deduplicate viewers by viewer sid (keep latest)
        const seenViewers = new Set<string>();
        const viewers: typeof rawViewers = [];
        for (const v of rawViewers) {
          const vk = String(v.sid || v.topic || v.id);
          if (seenViewers.has(vk)) continue;
          seenViewers.add(vk);
          viewers.push(v);
        }

        socket.emit("msg", { cmd: "sviw", data: { sid, itemId, viewers, likers: rawLikers } });
        return;
      }

      if (event === "storvi") {
        const storySid = String(d.idsto || d.sid || "").trim();
        const itemIdx = Math.max(0, Number(d.item || 0) || 0);
        const itemId = String(d.itemId || "").trim();
        if (!storySid || !viewerKey) return;

        // Avoid duplicate view row per (viewerKey, storySid, itemIdx)
        const existingView = await db
          .select({ id: storieview.id })
          .from(storieview)
          .where(and(eq(storieview.idsto, storySid), eq(storieview.item, itemIdx), eq(storieview.sid, viewerKey)))
          .limit(1);

        if (!existingView[0] && !actor.stealth) {
          await db.insert(storieview).values({
            sid: viewerKey,
            topic: sanitizeHtmlText(actor.topic).slice(0, 250),
            photo: actor.pic || "pic.png",
            idsto: storySid,
            item: itemIdx,
            time: String(Date.now()),
          });
        }

        const countRes = await db
          .select({ cnt: sql<number>`count(distinct ${storieview.sid})::int` })
          .from(storieview)
          .where(and(eq(storieview.idsto, storySid), eq(storieview.item, itemIdx)));
        const viewsCount = Number(countRes[0]?.cnt || 0);

        ctx.io.emit("msg", {
          cmd: "story_viewed_update",
          data: { sid: storySid, itemIdx, itemId, viewerKey, viewsCount },
        });
        return;
      }

      if (event === "remstorv") {
        const storyId = Number(d.id || 0);
        const sid = String(d.sid || actor.uid || "").trim();
        const itemId = String(d.itemId || "").trim();
        const isAdmin = verAdminPanel(ctx.catalogStore.getPowers(), actor.rank || actor.power);

        const row =
          storyId > 0
            ? (await db.select().from(storie).where(eq(storie.id, storyId)).limit(1))[0]
            : sid
              ? (await db.select().from(storie).where(eq(storie.sid, sid)).limit(1))[0]
              : undefined;

        if (!row) return;
        if (row.sid !== actor.uid && !isAdmin) return;

        const items = safeJsonParse<Array<Record<string, unknown>>>(row.item, []);
        if (itemId && items.length > 1) {
          const remaining = items.filter((it) => String(it.id || "") !== itemId);
          if (remaining.length > 0 && remaining.length < items.length) {
            const lastItem = remaining[remaining.length - 1] || {};
            await db
              .update(storie)
              .set({
                link: String(lastItem.src || (lastItem.caption ? `text:${String(lastItem.caption).slice(0, 60)}` : "")).slice(0, 250),
                item: JSON.stringify(remaining),
              })
              .where(eq(storie.id, row.id));

            // Cleanup slide likes & comments
            const slideCommentRows = await db
              .select({ cid: story_comments.cid })
              .from(story_comments)
              .where(and(eq(story_comments.story_sid, row.sid || ""), eq(story_comments.item_id, itemId)));
            const cids = slideCommentRows.map((c) => c.cid);
            if (cids.length > 0) {
              await db.delete(story_comment_likes).where(inArray(story_comment_likes.comment_cid, cids));
            }
            await Promise.all([
              db.delete(story_likes).where(and(eq(story_likes.story_sid, row.sid || ""), eq(story_likes.item_id, itemId))),
              db.delete(story_comments).where(and(eq(story_comments.story_sid, row.sid || ""), eq(story_comments.item_id, itemId))),
            ]);

            ctx.io.emit("msg", { cmd: "rremstori", data: { id: row.id, sid: row.sid, itemId } });
            return;
          }
        }

        // Full deletion of user story row & associated social records
        const allCommentRows = await db
          .select({ cid: story_comments.cid })
          .from(story_comments)
          .where(eq(story_comments.story_sid, row.sid || ""));
        const allCids = allCommentRows.map((c) => c.cid);
        if (allCids.length > 0) {
          await db.delete(story_comment_likes).where(inArray(story_comment_likes.comment_cid, allCids));
        }
        await Promise.all([
          db.delete(storie).where(eq(storie.id, row.id)),
          db.delete(story_likes).where(eq(story_likes.story_sid, row.sid || "")),
          db.delete(story_comments).where(eq(story_comments.story_sid, row.sid || "")),
          db.delete(storieview).where(eq(storieview.idsto, row.sid || "")),
        ]);
        ctx.io.emit("msg", { cmd: "rremstori", data: { id: row.id, sid: row.sid } });
      }
    },

    async handleStorySocialAction(
      socket: Socket,
      cmd:
        | "story_like_toggle"
        | "story_likes_get"
        | "story_comments_get"
        | "story_comment_add"
        | "story_comment_like"
        | "story_comment_delete",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor || !rawData || typeof rawData !== "object") return;
      const d = rawData as Record<string, unknown>;
      const storySid = String(d.storySid || d.sid || "").trim();
      const itemId = String(d.itemId || "").trim();
      if (!storySid || !itemId) return;

      const { db } = getDb();
      const actorUid = actor.uid || actor.lid || "";
      const isMember = actor.islogin === "عضو" && Boolean(actor.uid);

      if (cmd === "story_likes_get") {
        const rows = await db
          .select({
            user_uid: story_likes.user_uid,
            topic: story_likes.topic,
            photo: story_likes.photo,
            created_at: story_likes.created_at,
          })
          .from(story_likes)
          .where(and(eq(story_likes.story_sid, storySid), eq(story_likes.item_id, itemId)))
          .orderBy(desc(story_likes.created_at))
          .limit(100);
        socket.emit("msg", { cmd: "story_likes_list", data: { storySid, itemId, likers: rows } });
        return;
      }

      if (cmd === "story_like_toggle") {
        if (!isMember) {
          emitNotice(socket, "الإعجاب بالقصص متاح للأعضاء المسجلين فقط");
          return;
        }
        const rate = await ctx.securityGuard.consumeRateSlot(`story:like:${actor.uid}`, 25, 30_000);
        if (!rate.ok) return;

        const existing = await db
          .select({ id: story_likes.id })
          .from(story_likes)
          .where(
            and(
              eq(story_likes.story_sid, storySid),
              eq(story_likes.item_id, itemId),
              eq(story_likes.user_uid, actor.uid),
            ),
          )
          .limit(1);

        let liked = false;
        if (existing[0]) {
          await db.delete(story_likes).where(eq(story_likes.id, existing[0].id));
          liked = false;
        } else {
          await db.insert(story_likes).values({
            story_sid: storySid,
            item_id: itemId,
            user_uid: actor.uid,
            topic: sanitizeHtmlText(actor.topic).slice(0, 250),
            photo: actor.pic || "pic.png",
            created_at: Date.now(),
          });
          liked = true;
        }

        const countRes = await db
          .select({ cnt: sql<number>`count(*)::int` })
          .from(story_likes)
          .where(and(eq(story_likes.story_sid, storySid), eq(story_likes.item_id, itemId)));
        const likesCount = Number(countRes[0]?.cnt || 0);

        ctx.io.emit("msg", {
          cmd: "story_like_updated",
          data: {
            storySid,
            itemId,
            userUid: actor.uid,
            userTopic: sanitizeHtmlText(actor.topic).slice(0, 250),
            userPic: actor.pic || "pic.png",
            liked,
            likesCount,
          },
        });
        return;
      }

      if (cmd === "story_comments_get") {
        const sort = String(d.sort || "newest").trim().toLowerCase();
        const rows = await db
          .select()
          .from(story_comments)
          .where(and(eq(story_comments.story_sid, storySid), eq(story_comments.item_id, itemId)))
          .orderBy(
            sort === "top"
              ? desc(story_comments.likes_count)
              : sort === "oldest"
                ? asc(story_comments.created_at)
                : desc(story_comments.created_at),
          )
          .limit(250);

        const cids = rows.map((r) => r.cid);
        const myLikedRows =
          actorUid && cids.length > 0
            ? await db
                .select({ comment_cid: story_comment_likes.comment_cid })
                .from(story_comment_likes)
                .where(
                  and(
                    inArray(story_comment_likes.comment_cid, cids),
                    eq(story_comment_likes.user_uid, actorUid),
                  ),
                )
            : [];
        const likedSet = new Set(myLikedRows.map((l) => l.comment_cid));

        const comments = rows.map((r) => ({
          id: r.id,
          cid: r.cid,
          story_sid: r.story_sid,
          item_id: r.item_id,
          parent_cid: String(r.parent_cid || ""),
          reply_to_topic: String(r.reply_to_topic || ""),
          author_uid: r.author_uid,
          author_topic: String(r.author_topic || ""),
          author_pic: String(r.author_pic || "pic.png"),
          author_ucol: String(r.author_ucol || ""),
          author_verified: Boolean(r.author_verified),
          body: r.body,
          likes_count: Number(r.likes_count || 0),
          liked_by_me: likedSet.has(r.cid),
          created_at: Number(r.created_at || 0),
        }));

        socket.emit("msg", { cmd: "story_comments_list", data: { storySid, itemId, comments } });
        return;
      }

      if (cmd === "story_comment_add") {
        if (!isMember) {
          emitNotice(socket, "التعليق على القصص متاح للأعضاء المسجلين فقط");
          return;
        }
        if (actor.ismuted || actor.muted) {
          emitNotice(socket, "أنت مكتوم ولا يمكنك التعليق حالياً");
          return;
        }
        const rate = await ctx.securityGuard.consumeRateSlot(`story:comment:${actor.uid}`, 12, 60_000);
        if (!rate.ok) {
          emitNotice(socket, "يرجى التمهل قبل إرسال تعليق آخر");
          return;
        }

        const rawBody = sanitizeHtmlText(String(d.body || d.text || "").trim()).slice(0, 500);
        const body = ctx.catalogStore.replaceShortcuts(rawBody);
        if (!body) return;
        if (ctx.catalogStore.scanProhibitedWords(body)) {
          emitNotice(socket, "يحتوي التعليق على كلمات غير مسموح بها");
          return;
        }

        let parentCid = sanitizeHtmlText(String(d.parentCid || "").trim()).slice(0, 64);
        let replyToTopic = sanitizeHtmlText(String(d.replyToTopic || "").trim()).slice(0, 150);

        // Keep the direct parent so reply-to-reply threads nest correctly,
        // but verify it belongs to this story item.
        if (parentCid) {
          const parentRow = (
            await db
              .select({ cid: story_comments.cid, author_topic: story_comments.author_topic })
              .from(story_comments)
              .where(
                and(
                  eq(story_comments.story_sid, storySid),
                  eq(story_comments.item_id, itemId),
                  eq(story_comments.cid, parentCid),
                ),
              )
              .limit(1)
          )[0];
          if (!parentRow) {
            parentCid = "";
            replyToTopic = "";
          } else if (!replyToTopic) {
            replyToTopic = String(parentRow.author_topic || "");
          }
        }

        const cid = `sc_${stringGen(12)}`;
        const createdAt = Date.now();
        const isVerified = Boolean(actor.documentationc || actor.documents);

        const [inserted] = await db
          .insert(story_comments)
          .values({
            cid,
            story_sid: storySid,
            item_id: itemId,
            parent_cid: parentCid,
            reply_to_topic: replyToTopic,
            author_uid: actor.uid,
            author_topic: sanitizeHtmlText(actor.topic).slice(0, 250),
            author_pic: actor.pic || "pic.png",
            author_ucol: cleanColor(actor.ucol, "#000000"),
            author_verified: isVerified,
            body,
            likes_count: 0,
            created_at: createdAt,
          })
          .returning();

        const countRes = await db
          .select({ cnt: sql<number>`count(*)::int` })
          .from(story_comments)
          .where(and(eq(story_comments.story_sid, storySid), eq(story_comments.item_id, itemId)));
        const commentsCount = Number(countRes[0]?.cnt || 0);

        const commentPayload = {
          id: inserted?.id,
          cid,
          story_sid: storySid,
          item_id: itemId,
          parent_cid: parentCid,
          reply_to_topic: replyToTopic,
          author_uid: actor.uid,
          author_topic: sanitizeHtmlText(actor.topic).slice(0, 250),
          author_pic: actor.pic || "pic.png",
          author_ucol: cleanColor(actor.ucol, "#000000"),
          author_verified: isVerified,
          body,
          likes_count: 0,
          liked_by_me: false,
          created_at: createdAt,
        };

        ctx.io.emit("msg", {
          cmd: "story_comment_added",
          data: { storySid, itemId, comment: commentPayload, commentsCount },
        });
        return;
      }

      if (cmd === "story_comment_like") {
        if (!isMember) {
          emitNotice(socket, "الإعجاب بالتعليقات متاح للأعضاء المسجلين فقط");
          return;
        }
        const commentCid = String(d.commentCid || d.cid || "").trim();
        if (!commentCid) return;
        const rate = await ctx.securityGuard.consumeRateSlot(`story:clike:${actor.uid}`, 30, 30_000);
        if (!rate.ok) return;

        const targetComment = (
          await db
            .select({ cid: story_comments.cid })
            .from(story_comments)
            .where(eq(story_comments.cid, commentCid))
            .limit(1)
        )[0];
        if (!targetComment) return;

        const existingLike = (
          await db
            .select({ id: story_comment_likes.id })
            .from(story_comment_likes)
            .where(
              and(
                eq(story_comment_likes.comment_cid, commentCid),
                eq(story_comment_likes.user_uid, actor.uid),
              ),
            )
            .limit(1)
        )[0];

        let liked = false;
        if (existingLike) {
          await db.delete(story_comment_likes).where(eq(story_comment_likes.id, existingLike.id));
          liked = false;
        } else {
          await db.insert(story_comment_likes).values({
            comment_cid: commentCid,
            user_uid: actor.uid,
            created_at: Date.now(),
          });
          liked = true;
        }

        const likeCountRes = await db
          .select({ cnt: sql<number>`count(*)::int` })
          .from(story_comment_likes)
          .where(eq(story_comment_likes.comment_cid, commentCid));
        const likesCount = Number(likeCountRes[0]?.cnt || 0);

        await db
          .update(story_comments)
          .set({ likes_count: likesCount })
          .where(eq(story_comments.cid, commentCid));

        ctx.io.emit("msg", {
          cmd: "story_comment_like_updated",
          data: { storySid, itemId, commentCid, userUid: actor.uid, liked, likesCount },
        });
        return;
      }

      if (cmd === "story_comment_delete") {
        if (!actor.uid) return;
        const commentCid = String(d.commentCid || d.cid || "").trim();
        if (!commentCid) return;

        const targetComment = (
          await db
            .select()
            .from(story_comments)
            .where(
              and(
                eq(story_comments.story_sid, storySid),
                eq(story_comments.item_id, itemId),
                eq(story_comments.cid, commentCid),
              ),
            )
            .limit(1)
        )[0];
        if (!targetComment) return;

        const isAdmin = verAdminPanel(ctx.catalogStore.getPowers(), actor.rank || actor.power);
        if (
          targetComment.author_uid !== actor.uid &&
          targetComment.story_sid !== actor.uid &&
          !isAdmin
        ) {
          emitNotice(socket, "لا تملك صلاحية حذف هذا التعليق");
          return;
        }

        // Delete the whole descendant subtree so deeper reply chains are not orphaned.
        const treeRows = await db
          .select({ cid: story_comments.cid, parent_cid: story_comments.parent_cid })
          .from(story_comments)
          .where(and(eq(story_comments.story_sid, storySid), eq(story_comments.item_id, itemId)));
        const deletedCids = new Set<string>([commentCid]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const row of treeRows) {
            if (row.parent_cid && deletedCids.has(row.parent_cid) && !deletedCids.has(row.cid)) {
              deletedCids.add(row.cid);
              grew = true;
            }
          }
        }
        const deleteList = [...deletedCids];

        await db
          .delete(story_comment_likes)
          .where(inArray(story_comment_likes.comment_cid, deleteList));
        await db.delete(story_comments).where(inArray(story_comments.cid, deleteList));

        const countRes = await db
          .select({ cnt: sql<number>`count(*)::int` })
          .from(story_comments)
          .where(and(eq(story_comments.story_sid, storySid), eq(story_comments.item_id, itemId)));
        const commentsCount = Number(countRes[0]?.cnt || 0);

        ctx.io.emit("msg", {
          cmd: "story_comment_deleted",
          data: { storySid, itemId, commentCid, deletedCids: deleteList, commentsCount },
        });
      }
    },

    async handleProfileVisitEvent(
      socket: Socket,
      event:
        | "record_profile_visit"
        | "get_profile_visitors"
        | "get_profile_visitors_count"
        | "mark_visits_seen",
      rawData: unknown,
    ): Promise<void> {
      const actor = ctx.presenceDirectory.getLocalSession(socket.id);
      if (!actor) return;
      const d = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};
      const { db } = getDb();

      if (event === "record_profile_visit") {
        const targetUid = String(d.ownerUid || d.uid || "").trim();
        if (!targetUid || targetUid === actor.uid || actor.stealth) return;
        await db.insert(profile_visits).values({
          owner_id: targetUid,
          visitor_id: actor.uid || actor.lid,
          visitor_name: sanitizeHtmlText(actor.topic).slice(0, 250),
          visitor_pic: actor.pic || "pic.png",
          seen: 0,
          time: Date.now(),
          visitor_type: actor.islogin,
        });
        for (const sid of await ctx.presenceDirectory.getAllSocketIdsByUid(targetUid)) {
          ctx.io.to(sid).emit("msg", {
            cmd: "profile_visit_new",
            data: { visitor_name: sanitizeHtmlText(actor.topic), visitor_pic: actor.pic || "pic.png" },
          });
        }
        return;
      }

      const ownerUid = actor.uid;
      if (!ownerUid) return;

      if (event === "get_profile_visitors") {
        const rows = await db
          .select()
          .from(profile_visits)
          .where(eq(profile_visits.owner_id, ownerUid))
          .orderBy(desc(profile_visits.time))
          .limit(50);
        socket.emit("msg", { cmd: "profile_visitors_list", data: rows });
      } else if (event === "get_profile_visitors_count") {
        const rows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(profile_visits)
          .where(and(eq(profile_visits.owner_id, ownerUid), eq(profile_visits.seen, 0)));
        socket.emit("msg", { cmd: "profile_visitors_count", data: { count: Number(rows[0]?.count || 0) } });
      } else if (event === "mark_visits_seen") {
        await db
          .update(profile_visits)
          .set({ seen: 1 })
          .where(eq(profile_visits.owner_id, ownerUid));
        socket.emit("msg", { cmd: "profile_visits_seen_ok", data: { ok: true } });
      }
    },
  };
}
