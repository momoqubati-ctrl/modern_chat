import {
  pgTable,
  bigserial,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  numeric,
  smallint,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";

export const coin_ledger = pgTable(
  "coin_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    txid: varchar("txid", { length: 128 }).default(""),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    actor_uid: varchar("actor_uid", { length: 255 }).default(""),
    actor_idreg: integer("actor_idreg").default(0),
    user_uid: varchar("user_uid", { length: 255 }).default(""),
    user_idreg: integer("user_idreg").default(0),
    counterparty_uid: varchar("counterparty_uid", { length: 255 }).default(""),
    counterparty_idreg: integer("counterparty_idreg").default(0),
    amount: bigint("amount", { mode: "number" }).notNull(),
    before_balance: bigint("before_balance", { mode: "number" }).notNull(),
    after_balance: bigint("after_balance", { mode: "number" }).notNull(),
    gift_file: varchar("gift_file", { length: 255 }).default(""),
    note: text("note"),
    ip: varchar("ip", { length: 255 }).default(""),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_coin_ledger_txid_event_user")
      .on(t.txid, t.event_type, t.user_idreg)
      .where(sql`${t.txid} <> ''`),
    index("idx_coin_ledger_user_uid").on(t.user_uid, t.created_at),
    index("idx_coin_ledger_created_at").on(t.created_at),
  ]
);

export const gift_notifications = pgTable(
  "gift_notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    txid: varchar("txid", { length: 128 }).default(""),
    to_uid: varchar("to_uid", { length: 255 }).notNull(),
    to_idreg: integer("to_idreg").default(0),
    from_uid: varchar("from_uid", { length: 255 }).default(""),
    from_idreg: integer("from_idreg").default(0),
    from_topic: varchar("from_topic", { length: 255 }).default(""),
    gift_file: varchar("gift_file", { length: 255 }).default(""),
    coin: bigint("coin", { mode: "number" }).default(0),
    note: text("note"),
    is_read: boolean("is_read").default(false),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    read_at: bigint("read_at", { mode: "number" }).default(0),
  },
  (t) => [
    index("idx_gift_notif_txid").on(t.txid),
    index("idx_gift_notif_to_uid").on(t.to_uid, t.is_read, t.created_at),
    index("idx_gift_notif_created_at").on(t.created_at),
  ]
);

export const site_master_wallet = pgTable(
  "site_master_wallet",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    site_id: integer("site_id").notNull(),
    balance_coins: bigint("balance_coins", { mode: "number" }).default(0),
    reserved_coins: bigint("reserved_coins", { mode: "number" }).default(0),
    status: varchar("status", { length: 32 }).default("active"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("uniq_site_master_wallet_site").on(t.site_id)]
);

export const site_master_wallet_ledger = pgTable(
  "site_master_wallet_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    txid: varchar("txid", { length: 128 }).default(""),
    site_id: integer("site_id").notNull(),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    before_balance: bigint("before_balance", { mode: "number" }).notNull(),
    after_balance: bigint("after_balance", { mode: "number" }).notNull(),
    actor_type: varchar("actor_type", { length: 64 }).default(""),
    actor_id: varchar("actor_id", { length: 255 }).default(""),
    counterparty_type: varchar("counterparty_type", { length: 64 }).default(""),
    counterparty_id: varchar("counterparty_id", { length: 255 }).default(""),
    note: text("note"),
    reference_table: varchar("reference_table", { length: 128 }).default(""),
    reference_id: bigint("reference_id", { mode: "number" }).default(0),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_smwl_txid").on(t.txid),
    index("idx_smwl_site").on(t.site_id, t.created_at),
  ]
);

export const gift_fee_slabs = pgTable(
  "gift_fee_slabs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slab_min_coin: integer("slab_min_coin").notNull(),
    slab_max_coin: integer("slab_max_coin"),
    platform_fee_bps: smallint("platform_fee_bps").notNull(),
    is_active: boolean("is_active").notNull().default(true),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_gift_fee_slabs_min").on(t.slab_min_coin),
    check("chk_gift_fee_slabs_bps", sql`${t.platform_fee_bps} >= 0 AND ${t.platform_fee_bps} <= 5000`),
    check("chk_gift_fee_slabs_range", sql`${t.slab_min_coin} >= 1 AND (${t.slab_max_coin} IS NULL OR ${t.slab_max_coin} >= ${t.slab_min_coin})`),
  ],
);

