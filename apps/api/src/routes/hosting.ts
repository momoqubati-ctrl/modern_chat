import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  desc,
  eq,
  getDb,
  hosting_owner_wallet,
  hosting_owner_wallet_ledger,
  ensureGiftSystemTablesExist,
  site_funding_log,
  site_master_wallet,
  site_master_wallet_ledger,
  sql,
} from "@newchat/db";
import { apiConfig } from "../config.js";

const SESSION_COOKIE = "hosting_owner_session";
const SESSION_TTL_SECONDS = 4 * 60 * 60;

function getPortalPath(): string | null {
  const raw = apiConfig.hostingPortalPath.trim().replace(/\/+$/, "");
  if (!raw) return null;
  if (!/^\/[A-Za-z0-9_-]{20,128}(?:\/[A-Za-z0-9_-]{1,64})*$/.test(raw)) {
    throw new Error("HOSTING_PORTAL_PATH must be a long, URL-safe path and cannot be '/'");
  }
  return raw;
}

function getSessionSecret(): string {
  return crypto
    .createHmac("sha256", apiConfig.jwtSecret)
    .update("newchat-hosting-owner-session")
    .digest("hex");
}

function readCookie(req: FastifyRequest): string {
  const header = String(req.headers.cookie || "");
  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === SESSION_COOKIE) return valueParts.join("=");
  }
  return "";
}

function setSessionCookie(reply: FastifyReply, path: string, token: string): void {
  const secure = apiConfig.nodeEnv === "production" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=${path}; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
  );
}

