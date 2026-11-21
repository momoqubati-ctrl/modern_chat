import { z } from "zod";

export const guestLoginSchema = z.object({
  username: z.string().trim().min(1, "الرجاء إدخال الاسم").max(60, "الاسم طويل جداً"),
  refr: z.string().trim().max(255).optional().default("web"),
  pic: z.string().trim().max(255).optional().default("pic.png"),
  fp: z.string().trim().max(255).optional().default(""),
  id: z.string().trim().max(255).optional(),
  roomid: z.string().trim().max(128).optional().nullable(),
});

export const memberLoginSchema = z.object({
  username: z.string().trim().min(1, "الرجاء إدخال اسم المستخدم").max(50),
  password: z.string().min(1, "الرجاء إدخال كلمة المرور").max(255),
  refr: z.string().trim().max(255).optional().default("web"),
  fp: z.string().trim().max(255).optional().default(""),
  roomid: z.string().trim().max(128).optional().nullable(),
});

export const registerSchema = z.object({
  username: z.string().trim().min(2, "اسم المستخدم قصير جداً").max(50),
  password: z.string().min(3, "كلمة المرور قصيرة جداً").max(255),
  topic: z.string().trim().min(1).max(60).optional(),
  refr: z.string().trim().max(255).optional().default("web"),
  fp: z.string().trim().max(255).optional().default(""),
});

export const roomJoinSchema = z.object({
  id: z.string().trim().min(1).max(128),
  pwd: z.string().max(255).optional().default(""),
  pass: z.string().max(255).optional().default(""),
  mr: z.string().max(128).optional().default(""),
});

export const chatMessageSchema = z.object({
  msg: z.string().trim().min(1).max(4000),
  roomid: z.string().trim().max(128).optional(),
  reply: z.record(z.unknown()).optional().nullable(),
  replyTo: z.record(z.unknown()).optional().nullable(),
  _cid: z.string().max(64).optional(),
  _cts: z.number().optional(),
});

export const giftSendSchema = z.object({
  id: z.string().trim().min(1).max(255),
  file: z.string().trim().min(1).max(255),
  qty: z.number().int().min(1).max(100).optional().default(1),
  roomId: z.string().trim().max(128).optional(),
  note: z.string().trim().max(500).optional().default(""),
  idempotencyKey: z.string().trim().max(128).optional(),
});

export const feedGiftSchema = z.object({
  postId: z.string().trim().min(1).max(64),
  giftFile: z.string().trim().min(1).max(255),
  quantity: z.number().int().min(1).max(100).default(1),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9._:-]{16,128}$/),
});

export const giftFeeSlabSchema = z.object({
  slabMin: z.number().int().min(1).max(2_147_483_647),
  slabMax: z.number().int().min(1).max(2_147_483_647).nullable(),
  platformFeeBps: z.number().int().min(0).max(5000),
}).refine(
  (value) => value.slabMax === null || value.slabMax >= value.slabMin,
  { message: "نهاية الشريحة يجب أن تكون أكبر من أو تساوي بدايتها", path: ["slabMax"] },
);

export const giftSettingsSchema = z.object({
  maxQty: z.number().int().min(1).max(100),
  rateLimitMax: z.number().int().min(1).max(100),
  rateLimitWindowMs: z.number().int().min(1000).max(60_000),
  giftEnabled: z.boolean(),
});

export const ludoManageSchema = z.object({
  op: z.enum(["sit", "stand", "start", "reset", "stop", "close", "add_bot", "remove_bot"]).optional(),
  action: z.enum(["sit", "stand", "start", "reset", "stop", "close", "add_bot", "remove_bot"]).optional(),
  seat: z.number().int().min(0).max(3).optional(),
});

export const ludoMoveSchema = z.object({
  tokenId: z.string().trim().min(3).max(24),
});

export const ludoArenaCreateSchema = z.object({
  title: z.string().trim().max(60).optional(),
  roomCode: z.string().trim().regex(/^[A-Za-z0-9_-]{3,24}$/).optional(),
});

export const ludoArenaJoinSchema = z.object({
  roomCode: z.string().trim().min(3).max(24),
});