export const gift_settings = pgTable(
  "gift_settings",
  {
    key: varchar("key", { length: 64 }).primaryKey(),
    value: text("value").notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
    updated_by: integer("updated_by").references(() => users.idreg, { onDelete: "set null" }),
  },
);

export const site_funding_log = pgTable(
  "site_funding_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    amount_coins: bigint("amount_coins", { mode: "number" }).notNull(),
    external_ref: varchar("external_ref", { length: 255 }).notNull(),
    note: text("note").default(""),
    funded_by: varchar("funded_by", { length: 255 }).notNull().default("hosting_owner"),
    idempotency_key: varchar("idempotency_key", { length: 128 }).notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_site_funding_idempotency").on(t.idempotency_key),
    index("idx_site_funding_created_at").on(t.created_at),
    check("chk_site_funding_positive", sql`${t.amount_coins} > 0`),
  ],
);

export const hosting_owner_wallet = pgTable(
  "hosting_owner_wallet",
  {
    id: integer("id").primaryKey().default(1),
    balance_coins: bigint("balance_coins", { mode: "number" }).notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [check("chk_hosting_owner_wallet_singleton", sql`${t.id} = 1`)],
);

export const hosting_owner_wallet_ledger = pgTable(
  "hosting_owner_wallet_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    txid: varchar("txid", { length: 128 }).notNull(),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    before_balance: bigint("before_balance", { mode: "number" }).notNull(),
    after_balance: bigint("after_balance", { mode: "number" }).notNull(),
    reference_table: varchar("reference_table", { length: 128 }).default(""),
    reference_id: bigint("reference_id", { mode: "number" }).default(0),
    note: text("note").default(""),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_hosting_owner_wallet_ledger_txid").on(t.txid),
    index("idx_hosting_owner_wallet_ledger_created_at").on(t.created_at),
    check("chk_hosting_owner_wallet_ledger_amount", sql`${t.amount} > 0`),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    country_code: varchar("country_code", { length: 16 }).default(""),
    city: varchar("city", { length: 255 }).default(""),
    phone: varchar("phone", { length: 64 }).default(""),
    username: varchar("username", { length: 64 }).notNull(),
    password_hash: text("password_hash"),
    status: varchar("status", { length: 32 }).default("active"),
    commission_type: varchar("commission_type", { length: 32 }).default("spread"),
    commission_value: numeric("commission_value", { precision: 18, scale: 4 }).default("0.0000"),
    can_receive_orders: boolean("can_receive_orders").default(true),
    notes: text("notes"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_agents_code").on(t.code),
    uniqueIndex("uniq_agents_username").on(t.username),
    index("idx_agents_country").on(t.country_code),
    index("idx_agents_status").on(t.status),
  ]
);

export const agent_wallets = pgTable(
  "agent_wallets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    agent_id: bigint("agent_id", { mode: "number" }).notNull(),
    balance_coins: bigint("balance_coins", { mode: "number" }).default(0),
    reserved_coins: bigint("reserved_coins", { mode: "number" }).default(0),
    status: varchar("status", { length: 32 }).default("active"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    uniqueIndex("uniq_agent_wallets_agent").on(t.agent_id),
    index("idx_agent_wallets_status").on(t.status),
  ]
);

export const agent_wallet_ledger = pgTable(
  "agent_wallet_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    txid: varchar("txid", { length: 128 }).default(""),
    agent_id: bigint("agent_id", { mode: "number" }).notNull(),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    before_balance: bigint("before_balance", { mode: "number" }).notNull(),
    after_balance: bigint("after_balance", { mode: "number" }).notNull(),
    actor_type: varchar("actor_type", { length: 64 }).default(""),
    actor_id: varchar("actor_id", { length: 255 }).default(""),
    counterparty_type: varchar("counterparty_type", { length: 64 }).default(""),
    counterparty_id: varchar("counterparty_id", { length: 255 }).default(""),
    note: text("note"),
    reference_table: varchar("reference_table", { length: 128 }).default(""),
    reference_id: bigint("reference_id", { mode: "number" }).default(0),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_awl_txid").on(t.txid),
    index("idx_awl_agent").on(t.agent_id, t.created_at),
  ]
);

