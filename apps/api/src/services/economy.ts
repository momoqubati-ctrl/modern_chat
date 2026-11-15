import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  getDb,
  users,
  coin_ledger,
  gift_notifications,
  site_master_wallet,
  site_master_wallet_ledger,
  agents,
  agent_wallets,
  agent_wallet_ledger,
  owner_agent_transfers,
  coin_packages,
  topup_orders,
  topup_order_events,
  agent_payment_methods,
  topup_settlement_ledger,
  eq,
  and,
  or,
  desc,
  asc,
  inArray,
  sql,
  executeUnifiedGiftTransfer,
  isUnifiedEconomyError,
} from "@newchat/db";
import {
  GIFT_PLATFORM_FEE_PERCENT,
  SITE_MASTER_WALLET_SITE_ID,
  TOPUP_PENDING_EXPIRY_MS,
} from "@newchat/shared";
import { apiConfig } from "../config.js";
import { hashPasswordSync, verifyPasswordAsync } from "../lib/password.js";

export class EconomyError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.name = "EconomyError";
    this.code = code;
  }
}

export function isEconomyError(err: unknown, code?: string): err is EconomyError {
  if (!err || typeof err !== "object") return false;
  const c = (err as { code?: unknown }).code;
  if (typeof c !== "string" || !c) return false;
  return code ? c === code : true;
}

export function normalizeAgentStatus(input: unknown): "active" | "suspended" | "archived" {
  const value = String(input || "").trim().toLowerCase();
  if (value === "suspended" || value === "archived") {
    return value;
  }
  return "active";
}

export function normalizeAgentCommissionType(input: unknown): "spread" | "fixed" | "percent" {
  const value = String(input || "").trim().toLowerCase();
  if (value === "fixed" || value === "percent") {
    return value;
  }
  return "spread";
}

export function normalizeCurrencyCode(input: unknown): string {
  return String(input || "").trim().toUpperCase().slice(0, 16);
}

export function normalizeTopupCountryCode(input: unknown): string {
  return String(input || "").trim().toUpperCase().slice(0, 16);
}

export function normalizeAgentText(input: unknown, maxLen = 255): string {
  return String(input || "").trim().slice(0, Math.max(1, Number(maxLen) || 255));
}

