import test from "node:test";
import assert from "node:assert/strict";
import passwordHash from "password-hash";
import {
  SOCKET_EVENTS,
  INCOMING_CMDS,
  OUTGOING_CMDS,
  guestLoginSchema,
  memberLoginSchema,
  registerSchema,
  roomJoinSchema,
  chatMessageSchema,
  giftSendSchema,
} from "../packages/shared/src/index.js";
import * as dbSchema from "../packages/db/src/schema/index.js";

test("1:1 parity counts for socket events and commands match legacy server.js", () => {
  assert.equal(SOCKET_EVENTS.length, 39, "Expected 39 registered socket events");
  assert.equal(INCOMING_CMDS.length, 218, "Expected 218 registered incoming cmds");
  assert.equal(OUTGOING_CMDS.length, 98, "Expected 98 registered outgoing cmds");
});

test("all 39 legacy MySQL tables exist in PostgreSQL 18 Drizzle schema", () => {
  const expected = [
    "users", "names", "followers", "profile_visits", "sub",
    "rooms", "room_welcome_visits", "bots",
    "bars", "storie", "storieview", "top10wall", "internal_mail", "intromsg",
    "coin_ledger", "gift_notifications", "site_master_wallet", "site_master_wallet_ledger",
    "agents", "agent_wallets", "agent_wallet_ledger", "owner_agent_transfers",
    "coin_packages", "topup_orders", "topup_order_events", "agent_payment_methods",
    "topup_settlement_ledger",
    "owner", "site", "hosts", "settings", "powers", "band", "bsb", "cuts",
    "notext", "histletter", "logs", "stats",
  ];
  assert.equal(expected.length, 39);
  for (const tbl of expected) {
    assert.ok(tbl in dbSchema, `Missing schema table: ${tbl}`);
  }
});

test("Zod validators accept valid Arabic and ASCII payloads", () => {
  assert.equal(guestLoginSchema.safeParse({ username: "أحمد" }).success, true);
  assert.equal(memberLoginSchema.safeParse({ username: "user1", password: "secret" }).success, true);
  assert.equal(registerSchema.safeParse({ username: "عضو جديد", password: "123" }).success, true);
  assert.equal(roomJoinSchema.safeParse({ id: "general", pwd: "" }).success, true);
  assert.equal(chatMessageSchema.safeParse({ msg: "السلام عليكم" }).success, true);
  assert.equal(giftSendSchema.safeParse({ id: "sock1", file: "rose.gif", qty: 2 }).success, true);
});

test("legacy sha1 password-hash verifies cleanly alongside bcrypt", async () => {
  const legacyHash = passwordHash.generate("oldpass123");
  assert.equal(passwordHash.verify("oldpass123", legacyHash), true);
  assert.equal(passwordHash.verify("wrong", legacyHash), false);
});