export const owner_agent_transfers = pgTable(
  "owner_agent_transfers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    txid: varchar("txid", { length: 128 }).default(""),
    agent_id: bigint("agent_id", { mode: "number" }).notNull(),
    coins_amount: bigint("coins_amount", { mode: "number" }).notNull(),
    settlement_amount_local: numeric("settlement_amount_local", { precision: 18, scale: 4 }).default("0.0000"),
    currency: varchar("currency", { length: 16 }).default(""),
    status: varchar("status", { length: 32 }).default("approved"),
    note: text("note"),
    created_by: varchar("created_by", { length: 255 }).default(""),
    approved_by: varchar("approved_by", { length: 255 }).default(""),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    approved_at: bigint("approved_at", { mode: "number" }).default(0),
  },
  (t) => [
    index("idx_oat_txid").on(t.txid),
    index("idx_oat_agent").on(t.agent_id, t.created_at),
  ]
);

export const coin_packages = pgTable(
  "coin_packages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    coins_amount: bigint("coins_amount", { mode: "number" }).notNull(),
    price_local: numeric("price_local", { precision: 18, scale: 4 }).default("0.0000"),
    currency: varchar("currency", { length: 16 }).default(""),
    country_code: varchar("country_code", { length: 16 }).default(""),
    city: varchar("city", { length: 255 }).default(""),
    is_active: boolean("is_active").default(true),
    sort_order: integer("sort_order").default(0),
    notes: text("notes"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_cp_country").on(t.country_code),
    index("idx_cp_active_sort").on(t.is_active, t.sort_order),
  ]
);

export const topup_orders = pgTable(
  "topup_orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    order_no: varchar("order_no", { length: 64 }).notNull(),
    user_uid: varchar("user_uid", { length: 255 }).default(""),
    user_idreg: integer("user_idreg").default(0),
    user_topic: varchar("user_topic", { length: 255 }).default(""),
    user_username: varchar("user_username", { length: 64 }).default(""),
    agent_id: bigint("agent_id", { mode: "number" }).notNull(),
    agent_code: varchar("agent_code", { length: 64 }).default(""),
    agent_name: varchar("agent_name", { length: 255 }).default(""),
    agent_phone: varchar("agent_phone", { length: 64 }).default(""),
    agent_country_code: varchar("agent_country_code", { length: 16 }).default(""),
    agent_city: varchar("agent_city", { length: 255 }).default(""),
    package_id: bigint("package_id", { mode: "number" }).notNull(),
    package_title: varchar("package_title", { length: 255 }).default(""),
    package_coins: bigint("package_coins", { mode: "number" }).notNull(),
    package_price_local: numeric("package_price_local", { precision: 18, scale: 4 }).default("0.0000"),
    customer_price_local: numeric("customer_price_local", { precision: 18, scale: 4 }).default("0.0000"),
    agent_profit_local: numeric("agent_profit_local", { precision: 18, scale: 4 }).default("0.0000"),
    agent_commission_type: varchar("agent_commission_type", { length: 32 }).default("spread"),
    agent_commission_value: numeric("agent_commission_value", { precision: 18, scale: 4 }).default("0.0000"),
    currency: varchar("currency", { length: 16 }).default(""),
    package_country_code: varchar("package_country_code", { length: 16 }).default(""),
    package_city: varchar("package_city", { length: 255 }).default(""),
    payment_method_id: bigint("payment_method_id", { mode: "number" }).default(0),
    payment_method_name: varchar("payment_method_name", { length: 255 }).default(""),
    payment_method_account_name: varchar("payment_method_account_name", { length: 255 }).default(""),
    payment_method_identifier: varchar("payment_method_identifier", { length: 255 }).default(""),
    receipt_path: varchar("receipt_path", { length: 255 }).default(""),
    receipt_uploaded_at: bigint("receipt_uploaded_at", { mode: "number" }).default(0),
    payment_reference: varchar("payment_reference", { length: 255 }).default(""),
    payment_note: text("payment_note"),
    status: varchar("status", { length: 32 }).default("pending"),
    processed_by: varchar("processed_by", { length: 255 }).default(""),
    processed_note: text("processed_note"),
    reject_reason: text("reject_reason"),
    requested_at: bigint("requested_at", { mode: "number" }).notNull(),
    processed_at: bigint("processed_at", { mode: "number" }).default(0),
    source_ip: varchar("source_ip", { length: 255 }).default(""),
    agent_commission_coins: bigint("agent_commission_coins", { mode: "number" }).default(0),
  },
  (t) => [
    uniqueIndex("uniq_topup_orders_order_no").on(t.order_no),
    index("idx_topup_orders_status").on(t.status),
    index("idx_topup_orders_user_uid").on(t.user_uid),
    index("idx_topup_orders_agent_id").on(t.agent_id),
    index("idx_topup_orders_requested_at").on(t.requested_at),
  ]
);