export function parsePositiveCoinAmount(input: unknown): number {
  const n = Number.parseInt(String(input ?? "0"), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function makeCoinTxId(prefix = "tx"): string {
  return `${String(prefix || "tx")}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export function buildAgentCode(): string {
  return "AG" + crypto.randomBytes(5).toString("hex").toUpperCase();
}

export function buildTopupOrderNo(): string {
  return "TP" + Date.now() + crypto.randomBytes(3).toString("hex").toUpperCase();
}

export function buildWalletActorLabel(
  actor: { idreg?: number | string; username?: string; topic?: string } | null | undefined,
): string {
  if (!actor) return "";
  const rawId = actor.idreg ? "#" + String(actor.idreg).replace(/^#/, "") : "";
  const username = String(actor.username || actor.topic || "").trim();
  return [rawId, username].filter(Boolean).join(" ").trim();
}

export function buildAgentActorLabel(
  agentRow: { code?: string; username?: string; name?: string } | null | undefined,
): string {
  if (!agentRow) return "";
  const code = String(agentRow.code || "").trim();
  const username = String(agentRow.username || "").trim();
  const name = String(agentRow.name || "").trim();
  return [code, username || name].filter(Boolean).join(" ").trim();
}

export function roundTopupMoney(value: unknown): number {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 10000) / 10000;
}

function toNumericSql(value: unknown): string {
  return roundTopupMoney(value).toFixed(4);
}

export function normalizeTopupOrderStatus(input: unknown): "pending" | "approved" | "rejected" | "cancelled" {
  const value = String(input || "").trim().toLowerCase();
  if (value === "approved" || value === "rejected" || value === "cancelled") {
    return value;
  }
  return "pending";
}

export function normalizeTopupReceiptPath(input: unknown): string {
  const value = String(input || "").trim();
  const match = value.match(/^\/topup_receipts\/([A-Za-z0-9._-]+)$/);
  if (!match?.[1]) return "";
  return "/topup_receipts/" + match[1];
}

export function buildTopupReceiptAbsolutePath(receiptPath: unknown): string {
  const normalized = normalizeTopupReceiptPath(receiptPath);
  if (!normalized) return "";
  const receiptsDir = path.resolve(apiConfig.uploadDir, "topup_receipts");
  const fullPath = path.resolve(receiptsDir, path.basename(normalized));
  if (!fullPath.startsWith(receiptsDir + path.sep)) return "";
  return fullPath;
}

export function calculateTopupAgentPricing(
  basePriceRaw: unknown,
  commissionTypeRaw: unknown,
  commissionValueRaw: unknown,
) {
  const basePrice = Math.max(0, roundTopupMoney(basePriceRaw));
  const commissionType = normalizeAgentCommissionType(commissionTypeRaw);
  const commissionValue = Math.max(0, roundTopupMoney(commissionValueRaw));
  let agentProfitLocal = 0;
  if (commissionType === "fixed") {
    agentProfitLocal = Math.max(0, commissionValue - basePrice);
  } else if (commissionType === "percent") {
    agentProfitLocal = (basePrice * commissionValue) / 100;
  } else {
    agentProfitLocal = commissionValue;
  }
  agentProfitLocal = Math.max(0, roundTopupMoney(agentProfitLocal));
  return {
    base_price_local: basePrice,
    customer_price_local: basePrice,
    agent_profit_local: agentProfitLocal,
    agent_commission_type: commissionType,
    agent_commission_value: commissionValue,
  };
}

export function calculateTopupAgentCommissionCoins(
  packageCoinsRaw: unknown,
  basePriceRaw: unknown,
  commissionLocalRaw: unknown,
): number {
  const packageCoins = Math.max(0, Number.parseInt(String(packageCoinsRaw ?? "0"), 10) || 0);
  const basePrice = Math.max(0, roundTopupMoney(basePriceRaw));
  const commissionLocal = Math.max(0, roundTopupMoney(commissionLocalRaw));
  if (packageCoins < 1 || basePrice <= 0 || commissionLocal <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((commissionLocal / basePrice) * packageCoins));
}

export function normalizeAgentDashboardRow(
  agentRow: Record<string, any> | null | undefined,
  walletRow?: Record<string, any> | null,
) {
  if (!agentRow) return null;
  const wBalance =
    walletRow?.balance_coins ?? agentRow.wallet_balance_coins ?? 0;
  const wReserved =
    walletRow?.reserved_coins ?? agentRow.wallet_reserved_coins ?? 0;
  const wStatus =
    walletRow?.status ?? agentRow.wallet_status ?? agentRow.status;

  return {
    id: Number(agentRow.id || 0),
    code: String(agentRow.code || ""),
    name: String(agentRow.name || ""),
    country_code: String(agentRow.country_code || ""),
    city: String(agentRow.city || ""),
    phone: String(agentRow.phone || ""),
    username: String(agentRow.username || ""),
    status: normalizeAgentStatus(agentRow.status),
    commission_type: normalizeAgentCommissionType(agentRow.commission_type),
    commission_value: Number(agentRow.commission_value || 0),
    can_receive_orders: Boolean(agentRow.can_receive_orders),
    notes: String(agentRow.notes || ""),
    wallet_balance_coins: Math.max(0, Number.parseInt(String(wBalance), 10) || 0),
    wallet_reserved_coins: Math.max(0, Number.parseInt(String(wReserved), 10) || 0),
    wallet_status: normalizeAgentStatus(wStatus),
    created_at: Number.parseInt(String(agentRow.created_at || 0), 10) || 0,
    updated_at: Number.parseInt(String(agentRow.updated_at || 0), 10) || 0,
    payment_methods: [] as ReturnType<typeof normalizeAgentPaymentMethodRow>[],
    report: undefined as ReturnType<typeof buildEmptyAgentTopupReport> | undefined,
  };
}

export function normalizeAgentPaymentMethodRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    agent_id: Number(row.agent_id || 0),
    method_name: String(row.method_name || ""),
    account_name: String(row.account_name || ""),
    account_identifier: String(row.account_identifier || ""),
    instructions: String(row.instructions || ""),
    is_active: Boolean(row.is_active),
    sort_order: Number.parseInt(String(row.sort_order || 0), 10) || 0,
    created_at: Number.parseInt(String(row.created_at || 0), 10) || 0,
    updated_at: Number.parseInt(String(row.updated_at || 0), 10) || 0,
  };
}

export function normalizeCoinPackageRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    title: String(row.title || ""),
    coins_amount: Math.max(0, Number.parseInt(String(row.coins_amount || 0), 10) || 0),
    price_local: Number(row.price_local || 0),
    currency: normalizeCurrencyCode(row.currency),
    country_code: normalizeTopupCountryCode(row.country_code),
    city: String(row.city || ""),
    is_active: Boolean(row.is_active),
    sort_order: Number.parseInt(String(row.sort_order || 0), 10) || 0,
    notes: String(row.notes || ""),
    created_at: Number.parseInt(String(row.created_at || 0), 10) || 0,
    updated_at: Number.parseInt(String(row.updated_at || 0), 10) || 0,
  };
}

export function normalizeTopupOrderRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  const packagePriceLocal = Number(row.package_price_local || 0);
  const customerPriceLocal =
    row.customer_price_local != null && String(row.customer_price_local) !== ""
      ? Number(row.customer_price_local || 0)
      : packagePriceLocal;
  const agentProfitLocal =
    row.agent_profit_local != null && String(row.agent_profit_local) !== ""
      ? Number(row.agent_profit_local || 0)
      : customerPriceLocal - packagePriceLocal;
  const agentCommissionCoins = Math.max(
    0,
    Number.parseInt(String(row.agent_commission_coins || 0), 10) || 0,
  );
  return {
    id: Number(row.id || 0),
    order_no: String(row.order_no || ""),
    user_uid: String(row.user_uid || ""),
    user_idreg: Number.parseInt(String(row.user_idreg || 0), 10) || 0,
    user_topic: String(row.user_topic || ""),
    user_username: String(row.user_username || ""),
    agent_id: Number.parseInt(String(row.agent_id || 0), 10) || 0,
    agent_code: String(row.agent_code || ""),
    agent_name: String(row.agent_name || ""),
    agent_phone: String(row.agent_phone || ""),
    agent_country_code: normalizeTopupCountryCode(row.agent_country_code),
    agent_city: String(row.agent_city || ""),
    package_id: Number.parseInt(String(row.package_id || 0), 10) || 0,
    package_title: String(row.package_title || ""),
    package_coins: Math.max(0, Number.parseInt(String(row.package_coins || 0), 10) || 0),
    package_price_local: packagePriceLocal,
    customer_price_local: customerPriceLocal,
    agent_profit_local: agentProfitLocal,
    agent_commission_coins: agentCommissionCoins,
    agent_commission_type: normalizeAgentCommissionType(row.agent_commission_type),
    agent_commission_value: Number(row.agent_commission_value || 0),
    currency: normalizeCurrencyCode(row.currency),
    package_country_code: normalizeTopupCountryCode(row.package_country_code),
    package_city: String(row.package_city || ""),
    payment_method_id: Number.parseInt(String(row.payment_method_id || 0), 10) || 0,
    payment_method_name: String(row.payment_method_name || ""),
    payment_method_account_name: String(row.payment_method_account_name || ""),
    payment_method_identifier: String(row.payment_method_identifier || ""),
    receipt_path: normalizeTopupReceiptPath(row.receipt_path),
    receipt_uploaded_at: Number.parseInt(String(row.receipt_uploaded_at || 0), 10) || 0,
    payment_reference: String(row.payment_reference || ""),
    payment_note: String(row.payment_note || ""),
    status: normalizeTopupOrderStatus(row.status),
    processed_by: String(row.processed_by || ""),
    processed_note: String(row.processed_note || ""),
    reject_reason: String(row.reject_reason || ""),
    requested_at: Number.parseInt(String(row.requested_at || 0), 10) || 0,
    processed_at: Number.parseInt(String(row.processed_at || 0), 10) || 0,
    source_ip: String(row.source_ip || ""),
  };
}

export function normalizeCoinLedgerRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    txid: String(row.txid || ""),
    event_type: String(row.event_type || "").trim().toLowerCase(),
    actor_uid: String(row.actor_uid || ""),
    actor_idreg: Number.parseInt(String(row.actor_idreg || 0), 10) || 0,
    user_uid: String(row.user_uid || ""),
    user_idreg: Number.parseInt(String(row.user_idreg || 0), 10) || 0,
    counterparty_uid: String(row.counterparty_uid || ""),
    counterparty_idreg: Number.parseInt(String(row.counterparty_idreg || 0), 10) || 0,
    amount: Number.parseInt(String(row.amount || 0), 10) || 0,
    before_balance: Number.parseInt(String(row.before_balance || 0), 10) || 0,
    after_balance: Number.parseInt(String(row.after_balance || 0), 10) || 0,
    gift_file: String(row.gift_file || ""),
    note: String(row.note || ""),
    ip: String(row.ip || ""),
    created_at: Number.parseInt(String(row.created_at || 0), 10) || 0,
  };
}

export function normalizeTopupAdminNotificationRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  const eventType = String(row.event_type || "").trim().toLowerCase();
  return {
    id: Number(row.id || 0),
    order_id: Number(row.order_id || 0),
    order_no: String(row.order_no || ""),
    event_type: eventType,
    old_status: String(row.old_status || "").trim().toLowerCase(),
    new_status: String(row.new_status || "").trim().toLowerCase(),
    actor_type: String(row.actor_type || "").trim().toLowerCase(),
    actor_id: String(row.actor_id || ""),
    note: String(row.note || ""),
    created_at: Number.parseInt(String(row.created_at || 0), 10) || 0,
    user_uid: String(row.user_uid || ""),
    user_idreg: Number.parseInt(String(row.user_idreg || 0), 10) || 0,
    user_topic: String(row.user_topic || ""),
    user_username: String(row.user_username || ""),
    agent_id: Number.parseInt(String(row.agent_id || 0), 10) || 0,
    agent_name: String(row.agent_name || ""),
    package_id: Number.parseInt(String(row.package_id || 0), 10) || 0,
    package_title: String(row.package_title || ""),
    package_coins: Math.max(0, Number.parseInt(String(row.package_coins || 0), 10) || 0),
    currency: normalizeCurrencyCode(row.currency),
    order_status: normalizeTopupOrderStatus(row.order_status || row.new_status || ""),
    requested_at: Number.parseInt(String(row.requested_at || 0), 10) || 0,
    processed_at: Number.parseInt(String(row.processed_at || 0), 10) || 0,
  };
}

export function buildEmptyAgentTopupReport() {
  return {
    orders_total: 0,
    pending_orders_total: 0,
    rejected_orders_total: 0,
    approved_orders_total: 0,
    approved_coins_total: 0,
    approved_sales_value_total_local: 0,
    approved_profit_total_local: 0,
    owner_share_total_local: 0,
    approved_orders_today: 0,
    approved_coins_today: 0,
    approved_sales_value_today_local: 0,
    approved_profit_today_local: 0,
    owner_share_today_local: 0,
    approved_orders_week: 0,
    approved_coins_week: 0,
    approved_sales_value_week_local: 0,
    approved_profit_week_local: 0,
    owner_share_week_local: 0,
    approved_orders_month: 0,
    approved_coins_month: 0,
    approved_sales_value_month_local: 0,
    approved_profit_month_local: 0,
    owner_share_month_local: 0,
    funded_coins_total: 0,
    funded_coins_today: 0,
    funded_coins_month: 0,
    funded_value_total_local: 0,
    funded_value_today_local: 0,
    funded_value_month_local: 0,
    funded_avg_unit_price_local: 0,
    approved_currency: "",
    approved_currency_mixed: false,
    funding_currency: "",
    funding_currency_mixed: false,
    last_approved_at: 0,
    last_funded_at: 0,
  };
}

function getTopupReportPeriodStarts(nowRaw = Date.now()) {
  const now = Number.parseInt(String(nowRaw || Date.now()), 10) || Date.now();
  const current = new Date(now);
  const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
  const weekday = current.getDay();
  const diffToMonday = (weekday + 6) % 7;
  const weekStart = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate() - diffToMonday,
  ).getTime();
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1).getTime();
  return { now, dayStart, weekStart, monthStart };
}

export async function resolveUserByCoinsTarget(targetRaw: unknown) {
  const target = String(targetRaw || "").trim();
  if (!target) return null;
  const { db } = getDb();
  const idMatch = target.match(/^#?(\d+)$/);
  if (idMatch?.[1]) {
    const idreg = Number.parseInt(idMatch[1], 10);
    if (!Number.isFinite(idreg) || idreg < 1) return null;
    const rows = await db.select().from(users).where(eq(users.idreg, idreg)).limit(1);
    return rows[0] ?? null;
  }
  const byUsername = await db
    .select()
    .from(users)
    .where(eq(users.username, target.toLowerCase()))
    .limit(1);
  if (byUsername[0]) return byUsername[0];
  const byTopic = await db.select().from(users).where(eq(users.topic, target)).limit(1);
  return byTopic[0] ?? null;
}

export async function ensureSiteMasterWalletReady(): Promise<void> {
  const { db } = getDb();
  const now = Date.now();
  await db
    .insert(site_master_wallet)
    .values({
      site_id: SITE_MASTER_WALLET_SITE_ID,
      balance_coins: 0,
      reserved_coins: 0,
      status: "active",
      created_at: now,
      updated_at: now,
    })
    .onConflictDoNothing({ target: site_master_wallet.site_id });
}

export async function getSecretMasterWalletSnapshot() {
  await ensureSiteMasterWalletReady();
  const { db } = getDb();
  const rows = await db
    .select()
    .from(site_master_wallet)
    .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID))
    .limit(1);
  const walletRow = rows[0];
  return {
    site_id: SITE_MASTER_WALLET_SITE_ID,
    balance_coins: Math.max(0, Number(walletRow?.balance_coins || 0)),
    status: String(walletRow?.status || "active"),
  };
}

export async function verifyAgentCredentials(usernameRaw: unknown, passwordRaw: unknown) {
  const username = normalizeAgentText(usernameRaw, 64).toLowerCase();
  const password = String(passwordRaw || "");
  if (!username || !password) return null;

  const { db } = getDb();
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.username, username))
    .limit(1);
  const agent = rows[0];
  if (!agent || !agent.password_hash) return null;

  const valid = await verifyPasswordAsync(password, String(agent.password_hash));
  if (!valid) return null;

  const walletRows = await db
    .select()
    .from(agent_wallets)
    .where(eq(agent_wallets.agent_id, agent.id))
    .limit(1);

  return normalizeAgentDashboardRow(agent, walletRows[0] ?? null);
}

export async function getAgentWithWalletById(agentId: number) {
  const safeId = Number.parseInt(String(agentId || 0), 10) || 0;
  if (safeId < 1) return null;
  const { db } = getDb();
  const rows = await db.select().from(agents).where(eq(agents.id, safeId)).limit(1);
  if (!rows[0]) return null;
  const walletRows = await db
    .select()
    .from(agent_wallets)
    .where(eq(agent_wallets.agent_id, safeId))
    .limit(1);
  return normalizeAgentDashboardRow(rows[0], walletRows[0] ?? null);
}

export async function getAllAgentsWithWallets() {
  const { db } = getDb();
  const [agentRows, walletRows] = await Promise.all([
    db.select().from(agents).orderBy(desc(agents.id)),
    db.select().from(agent_wallets),
  ]);
  const walletByAgentId = new Map<number, typeof agent_wallets.$inferSelect>();
  for (const w of walletRows) {
    walletByAgentId.set(Number(w.agent_id), w);
  }
  return agentRows
    .map((a) => normalizeAgentDashboardRow(a, walletByAgentId.get(Number(a.id)) ?? null))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getActiveTopupAgents() {
  const all = await getAllAgentsWithWallets();
  const active = all.filter(
    (row) =>
      row.id > 0 &&
      row.status === "active" &&
      row.wallet_status === "active" &&
      row.can_receive_orders,
  );
  if (!active.length) return [];

  const { db } = getDb();
  const agentIds = active.map((a) => a.id);
  const methodRows = await db
    .select()
    .from(agent_payment_methods)
    .where(
      and(
        inArray(agent_payment_methods.agent_id, agentIds),
        eq(agent_payment_methods.is_active, true),
      ),
    )
    .orderBy(asc(agent_payment_methods.sort_order), asc(agent_payment_methods.id));

  const grouped = new Map<number, Array<NonNullable<ReturnType<typeof normalizeAgentPaymentMethodRow>>>>();
  for (const row of methodRows) {
    const norm = normalizeAgentPaymentMethodRow(row);
    if (!norm) continue;
    const list = grouped.get(norm.agent_id) ?? [];
    list.push(norm);
    grouped.set(norm.agent_id, list);
  }

  return active
    .map((agent) => {
      const methods = grouped.get(agent.id) ?? [];
      return { ...agent, payment_methods: methods };
    })
    .filter((agent) => agent.payment_methods.length > 0);
}

export async function getCoinTopupUserDashboard(userRow: { uid?: string | null } | null | undefined) {
  if (!userRow?.uid) {
    return { packages: [], agents: [], orders: [] };
  }
  const { db } = getDb();
  const [pkgRows, activeAgents, orderRows] = await Promise.all([
    db
      .select()
      .from(coin_packages)
      .where(eq(coin_packages.is_active, true))
      .orderBy(asc(coin_packages.sort_order), asc(coin_packages.id))
      .limit(100),
    getActiveTopupAgents(),
    db
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.user_uid, String(userRow.uid)))
      .orderBy(desc(topup_orders.requested_at))
      .limit(15),
  ]);

  return {
    packages: pkgRows.map(normalizeCoinPackageRow).filter(Boolean),
    agents: activeAgents,
    orders: orderRows.map(normalizeTopupOrderRow).filter(Boolean),
  };
}

export async function getCoinWalletCenterDashboard(
  userRow: {
    uid?: string | null;
    idreg?: number | null;
    username?: string | null;
    topic?: string | null;
    coins?: number | null;
  } | null | undefined,
) {
  if (!userRow?.uid) {
    return {
      profile: { uid: "", idreg: 0, username: "", topic: "", coins: 0 },
      summary: {
        ledger_entries: 0,
        topup_orders: 0,
        pending_orders: 0,
        approved_orders: 0,
        rejected_orders: 0,
        cancelled_orders: 0,
        total_added_coins: 0,
        total_spent_coins: 0,
      },
      ledger: [],
      orders: [],
    };
  }
  const { db } = getDb();
  const uid = String(userRow.uid);
  const [ledgerRows, orderRows] = await Promise.all([
    db
      .select()
      .from(coin_ledger)
      .where(eq(coin_ledger.user_uid, uid))
      .orderBy(desc(coin_ledger.created_at), desc(coin_ledger.id))
      .limit(60),
    db
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.user_uid, uid))
      .orderBy(desc(topup_orders.requested_at), desc(topup_orders.id))
      .limit(20),
  ]);

  const ledger = ledgerRows
    .map(normalizeCoinLedgerRow)
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  const orders = orderRows
    .map(normalizeTopupOrderRow)
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const summary = {
    ledger_entries: ledger.length,
    topup_orders: orders.length,
    pending_orders: 0,
    approved_orders: 0,
    rejected_orders: 0,
    cancelled_orders: 0,
    total_added_coins: 0,
    total_spent_coins: 0,
  };
  for (const row of ledger) {
    if (row.amount >= 0) {
      summary.total_added_coins += Math.max(0, row.amount);
    } else {
      summary.total_spent_coins += Math.abs(row.amount);
    }
  }
  for (const row of orders) {
    if (row.status === "approved") summary.approved_orders += 1;
    else if (row.status === "rejected") summary.rejected_orders += 1;
    else if (row.status === "cancelled") summary.cancelled_orders += 1;
    else summary.pending_orders += 1;
  }

  return {
    profile: {
      uid,
      idreg: Number(userRow.idreg || 0),
      username: String(userRow.username || ""),
      topic: String(userRow.topic || ""),
      coins: Math.max(0, Number(userRow.coins || 0)),
    },
    summary,
    ledger,
    orders,
  };
}

export async function getAgentTopupReportMap(
  agentIdsRaw: number[],
): Promise<Record<string, ReturnType<typeof buildEmptyAgentTopupReport>>> {
  const agentIds = agentIdsRaw
    .map((id) => Number.parseInt(String(id || 0), 10) || 0)
    .filter((id) => id > 0);
  const emptyMap: Record<string, ReturnType<typeof buildEmptyAgentTopupReport>> = {};
  for (const id of agentIds) {
    emptyMap[String(id)] = buildEmptyAgentTopupReport();
  }
  if (!agentIds.length) {
    return emptyMap;
  }

  const periods = getTopupReportPeriodStarts(Date.now());
  const idListSql = sql.join(
    agentIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const { db } = getDb();
  const [ordersRes, transfersRes] = await Promise.all([
    db.execute(sql`
      SELECT
        agent_id,
        COUNT(*) AS orders_total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_orders_total,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_orders_total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_orders_total,
        SUM(CASE WHEN status = 'approved' THEN package_coins ELSE 0 END) AS approved_coins_total,
        SUM(CASE WHEN status = 'approved' THEN customer_price_local ELSE 0 END) AS approved_sales_value_total_local,
        SUM(CASE WHEN status = 'approved' THEN agent_profit_local ELSE 0 END) AS approved_profit_total_local,
        SUM(CASE WHEN status = 'approved' THEN package_price_local ELSE 0 END) AS owner_share_total_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.dayStart} THEN 1 ELSE 0 END) AS approved_orders_today,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.dayStart} THEN package_coins ELSE 0 END) AS approved_coins_today,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.dayStart} THEN customer_price_local ELSE 0 END) AS approved_sales_value_today_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.dayStart} THEN agent_profit_local ELSE 0 END) AS approved_profit_today_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.dayStart} THEN package_price_local ELSE 0 END) AS owner_share_today_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.weekStart} THEN 1 ELSE 0 END) AS approved_orders_week,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.weekStart} THEN package_coins ELSE 0 END) AS approved_coins_week,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.weekStart} THEN customer_price_local ELSE 0 END) AS approved_sales_value_week_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.weekStart} THEN agent_profit_local ELSE 0 END) AS approved_profit_week_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.weekStart} THEN package_price_local ELSE 0 END) AS owner_share_week_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.monthStart} THEN 1 ELSE 0 END) AS approved_orders_month,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.monthStart} THEN package_coins ELSE 0 END) AS approved_coins_month,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.monthStart} THEN customer_price_local ELSE 0 END) AS approved_sales_value_month_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.monthStart} THEN agent_profit_local ELSE 0 END) AS approved_profit_month_local,
        SUM(CASE WHEN status = 'approved' AND processed_at >= ${periods.monthStart} THEN package_price_local ELSE 0 END) AS owner_share_month_local,
        COUNT(DISTINCT CASE WHEN status = 'approved' AND currency <> '' THEN currency ELSE NULL END) AS approved_currency_count,
        MAX(CASE WHEN status = 'approved' THEN currency ELSE '' END) AS approved_currency,
        MAX(CASE WHEN status = 'approved' THEN processed_at ELSE 0 END) AS last_approved_at
      FROM topup_orders
      WHERE agent_id IN (${idListSql})
      GROUP BY agent_id
    `),
    db.execute(sql`
      SELECT
        agent_id,
        SUM(coins_amount) AS funded_coins_total,
        SUM(CASE WHEN approved_at >= ${periods.dayStart} THEN coins_amount ELSE 0 END) AS funded_coins_today,
        SUM(CASE WHEN approved_at >= ${periods.monthStart} THEN coins_amount ELSE 0 END) AS funded_coins_month,
        SUM(settlement_amount_local) AS funded_value_total_local,
        SUM(CASE WHEN approved_at >= ${periods.dayStart} THEN settlement_amount_local ELSE 0 END) AS funded_value_today_local,
        SUM(CASE WHEN approved_at >= ${periods.monthStart} THEN settlement_amount_local ELSE 0 END) AS funded_value_month_local,
        COUNT(DISTINCT CASE WHEN currency <> '' THEN currency ELSE NULL END) AS funding_currency_count,
        MAX(currency) AS funding_currency,
        MAX(approved_at) AS last_funded_at
      FROM owner_agent_transfers
      WHERE agent_id IN (${idListSql}) AND status = 'approved'
      GROUP BY agent_id
    `),
  ]);

  const map = { ...emptyMap };
  for (const row of ordersRes.rows as Array<Record<string, any>>) {
    const key = String(Number.parseInt(String(row.agent_id || 0), 10) || 0);
    const base = map[key] || buildEmptyAgentTopupReport();
    map[key] = {
      ...base,
      orders_total: Math.max(0, Number.parseInt(String(row.orders_total || 0), 10) || 0),
      pending_orders_total: Math.max(0, Number.parseInt(String(row.pending_orders_total || 0), 10) || 0),
      rejected_orders_total: Math.max(0, Number.parseInt(String(row.rejected_orders_total || 0), 10) || 0),
      approved_orders_total: Math.max(0, Number.parseInt(String(row.approved_orders_total || 0), 10) || 0),
      approved_coins_total: Math.max(0, Number.parseInt(String(row.approved_coins_total || 0), 10) || 0),
      approved_sales_value_total_local: roundTopupMoney(row.approved_sales_value_total_local || 0),
      approved_profit_total_local: roundTopupMoney(row.approved_profit_total_local || 0),
      owner_share_total_local: roundTopupMoney(row.owner_share_total_local || 0),
      approved_orders_today: Math.max(0, Number.parseInt(String(row.approved_orders_today || 0), 10) || 0),
      approved_coins_today: Math.max(0, Number.parseInt(String(row.approved_coins_today || 0), 10) || 0),
      approved_sales_value_today_local: roundTopupMoney(row.approved_sales_value_today_local || 0),
      approved_profit_today_local: roundTopupMoney(row.approved_profit_today_local || 0),
      owner_share_today_local: roundTopupMoney(row.owner_share_today_local || 0),
      approved_orders_week: Math.max(0, Number.parseInt(String(row.approved_orders_week || 0), 10) || 0),
      approved_coins_week: Math.max(0, Number.parseInt(String(row.approved_coins_week || 0), 10) || 0),
      approved_sales_value_week_local: roundTopupMoney(row.approved_sales_value_week_local || 0),
      approved_profit_week_local: roundTopupMoney(row.approved_profit_week_local || 0),
      owner_share_week_local: roundTopupMoney(row.owner_share_week_local || 0),
      approved_orders_month: Math.max(0, Number.parseInt(String(row.approved_orders_month || 0), 10) || 0),
      approved_coins_month: Math.max(0, Number.parseInt(String(row.approved_coins_month || 0), 10) || 0),
      approved_sales_value_month_local: roundTopupMoney(row.approved_sales_value_month_local || 0),
      approved_profit_month_local: roundTopupMoney(row.approved_profit_month_local || 0),
      owner_share_month_local: roundTopupMoney(row.owner_share_month_local || 0),
      approved_currency:
        Number(row.approved_currency_count || 0) === 1
          ? normalizeCurrencyCode(row.approved_currency)
          : "",
      approved_currency_mixed: Number(row.approved_currency_count || 0) > 1,
      last_approved_at: Math.max(0, Number.parseInt(String(row.last_approved_at || 0), 10) || 0),
    };
  }

  for (const row of transfersRes.rows as Array<Record<string, any>>) {
    const key = String(Number.parseInt(String(row.agent_id || 0), 10) || 0);
    const base = map[key] || buildEmptyAgentTopupReport();
    const fundedCoinsTotal = Math.max(0, Number.parseInt(String(row.funded_coins_total || 0), 10) || 0);
    const fundedValueTotalLocal = roundTopupMoney(row.funded_value_total_local || 0);
    map[key] = {
      ...base,
      funded_coins_total: fundedCoinsTotal,
      funded_coins_today: Math.max(0, Number.parseInt(String(row.funded_coins_today || 0), 10) || 0),
      funded_coins_month: Math.max(0, Number.parseInt(String(row.funded_coins_month || 0), 10) || 0),
      funded_value_total_local: fundedValueTotalLocal,
      funded_value_today_local: roundTopupMoney(row.funded_value_today_local || 0),
      funded_value_month_local: roundTopupMoney(row.funded_value_month_local || 0),
      funded_avg_unit_price_local:
        fundedCoinsTotal > 0 ? roundTopupMoney(fundedValueTotalLocal / fundedCoinsTotal) : 0,
      funding_currency:
        Number(row.funding_currency_count || 0) === 1
          ? normalizeCurrencyCode(row.funding_currency)
          : "",
      funding_currency_mixed: Number(row.funding_currency_count || 0) > 1,
      last_funded_at: Math.max(0, Number.parseInt(String(row.last_funded_at || 0), 10) || 0),
    };
  }

  return map;
}

export function buildOwnerAgentReportsSummary(
  agentsList: Array<NonNullable<ReturnType<typeof normalizeAgentDashboardRow>>>,
) {
  const rows = Array.isArray(agentsList) ? agentsList : [];
  const acc = {
    agents_total: rows.length,
    active_agents_total: 0,
    pending_orders_total: 0,
    approved_orders_today: 0,
    approved_coins_today: 0,
    approved_orders_month: 0,
    approved_coins_month: 0,
    funded_coins_total: 0,
    funded_value_total_local: 0,
    customer_sales_today_local: 0,
    customer_sales_month_local: 0,
    owner_share_today_local: 0,
    owner_share_month_local: 0,
    agent_profit_today_local: 0,
    agent_profit_month_local: 0,
    wallet_balance_total: 0,
    funding_currency: "",
    funding_currency_mixed: false,
    sales_currency: "",
    sales_currency_mixed: false,
    best_owner_share_agent_name: "",
    best_owner_share_month_local: 0,
    best_agent_profit_agent_name: "",
    best_agent_profit_month_local: 0,
    funded_avg_unit_price_local: 0,
  };

  for (const agent of rows) {
    const report = agent.report ?? buildEmptyAgentTopupReport();
    if (agent.status === "active" && agent.wallet_status === "active") {
      acc.active_agents_total += 1;
    }
    acc.pending_orders_total += Math.max(0, report.pending_orders_total || 0);
    acc.approved_orders_today += Math.max(0, report.approved_orders_today || 0);
    acc.approved_coins_today += Math.max(0, report.approved_coins_today || 0);
    acc.approved_orders_month += Math.max(0, report.approved_orders_month || 0);
    acc.approved_coins_month += Math.max(0, report.approved_coins_month || 0);
    acc.funded_coins_total += Math.max(0, report.funded_coins_total || 0);
    acc.funded_value_total_local += roundTopupMoney(report.funded_value_total_local || 0);
    acc.customer_sales_today_local += roundTopupMoney(report.approved_sales_value_today_local || 0);
    acc.customer_sales_month_local += roundTopupMoney(report.approved_sales_value_month_local || 0);
    acc.owner_share_today_local += roundTopupMoney(report.owner_share_today_local || 0);
    acc.owner_share_month_local += roundTopupMoney(report.owner_share_month_local || 0);
    acc.agent_profit_today_local += roundTopupMoney(report.approved_profit_today_local || 0);
    acc.agent_profit_month_local += roundTopupMoney(report.approved_profit_month_local || 0);
    acc.wallet_balance_total += Math.max(0, agent.wallet_balance_coins || 0);

    if (roundTopupMoney(report.owner_share_month_local) > acc.best_owner_share_month_local) {
      acc.best_owner_share_month_local = roundTopupMoney(report.owner_share_month_local);
      acc.best_owner_share_agent_name = agent.name;
    }
    if (roundTopupMoney(report.approved_profit_month_local) > acc.best_agent_profit_month_local) {
      acc.best_agent_profit_month_local = roundTopupMoney(report.approved_profit_month_local);
      acc.best_agent_profit_agent_name = agent.name;
    }
    if (roundTopupMoney(report.funded_value_total_local) > 0) {
      if (report.funding_currency_mixed) {
        acc.funding_currency_mixed = true;
      } else if (report.funding_currency) {
        if (!acc.funding_currency) acc.funding_currency = report.funding_currency;
        else if (acc.funding_currency !== report.funding_currency) acc.funding_currency_mixed = true;
      }
    }
    if (
      roundTopupMoney(report.owner_share_month_local) > 0 ||
      roundTopupMoney(report.approved_sales_value_month_local) > 0
    ) {
      if (report.approved_currency_mixed) {
        acc.sales_currency_mixed = true;
      } else if (report.approved_currency) {
        if (!acc.sales_currency) acc.sales_currency = report.approved_currency;
        else if (acc.sales_currency !== report.approved_currency) acc.sales_currency_mixed = true;
      }
    }
  }
  acc.funded_avg_unit_price_local =
    acc.funded_coins_total > 0
      ? roundTopupMoney(acc.funded_value_total_local / acc.funded_coins_total)
      : 0;
  return acc;
}

export async function getAgentPanelDashboard(agentRow: { id?: number } | null | undefined) {
  const agentId = Number(agentRow?.id || 0);
  if (!agentId) {
    return {
      agent: null,
      wallet: null,
      paymentMethods: [],
      pendingOrders: [],
      recentOrders: [],
      recentLedger: [],
      recentTransfers: [],
      report: buildEmptyAgentTopupReport(),
    };
  }
  const { db } = getDb();
  const [
    agentData,
    paymentMethods,
    pendingOrders,
    recentOrders,
    recentLedger,
    recentTransfers,
    reportMap,
  ] = await Promise.all([
    getAgentWithWalletById(agentId),
    db
      .select()
      .from(agent_payment_methods)
      .where(eq(agent_payment_methods.agent_id, agentId))
      .orderBy(asc(agent_payment_methods.sort_order), desc(agent_payment_methods.id)),
    db
      .select()
      .from(topup_orders)
      .where(and(eq(topup_orders.agent_id, agentId), eq(topup_orders.status, "pending")))
      .orderBy(desc(topup_orders.requested_at), desc(topup_orders.id))
      .limit(25),
    db
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.agent_id, agentId))
      .orderBy(desc(topup_orders.requested_at), desc(topup_orders.id))
      .limit(25),
    db
      .select()
      .from(agent_wallet_ledger)
      .where(eq(agent_wallet_ledger.agent_id, agentId))
      .orderBy(desc(agent_wallet_ledger.created_at), desc(agent_wallet_ledger.id))
      .limit(20),
    db
      .select()
      .from(owner_agent_transfers)
      .where(eq(owner_agent_transfers.agent_id, agentId))
      .orderBy(desc(owner_agent_transfers.created_at), desc(owner_agent_transfers.id))
      .limit(12),
    getAgentTopupReportMap([agentId]),
  ]);

  return {
    agent: agentData,
    wallet: agentData
      ? {
          balance_coins: agentData.wallet_balance_coins,
          reserved_coins: agentData.wallet_reserved_coins,
          status: agentData.wallet_status,
        }
      : null,
    paymentMethods: paymentMethods.map(normalizeAgentPaymentMethodRow).filter(Boolean),
    pendingOrders: pendingOrders.map(normalizeTopupOrderRow).filter(Boolean),
    recentOrders: recentOrders.map(normalizeTopupOrderRow).filter(Boolean),
    recentLedger,
    recentTransfers,
    report: reportMap[String(agentId)] ?? buildEmptyAgentTopupReport(),
  };
}

export async function resolveActiveAgentPanelActor(agentId: number) {
  const agent = await getAgentWithWalletById(agentId);
  if (!agent || !agent.id) return null;
  if (agent.status !== "active" || agent.wallet_status !== "active" || !agent.can_receive_orders) {
    return null;
  }
  return agent;
}

export async function getAgentWalletDashboardSnapshot() {
  await ensureSiteMasterWalletReady();
  const { db } = getDb();

  const [
    masterRows,
    agentsList,
    masterLedger,
    recentTopupSettlements,
    recentTransfers,
    topupPackages,
    pendingTopupOrdersRows,
    recentTopupOrdersRows,
    recentOrderEventsRes,
  ] = await Promise.all([
    db
      .select()
      .from(site_master_wallet)
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID))
      .limit(1),
    getAllAgentsWithWallets(),
    db
      .select()
      .from(site_master_wallet_ledger)
      .where(eq(site_master_wallet_ledger.site_id, SITE_MASTER_WALLET_SITE_ID))
      .orderBy(desc(site_master_wallet_ledger.created_at), desc(site_master_wallet_ledger.id))
      .limit(12),
    db
      .select()
      .from(topup_settlement_ledger)
      .orderBy(desc(topup_settlement_ledger.created_at), desc(topup_settlement_ledger.id))
      .limit(12),
    db
      .select()
      .from(owner_agent_transfers)
      .orderBy(desc(owner_agent_transfers.created_at), desc(owner_agent_transfers.id))
      .limit(12),
    db
      .select()
      .from(coin_packages)
      .orderBy(asc(coin_packages.sort_order), desc(coin_packages.id)),
    db
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.status, "pending"))
      .orderBy(desc(topup_orders.requested_at), desc(topup_orders.id))
      .limit(20),
    db
      .select()
      .from(topup_orders)
      .orderBy(desc(topup_orders.requested_at), desc(topup_orders.id))
      .limit(20),
    db.execute(sql`
      SELECT
        e.*,
        o.user_uid, o.user_idreg, o.user_topic, o.user_username,
        o.agent_id, o.agent_name, o.package_id, o.package_title,
        o.package_coins, o.currency, o.status AS order_status,
        o.requested_at, o.processed_at
      FROM topup_order_events e
      LEFT JOIN topup_orders o ON o.id = e.order_id
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 20
    `),
  ]);

  const reportMap = await getAgentTopupReportMap(agentsList.map((a) => a.id));
  const agentsWithReports = agentsList.map((a) => ({
    ...a,
    report: reportMap[String(a.id)] ?? buildEmptyAgentTopupReport(),
  }));

  return {
    masterWallet: masterRows[0] ?? {
      site_id: SITE_MASTER_WALLET_SITE_ID,
      balance_coins: 0,
      reserved_coins: 0,
      status: "active",
    },
    agents: agentsWithReports,
    masterLedger,
    recentTopupSettlements,
    recentTransfers,
    topupPackages: topupPackages.map(normalizeCoinPackageRow).filter(Boolean),
    pendingTopupOrders: pendingTopupOrdersRows.map(normalizeTopupOrderRow).filter(Boolean),
    recentTopupOrders: recentTopupOrdersRows.map(normalizeTopupOrderRow).filter(Boolean),
    recentTopupAdminNotifications: (recentOrderEventsRes.rows as Array<Record<string, any>>)
      .map(normalizeTopupAdminNotificationRow)
      .filter(Boolean),
    reportsSummary: buildOwnerAgentReportsSummary(agentsWithReports),
  };
}

export async function createAgentWithWalletAtomic(
  _actor: unknown,
  payload: Record<string, unknown>,
) {
  const name = normalizeAgentText(payload.name, 255);
  const username = normalizeAgentText(payload.username, 64).toLowerCase();
  const passwordRaw = String(payload.password || "");
  const countryCode = normalizeTopupCountryCode(payload.country_code);
  const city = normalizeAgentText(payload.city, 255);
  const phone = normalizeAgentText(payload.phone, 64);
  const notes = normalizeAgentText(payload.notes, 500);
  const status = normalizeAgentStatus(payload.status);
  const commissionType = normalizeAgentCommissionType(payload.commission_type);
  const commissionValue = Math.max(0, Number(payload.commission_value ?? 0) || 0);

  if (!name) throw new EconomyError("AGENT_NAME_REQUIRED");
  if (!username || !/^[a-z0-9_.-]{3,64}$/i.test(username)) {
    throw new EconomyError("AGENT_USERNAME_INVALID");
  }
  if (!passwordRaw || passwordRaw.length < 4) {
    throw new EconomyError("AGENT_PASSWORD_INVALID");
  }

  const now = Date.now();
  const passwordHashValue = hashPasswordSync(passwordRaw);
  const { db } = getDb();

  return db.transaction(async (tx) => {
    const [existingByUser] = await tx
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.username, username))
      .for("update");
    if (existingByUser) {
      throw new EconomyError("AGENT_USERNAME_EXISTS");
    }

    let code = "";
    let codeExists = true;
    for (let attempt = 0; attempt < 5 && codeExists; attempt += 1) {
      code = buildAgentCode();
      const [existingByCode] = await tx
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.code, code))
        .for("update");
      codeExists = Boolean(existingByCode);
    }
    if (codeExists) {
      throw new EconomyError("AGENT_CODE_GENERATION_FAILED");
    }

    const [createdAgent] = await tx
      .insert(agents)
      .values({
        code,
        name,
        country_code: countryCode,
        city,
        phone,
        username,
        password_hash: passwordHashValue,
        status,
        commission_type: commissionType,
        commission_value: toNumericSql(commissionValue),
        can_receive_orders: status === "active",
        notes,
        created_at: now,
        updated_at: now,
      })
      .returning();

    if (!createdAgent) {
      throw new EconomyError("AGENT_CREATE_FAILED");
    }

    const [createdWallet] = await tx
      .insert(agent_wallets)
      .values({
        agent_id: createdAgent.id,
        balance_coins: 0,
        reserved_coins: 0,
        status,
        created_at: now,
        updated_at: now,
      })
      .returning();

    return normalizeAgentDashboardRow(createdAgent, createdWallet);
  });
}

export async function adjustSiteMasterWalletAtomic(
  actor: { idreg?: number | string; username?: string; topic?: string } | null | undefined,
  amountRaw: unknown,
  directionRaw: unknown,
  noteRaw: unknown,
) {
  const amount = parsePositiveCoinAmount(amountRaw);
  const direction = String(directionRaw || "").trim().toLowerCase() === "subtract" ? "subtract" : "add";
  const note = normalizeAgentText(noteRaw, 500);
  if (amount < 1) {
    throw new EconomyError("MASTER_AMOUNT_REQUIRED");
  }
  const delta = direction === "subtract" ? -amount : amount;
  const eventType = direction === "subtract" ? "manual_adjustment_subtract" : "manual_adjustment_add";
  const txid = makeCoinTxId("master");

  await ensureSiteMasterWalletReady();
  const { db } = getDb();

  return db.transaction(async (tx) => {
    const [masterRow] = await tx
      .select()
      .from(site_master_wallet)
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID))
      .for("update");
    if (!masterRow) {
      throw new EconomyError("MASTER_WALLET_NOT_FOUND");
    }
    const beforeBalance = Math.max(0, Number(masterRow.balance_coins || 0));
    const afterBalance = beforeBalance + delta;
    if (afterBalance < 0) {
      throw new EconomyError("MASTER_WALLET_INSUFFICIENT");
    }
    const now = Date.now();
    await tx
      .update(site_master_wallet)
      .set({ balance_coins: afterBalance, updated_at: now })
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID));

    await tx.insert(site_master_wallet_ledger).values({
      txid,
      site_id: SITE_MASTER_WALLET_SITE_ID,
      event_type: eventType,
      amount: delta,
      before_balance: beforeBalance,
      after_balance: afterBalance,
      actor_type: "owner",
      actor_id: buildWalletActorLabel(actor),
      counterparty_type: "system",
      counterparty_id: "",
      note,
      reference_table: "site_master_wallet",
      reference_id: masterRow.id,
      created_at: now,
    });

    return { txid, beforeBalance, afterBalance };
  });
}

export async function updateAgentStatusAtomic(
  _actor: unknown,
  agentIdRaw: unknown,
  nextStatusRaw: unknown,
) {
  const agentId = Number.parseInt(String(agentIdRaw || "0"), 10) || 0;
  const nextStatus = normalizeAgentStatus(nextStatusRaw);
  if (agentId < 1) throw new EconomyError("AGENT_ID_INVALID");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [agentRow] = await tx
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .for("update");
    if (!agentRow) throw new EconomyError("AGENT_NOT_FOUND");

    const now = Date.now();
    const [updatedAgent] = await tx
      .update(agents)
      .set({
        status: nextStatus,
        can_receive_orders: nextStatus === "active",
        updated_at: now,
      })
      .where(eq(agents.id, agentId))
      .returning();

    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");

    let updatedWallet = walletRow;
    if (walletRow) {
      const [w] = await tx
        .update(agent_wallets)
        .set({ status: nextStatus, updated_at: now })
        .where(eq(agent_wallets.agent_id, agentId))
        .returning();
      updatedWallet = w ?? walletRow;
    } else {
      const [w] = await tx
        .insert(agent_wallets)
        .values({
          agent_id: agentId,
          balance_coins: 0,
          reserved_coins: 0,
          status: nextStatus,
          created_at: now,
          updated_at: now,
        })
        .returning();
      updatedWallet = w;
    }

    return normalizeAgentDashboardRow(updatedAgent ?? agentRow, updatedWallet);
  });
}

export async function updateAgentCommissionAtomic(
  _actor: unknown,
  agentIdRaw: unknown,
  commissionTypeRaw: unknown,
  commissionValueRaw: unknown,
) {
  const agentId = Number.parseInt(String(agentIdRaw || "0"), 10) || 0;
  const commissionType = normalizeAgentCommissionType(commissionTypeRaw);
  const commissionValue = Math.max(0, roundTopupMoney(commissionValueRaw));
  if (agentId < 1) throw new EconomyError("AGENT_ID_INVALID");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [agentRow] = await tx
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .for("update");
    if (!agentRow) throw new EconomyError("AGENT_NOT_FOUND");

    const [updatedAgent] = await tx
      .update(agents)
      .set({
        commission_type: commissionType,
        commission_value: toNumericSql(commissionValue),
        updated_at: Date.now(),
      })
      .where(eq(agents.id, agentId))
      .returning();

    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId));

    return normalizeAgentDashboardRow(updatedAgent ?? agentRow, walletRow);
  });
}

export async function transferSiteMasterWalletToAgentAtomic(
  actor: { idreg?: number | string; username?: string; topic?: string } | null | undefined,
  payload: Record<string, unknown>,
) {
  const agentId = Number.parseInt(String(payload.agent_id || "0"), 10) || 0;
  const coinsAmount = parsePositiveCoinAmount(payload.coins_amount);
  const note = normalizeAgentText(payload.note, 500);
  const settlementAmountLocal = Math.max(0, Number(payload.settlement_amount_local ?? 0) || 0);
  const currency = normalizeCurrencyCode(payload.currency);

  if (agentId < 1) throw new EconomyError("AGENT_ID_INVALID");
  if (coinsAmount < 1) throw new EconomyError("TRANSFER_AMOUNT_REQUIRED");

  const txid = makeCoinTxId("agent_transfer");
  await ensureSiteMasterWalletReady();
  const { db } = getDb();

  return db.transaction(async (tx) => {
    const [masterRow] = await tx
      .select()
      .from(site_master_wallet)
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID))
      .for("update");
    if (!masterRow) throw new EconomyError("MASTER_WALLET_NOT_FOUND");

    const [agentRow] = await tx
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .for("update");
    if (!agentRow) throw new EconomyError("AGENT_NOT_FOUND");

    let [agentWalletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");

    const now = Date.now();
    if (!agentWalletRow) {
      const [inserted] = await tx
        .insert(agent_wallets)
        .values({
          agent_id: agentId,
          balance_coins: 0,
          reserved_coins: 0,
          status: normalizeAgentStatus(agentRow.status),
          created_at: now,
          updated_at: now,
        })
        .returning();
      agentWalletRow = inserted;
    }

    const masterBefore = Math.max(0, Number(masterRow.balance_coins || 0));
    if (masterBefore < coinsAmount) {
      throw new EconomyError("MASTER_WALLET_INSUFFICIENT");
    }

    const agentBefore = Math.max(0, Number(agentWalletRow?.balance_coins || 0));
    const masterAfter = masterBefore - coinsAmount;
    const agentAfter = agentBefore + coinsAmount;

    await tx
      .update(site_master_wallet)
      .set({ balance_coins: masterAfter, updated_at: now })
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID));

    await tx
      .update(agent_wallets)
      .set({ balance_coins: agentAfter, updated_at: now })
      .where(eq(agent_wallets.agent_id, agentId));

    const actorLabel = buildWalletActorLabel(actor);
    const [transferInsert] = await tx
      .insert(owner_agent_transfers)
      .values({
        txid,
        agent_id: agentId,
        coins_amount: coinsAmount,
        settlement_amount_local: toNumericSql(settlementAmountLocal),
        currency,
        status: "approved",
        note,
        created_by: actorLabel,
        approved_by: actorLabel,
        created_at: now,
        approved_at: now,
      })
      .returning();

    const transferId = Number(transferInsert?.id || 0);

    await tx.insert(site_master_wallet_ledger).values({
      txid,
      site_id: SITE_MASTER_WALLET_SITE_ID,
      event_type: "transfer_to_agent",
      amount: -coinsAmount,
      before_balance: masterBefore,
      after_balance: masterAfter,
      actor_type: "owner",
      actor_id: actorLabel,
      counterparty_type: "agent",
      counterparty_id: String(agentId),
      note,
      reference_table: "owner_agent_transfers",
      reference_id: transferId,
      created_at: now,
    });

    await tx.insert(agent_wallet_ledger).values({
      txid,
      agent_id: agentId,
      event_type: "owner_transfer_in",
      amount: coinsAmount,
      before_balance: agentBefore,
      after_balance: agentAfter,
      actor_type: "owner",
      actor_id: actorLabel,
      counterparty_type: "master_wallet",
      counterparty_id: String(SITE_MASTER_WALLET_SITE_ID),
      note,
      reference_table: "owner_agent_transfers",
      reference_id: transferId,
      created_at: now,
    });

    return {
      txid,
      transferId,
      masterBefore,
      masterAfter,
      agentBefore,
      agentAfter,
      agentName: String(agentRow.name || ""),
    };
  });
}

export async function saveCoinPackageAtomic(
  _actor: unknown,
  payload: Record<string, unknown>,
) {
  const packageId = Number.parseInt(String(payload.id || "0"), 10) || 0;
  const title = normalizeAgentText(payload.title, 255);
  const coinsAmount = parsePositiveCoinAmount(payload.coins_amount);
  const priceLocal = Math.max(0, Number(payload.price_local ?? 0) || 0);
  const currency = normalizeCurrencyCode(payload.currency);
  const countryCode = normalizeTopupCountryCode(payload.country_code);
  const city = normalizeAgentText(payload.city, 255);
  const sortOrder = Number.parseInt(String(payload.sort_order || "0"), 10) || 0;
  const notes = normalizeAgentText(payload.notes, 500);
  const isActive =
    payload.is_active != null ? !/^(0|false|no)$/i.test(String(payload.is_active)) : true;

  if (!title) throw new EconomyError("TOPUP_PACKAGE_TITLE_REQUIRED");
  if (coinsAmount < 1) throw new EconomyError("TOPUP_PACKAGE_COINS_REQUIRED");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const now = Date.now();
    if (packageId > 0) {
      const [existing] = await tx
        .select()
        .from(coin_packages)
        .where(eq(coin_packages.id, packageId))
        .for("update");
      if (!existing) throw new EconomyError("TOPUP_PACKAGE_NOT_FOUND");

      const [updated] = await tx
        .update(coin_packages)
        .set({
          title,
          coins_amount: coinsAmount,
          price_local: toNumericSql(priceLocal),
          currency,
          country_code: countryCode,
          city,
          is_active: isActive,
          sort_order: sortOrder,
          notes,
          updated_at: now,
        })
        .where(eq(coin_packages.id, packageId))
        .returning();
      return normalizeCoinPackageRow(updated);
    }

    const [created] = await tx
      .insert(coin_packages)
      .values({
        title,
        coins_amount: coinsAmount,
        price_local: toNumericSql(priceLocal),
        currency,
        country_code: countryCode,
        city,
        is_active: isActive,
        sort_order: sortOrder,
        notes,
        created_at: now,
        updated_at: now,
      })
      .returning();
    return normalizeCoinPackageRow(created);
  });
}

export async function updateCoinPackageStatusAtomic(
  _actor: unknown,
  packageIdRaw: unknown,
  isActiveRaw: unknown,
) {
  const packageId = Number.parseInt(String(packageIdRaw || "0"), 10) || 0;
  const isActive = !/^(0|false|no)$/i.test(String(isActiveRaw ?? ""));
  if (packageId < 1) throw new EconomyError("TOPUP_PACKAGE_ID_INVALID");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(coin_packages)
      .where(eq(coin_packages.id, packageId))
      .for("update");
    if (!existing) throw new EconomyError("TOPUP_PACKAGE_NOT_FOUND");

    const [updated] = await tx
      .update(coin_packages)
      .set({ is_active: isActive, updated_at: Date.now() })
      .where(eq(coin_packages.id, packageId))
      .returning();
    return normalizeCoinPackageRow(updated);
  });
}

export async function createTopupOrderAtomic(
  userRow: { uid?: string | null; idreg?: number | null; topic?: string | null; username?: string | null },
  payload: Record<string, unknown>,
  sourceIp: string,
) {
  const packageId = Number.parseInt(String(payload.package_id || "0"), 10) || 0;
  const agentId = Number.parseInt(String(payload.agent_id || "0"), 10) || 0;
  const paymentMethodId = Number.parseInt(String(payload.payment_method_id || "0"), 10) || 0;
  const receiptPath = normalizeTopupReceiptPath(payload.receipt_path);
  const paymentReference = normalizeAgentText(payload.payment_reference, 255);
  const paymentNote = normalizeAgentText(payload.payment_note, 500);

  if (!userRow?.uid || !userRow?.idreg) throw new EconomyError("TOPUP_USER_INVALID");
  if (packageId < 1) throw new EconomyError("TOPUP_PACKAGE_ID_INVALID");
  if (agentId < 1) throw new EconomyError("TOPUP_AGENT_ID_INVALID");
  if (paymentMethodId < 1) throw new EconomyError("TOPUP_PAYMENT_METHOD_REQUIRED");
  if (!receiptPath) throw new EconomyError("TOPUP_RECEIPT_REQUIRED");

  const receiptAbsPath = buildTopupReceiptAbsolutePath(receiptPath);
  if (!receiptAbsPath || !fs.existsSync(receiptAbsPath)) {
    throw new EconomyError("TOPUP_RECEIPT_INVALID");
  }

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [packageRow] = await tx
      .select()
      .from(coin_packages)
      .where(eq(coin_packages.id, packageId))
      .for("update");
    if (!packageRow) throw new EconomyError("TOPUP_PACKAGE_NOT_FOUND");
    if (!packageRow.is_active) throw new EconomyError("TOPUP_PACKAGE_INACTIVE");

    const [agentRow] = await tx
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .for("update");
    if (!agentRow) throw new EconomyError("AGENT_NOT_FOUND");

    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");
    if (!walletRow) throw new EconomyError("AGENT_WALLET_NOT_FOUND");

    const normalizedAgent = normalizeAgentDashboardRow(agentRow, walletRow);
    if (
      !normalizedAgent ||
      normalizedAgent.status !== "active" ||
      normalizedAgent.wallet_status !== "active" ||
      !normalizedAgent.can_receive_orders
    ) {
      throw new EconomyError("TOPUP_AGENT_INACTIVE");
    }

    const packageCountry = normalizeTopupCountryCode(packageRow.country_code);
    const agentCountry = normalizeTopupCountryCode(agentRow.country_code);
    if (packageCountry && agentCountry && packageCountry !== agentCountry) {
      throw new EconomyError("TOPUP_AGENT_COUNTRY_MISMATCH");
    }

    const [paymentMethodRow] = await tx
      .select()
      .from(agent_payment_methods)
      .where(eq(agent_payment_methods.id, paymentMethodId))
      .for("update");
    if (
      !paymentMethodRow ||
      Number(paymentMethodRow.agent_id) !== agentId ||
      !paymentMethodRow.is_active
    ) {
      throw new EconomyError("TOPUP_PAYMENT_METHOD_NOT_FOUND");
    }

    const pricing = calculateTopupAgentPricing(
      packageRow.price_local,
      agentRow.commission_type,
      agentRow.commission_value,
    );
    const coinsAmount = Math.max(0, Number(packageRow.coins_amount || 0));
    if (coinsAmount < 1) throw new EconomyError("TOPUP_PACKAGE_COINS_REQUIRED");

    const commissionCoins = calculateTopupAgentCommissionCoins(
      coinsAmount,
      pricing.base_price_local,
      pricing.agent_profit_local,
    );
    const agentBalance = Math.max(0, Number(walletRow.balance_coins || 0));
    const agentReserved = Math.max(0, Number(walletRow.reserved_coins || 0));
    const agentAvailable = Math.max(0, agentBalance - agentReserved);
    if (agentAvailable < coinsAmount) {
      throw new EconomyError("TOPUP_AGENT_AVAILABLE_INSUFFICIENT");
    }

    const orderNo = buildTopupOrderNo();
    const now = Date.now();
    const nextReservedCoins = agentReserved + coinsAmount;

    await tx
      .update(agent_wallets)
      .set({ reserved_coins: nextReservedCoins, updated_at: now })
      .where(eq(agent_wallets.agent_id, agentId));

    const [createdOrder] = await tx
      .insert(topup_orders)
      .values({
        order_no: orderNo,
        user_uid: String(userRow.uid || ""),
        user_idreg: Number.parseInt(String(userRow.idreg || "").replace(/^#/, ""), 10) || 0,
        user_topic: String(userRow.topic || ""),
        user_username: String(userRow.username || ""),
        agent_id: agentId,
        agent_code: String(agentRow.code || ""),
        agent_name: String(agentRow.name || ""),
        agent_phone: String(agentRow.phone || ""),
        agent_country_code: agentCountry,
        agent_city: String(agentRow.city || ""),
        package_id: packageId,
        package_title: String(packageRow.title || ""),
        package_coins: coinsAmount,
        package_price_local: toNumericSql(pricing.base_price_local),
        customer_price_local: toNumericSql(pricing.customer_price_local),
        agent_profit_local: toNumericSql(pricing.agent_profit_local),
        agent_commission_coins: commissionCoins,
        agent_commission_type: pricing.agent_commission_type,
        agent_commission_value: toNumericSql(pricing.agent_commission_value),
        currency: normalizeCurrencyCode(packageRow.currency),
        package_country_code: packageCountry,
        package_city: String(packageRow.city || ""),
        payment_method_id: paymentMethodId,
        payment_method_name: String(paymentMethodRow.method_name || ""),
        payment_method_account_name: String(paymentMethodRow.account_name || ""),
        payment_method_identifier: String(paymentMethodRow.account_identifier || ""),
        receipt_path: receiptPath,
        receipt_uploaded_at: now,
        payment_reference: paymentReference,
        payment_note: paymentNote,
        status: "pending",
        requested_at: now,
        processed_at: 0,
        source_ip: String(sourceIp || ""),
      })
      .returning();

    const orderId = Number(createdOrder?.id || 0);
    const currencyCode = normalizeCurrencyCode(packageRow.currency);
    const eventNoteParts: string[] = [];
    if (paymentMethodRow.method_name) {
      eventNoteParts.push(`وسيلة الدفع: ${paymentMethodRow.method_name}`);
    }
    if (pricing.customer_price_local > 0) {
      eventNoteParts.push(
        `سعر الباقة: ${pricing.customer_price_local}${currencyCode ? ` ${currencyCode}` : ""}`,
      );
    }
    if (pricing.agent_profit_local > 0) {
      eventNoteParts.push(
        `عمولة الوكيل: ${pricing.agent_profit_local}${currencyCode ? ` ${currencyCode}` : ""}`,
      );
    }
    if (commissionCoins > 0) {
      eventNoteParts.push(`عمولة كوين للوكيل: ${commissionCoins}`);
    }
    eventNoteParts.push(`تم حجز ${coinsAmount} coin من رصيد الوكيل`);
    if (paymentReference) eventNoteParts.push(`المرجع: ${paymentReference}`);
    if (receiptPath) eventNoteParts.push("سند مرفق");
    if (paymentNote) eventNoteParts.push(paymentNote);

    await tx.insert(topup_order_events).values({
      order_id: orderId,
      order_no: orderNo,
      event_type: "created",
      old_status: "",
      new_status: "pending",
      actor_type: "user",
      actor_id: buildWalletActorLabel(userRow as { idreg?: number; username?: string; topic?: string }),
      note: eventNoteParts.join(" | "),
      created_at: now,
    });

    if (!createdOrder) {
      throw new EconomyError("TOPUP_ORDER_NOT_FOUND");
    }
    return normalizeTopupOrderRow(createdOrder)!;
  });
}

async function createTopupSettlementEntryTx(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["db"]["transaction"]>[0]>[0],
  txid: string,
  orderRow: typeof topup_orders.$inferSelect,
  actorLabel: string,
  noteText: string,
  createdAt: number,
) {
  await tx.insert(topup_settlement_ledger).values({
    txid,
    order_id: orderRow.id,
    order_no: String(orderRow.order_no || ""),
    event_type: "topup_approved",
    agent_id: Number(orderRow.agent_id || 0),
    agent_name: String(orderRow.agent_name || ""),
    user_uid: String(orderRow.user_uid || ""),
    user_idreg: Number(orderRow.user_idreg || 0),
    package_id: Number(orderRow.package_id || 0),
    package_title: String(orderRow.package_title || ""),
    package_coins: Math.max(0, Number(orderRow.package_coins || 0)),
    currency: normalizeCurrencyCode(orderRow.currency),
    customer_price_local: toNumericSql(
      orderRow.customer_price_local ?? orderRow.package_price_local ?? 0,
    ),
    site_share_local: toNumericSql(orderRow.package_price_local ?? 0),
    agent_profit_local: toNumericSql(orderRow.agent_profit_local ?? 0),
    processed_by: actorLabel,
    note: noteText,
    created_at: createdAt,
  });
}

export async function approveTopupOrderAtomic(
  actor: { idreg?: number | string; username?: string; topic?: string; ip?: string } | null | undefined,
  orderIdRaw: unknown,
  noteRaw: unknown,
) {
  const orderId = Number.parseInt(String(orderIdRaw || "0"), 10) || 0;
  const processedNote = normalizeAgentText(noteRaw, 500);
  if (orderId < 1) throw new EconomyError("TOPUP_ORDER_ID_INVALID");

  const txid = makeCoinTxId("topup");
  await ensureSiteMasterWalletReady();
  const { db } = getDb();

  return db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.id, orderId))
      .for("update");
    if (!orderRow) throw new EconomyError("TOPUP_ORDER_NOT_FOUND");
    if (normalizeTopupOrderStatus(orderRow.status) !== "pending") {
      throw new EconomyError("TOPUP_ORDER_NOT_PENDING");
    }

    const agentId = Number(orderRow.agent_id || 0);
    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");
    if (!walletRow) throw new EconomyError("AGENT_WALLET_NOT_FOUND");

    const [masterRow] = await tx
      .select()
      .from(site_master_wallet)
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID))
      .for("update");
    if (!masterRow) throw new EconomyError("MASTER_WALLET_NOT_FOUND");

    const targetIdreg = Number(orderRow.user_idreg || 0);
    const [userRow] = await tx
      .select({
        idreg: users.idreg,
        uid: users.uid,
        topic: users.topic,
        username: users.username,
        coins: users.coins,
      })
      .from(users)
      .where(eq(users.idreg, targetIdreg))
      .for("update");
    if (!userRow) throw new EconomyError("TOPUP_USER_NOT_FOUND");

    const coinsAmount = Math.max(0, Number(orderRow.package_coins || 0));
    if (coinsAmount < 1) throw new EconomyError("TOPUP_PACKAGE_COINS_REQUIRED");

    const agentBefore = Math.max(0, Number(walletRow.balance_coins || 0));
    const agentReservedBefore = Math.max(0, Number(walletRow.reserved_coins || 0));
    if (agentBefore < coinsAmount) throw new EconomyError("AGENT_WALLET_INSUFFICIENT");

    const commissionCoins = Math.max(
      0,
      Number(orderRow.agent_commission_coins || 0) ||
        calculateTopupAgentCommissionCoins(
          coinsAmount,
          orderRow.package_price_local,
          orderRow.agent_profit_local,
        ),
    );
    const masterBefore = Math.max(0, Number(masterRow.balance_coins || 0));
    const masterAfter = masterBefore - commissionCoins;
    if (masterAfter < 0) throw new EconomyError("MASTER_WALLET_INSUFFICIENT");

    const userBefore = Math.max(0, Number(userRow.coins || 0));
    const agentAfterSale = agentBefore - coinsAmount;
    const agentReservedAfter = Math.max(0, agentReservedBefore - coinsAmount);
    const agentAfter = agentAfterSale + commissionCoins;
    const userAfter = userBefore + coinsAmount;
    const actorLabel = buildWalletActorLabel(actor);
    const now = Date.now();

    await tx
      .update(site_master_wallet)
      .set({ balance_coins: masterAfter, updated_at: now })
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID));

    await tx
      .update(agent_wallets)
      .set({ balance_coins: agentAfter, reserved_coins: agentReservedAfter, updated_at: now })
      .where(eq(agent_wallets.agent_id, agentId));

    await tx
      .update(users)
      .set({ coins: userAfter })
      .where(eq(users.idreg, targetIdreg));

    await tx
      .update(topup_orders)
      .set({
        status: "approved",
        processed_by: actorLabel,
        processed_note: processedNote,
        reject_reason: "",
        processed_at: now,
      })
      .where(eq(topup_orders.id, orderId));

    await tx.insert(topup_order_events).values({
      order_id: orderId,
      order_no: String(orderRow.order_no || ""),
      event_type: "approved",
      old_status: "pending",
      new_status: "approved",
      actor_type: "owner",
      actor_id: actorLabel,
      note:
        (processedNote ? `${processedNote} | ` : "") +
        `الحجز قبل الاعتماد: ${agentReservedBefore} | الحجز بعد الاعتماد: ${agentReservedAfter}`,
      created_at: now,
    });

    await tx.insert(agent_wallet_ledger).values({
      txid,
      agent_id: agentId,
      event_type: "topup_order_sale",
      amount: -coinsAmount,
      before_balance: agentBefore,
      after_balance: agentAfterSale,
      actor_type: "owner",
      actor_id: actorLabel,
      counterparty_type: "user",
      counterparty_id: String(orderRow.user_idreg || ""),
      note: `order ${orderRow.order_no || ""}${processedNote ? ` | ${processedNote}` : ""}`,
      reference_table: "topup_orders",
      reference_id: orderId,
      created_at: now,
    });

    if (commissionCoins > 0) {
      await tx.insert(site_master_wallet_ledger).values({
        txid,
        site_id: SITE_MASTER_WALLET_SITE_ID,
        event_type: "topup_agent_commission",
        amount: -commissionCoins,
        before_balance: masterBefore,
        after_balance: masterAfter,
        actor_type: "owner",
        actor_id: actorLabel,
        counterparty_type: "agent",
        counterparty_id: String(agentId),
        note: `commission for order ${orderRow.order_no || ""}`,
        reference_table: "topup_orders",
        reference_id: orderId,
        created_at: now,
      });

      await tx.insert(agent_wallet_ledger).values({
        txid,
        agent_id: agentId,
        event_type: "topup_order_commission",
        amount: commissionCoins,
        before_balance: agentAfterSale,
        after_balance: agentAfter,
        actor_type: "owner",
        actor_id: actorLabel,
        counterparty_type: "master_wallet",
        counterparty_id: String(SITE_MASTER_WALLET_SITE_ID),
        note: `commission for order ${orderRow.order_no || ""}${processedNote ? ` | ${processedNote}` : ""}`,
        reference_table: "topup_orders",
        reference_id: orderId,
        created_at: now,
      });
    }

    await tx.insert(coin_ledger).values({
      txid,
      event_type: "topup_order_receive",
      actor_uid: "",
      actor_idreg: 0,
      user_uid: String(userRow.uid || ""),
      user_idreg: userRow.idreg,
      counterparty_uid: "",
      counterparty_idreg: 0,
      amount: coinsAmount,
      before_balance: userBefore,
      after_balance: userAfter,
      gift_file: "",
      note: `topup order ${orderRow.order_no || ""} via agent #${agentId}`,
      ip: String(actor?.ip || ""),
      created_at: now,
    });

    await createTopupSettlementEntryTx(
      tx,
      txid,
      orderRow,
      actorLabel,
      `customer=${orderRow.customer_price_local || 0} | site_share=${orderRow.package_price_local || 0} | agent_profit=${orderRow.agent_profit_local || 0} | agent_commission_coins=${commissionCoins}${processedNote ? ` | ${processedNote}` : ""}`,
      now,
    );

    return {
      order: normalizeTopupOrderRow({
        ...orderRow,
        status: "approved",
        processed_by: actorLabel,
        processed_note: processedNote,
        reject_reason: "",
        processed_at: now,
      })!,
      userRow: {
        idreg: userRow.idreg,
        uid: String(userRow.uid || ""),
        topic: String(userRow.topic || ""),
        username: String(userRow.username || ""),
      },
      userAfter,
      agentAfter,
    };
  });
}