function clearSessionCookie(reply: FastifyReply, path: string): void {
  const secure = apiConfig.nodeEnv === "production" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=${path}; Max-Age=0${secure}`,
  );
}

function verifyOwnerSession(req: FastifyRequest): boolean {
  const token = readCookie(req);
  if (!token) return false;
  try {
    const payload = jwt.verify(token, getSessionSecret(), { issuer: "newchat-hosting" });
    return (
      typeof payload !== "string" &&
      payload.scope === "hosting_owner" &&
      payload.sub === apiConfig.hostingOwnerUsername
    );
  } catch {
    return false;
  }
}

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({ ok: false, message: "Unauthorized" });
}

export async function registerHostingRoutes(app: FastifyInstance): Promise<void> {
  const portalPath = getPortalPath();
  if (!portalPath) {
    if (apiConfig.nodeEnv === "production") {
      throw new Error("HOSTING_PORTAL_PATH is required in production");
    }
    app.log.warn("Hosting owner portal is disabled because HOSTING_PORTAL_PATH is not configured");
    return;
  }

  const hasCredentials =
    Boolean(apiConfig.hostingOwnerUsername) &&
    /^\$2[aby]\$\d{2}\$/.test(apiConfig.hostingOwnerPasswordHash);
  if (!hasCredentials && apiConfig.nodeEnv === "production") {
    throw new Error("HOSTING_OWNER_USERNAME and a bcrypt HOSTING_OWNER_PASSWORD_HASH are required");
  }

  await ensureGiftSystemTablesExist();

  app.get(`${portalPath}/meta`, async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });

  app.post(
    `${portalPath}/login`,
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 60_000,
          keyGenerator: (req: FastifyRequest) => req.ip,
        },
      },
    },
    async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (username.length > 128 || password.length > 128) return unauthorized(reply);
      const passwordMatches = hasCredentials
        ? await bcrypt.compare(password, apiConfig.hostingOwnerPasswordHash)
        : false;
      if (
        !hasCredentials ||
        username !== apiConfig.hostingOwnerUsername ||
        !passwordMatches
      ) {
        return unauthorized(reply);
      }

      const token = jwt.sign(
        { scope: "hosting_owner" },
        getSessionSecret(),
        {
          subject: apiConfig.hostingOwnerUsername,
          issuer: "newchat-hosting",
          expiresIn: SESSION_TTL_SECONDS,
        },
      );
      setSessionCookie(reply, portalPath, token);
      return { ok: true };
    },
  );

  app.post(`${portalPath}/logout`, async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    clearSessionCookie(reply, portalPath);
    return { ok: true };
  });

  app.get(`${portalPath}/dashboard`, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!verifyOwnerSession(req)) return unauthorized(reply);

    const { db } = getDb();
    const [ownerWalletRows, siteWalletRows, earnings, funding] = await Promise.all([
      db.select().from(hosting_owner_wallet).where(eq(hosting_owner_wallet.id, 1)).limit(1),
      db.select().from(site_master_wallet).where(eq(site_master_wallet.site_id, 1)).limit(1),
      db
        .select()
        .from(hosting_owner_wallet_ledger)
        .orderBy(desc(hosting_owner_wallet_ledger.created_at), desc(hosting_owner_wallet_ledger.id))
        .limit(50),
      db
        .select()
        .from(site_funding_log)
        .orderBy(desc(site_funding_log.created_at), desc(site_funding_log.id))
        .limit(50),
    ]);

    return {
      ok: true,
      hostingOwnerBalance: Number(ownerWalletRows[0]?.balance_coins || 0),
      siteWalletBalance: Number(siteWalletRows[0]?.balance_coins || 0),
      earnings,
      funding,
      withdrawalsEnabled: false,
    };
  });

  app.post(`${portalPath}/fund`, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!verifyOwnerSession(req)) return unauthorized(reply);

    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const amount = Number(body.amount_coins);
    const externalRef = String(body.external_ref || "").trim();
    const idempotencyKey = String(body.idempotency_key || "").trim();
    const note = String(body.note || "").trim();
    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > 1_000_000_000 ||
      !externalRef ||
      externalRef.length > 255 ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey) ||
      note.length > 1000
    ) {
      return reply.code(400).send({ ok: false, message: "بيانات الإيداع غير صالحة" });
    }

    const txid = `hosting_fund_${crypto.randomUUID()}`;
    const now = Date.now();
    const { db } = getDb();
    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(site_funding_log)
        .values({
          amount_coins: amount,
          external_ref: externalRef,
          note,
          funded_by: "hosting_owner",
          idempotency_key: idempotencyKey,
          created_at: now,
        })
        .onConflictDoNothing({ target: site_funding_log.idempotency_key })
        .returning({ id: site_funding_log.id });

      if (!inserted[0]) {
        const [existing] = await tx
          .select()
          .from(site_funding_log)
          .where(eq(site_funding_log.idempotency_key, idempotencyKey))
          .limit(1);
        if (!existing) throw new Error("Funding idempotency record disappeared");
        if (
          Number(existing.amount_coins) !== amount ||
          existing.external_ref !== externalRef
        ) {
          return { status: "conflict" as const };
        }
        const [wallet] = await tx
          .select({ balance_coins: site_master_wallet.balance_coins })
          .from(site_master_wallet)
          .where(eq(site_master_wallet.site_id, 1))
          .limit(1);
        return {
          status: "duplicate" as const,
          balance: Number(wallet?.balance_coins || 0),
          funding: existing,
        };
      }

      await tx
        .insert(site_master_wallet)
        .values({
          site_id: 1,
          balance_coins: 0,
          reserved_coins: 0,
          status: "active",
          created_at: now,
          updated_at: now,
        })
        .onConflictDoNothing();
      const lockedWallet = await tx.execute(
        sql`SELECT balance_coins, status FROM site_master_wallet WHERE site_id = 1 FOR UPDATE`,
      );
      const walletRow = lockedWallet.rows[0] as
        | { balance_coins: number | string; status: string }
        | undefined;
      if (!walletRow || walletRow.status !== "active") {
        throw new Error("Site master wallet is unavailable");
      }
      const before = Number(walletRow.balance_coins || 0);
      const after = before + amount;
      if (!Number.isSafeInteger(after)) throw new Error("Site master wallet balance overflow");
      await tx
        .update(site_master_wallet)
        .set({ balance_coins: after, updated_at: now })
        .where(eq(site_master_wallet.site_id, 1));
      await tx.insert(site_master_wallet_ledger).values({
        txid,
        site_id: 1,
        event_type: "owner_funding",
        amount,
        before_balance: before,
        after_balance: after,
        actor_type: "hosting_owner",
        actor_id: apiConfig.hostingOwnerUsername,
        counterparty_type: "external",
        counterparty_id: externalRef,
        note,
        reference_table: "site_funding_log",
        reference_id: inserted[0].id,
        created_at: now,
      });
      const [funding] = await tx
        .select()
        .from(site_funding_log)
        .where(eq(site_funding_log.id, inserted[0].id))
        .limit(1);
      return { status: "funded" as const, balance: after, funding };
    });

    if (result.status === "conflict") {
      return reply.code(409).send({ ok: false, message: "مفتاح الإيداع مستخدم لعملية مختلفة" });
    }
    return {
      ok: true,
      duplicate: result.status === "duplicate",
      balance: result.balance,
      funding: result.funding,
    };
  });

  app.get(`${portalPath}/audit`, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!verifyOwnerSession(req)) return unauthorized(reply);
    const query = req.query as Record<string, unknown>;
    const page = Math.max(1, Math.min(1_000_000, Number.parseInt(String(query.page || "1"), 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(query.limit || "50"), 10) || 50));
    const { db } = getDb();
    const entries = await db
      .select()
      .from(site_funding_log)
      .orderBy(desc(site_funding_log.created_at), desc(site_funding_log.id))
      .limit(limit)
      .offset((page - 1) * limit);
    return { ok: true, page, limit, entries };
  });
}