export const topup_order_events = pgTable(
  "topup_order_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    order_id: bigint("order_id", { mode: "number" }).notNull(),
    order_no: varchar("order_no", { length: 64 }).default(""),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    old_status: varchar("old_status", { length: 32 }).default(""),
    new_status: varchar("new_status", { length: 32 }).default(""),
    actor_type: varchar("actor_type", { length: 64 }).default(""),
    actor_id: varchar("actor_id", { length: 255 }).default(""),
    note: text("note"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_toe_order_id").on(t.order_id),
    index("idx_toe_created_at").on(t.created_at),
  ]
);

export const agent_payment_methods = pgTable(
  "agent_payment_methods",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    agent_id: bigint("agent_id", { mode: "number" }).notNull(),
    method_name: varchar("method_name", { length: 255 }).notNull(),
    account_name: varchar("account_name", { length: 255 }).default(""),
    account_identifier: varchar("account_identifier", { length: 255 }).default(""),
    instructions: text("instructions"),
    is_active: boolean("is_active").default(true),
    sort_order: integer("sort_order").default(0),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    updated_at: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_apm_agent").on(t.agent_id),
    index("idx_apm_active").on(t.is_active),
  ]
);

export const topup_settlement_ledger = pgTable(
  "topup_settlement_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    txid: varchar("txid", { length: 128 }).default(""),
    order_id: bigint("order_id", { mode: "number" }).notNull(),
    order_no: varchar("order_no", { length: 64 }).default(""),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    agent_id: bigint("agent_id", { mode: "number" }).default(0),
    agent_name: varchar("agent_name", { length: 255 }).default(""),
    user_uid: varchar("user_uid", { length: 255 }).default(""),
    user_idreg: integer("user_idreg").default(0),
    package_id: bigint("package_id", { mode: "number" }).default(0),
    package_title: varchar("package_title", { length: 255 }).default(""),
    package_coins: bigint("package_coins", { mode: "number" }).default(0),
    currency: varchar("currency", { length: 16 }).default(""),
    customer_price_local: numeric("customer_price_local", { precision: 18, scale: 4 }).default("0.0000"),
    site_share_local: numeric("site_share_local", { precision: 18, scale: 4 }).default("0.0000"),
    agent_profit_local: numeric("agent_profit_local", { precision: 18, scale: 4 }).default("0.0000"),
    processed_by: varchar("processed_by", { length: 255 }).default(""),
    note: text("note"),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("idx_tsl_txid").on(t.txid),
    index("idx_tsl_order").on(t.order_id),
    index("idx_tsl_agent").on(t.agent_id),
    index("idx_tsl_created_at").on(t.created_at),
  ]
);