export async function rejectTopupOrderAtomic(
  actor: { idreg?: number | string; username?: string; topic?: string } | null | undefined,
  orderIdRaw: unknown,
  reasonRaw: unknown,
) {
  const orderId = Number.parseInt(String(orderIdRaw || "0"), 10) || 0;
  const reason = normalizeAgentText(reasonRaw, 500);
  if (orderId < 1) throw new EconomyError("TOPUP_ORDER_ID_INVALID");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.id, orderId))
      .for("update");
    if (!orderRow) throw new EconomyError("TOPUP_ORDER_NOT_FOUND");
    if (normalizeTopupOrderStatus(orderRow.status) !== "pending") {
      throw new EconomyError("TOPUP_ORDER_NOT_PENDING");
    }

    const agentId = Number(orderRow.agent_id || 0);
    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");

    const actorLabel = buildWalletActorLabel(actor);
    const now = Date.now();
    const coinsAmount = Math.max(0, Number(orderRow.package_coins || 0));
    const agentReservedBefore = Math.max(0, Number(walletRow?.reserved_coins || 0));
    const agentReservedAfter = Math.max(0, agentReservedBefore - coinsAmount);

    if (walletRow) {
      await tx
        .update(agent_wallets)
        .set({ reserved_coins: agentReservedAfter, updated_at: now })
        .where(eq(agent_wallets.agent_id, agentId));
    }

    await tx
      .update(topup_orders)
      .set({
        status: "rejected",
        processed_by: actorLabel,
        processed_note: reason,
        reject_reason: reason,
        processed_at: now,
      })
      .where(eq(topup_orders.id, orderId));

    await tx.insert(topup_order_events).values({
      order_id: orderId,
      order_no: String(orderRow.order_no || ""),
      event_type: "rejected",
      old_status: "pending",
      new_status: "rejected",
      actor_type: "owner",
      actor_id: actorLabel,
      note:
        (reason ? `${reason} | ` : "") +
        `الحجز قبل الرفض: ${agentReservedBefore} | الحجز بعد الرفض: ${agentReservedAfter}`,
      created_at: now,
    });

    return {
      order: normalizeTopupOrderRow({
        ...orderRow,
        status: "rejected",
        processed_by: actorLabel,
        processed_note: reason,
        reject_reason: reason,
        processed_at: now,
      })!,
      userRow: {
        idreg: Number(orderRow.user_idreg || 0),
        uid: String(orderRow.user_uid || ""),
        topic: String(orderRow.user_topic || ""),
        username: String(orderRow.user_username || ""),
      },
    };
  });
}

