import crypto from "node:crypto";
import { getDb, bots, users, rooms, eq, sql } from "@newchat/db";
import { MIC_SLOT_COUNT, getSystemRoomOwner } from "@newchat/shared";
import { invalidateCatalogScopes } from "./runtime.js";

function randomIp(): string {
  const chunk = (min: number, max: number) =>
    String(Math.floor(Math.random() * (max - min + 1)) + min);
  return [chunk(11, 223), chunk(0, 255), chunk(0, 255), chunk(1, 254)].join(".");
}

function createLockedSlotsJson(count = MIC_SLOT_COUNT): string {
  const slots: Record<string, boolean> = {};
  for (let i = 1; i <= count; i += 1) {
    slots[String(i)] = true;
  }
  return JSON.stringify(slots);
}

export async function runTalkingBotsSeed(options: {
  count?: number | string;
  source?: string;
  prefix?: string;
  room?: string;
  rooms?: string;
  country?: string;
  status?: number | string;
  message?: string;
  power?: string;
}) {
  const count = Math.max(1, Math.min(5000, Number.parseInt(String(options.count || "100"), 10) || 100));
  const source = String(options.source || "mohammed").trim();
  const prefix = String(options.prefix || `${source} bot`).trim().slice(0, 60);
  const singleRoom = String(options.room || "D8D8A9A9C00").trim();
  const roomsCsv = String(options.rooms || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const roomList = roomsCsv.length ? roomsCsv : [singleRoom];
  const country = String(options.country || "kw").trim().slice(0, 10);
  const power = String(options.power || "").trim().slice(0, 80);
  const status = Math.max(0, Math.min(3, Number.parseInt(String(options.status ?? "0"), 10) || 0));
  const message = String(options.message || "مرحبا بكم").trim().slice(0, 180);

  const { db } = getDb();

  const sourceUserRows = await db
    .select({ pic: users.pic })
    .from(users)
    .where(sql`${users.username} = ${source} OR ${users.topic} = ${source}`)
    .limit(1);
  const picPath = String(sourceUserRows[0]?.pic || "pic.png");

  const existingTopics = await db
    .select({ topic: bots.topic })
    .from(bots)
    .where(sql`${bots.topic} LIKE ${prefix + "%"}`);

  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffixRegex = new RegExp(`^${escaped}\\s+(\\d+)$`);
  const used = new Set<number>();
  for (const row of existingTopics) {
    const match = suffixRegex.exec(String(row.topic || "").trim());
    if (match?.[1]) {
      used.add(Number.parseInt(match[1], 10));
    }
  }

  let cursor = 1;
  const rows: Array<typeof bots.$inferInsert> = [];
  for (let i = 1; i <= count; i += 1) {
    while (used.has(cursor)) {
      cursor += 1;
    }
    used.add(cursor);
    rows.push({
      msg: message,
      pic: picPath,
      power,
      country,
      room: roomList[(i - 1) % roomList.length] || singleRoom,
      ip: randomIp(),
      id: `bot-${crypto.randomBytes(9).toString("hex")}`,
      stat: status,
      topic: `${prefix} ${cursor}`,
    });
  }

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(bots).values(rows.slice(i, i + chunkSize));
  }

  await invalidateCatalogScopes(["bots"]);

  return {
    count,
    source,
    sourcePic: picPath,
    prefix,
    rooms: roomList,
    country,
    status,
    power,
    inserted: rows.length,
  };
}

export async function ensureBotLoadTestRooms(options: {
  roomCount?: number;
  roomPrefix?: string;
}) {
  const roomCount = Math.max(1, Math.min(50, Number(options.roomCount || 10)));
  const roomPrefix = String(options.roomPrefix || "اختبار الوهمي")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const { db } = getDb();
  const systemOwner = getSystemRoomOwner();
  const stageState = createLockedSlotsJson(MIC_SLOT_COUNT);
  const resultRooms: Array<typeof rooms.$inferSelect> = [];
  const createdRooms: Array<typeof rooms.$inferSelect> = [];

  for (let i = 1; i <= roomCount; i += 1) {
    const topic = `${roomPrefix} ${i}`;
    const existing = await db.select().from(rooms).where(eq(rooms.topic, topic)).limit(1);
    if (existing[0]) {
      resultRooms.push(existing[0]);
      continue;
    }
    const roomId = `bt${crypto.randomBytes(4).toString("hex")}`;
    const [created] = await db
      .insert(rooms)
      .values({
        id: roomId,
        about: "غرفة اختبار ضغط للبوتات الوهمية",
        user: "chatmaster",
        pass: "",
        owner: systemOwner.owner,
        topic,
        pic: "room.png",
        welcome: `غرفة اختبار ضغط رقم ${i}`,
        deleted: false,
        needpass: false,
        color: "#000000",
        max: 2000,
        mic: MIC_SLOT_COUNT,
        stage_count: MIC_SLOT_COUNT,
        stage_state: stageState,
        message_mode: "real",
        rmli: 0,
        broadcast: false,
        room_owner_meta: systemOwner.meta,
      })
      .returning();

    if (created) {
      resultRooms.push(created);
      createdRooms.push(created);
    }
  }

  if (createdRooms.length) {
    await invalidateCatalogScopes(["rooms"]);
  }

  return { rooms: resultRooms, createdRooms };
}
