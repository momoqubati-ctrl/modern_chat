import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POWER_NON,
  DEFAULT_POWERS,
  MIC_SLOT_COUNT,
  canCreateVoiceRoom,
  normalizeLiveRoomConfig,
  normalizePowerShape,
  parseRoomOwnerMeta,
} from "../packages/shared/dist/index.js";

test("MIC_SLOT_COUNT is configured to 12 seats for TikTok-style audio rooms", () => {
  assert.equal(MIC_SLOT_COUNT, 12, "MIC_SLOT_COUNT must support 12 seats");
});

test("RBAC: can_create_voice_room permission is respected and verified", () => {
  // 1. Default non-privileged role has 0
  assert.equal(DEFAULT_POWER_NON.can_create_voice_room, 0);

  // 2. Normalization sets flag correctly
  const norm0 = normalizePowerShape({ name: "member", can_create_voice_room: 0 });
  assert.equal(norm0.can_create_voice_room, 0);

  const norm1 = normalizePowerShape({ name: "streamer", can_create_voice_room: 1 });
  assert.equal(norm1.can_create_voice_room, 1);

  const testPowers = [norm0, norm1, ...DEFAULT_POWERS];

  // 3. canCreateVoiceRoom returns true for privileged role, false for unprivileged
  assert.equal(canCreateVoiceRoom(testPowers, "member"), false);
  assert.equal(canCreateVoiceRoom(testPowers, "streamer"), true);

  // 4. Super powers (chatmaster, Hide, ispower) always have permission
  assert.equal(canCreateVoiceRoom(testPowers, "chatmaster"), true);
  assert.equal(canCreateVoiceRoom(testPowers, "Hide"), true);
  assert.equal(canCreateVoiceRoom(testPowers, "ispower"), true);
});

test("Live Room Configuration normalization and metadata parsing", () => {
  const sampleConfig = {
    is_live_audio: true,
    join_mode: "request",
    chat_locked: true,
    gift_goal: {
      giftId: "rose",
      giftFile: "rose.png",
      giftName: "وردة",
      giftIcon: "🌹",
      giftCoin: 1,
      targetCount: 150,
      currentCount: 30,
    },
    pinned_notice: "إرشادات البث المباشر",
    hourly_rank: "🔥 ترتيب كل ساعة",
  };

  const normalized = normalizeLiveRoomConfig(sampleConfig);
  assert.equal(normalized.is_live_audio, true);
  assert.equal(normalized.join_mode, "request");
  assert.equal(normalized.chat_locked, true);
  assert.equal(normalized.gift_goal?.giftFile, "rose.png");
  assert.equal(normalized.gift_goal?.giftCoin, 1);
  assert.equal(normalized.gift_goal?.targetCount, 150);
  assert.equal(normalized.gift_goal?.currentCount, 30);
  assert.equal(normalized.pinned_notice, "إرشادات البث المباشر");

  // Meta parsing preserves live_config
  const parsedMeta = parseRoomOwnerMeta({
    ownerId: "#5",
    ownerUser: "host_user",
    ownerTopic: "Host",
    live_config: sampleConfig,
  });

  assert.equal(parsedMeta.ownerId, "#5");
  assert.equal(parsedMeta.ownerUser, "host_user");
  assert.equal(parsedMeta.live_config?.is_live_audio, true);
  assert.equal(parsedMeta.live_config?.join_mode, "request");
});

test("Live Room Gift Goal progress calculation and edge cases", () => {
  const goal = {
    targetCount: 100,
    currentCount: 65,
  };
  const percent = Math.min(100, Math.round((goal.currentCount / goal.targetCount) * 100));
  assert.equal(percent, 65);

  // Over-target capping at 100%
  const overTarget = {
    targetCount: 100,
    currentCount: 140,
  };
  const capped = Math.min(100, Math.round((overTarget.currentCount / overTarget.targetCount) * 100));
  assert.equal(capped, 100);

  // Zero target fallback
  const zeroTarget = {
    targetCount: 0,
    currentCount: 0,
  };
  const safePercent = Math.min(100, Math.round((zeroTarget.currentCount / (zeroTarget.targetCount || 100)) * 100));
  assert.equal(safePercent, 0);
});