export async function saveAgentPaymentMethodAtomic(
  agentRow: { id?: number } | null | undefined,
  payload: Record<string, unknown>,
) {
  const agentId = Number(agentRow?.id || 0);
  if (agentId < 1) throw new EconomyError("AGENT_NOT_FOUND");

  const methodId = Number.parseInt(String(payload.id || "0"), 10) || 0;
  const methodName = normalizeAgentText(payload.method_name, 255);
  const accountName = normalizeAgentText(payload.account_name, 255);
  const accountIdentifier = normalizeAgentText(payload.account_identifier, 255);
  const instructions = normalizeAgentText(payload.instructions, 500);
  const sortOrder = Number.parseInt(String(payload.sort_order || "0"), 10) || 0;
  const isActive =
    payload.is_active != null ? !/^(0|false|no)$/i.test(String(payload.is_active)) : true;

  if (!methodName) throw new EconomyError("AGENT_PAYMENT_METHOD_NAME_REQUIRED");
  if (!accountIdentifier) throw new EconomyError("AGENT_PAYMENT_METHOD_ACCOUNT_REQUIRED");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const now = Date.now();
    if (methodId > 0) {
      const [existing] = await tx
        .select()
        .from(agent_payment_methods)
        .where(eq(agent_payment_methods.id, methodId))
        .for("update");
      if (!existing || Number(existing.agent_id) !== agentId) {
        throw new EconomyError("AGENT_PAYMENT_METHOD_NOT_FOUND");
      }
      const [updated] = await tx
        .update(agent_payment_methods)
        .set({
          method_name: methodName,
          account_name: accountName,
          account_identifier: accountIdentifier,
          instructions,
          is_active: isActive,
          sort_order: sortOrder,
          updated_at: now,
        })
        .where(eq(agent_payment_methods.id, methodId))
        .returning();
      return normalizeAgentPaymentMethodRow(updated);
    }

    const [created] = await tx
      .insert(agent_payment_methods)
      .values({
        agent_id: agentId,
        method_name: methodName,
        account_name: accountName,
        account_identifier: accountIdentifier,
        instructions,
        is_active: isActive,
        sort_order: sortOrder,
        created_at: now,
        updated_at: now,
      })
      .returning();
    return normalizeAgentPaymentMethodRow(created);
  });
}

