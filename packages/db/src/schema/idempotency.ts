import {
  pgTable,
  varchar,
  text,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const idempotency_records = pgTable(
  "idempotency_records",
  {
    user_uid: varchar("user_uid", { length: 255 }).notNull(),
    idempotency_key: varchar("idempotency_key", { length: 128 }).notNull(),
    source_type: varchar("source_type", { length: 64 }).notNull(),
    payload_hash: varchar("payload_hash", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    owner_token: varchar("owner_token", { length: 64 }).notNull(),
    lease_expires_at: bigint("lease_expires_at", { mode: "number" }).notNull(),
    locked_unit_coin: bigint("locked_unit_coin", { mode: "number" }).notNull(),
    txid: varchar("txid", { length: 128 }).default(""),
    response_json: text("response_json"),
    error_message: text("error_message"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.user_uid, t.idempotency_key], name: "pk_idempotency_records" }),
    check("chk_idem_status", sql`status IN ('pending', 'completed', 'failed')`),
    uniqueIndex("uniq_idem_txid").on(t.txid).where(sql`txid <> ''`),
    index("idx_idem_status_lease").on(t.status, t.lease_expires_at),
  ]
);

export type IdempotencyRecord = typeof idempotency_records.$inferSelect;
export type NewIdempotencyRecord = typeof idempotency_records.$inferInsert;