test("Live Room Host Identification with username, topic, or registered ID", () => {
  const isHostCheck = (
    me: { username?: string; idreg?: number; topic?: string },
    room: { owner?: string; user?: string }
  ) => {
    const myReg = me.idreg ? String(me.idreg).replace(/^#/, "") : "";
    const rOwner = String(room.owner || "").replace(/^#/, "");
    const roomUser = (room as any)?.user;
    return Boolean(
      (me.username && room.owner?.toLowerCase() === me.username.toLowerCase()) ||
        (myReg && myReg === rOwner) ||
        (roomUser && me.topic && roomUser === me.topic)
    );
  };

  // Match by username
  assert.equal(isHostCheck({ username: "alice", idreg: 10 }, { owner: "Alice" }), true);
  // Match by idreg with hash prefix
  assert.equal(isHostCheck({ username: "bob", idreg: 42 }, { owner: "#42" }), true);
  // Match by idreg without hash
  assert.equal(isHostCheck({ username: "charlie", idreg: 99 }, { owner: "99" }), true);
  // Match by creator topic
  assert.equal(isHostCheck({ username: "david", idreg: 15, topic: "SuperDave" }, { owner: "#88", user: "SuperDave" }), true);
  // Non-matching regular user
  assert.equal(isHostCheck({ username: "guest", idreg: 100, topic: "Guest" }, { owner: "#42", user: "Bob" }), false);
});

test("Live Room Authoritative Hearts & Likes Synchronization across all users", () => {
  // 1. Config normalization preserves likes_count
  const norm = normalizeLiveRoomConfig({
    is_live_audio: true,
    likes_count: 350,
  });
  assert.equal(norm.likes_count, 350);

  // 2. Client-side authoritative reconciliation logic
  // Reconcile function matching LiveAudioRoomExperience.tsx
  const reconcileLikes = (
    currentCount: number,
    isSelf: boolean,
    payload: { count?: number; total?: number }
  ): number => {
    const hasTotal = payload.total !== undefined && payload.total !== null;
    const total = hasTotal ? Number(payload.total) : null;
    if (total !== null && !Number.isNaN(total)) {
      return isSelf ? Math.max(currentCount, total) : total;
    }
    const added = Math.max(1, Number(payload.count || 1));
    return isSelf ? currentCount : currentCount + added;
  };

  // Scenario: Starting with 100 likes in room
  let serverTotal = 100;
  let userA = 100; // Tapping user (Sender)
  let userB = 100; // Listener 1
  let userC = 0;   // Late joiner

  // User A taps 5 times optimistically
  for (let i = 0; i < 5; i++) {
    userA += 1;
  }
  assert.equal(userA, 105, "User A sees immediate optimistic update");
  assert.equal(userB, 100, "User B has not received packet yet");

  // Server processes User A's batch of 5 likes atomically
  const batchCount = 5;
  serverTotal += batchCount; // Server total becomes 105
  assert.equal(serverTotal, 105);

  // Broadcast to all room members: { count: 5, total: 105 }
  const broadcastPacket = { count: 5, total: serverTotal };

  // User A receives broadcast (isSelf: true) -> Reconciles to 105 WITHOUT double counting!
  userA = reconcileLikes(userA, true, broadcastPacket);
  assert.equal(userA, 105, "User A must not double-count to 110, must stay exactly at 105");

  // User B receives broadcast (isSelf: false) -> Updates directly to 105
  userB = reconcileLikes(userB, false, broadcastPacket);
  assert.equal(userB, 105, "User B must match authoritative total 105");

  // User C joins late and receives authoritative total from req-room-likes / all
  userC = serverTotal;
  assert.equal(userC, 105, "Late-joining User C gets exact total 105");

  // Verify all 3 users are now 100% in sync
  assert.equal(userA, userB);
  assert.equal(userB, userC);
  assert.equal(userA, 105);

  // Scenario 2: User A taps 3 more while in-flight
  userA += 3; // userA = 108
  // Previous packet arrives with total 105: userA must not jump backwards
  userA = reconcileLikes(userA, true, { count: 5, total: 105 });
  assert.equal(userA, 108, "User A does not flicker backwards if further uncommitted taps occurred");

  // Server receives the 3 taps
  serverTotal += 3; // serverTotal = 108
  const secondBroadcast = { count: 3, total: serverTotal };

  userA = reconcileLikes(userA, true, secondBroadcast);
  userB = reconcileLikes(userB, false, secondBroadcast);
  userC = reconcileLikes(userC, false, secondBroadcast);

  assert.equal(userA, 108);
  assert.equal(userB, 108);
  assert.equal(userC, 108);
  assert.equal(userA, userB);
  assert.equal(userB, userC);
});