export async function updateAgentPaymentMethodStatusAtomic(
  agentRow: { id?: number } | null | undefined,
  methodIdRaw: unknown,
  isActiveRaw: unknown,
) {
  const agentId = Number(agentRow?.id || 0);
  if (agentId < 1) throw new EconomyError("AGENT_NOT_FOUND");

  const methodId = Number.parseInt(String(methodIdRaw || "0"), 10) || 0;
  const isActive = !/^(0|false|no)$/i.test(String(isActiveRaw ?? ""));
  if (methodId < 1) throw new EconomyError("AGENT_PAYMENT_METHOD_ID_INVALID");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(agent_payment_methods)
      .where(eq(agent_payment_methods.id, methodId))
      .for("update");
    if (!existing || Number(existing.agent_id) !== agentId) {
      throw new EconomyError("AGENT_PAYMENT_METHOD_NOT_FOUND");
    }
    const [updated] = await tx
      .update(agent_payment_methods)
      .set({ is_active: isActive, updated_at: Date.now() })
      .where(eq(agent_payment_methods.id, methodId))
      .returning();
    return normalizeAgentPaymentMethodRow(updated);
  });
}

export async function approveTopupOrderByAgentAtomic(
  agentRow: { id?: number; code?: string; username?: string; name?: string } | null | undefined,
  orderIdRaw: unknown,
  noteRaw: unknown,
) {
  const agentId = Number(agentRow?.id || 0);
  if (agentId < 1) throw new EconomyError("AGENT_NOT_FOUND");
  const orderId = Number.parseInt(String(orderIdRaw || "0"), 10) || 0;
  const processedNote = normalizeAgentText(noteRaw, 500);
  if (orderId < 1) throw new EconomyError("TOPUP_ORDER_ID_INVALID");

  const txid = makeCoinTxId("agent_topup");
  await ensureSiteMasterWalletReady();
  const { db } = getDb();

  return db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.id, orderId))
      .for("update");
    if (!orderRow || Number(orderRow.agent_id) !== agentId) {
      throw new EconomyError("TOPUP_ORDER_NOT_FOUND");
    }
    if (normalizeTopupOrderStatus(orderRow.status) !== "pending") {
      throw new EconomyError("TOPUP_ORDER_NOT_PENDING");
    }

    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");
    if (!walletRow) throw new EconomyError("AGENT_WALLET_NOT_FOUND");

    const [masterRow] = await tx
      .select()
      .from(site_master_wallet)
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID))
      .for("update");
    if (!masterRow) throw new EconomyError("MASTER_WALLET_NOT_FOUND");

    const targetIdreg = Number(orderRow.user_idreg || 0);
    const [userRow] = await tx
      .select({
        idreg: users.idreg,
        uid: users.uid,
        topic: users.topic,
        username: users.username,
        coins: users.coins,
      })
      .from(users)
      .where(eq(users.idreg, targetIdreg))
      .for("update");
    if (!userRow) throw new EconomyError("TOPUP_USER_NOT_FOUND");

    const coinsAmount = Math.max(0, Number(orderRow.package_coins || 0));
    if (coinsAmount < 1) throw new EconomyError("TOPUP_PACKAGE_COINS_REQUIRED");

    const agentBefore = Math.max(0, Number(walletRow.balance_coins || 0));
    const agentReservedBefore = Math.max(0, Number(walletRow.reserved_coins || 0));
    if (agentBefore < coinsAmount) throw new EconomyError("AGENT_WALLET_INSUFFICIENT");

    const commissionCoins = Math.max(
      0,
      Number(orderRow.agent_commission_coins || 0) ||
        calculateTopupAgentCommissionCoins(
          coinsAmount,
          orderRow.package_price_local,
          orderRow.agent_profit_local,
        ),
    );
    const masterBefore = Math.max(0, Number(masterRow.balance_coins || 0));
    const masterAfter = masterBefore - commissionCoins;
    if (masterAfter < 0) throw new EconomyError("MASTER_WALLET_INSUFFICIENT");

    const userBefore = Math.max(0, Number(userRow.coins || 0));
    const agentAfterSale = agentBefore - coinsAmount;
    const agentReservedAfter = Math.max(0, agentReservedBefore - coinsAmount);
    const agentAfter = agentAfterSale + commissionCoins;
    const userAfter = userBefore + coinsAmount;
    const actorLabel = buildAgentActorLabel(agentRow);
    const now = Date.now();

    await tx
      .update(site_master_wallet)
      .set({ balance_coins: masterAfter, updated_at: now })
      .where(eq(site_master_wallet.site_id, SITE_MASTER_WALLET_SITE_ID));

    await tx
      .update(agent_wallets)
      .set({ balance_coins: agentAfter, reserved_coins: agentReservedAfter, updated_at: now })
      .where(eq(agent_wallets.agent_id, agentId));

    await tx
      .update(users)
      .set({ coins: userAfter })
      .where(eq(users.idreg, targetIdreg));

    await tx
      .update(topup_orders)
      .set({
        status: "approved",
        processed_by: actorLabel,
        processed_note: processedNote,
        reject_reason: "",
        processed_at: now,
      })
      .where(eq(topup_orders.id, orderId));

    await tx.insert(topup_order_events).values({
      order_id: orderId,
      order_no: String(orderRow.order_no || ""),
      event_type: "approved",
      old_status: "pending",
      new_status: "approved",
      actor_type: "agent",
      actor_id: actorLabel,
      note:
        (processedNote ? `${processedNote} | ` : "") +
        `الحجز قبل الاعتماد: ${agentReservedBefore} | الحجز بعد الاعتماد: ${agentReservedAfter}`,
      created_at: now,
    });

    await tx.insert(agent_wallet_ledger).values({
      txid,
      agent_id: agentId,
      event_type: "topup_order_sale",
      amount: -coinsAmount,
      before_balance: agentBefore,
      after_balance: agentAfterSale,
      actor_type: "agent",
      actor_id: actorLabel,
      counterparty_type: "user",
      counterparty_id: String(orderRow.user_idreg || ""),
      note: `order ${orderRow.order_no || ""}${processedNote ? ` | ${processedNote}` : ""}`,
      reference_table: "topup_orders",
      reference_id: orderId,
      created_at: now,
    });

    if (commissionCoins > 0) {
      await tx.insert(site_master_wallet_ledger).values({
        txid,
        site_id: SITE_MASTER_WALLET_SITE_ID,
        event_type: "topup_agent_commission",
        amount: -commissionCoins,
        before_balance: masterBefore,
        after_balance: masterAfter,
        actor_type: "agent",
        actor_id: actorLabel,
        counterparty_type: "agent",
        counterparty_id: String(agentId),
        note: `commission for order ${orderRow.order_no || ""}`,
        reference_table: "topup_orders",
        reference_id: orderId,
        created_at: now,
      });

      await tx.insert(agent_wallet_ledger).values({
        txid,
        agent_id: agentId,
        event_type: "topup_order_commission",
        amount: commissionCoins,
        before_balance: agentAfterSale,
        after_balance: agentAfter,
        actor_type: "agent",
        actor_id: actorLabel,
        counterparty_type: "master_wallet",
        counterparty_id: String(SITE_MASTER_WALLET_SITE_ID),
        note: `commission for order ${orderRow.order_no || ""}${processedNote ? ` | ${processedNote}` : ""}`,
        reference_table: "topup_orders",
        reference_id: orderId,
        created_at: now,
      });
    }

    await tx.insert(coin_ledger).values({
      txid,
      event_type: "topup_order_receive",
      actor_uid: "",
      actor_idreg: 0,
      user_uid: String(userRow.uid || ""),
      user_idreg: userRow.idreg,
      counterparty_uid: "",
      counterparty_idreg: 0,
      amount: coinsAmount,
      before_balance: userBefore,
      after_balance: userAfter,
      gift_file: "",
      note: `topup order ${orderRow.order_no || ""} via agent #${agentId}`,
      ip: "",
      created_at: now,
    });

    await createTopupSettlementEntryTx(
      tx,
      txid,
      orderRow,
      actorLabel,
      `customer=${orderRow.customer_price_local || 0} | site_share=${orderRow.package_price_local || 0} | agent_profit=${orderRow.agent_profit_local || 0} | agent_commission_coins=${commissionCoins}${processedNote ? ` | ${processedNote}` : ""}`,
      now,
    );

    return {
      order: normalizeTopupOrderRow({
        ...orderRow,
        status: "approved",
        processed_by: actorLabel,
        processed_note: processedNote,
        reject_reason: "",
        processed_at: now,
      })!,
      userRow: {
        idreg: userRow.idreg,
        uid: String(userRow.uid || ""),
        topic: String(userRow.topic || ""),
        username: String(userRow.username || ""),
      },
      userAfter,
      agentAfter,
    };
  });
}

export async function rejectTopupOrderByAgentAtomic(
  agentRow: { id?: number; code?: string; username?: string; name?: string } | null | undefined,
  orderIdRaw: unknown,
  reasonRaw: unknown,
) {
  const agentId = Number(agentRow?.id || 0);
  if (agentId < 1) throw new EconomyError("AGENT_NOT_FOUND");
  const orderId = Number.parseInt(String(orderIdRaw || "0"), 10) || 0;
  const reason = normalizeAgentText(reasonRaw, 500);
  if (orderId < 1) throw new EconomyError("TOPUP_ORDER_ID_INVALID");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.id, orderId))
      .for("update");
    if (!orderRow || Number(orderRow.agent_id) !== agentId) {
      throw new EconomyError("TOPUP_ORDER_NOT_FOUND");
    }
    if (normalizeTopupOrderStatus(orderRow.status) !== "pending") {
      throw new EconomyError("TOPUP_ORDER_NOT_PENDING");
    }

    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");

    const actorLabel = buildAgentActorLabel(agentRow);
    const now = Date.now();
    const coinsAmount = Math.max(0, Number(orderRow.package_coins || 0));
    const agentReservedBefore = Math.max(0, Number(walletRow?.reserved_coins || 0));
    const agentReservedAfter = Math.max(0, agentReservedBefore - coinsAmount);

    if (walletRow) {
      await tx
        .update(agent_wallets)
        .set({ reserved_coins: agentReservedAfter, updated_at: now })
        .where(eq(agent_wallets.agent_id, agentId));
    }

    await tx
      .update(topup_orders)
      .set({
        status: "rejected",
        processed_by: actorLabel,
        processed_note: reason,
        reject_reason: reason,
        processed_at: now,
      })
      .where(eq(topup_orders.id, orderId));

    await tx.insert(topup_order_events).values({
      order_id: orderId,
      order_no: String(orderRow.order_no || ""),
      event_type: "rejected",
      old_status: "pending",
      new_status: "rejected",
      actor_type: "agent",
      actor_id: actorLabel,
      note:
        (reason ? `${reason} | ` : "") +
        `الحجز قبل الرفض: ${agentReservedBefore} | الحجز بعد الرفض: ${agentReservedAfter}`,
      created_at: now,
    });

    return {
      order: normalizeTopupOrderRow({
        ...orderRow,
        status: "rejected",
        processed_by: actorLabel,
        processed_note: reason,
        reject_reason: reason,
        processed_at: now,
      })!,
      userRow: {
        idreg: Number(orderRow.user_idreg || 0),
        uid: String(orderRow.user_uid || ""),
        topic: String(orderRow.user_topic || ""),
        username: String(orderRow.user_username || ""),
      },
    };
  });
}

export async function expireTopupOrderAtomic(orderIdRaw: unknown, reasonRaw?: unknown) {
  const orderId = Number.parseInt(String(orderIdRaw || "0"), 10) || 0;
  const reason = normalizeAgentText(reasonRaw, 500) || "انتهت مهلة الطلب تلقائيًا";
  if (orderId < 1) throw new EconomyError("TOPUP_ORDER_ID_INVALID");

  const { db } = getDb();
  return db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select()
      .from(topup_orders)
      .where(eq(topup_orders.id, orderId))
      .for("update");
    if (!orderRow) throw new EconomyError("TOPUP_ORDER_NOT_FOUND");
    if (normalizeTopupOrderStatus(orderRow.status) !== "pending") {
      throw new EconomyError("TOPUP_ORDER_NOT_PENDING");
    }

    const agentId = Number(orderRow.agent_id || 0);
    const [walletRow] = await tx
      .select()
      .from(agent_wallets)
      .where(eq(agent_wallets.agent_id, agentId))
      .for("update");

    const now = Date.now();
    const coinsAmount = Math.max(0, Number(orderRow.package_coins || 0));
    const agentReservedBefore = Math.max(0, Number(walletRow?.reserved_coins || 0));
    const agentReservedAfter = Math.max(0, agentReservedBefore - coinsAmount);

    if (walletRow) {
      await tx
        .update(agent_wallets)
        .set({ reserved_coins: agentReservedAfter, updated_at: now })
        .where(eq(agent_wallets.agent_id, agentId));
    }

    await tx
      .update(topup_orders)
      .set({
        status: "cancelled",
        processed_by: "system",
        processed_note: reason,
        reject_reason: reason,
        processed_at: now,
      })
      .where(eq(topup_orders.id, orderId));

    await tx.insert(topup_order_events).values({
      order_id: orderId,
      order_no: String(orderRow.order_no || ""),
      event_type: "expired",
      old_status: "pending",
      new_status: "cancelled",
      actor_type: "system",
      actor_id: "system",
      note: `${reason} | الحجز قبل الإلغاء: ${agentReservedBefore} | الحجز بعد الإلغاء: ${agentReservedAfter}`,
      created_at: now,
    });

    return {
      order: normalizeTopupOrderRow({
        ...orderRow,
        status: "cancelled",
        processed_by: "system",
        processed_note: reason,
        reject_reason: reason,
        processed_at: now,
      })!,
      userRow: {
        idreg: Number(orderRow.user_idreg || 0),
        uid: String(orderRow.user_uid || ""),
        topic: String(orderRow.user_topic || ""),
        username: String(orderRow.user_username || ""),
      },
    };
  });
}

export async function sweepExpiredPendingTopupOrders(limitRaw = 10) {
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(limitRaw || 10), 10) || 10));
  const cutoff = Date.now() - TOPUP_PENDING_EXPIRY_MS;
  const { db } = getDb();
  const rowsRes = await db.execute(sql`
    SELECT id FROM topup_orders
    WHERE status = 'pending' AND requested_at > 0 AND requested_at <= ${cutoff}
    ORDER BY requested_at ASC
    LIMIT ${limit}
  `);

  const results = [];
  for (const row of rowsRes.rows as Array<{ id?: number }>) {
    try {
      const expired = await expireTopupOrderAtomic(row.id, "انتهت مهلة الطلب تلقائيًا");
      results.push(expired);
    } catch (err) {
      if (!isEconomyError(err, "TOPUP_ORDER_NOT_PENDING")) {
        console.error("[Economy] sweepExpiredPendingTopupOrders error:", err);
      }
    }
  }
  return results;
}

export async function transferGiftCoinsAtomic(
  senderInfo: { idreg?: number | string; uid?: string; topic?: string; username?: string },
  receiverInfo: { idreg?: number | string; uid?: string; topic?: string; username?: string },
  selectedGift: string,
  giftCoin: number,
  quantity = 1,
  requestMeta: { requestId?: string; ip?: string } = {},
) {
  const senderIdreg =
    Number.parseInt(String(senderInfo?.idreg || "").replace(/^#/, ""), 10) || 0;
  const receiverIdreg =
    Number.parseInt(String(receiverInfo?.idreg || "").replace(/^#/, ""), 10) || 0;
  if (senderIdreg < 1 || receiverIdreg < 1) {
    throw new EconomyError("INVALID_USER_IDS");
  }

  const safeGiftCoin = Math.max(1, Number.parseInt(String(giftCoin), 10) || 1);
  const safeQuantity = Math.max(1, Number.parseInt(String(quantity), 10) || 1);
  const totalGiftCoin = safeGiftCoin * safeQuantity;
  const platformFeeEstimated = Math.floor((totalGiftCoin * GIFT_PLATFORM_FEE_PERCENT) / 100);
  const receiverCoinEstimated = Math.max(0, totalGiftCoin - platformFeeEstimated);
  const ridPart = requestMeta.requestId ? ` rid=${requestMeta.requestId}` : "";

  try {
    const res = await executeUnifiedGiftTransfer({
      senderIdreg,
      senderUid: senderInfo.uid ? String(senderInfo.uid) : undefined,
      senderIp: String(requestMeta.ip || ""),
      receiverIdreg,
      receiverUid: receiverInfo.uid ? String(receiverInfo.uid) : undefined,
      receiverTopic: receiverInfo.topic || receiverInfo.username,
      giftFile: selectedGift || "",
      unitCoin: safeGiftCoin,
      quantity: safeQuantity,
      noteSender: `gift to #${receiverIdreg} qty=${safeQuantity}${ridPart}`,
      noteReceiver: `gift from #${senderIdreg} qty=${safeQuantity} recv=${receiverCoinEstimated} fee=${platformFeeEstimated}${ridPart}`,
      isOnlineTarget: false,
      sourceType: "api",
    });

    return {
      txid: res.txid,
      senderAfter: res.senderAfter,
      receiverAfter: res.receiverAfter,
      receiverGiftsAfter: res.receiverGiftsAfter,
      quantity: res.quantity,
      totalGiftCoin: res.totalCoin,
      receiverGiftCoin: res.receiverCoin,
      platformFeeCoin: res.platformFee,
      senderUid: res.senderUid,
      receiverUid: res.receiverUid,
    };
  } catch (err: unknown) {
    if (isUnifiedEconomyError(err)) {
      throw new EconomyError(err.code, err.message);
    }
    throw err;
  }
}

export async function addSecretCoinsAtomic(
  actor: { uid?: string; idreg?: number | string; topic?: string; username?: string },
  targetUser: { idreg?: number | string },
  amountRaw: unknown,
  noteRaw: unknown,
  actorIp: string,
) {
  const targetIdreg =
    Number.parseInt(String(targetUser?.idreg || "").replace(/^#/, ""), 10) || 0;
  if (targetIdreg < 1) throw new EconomyError("TARGET_NOT_FOUND");
  const delta = Number.parseInt(String(amountRaw || "0"), 10) || 0;
  if (delta < 1) throw new EconomyError("INVALID_AMOUNT");

  const txid = makeCoinTxId("secret");
  const { db } = getDb();

  return db.transaction(async (tx) => {
    const [userRow] = await tx
      .select({
        idreg: users.idreg,
        uid: users.uid,
        topic: users.topic,
        username: users.username,
        coins: users.coins,
      })
      .from(users)
      .where(eq(users.idreg, targetIdreg))
      .for("update");
    if (!userRow) throw new EconomyError("TARGET_NOT_FOUND");

    const before = Math.max(0, Number(userRow.coins || 0));
    const after = before + delta;
    await tx.update(users).set({ coins: after }).where(eq(users.idreg, targetIdreg));

    const now = Date.now();
    await tx.insert(coin_ledger).values({
      txid,
      event_type: "secret_admin_add",
      actor_uid: String(actor?.uid || ""),
      actor_idreg: Number.parseInt(String(actor?.idreg || "0").replace(/^#/, ""), 10) || 0,
      user_uid: String(userRow.uid || ""),
      user_idreg: targetIdreg,
      counterparty_uid: "",
      counterparty_idreg: 0,
      amount: delta,
      before_balance: before,
      after_balance: after,
      gift_file: "",
      note: String(noteRaw || ""),
      ip: String(actorIp || ""),
      created_at: now,
    });

    await tx.insert(gift_notifications).values({
      txid,
      to_uid: String(userRow.uid || ""),
      to_idreg: targetIdreg,
      from_uid: String(actor?.uid || ""),
      from_idreg: Number.parseInt(String(actor?.idreg || "0").replace(/^#/, ""), 10) || 0,
      from_topic: String(actor?.topic || actor?.username || "الإدارة"),
      gift_file: "",
      coin: delta,
      note: "secret_add",
      is_read: false,
      created_at: now,
      read_at: 0,
    });

    return { txid, before, after, userRow };
  });
}

export async function getSecretCoinsLedger(limit = 30) {
  const { db } = getDb();
  const rows = await db
    .select()
    .from(coin_ledger)
    .orderBy(desc(coin_ledger.created_at), desc(coin_ledger.id))
    .limit(Math.max(1, Math.min(100, limit)));
  return rows.map(normalizeCoinLedgerRow).filter(Boolean);
}

export async function getMasterWalletLedger(limit = 30) {
  const { db } = getDb();
  return db
    .select()
    .from(site_master_wallet_ledger)
    .where(eq(site_master_wallet_ledger.site_id, SITE_MASTER_WALLET_SITE_ID))
    .orderBy(desc(site_master_wallet_ledger.created_at), desc(site_master_wallet_ledger.id))
    .limit(Math.max(1, Math.min(100, limit)));
}
