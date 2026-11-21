import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { REDIS_KEYS, coin_ledger, desc, eq, getDb, getRedis } from "@newchat/db";
import {
  TOPUP_CREATE_IDEMPOTENCY_TTL_MS,
  TOPUP_CREATE_RATE_LIMIT_MAX,
  TOPUP_CREATE_RATE_LIMIT_WINDOW_MS,
  verAdminPanel,
  verOwner,
} from "@newchat/shared";
import { apiConfig } from "../config.js";
import {
  applyCoinsToOnlineUser,
  buildAgentPanelSession,
  clearBruteForceSlot,
  clearRedisIdempotentKey,
  consumeBruteForceSlot,
  createSecretCoinsSession,
  deleteSecretCoinsSession,
  emitTopupAdminNotification,
  emitTopupUserNotification,
  extractRequestParams,
  extractRequestToken,
  getPowersList,
  getRequestRealIp,
  getValidSecretCoinsSession,
  isSecretCoinsKeyValid,
  isSecretCoinsOwnerCredentialValid,
  resolveUserActorByToken,
  safeJsonParse,
  savestate,
  verifyAgentPanelToken,
} from "../lib/runtime.js";
import {
  addSecretCoinsAtomic,
  adjustSiteMasterWalletAtomic,
  approveTopupOrderByAgentAtomic,
  buildWalletActorLabel,
  createTopupOrderAtomic,
  getAgentPanelDashboard,
  getCoinTopupUserDashboard,
  getCoinWalletCenterDashboard,
  getMasterWalletLedger,
  getSecretMasterWalletSnapshot,
  isEconomyError,
  normalizeCoinLedgerRow,
  rejectTopupOrderByAgentAtomic,
  resolveActiveAgentPanelActor,
  resolveUserByCoinsTarget,
  saveAgentPaymentMethodAtomic,
  updateAgentPaymentMethodStatusAtomic,
  verifyAgentCredentials,
} from "../services/economy.js";

function parseJsonParamObject(raw: unknown): Record<string, any> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = safeJsonParse<unknown>(raw, null);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  }
  return null;
}

function buildTopupCreateIdempotencyKey(uid: string, payload: Record<string, any>): string {
  const canonical = JSON.stringify({
    uid,
    package_id: Number(payload.package_id || payload.packageId || 0),
    agent_id: Number(payload.agent_id || payload.agentId || 0),
    payment_method_id: Number(payload.payment_method_id || payload.paymentMethodId || 0),
    receipt_path: String(payload.receipt_path || payload.receiptPath || "").trim(),
    payment_reference: String(payload.payment_reference || payload.paymentReference || "").trim(),
    payment_note: String(payload.payment_note || payload.paymentNote || "").trim(),
    idempotency_key: String(payload.idempotency_key || payload.idempotencyKey || "").trim(),
  });
  return `topup:${crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}

async function beginTopupIdempotent(
  key: string,
): Promise<{ ok: true } | { ok: false; cachedResponse?: unknown }> {
  const fullKey = REDIS_KEYS.idempotencyPrefix + key;
  try {
    const redis = getRedis();
    const setRes = await redis.set(
      fullKey,
      JSON.stringify({ status: "pending", ts: Date.now() }),
      "PX",
      TOPUP_CREATE_IDEMPOTENCY_TTL_MS,
      "NX",
    );
    if (setRes === "OK") {
      return { ok: true };
    }
    const existingRaw = await redis.get(fullKey);
    const parsed = safeJsonParse<{ status?: string; response?: unknown } | null>(existingRaw, null);
    if (parsed && parsed.status === "done" && parsed.response) {
      return { ok: false, cachedResponse: parsed.response };
    }
    return { ok: false };
  } catch {
    return { ok: true };
  }
}

async function completeTopupIdempotent(key: string, response: unknown): Promise<void> {
  const fullKey = REDIS_KEYS.idempotencyPrefix + key;
  await getRedis()
    .set(
      fullKey,
      JSON.stringify({ status: "done", response, ts: Date.now() }),
      "PX",
      TOPUP_CREATE_IDEMPOTENCY_TTL_MS,
    )
    .catch(() => null);
}

async function takeTopupRateLimitSlot(uid: string): Promise<boolean> {
  if (!uid) return true;
  const key = `newchat:rl:topup:${uid}`;
  try {
    const redis = getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, TOPUP_CREATE_RATE_LIMIT_WINDOW_MS);
    }
    return count <= TOPUP_CREATE_RATE_LIMIT_MAX;
  } catch {
    return true;
  }
}

function mapTopupCreateErrorMessage(err: unknown): string {
  if (!isEconomyError(err)) {
    return "تعذر إنشاء طلب الشحن";
  }
  switch (err.code) {
    case "TOPUP_PACKAGE_ID_INVALID":
      return "الرجاء اختيار الباقة";
    case "TOPUP_AGENT_ID_INVALID":
      return "الرجاء اختيار الوكيل";
    case "TOPUP_AGENT_AVAILABLE_INSUFFICIENT":
      return "رصيد الوكيل المتاح لا يكفي لهذه الباقة حاليًا";
    case "TOPUP_PAYMENT_METHOD_REQUIRED":
      return "الرجاء اختيار وسيلة الدفع";
    case "TOPUP_RECEIPT_REQUIRED":
      return "الرجاء رفع سند الدفع";
    case "TOPUP_PACKAGE_NOT_FOUND":
      return "الباقة غير موجودة";
    case "TOPUP_PACKAGE_INACTIVE":
      return "هذه الباقة غير مفعلة حاليًا";
    case "TOPUP_AGENT_INACTIVE":
      return "هذا الوكيل غير متاح حاليًا";
    case "TOPUP_AGENT_COUNTRY_MISMATCH":
      return "هذا الوكيل غير مخصص لهذه الباقة";
    case "TOPUP_PAYMENT_METHOD_NOT_FOUND":
      return "وسيلة الدفع المختارة غير متاحة لهذا الوكيل";
    case "TOPUP_RECEIPT_INVALID":
      return "سند الدفع المرفوع غير صالح";
    case "AGENT_NOT_FOUND":
      return "الوكيل غير موجود";
    default:
      return "تعذر إنشاء طلب الشحن";
  }
}

function buildSecretCoinsHtml(secretCoinsApiPath: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>لوحة كوينز سرية</title>
  <style>
    body{font-family:Tahoma,Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px}
    .box{max-width:760px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:10px;padding:16px}
    h2{margin:0 0 12px}
    .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
    input,button,select{padding:10px;border:1px solid #bbb;border-radius:8px}
    input,select{flex:1;min-width:220px}
    button{cursor:pointer}
    .ok{color:#0a7a2a}
    .err{color:#b00020}
    pre{white-space:pre-wrap;background:#fafafa;border:1px solid #eee;padding:10px;border-radius:8px}
  </style>
</head>
<body>
  <div class="box">
    <h2>لوحة التحكم السرية للكوينز</h2>
    <p>الدخول عبر Session آمن مدته 10 دقائق.</p>
    <div class="row">
      <input id="k" placeholder="Secret Key" />
      <input id="t" placeholder="Owner Token" />
    </div>
    <div class="row">
      <input id="ou" placeholder="Owner Username (اختياري مع token)" />
      <input id="op" type="password" placeholder="Owner Password (اختياري مع token)" />
    </div>
    <div class="row">
      <input id="u" placeholder="المستخدم المستهدف (username أو #idreg)" />
      <input id="a" type="number" min="1" value="1" placeholder="عدد الكوينز للإضافة" />
    </div>
    <div class="row">
      <input id="n" placeholder="ملاحظة اختيارية لسبب الإضافة" />
    </div>
    <div class="row">
      <button onclick="loginSession()">تسجيل دخول</button>
      <button onclick="logoutSession()">تسجيل خروج</button>
    </div>
    <div class="row">
      <button onclick="lookupUser()">فحص المستخدم</button>
      <button onclick="addCoins()">إضافة كوينز</button>
      <button onclick="viewLedger()">سجل الكوينز</button>
    </div>
    <hr>
    <h3 style="margin:12px 0 8px;">محفظة الشات</h3>
    <div class="row">
      <input id="mwBalance" placeholder="رصيد محفظة الشات" readonly />
      <input id="mwStatus" placeholder="حالة محفظة الشات" readonly />
    </div>
    <div class="row">
      <select id="mwDirection">
        <option value="add">إضافة</option>
        <option value="subtract">خصم</option>
      </select>
      <input id="mwAmount" type="number" min="1" value="1" placeholder="عدد الكوينز" />
      <input id="mwNote" placeholder="ملاحظة اختيارية" />
    </div>
    <div class="row">
      <button onclick="loadChatWallet()">عرض المحفظة</button>
      <button onclick="adjustChatWallet()">تنفيذ الحركة</button>
      <button onclick="viewChatWalletLedger()">سجل المحفظة</button>
    </div>
    <div id="sess"></div>
    <div id="m"></div>
    <pre id="out"></pre>
  </div>
  <script>
    const apiPath = ${JSON.stringify(secretCoinsApiPath)};
    let sid = "";
    let exp = 0;
    function q(v){ return encodeURIComponent(v || ""); }
    function setMsg(txt, ok){
      const el = document.getElementById("m");
      el.className = ok ? "ok" : "err";
      el.textContent = txt || "";
    }
    function refreshSessView(){
      const now = Date.now();
      const el = document.getElementById("sess");
      if(!sid || !exp || exp <= now){
        sid = "";
        exp = 0;
        sessionStorage.removeItem("coins_sid");
        sessionStorage.removeItem("coins_exp");
        el.className = "err";
        el.textContent = "لا يوجد Session فعال";
        return;
      }
      const left = Math.ceil((exp - now) / 1000);
      el.className = "ok";
      el.textContent = "Session فعال - ينتهي بعد " + left + " ثانية";
    }
    function payloadAuthBase(cmd){
      return "cmd=" + q(cmd) +
        "&key=" + q(document.getElementById("k").value) +
        "&token=" + q(document.getElementById("t").value) +
        "&owner_user=" + q(document.getElementById("ou").value) +
        "&owner_pass=" + q(document.getElementById("op").value);
    }
    function payloadWithSession(cmd){
      return "cmd=" + q(cmd) +
        "&key=" + q(document.getElementById("k").value) +
        "&sid=" + q(sid) +
        "&target=" + q(document.getElementById("u").value);
    }
    function payloadSessionOnly(cmd){
      return "cmd=" + q(cmd) +
        "&key=" + q(document.getElementById("k").value) +
        "&sid=" + q(sid);
    }
    function syncSessionExpiry(d){
      if(d.session && d.session.expiresAt){
        exp = Number(d.session.expiresAt || exp);
        sessionStorage.setItem("coins_exp", String(exp));
      }
    }
    function renderWalletSummary(wallet){
      const safeWallet = wallet || {};
      document.getElementById("mwBalance").value = String(Number(safeWallet.balance_coins || 0)) + " coin";
      document.getElementById("mwStatus").value = String(safeWallet.status || "active");
    }
    function loginSession(){
      const url = apiPath + "?" + payloadAuthBase("login");
      fetch(url).then(r=>r.json()).then(d=>{
        if(d.err){ setMsg(d.msg || "فشل تسجيل الدخول", false); return; }
        sid = d.msg.sid || "";
        exp = Number(d.msg.expiresAt || 0);
        sessionStorage.setItem("coins_sid", sid);
        sessionStorage.setItem("coins_exp", String(exp));
        setMsg("تم تسجيل الدخول بنجاح", true);
        document.getElementById("out").textContent = JSON.stringify(d.msg, null, 2);
        refreshSessView();
      }).catch(()=>setMsg("تعذر الاتصال", false));
    }
    function logoutSession(){
      if(!sid){ refreshSessView(); return; }
      const url = apiPath + "?" + "cmd=logout&key=" + q(document.getElementById("k").value) + "&sid=" + q(sid);
      fetch(url).then(()=>{}).catch(()=>{});
      sid = "";
      exp = 0;
      sessionStorage.removeItem("coins_sid");
      sessionStorage.removeItem("coins_exp");
      setMsg("تم تسجيل الخروج", true);
      refreshSessView();
    }
    function lookupUser(){
      const url = apiPath + "?" + payloadWithSession("lookup");
      fetch(url).then(r=>r.json()).then(d=>{
        if(d.err){ setMsg(d.msg || "فشل الفحص", false); return; }
        setMsg("تم جلب بيانات المستخدم", true);
        syncSessionExpiry(d);
        document.getElementById("out").textContent = JSON.stringify(d.msg, null, 2);
        refreshSessView();
      }).catch(()=>setMsg("تعذر الاتصال", false));
    }
    function addCoins(){
      const amount = document.getElementById("a").value;
      const note = document.getElementById("n").value;
      const url = apiPath + "?" + payloadWithSession("add") + "&amount=" + q(amount) + "&note=" + q(note);
      fetch(url).then(r=>r.json()).then(d=>{
        if(d.err){ setMsg(d.msg || "فشل الإضافة", false); return; }
        setMsg("تمت إضافة الكوينز بنجاح", true);
        syncSessionExpiry(d);
        document.getElementById("out").textContent = JSON.stringify(d.msg, null, 2);
        refreshSessView();
      }).catch(()=>setMsg("تعذر الاتصال", false));
    }
    function viewLedger(){
      const url = apiPath + "?" + payloadWithSession("ledger");
      fetch(url).then(r=>r.json()).then(d=>{
        if(d.err){ setMsg(d.msg || "فشل جلب السجل", false); return; }
        setMsg("تم جلب سجل الكوينز", true);
        syncSessionExpiry(d);
        document.getElementById("out").textContent = JSON.stringify(d.msg, null, 2);
        refreshSessView();
      }).catch(()=>setMsg("تعذر الاتصال", false));
    }
    function loadChatWallet(){
      const url = apiPath + "?" + payloadSessionOnly("wallet");
      fetch(url).then(r=>r.json()).then(d=>{
        if(d.err){ setMsg(d.msg || "فشل جلب محفظة الشات", false); return; }
        setMsg("تم جلب محفظة الشات", true);
        syncSessionExpiry(d);
        renderWalletSummary(d.msg || {});
        document.getElementById("out").textContent = JSON.stringify(d.msg, null, 2);
        refreshSessView();
      }).catch(()=>setMsg("تعذر الاتصال", false));
    }
    function adjustChatWallet(){
      const direction = document.getElementById("mwDirection").value;
      const amount = document.getElementById("mwAmount").value;
      const note = document.getElementById("mwNote").value;
      const url = apiPath + "?" + payloadSessionOnly("wallet_adjust") + "&direction=" + q(direction) + "&amount=" + q(amount) + "&note=" + q(note);
      fetch(url).then(r=>r.json()).then(d=>{
        if(d.err){ setMsg(d.msg || "فشل تعديل محفظة الشات", false); return; }
        setMsg("تم تعديل محفظة الشات بنجاح", true);
        syncSessionExpiry(d);
        renderWalletSummary(d.msg && d.msg.wallet ? d.msg.wallet : {});
        document.getElementById("out").textContent = JSON.stringify(d.msg, null, 2);
        refreshSessView();
      }).catch(()=>setMsg("تعذر الاتصال", false));
    }
    function viewChatWalletLedger(){
      const url = apiPath + "?" + payloadSessionOnly("wallet_ledger");
      fetch(url).then(r=>r.json()).then(d=>{
        if(d.err){ setMsg(d.msg || "فشل جلب سجل محفظة الشات", false); return; }
        setMsg("تم جلب سجل محفظة الشات", true);
        syncSessionExpiry(d);
        renderWalletSummary(d.msg && d.msg.wallet ? d.msg.wallet : {});
        document.getElementById("out").textContent = JSON.stringify(d.msg, null, 2);
        refreshSessView();
      }).catch(()=>setMsg("تعذر الاتصال", false));
    }
    sid = sessionStorage.getItem("coins_sid") || "";
    exp = Number(sessionStorage.getItem("coins_exp") || 0);
    refreshSessView();
    if(sid && exp > Date.now()){
      loadChatWallet();
    }
    setInterval(refreshSessView, 1000);
  </script>
</body>
</html>`;
}

async function handleWalletTopupRequest(req: FastifyRequest, reply: FastifyReply) {
  try {
    const params = extractRequestParams(req);
    const cmd = String(params.cmd || "").trim().toLowerCase();
    if (!cmd) {
      return reply.send({ err: true, msg: "cmd is required" });
    }

    const tokenValue = extractRequestToken(req);
    if (!tokenValue) {
      return reply.send({ err: true, msg: "غير مصرح" });
    }

    const userRow = await resolveUserActorByToken(tokenValue);
    if (!userRow || !userRow.uid) {
      return reply.send({ err: true, msg: "يجب تسجيل الدخول أولاً" });
    }

    if (cmd === "dashboard") {
      try {
        const snapshot = await getCoinTopupUserDashboard(userRow);
        return reply.send({ err: false, data: snapshot });
      } catch {
        return reply.send({ err: true, msg: "تعذر تحميل بيانات الشحن" });
      }
    }

    if (cmd !== "create") {
      return reply.send({ err: true, msg: "cmd غير مدعوم" });
    }

    const payload = parseJsonParamObject(params.data) || parseJsonParamObject(req.body);
    if (!payload) {
      return reply.send({ err: true, msg: "بيانات الطلب غير صالحة" });
    }

    const idemKey = buildTopupCreateIdempotencyKey(String(userRow.uid || ""), payload);
    const idem = await beginTopupIdempotent(idemKey);
    if (!idem.ok) {
      if (idem.cachedResponse) {
        return reply.send(idem.cachedResponse);
      }
      return reply.send({
        err: true,
        msg: "طلب الشحن قيد المعالجة، انتظر قليلًا قبل إعادة المحاولة",
      });
    }

    const rateOk = await takeTopupRateLimitSlot(String(userRow.uid || ""));
    if (!rateOk) {
      await clearRedisIdempotentKey(idemKey);
      return reply.send({
        err: true,
        msg: "تم تجاوز الحد المسموح لإنشاء طلبات الشحن، أعد المحاولة بعد ثوان",
      });
    }

    const clientIp = getRequestRealIp(req) || "";
    try {
      const orderRow = await createTopupOrderAtomic(userRow, payload, clientIp);
      await emitTopupAdminNotification({
        ...orderRow,
        event_type: "created",
        old_status: "",
        new_status: "pending",
        actor_type: "user",
        actor_id: buildWalletActorLabel(userRow),
        note: orderRow.payment_reference || orderRow.payment_note || "",
        created_at: orderRow.requested_at || Date.now(),
        order_status: orderRow.status,
      });
      await savestate({
        state: "إنشاء طلب شحن",
        topic: userRow.topic || userRow.username || "",
        topic1: String(orderRow.order_no || ""),
        room: "",
        ip: clientIp,
        time: Date.now(),
      });

      const successResponse = {
        err: false,
        msg: "تم إنشاء طلب الشحن بنجاح، تواصل مع الوكيل لإتمام الدفع",
        data: orderRow,
      };
      await completeTopupIdempotent(idemKey, successResponse);
      return reply.send(successResponse);
    } catch (err) {
      await clearRedisIdempotentKey(idemKey);
      return reply.send({ err: true, msg: mapTopupCreateErrorMessage(err) });
    }
  } catch {
    return reply.code(500).send({ err: true, msg: "Server Error" });
  }
}

async function handleWalletCenterRequest(req: FastifyRequest, reply: FastifyReply) {
  try {
    const params = extractRequestParams(req);
    const cmd = String(params.cmd || "").trim().toLowerCase();
    if (cmd !== "dashboard") {
      return reply.send({ err: true, msg: "cmd غير مدعوم" });
    }
    const tokenValue = extractRequestToken(req);
    if (!tokenValue) {
      return reply.send({ err: true, msg: "غير مصرح" });
    }
    const userRow = await resolveUserActorByToken(tokenValue);
    if (!userRow || !userRow.uid) {
      return reply.send({ err: true, msg: "يجب تسجيل الدخول أولاً" });
    }
    const snapshot = await getCoinWalletCenterDashboard(userRow);
    return reply.send({ err: false, data: snapshot });
  } catch {
    return reply.send({ err: true, msg: "تعذر تحميل بيانات المحفظة" });
  }
}

async function handleAgentTopupRequest(req: FastifyRequest, reply: FastifyReply) {
  try {
    const params = extractRequestParams(req);
    const cmd = String(params.cmd || "").trim().toLowerCase();
    if (!cmd) {
      return reply.send({ err: true, msg: "cmd is required" });
    }

    if (cmd === "login") {
      const username = String(params.username || "").trim().toLowerCase();
      const password = String(params.password || "");
      if (!username || !password) {
        return reply.send({ err: true, msg: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      const bruteKey = `${getRequestRealIp(req) || "unknown-ip"}:${username}`;
      const brute = await consumeBruteForceSlot("agent-login", bruteKey);
      if (brute.blocked) {
        reply.header("Retry-After", String(brute.retryAfterSec));
        return reply.code(429).send({
          err: true,
          msg: "محاولات دخول كثيرة، انتظر قليلاً قبل المحاولة مرة أخرى",
        });
      }
      const agentRow = await verifyAgentCredentials(username, password);
      if (!agentRow || !agentRow.id) {
        return reply.send({ err: true, msg: "بيانات الدخول غير صحيحة" });
      }
      await clearBruteForceSlot("agent-login", bruteKey);
      const agentActor = await resolveActiveAgentPanelActor(agentRow.id);
      if (!agentActor) {
        return reply.send({ err: true, msg: "حساب الوكيل غير مفعل حالياً" });
      }
      const sessionRow = buildAgentPanelSession(agentActor);
      return reply.send({
        err: false,
        msg: "تم تسجيل الدخول بنجاح",
        session: {
          sid: sessionRow.sid,
          ttlMs: apiConfig.agentPanelSessionTtlMs,
          expiresAt: sessionRow.expiresAt,
        },
        data: sessionRow.agent,
      });
    }

    if (cmd === "logout") {
      return reply.send({ err: false, msg: "logged_out" });
    }

    const sidToken =
      String(params.sid || "").trim() ||
      String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    const verified = verifyAgentPanelToken(sidToken);
    if (!verified || !verified.agentId) {
      return reply.send({ err: true, msg: "انتهت الجلسة، سجل دخول من جديد" });
    }

    const agentActor = await resolveActiveAgentPanelActor(verified.agentId);
    if (!agentActor) {
      return reply.send({ err: true, msg: "حساب الوكيل غير مفعل حالياً" });
    }

    const refreshed = buildAgentPanelSession(agentActor);
    const refreshedSessionMeta = {
      sid: refreshed.sid,
      expiresAt: refreshed.expiresAt,
      ttlMs: apiConfig.agentPanelSessionTtlMs,
    };

    if (cmd === "dashboard") {
      try {
        const snapshot = await getAgentPanelDashboard(agentActor);
        return reply.send({
          err: false,
          session: refreshedSessionMeta,
          data: snapshot,
        });
      } catch {
        return reply.send({ err: true, msg: "تعذر تحميل لوحة الوكيل" });
      }
    }

    if (cmd === "payment_method_save") {
      const payload = parseJsonParamObject(params.data) || parseJsonParamObject(req.body);
      if (!payload) {
        return reply.send({ err: true, msg: "بيانات وسيلة الدفع غير صالحة" });
      }
      try {
        const row = await saveAgentPaymentMethodAtomic(agentActor, payload);
        return reply.send({
          err: false,
          msg: "تم حفظ وسيلة الدفع",
          session: refreshedSessionMeta,
          data: row,
        });
      } catch (err) {
        if (isEconomyError(err, "AGENT_PAYMENT_METHOD_NAME_REQUIRED")) {
          return reply.send({ err: true, msg: "اسم وسيلة الدفع مطلوب" });
        }
        if (isEconomyError(err, "AGENT_PAYMENT_METHOD_ACCOUNT_REQUIRED")) {
          return reply.send({ err: true, msg: "رقم الحساب أو المعرف مطلوب" });
        }
        if (isEconomyError(err, "AGENT_PAYMENT_METHOD_NOT_FOUND")) {
          return reply.send({ err: true, msg: "وسيلة الدفع غير موجودة" });
        }
        return reply.send({ err: true, msg: "تعذر حفظ وسيلة الدفع" });
      }
    }

    if (cmd === "payment_method_toggle") {
      try {
        const row = await updateAgentPaymentMethodStatusAtomic(
          agentActor,
          params.id,
          params.active,
        );
        return reply.send({
          err: false,
          msg: "تم تحديث حالة وسيلة الدفع",
          session: refreshedSessionMeta,
          data: row,
        });
      } catch (err) {
        if (isEconomyError(err, "AGENT_PAYMENT_METHOD_NOT_FOUND")) {
          return reply.send({ err: true, msg: "وسيلة الدفع غير موجودة" });
        }
        return reply.send({ err: true, msg: "تعذر تحديث حالة وسيلة الدفع" });
      }
    }

    if (cmd === "order_approve") {
      try {
        const result = await approveTopupOrderByAgentAtomic(
          agentActor,
          params.id,
          params.note,
        );
        await applyCoinsToOnlineUser(result.userRow, result.userAfter);
        await emitTopupUserNotification(
          result.userRow,
          `تم اعتماد طلب الشحن رقم ${String(result.order.order_no || "")}`,
          result.userAfter,
        );
        await emitTopupAdminNotification({
          ...result.order,
          event_type: "approved",
          old_status: "pending",
          new_status: "approved",
          actor_type: "agent",
          actor_id: String(
            agentActor.name || agentActor.username || agentActor.code || agentActor.id || "",
          ),
          note: result.order.processed_note || "",
          created_at: result.order.processed_at || Date.now(),
          order_status: result.order.status,
        });
        return reply.send({
          err: false,
          msg: "تم اعتماد طلب الشحن",
          session: refreshedSessionMeta,
          data: result.order,
        });
      } catch (err) {
        if (isEconomyError(err, "TOPUP_ORDER_NOT_FOUND")) {
          return reply.send({ err: true, msg: "طلب الشحن غير موجود" });
        }
        if (isEconomyError(err, "TOPUP_ORDER_NOT_PENDING")) {
          return reply.send({ err: true, msg: "الطلب لم يعد معلقاً" });
        }
        if (isEconomyError(err, "AGENT_WALLET_INSUFFICIENT")) {
          return reply.send({ err: true, msg: "رصيدك غير كاف لاعتماد هذا الطلب" });
        }
        if (isEconomyError(err, "MASTER_WALLET_INSUFFICIENT")) {
          return reply.send({
            err: true,
            msg: "رصيد محفظة الشات غير كاف لإيداع عمولة هذا الطلب",
          });
        }
        return reply.send({ err: true, msg: "تعذر اعتماد الطلب" });
      }
    }

    if (cmd === "order_reject") {
      try {
        const result = await rejectTopupOrderByAgentAtomic(
          agentActor,
          params.id,
          params.reason,
        );
        await emitTopupUserNotification(
          result.userRow,
          `تم رفض طلب الشحن رقم ${String(result.order.order_no || "")}${
            result.order.reject_reason ? ` | ${result.order.reject_reason}` : ""
          }`,
          null,
        );
        await emitTopupAdminNotification({
          ...result.order,
          event_type: "rejected",
          old_status: "pending",
          new_status: "rejected",
          actor_type: "agent",
          actor_id: String(
            agentActor.name || agentActor.username || agentActor.code || agentActor.id || "",
          ),
          note: result.order.reject_reason || result.order.processed_note || "",
          created_at: result.order.processed_at || Date.now(),
          order_status: result.order.status,
        });
        return reply.send({
          err: false,
          msg: "تم رفض طلب الشحن",
          session: refreshedSessionMeta,
          data: result.order,
        });
      } catch (err) {
        if (isEconomyError(err, "TOPUP_ORDER_NOT_FOUND")) {
          return reply.send({ err: true, msg: "طلب الشحن غير موجود" });
        }
        if (isEconomyError(err, "TOPUP_ORDER_NOT_PENDING")) {
          return reply.send({ err: true, msg: "الطلب لم يعد معلقاً" });
        }
        return reply.send({ err: true, msg: "تعذر رفض الطلب" });
      }
    }

    return reply.send({ err: true, msg: "cmd غير مدعوم" });
  } catch {
    return reply.code(500).send({ err: true, msg: "Server Error" });
  }
}

async function handleSecretCoinsApiRequest(req: FastifyRequest, reply: FastifyReply) {
  try {
    const params = extractRequestParams(req);
    const bruteKey = getRequestRealIp(req) || "unknown-ip";
    const brute = await consumeBruteForceSlot("coins", bruteKey);
    if (brute.blocked) {
      reply.header("Retry-After", String(brute.retryAfterSec));
      return reply.code(429).send({ err: true, msg: "محاولات كثيرة، حاول بعد دقائق" });
    }

    if (!apiConfig.secretCoinsEnabled || !isSecretCoinsKeyValid(params.key)) {
      return reply.code(404).send({ err: true, msg: "Not Found" });
    }

    const cmd = String(params.cmd || "").trim().toLowerCase();
    if (!cmd) {
      return reply.send({ err: true, msg: "cmd is required" });
    }

    if (cmd === "login") {
      const tokenValue = String(params.token || "").trim();
      const ownerUser = String(params.owner_user || "").trim();
      const ownerPass = String(params.owner_pass || "").trim();
      let actor: {
        topic: string;
        username: string;
        ip: string;
        power: string;
        uid?: string;
        idreg?: number;
      } | null = null;

      if (tokenValue) {
        const actorByToken = await resolveUserActorByToken(tokenValue);
        if (actorByToken) {
          const powersList = await getPowersList();
          if (
            verAdminPanel(powersList, actorByToken.power) &&
            verOwner(powersList, actorByToken.power)
          ) {
            actor = {
              topic: actorByToken.topic || actorByToken.username,
              username: actorByToken.username,
              ip: getRequestRealIp(req) || actorByToken.ip || "",
              power: actorByToken.power || "",
              uid: actorByToken.uid || undefined,
              idreg: actorByToken.idreg,
            };
          }
        }
      }

      if (!actor && isSecretCoinsOwnerCredentialValid(ownerUser, ownerPass)) {
        actor = {
          topic: ownerUser,
          username: ownerUser,
          ip: getRequestRealIp(req) || "",
          power: "owner",
        };
      }

      if (!actor) {
        return reply.send({ err: true, msg: "غير مصرح" });
      }

      await clearBruteForceSlot("coins", bruteKey);
      const sess = await createSecretCoinsSession(actor);
      return reply.send({
        err: false,
        msg: {
          sid: sess.sid,
          ttlMs: apiConfig.secretCoinsSessionTtlMs,
          expiresAt: sess.expiresAt,
        },
      });
    }

    if (cmd === "logout") {
      await deleteSecretCoinsSession(params.sid);
      return reply.send({ err: false, msg: "logged_out" });
    }

    const sessionRow = await getValidSecretCoinsSession(params.sid);
    if (!sessionRow) {
      return reply.send({ err: true, msg: "انتهت الجلسة، سجل دخول من جديد" });
    }
    const actor = sessionRow.actor;
    const sessionMeta = {
      expiresAt: sessionRow.expiresAt,
      ttlMs: apiConfig.secretCoinsSessionTtlMs,
    };

    if (cmd === "wallet") {
      try {
        const wallet = await getSecretMasterWalletSnapshot();
        return reply.send({ err: false, session: sessionMeta, msg: wallet });
      } catch {
        return reply.send({ err: true, msg: "تعذر جلب محفظة الشات" });
      }
    }

    if (cmd === "wallet_ledger") {
      try {
        const [wallet, rows] = await Promise.all([
          getSecretMasterWalletSnapshot(),
          getMasterWalletLedger(100),
        ]);
        return reply.send({
          err: false,
          session: sessionMeta,
          msg: { wallet, rows: rows || [] },
        });
      } catch {
        return reply.send({ err: true, msg: "تعذر جلب سجل محفظة الشات" });
      }
    }

    if (cmd === "wallet_adjust") {
      const amount = Number.parseInt(String(params.amount || ""), 10);
      const direction =
        String(params.direction || "").trim().toLowerCase() === "subtract"
          ? "subtract"
          : "add";
      if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) {
        return reply.send({ err: true, msg: "amount غير صالح (1 - 1000000000)" });
      }
      if (direction === "add") {
        return reply.send({
          err: true,
          msg: "تغذية محفظة الموقع مقتصرة حصرياً على بوابة مالك الاستضافة",
        });
      }
      const note = String(params.note || "").trim();
      try {
        const result = await adjustSiteMasterWalletAtomic(actor, amount, direction, note);
        const wallet = await getSecretMasterWalletSnapshot();
        await savestate({
          state:
            direction === "subtract"
              ? "خصم من محفظة الشات عبر اللوحة السرية"
              : "إضافة إلى محفظة الشات عبر اللوحة السرية",
          topic: actor.topic || actor.username || "",
          topic1: "",
          room: `amount=${amount}${note ? ` note=${note}` : ""}`,
          ip: actor.ip || getRequestRealIp(req) || "",
          time: Date.now(),
        });
        return reply.send({
          err: false,
          session: sessionMeta,
          msg: {
            txid: result.txid,
            before: result.beforeBalance,
            amount,
            after: result.afterBalance,
            wallet,
          },
        });
      } catch (err) {
        if (isEconomyError(err, "MASTER_WALLET_INSUFFICIENT")) {
          return reply.send({ err: true, msg: "رصيد محفظة الشات غير كاف" });
        }
        return reply.send({ err: true, msg: "فشل تعديل محفظة الشات" });
      }
    }

    const targetValue = String(params.target || "").trim();
    const targetUser = await resolveUserByCoinsTarget(targetValue);
    if (!targetUser) {
      return reply.send({ err: true, msg: "المستخدم غير موجود" });
    }
    const currentCoins = Math.max(0, Number.parseInt(String(targetUser.coins ?? 0), 10) || 0);

    if (cmd === "ledger") {
      try {
        const { db } = getDb();
        const rawRows = targetUser.uid
          ? await db
              .select()
              .from(coin_ledger)
              .where(eq(coin_ledger.user_uid, String(targetUser.uid)))
              .orderBy(desc(coin_ledger.created_at), desc(coin_ledger.id))
              .limit(100)
          : [];
        const rows = rawRows.map((r) => normalizeCoinLedgerRow(r)).filter(Boolean);
        return reply.send({
          err: false,
          session: sessionMeta,
          msg: {
            idreg: targetUser.idreg,
            username: targetUser.username,
            topic: targetUser.topic,
            coins: currentCoins,
            rows,
          },
        });
      } catch {
        return reply.send({ err: true, msg: "تعذر جلب السجل" });
      }
    }

    if (cmd === "lookup") {
      return reply.send({
        err: false,
        session: sessionMeta,
        msg: {
          idreg: targetUser.idreg,
          username: targetUser.username,
          topic: targetUser.topic,
          coins: currentCoins,
        },
      });
    }

    if (cmd !== "add") {
      return reply.send({ err: true, msg: "cmd غير مدعوم" });
    }

    const amount = Number.parseInt(String(params.amount || ""), 10);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000) {
      return reply.send({ err: true, msg: "amount غير صالح (1 - 1000000000)" });
    }
    const note = String(params.note || "").trim();
    try {
      const txResult = await addSecretCoinsAtomic(
        actor,
        targetUser,
        amount,
        note,
        actor.ip || getRequestRealIp(req) || "",
      );
      const nextCoins = Math.max(0, Number.parseInt(String(txResult.after ?? 0), 10) || 0);
      await applyCoinsToOnlineUser(targetUser, nextCoins);
      await savestate({
        state: "إضافة coin سرية",
        topic: actor.topic || actor.username || "",
        topic1: targetUser.topic || targetUser.username || "",
        room: `amount=${amount}${note ? ` note=${note}` : ""}`,
        ip: actor.ip || "",
        time: Date.now(),
      });
      return reply.send({
        err: false,
        session: sessionMeta,
        msg: {
          idreg: targetUser.idreg,
          username: targetUser.username,
          topic: targetUser.topic,
          before: txResult.before,
          amount,
          after: nextCoins,
          coins: nextCoins,
        },
      });
    } catch {
      return reply.send({ err: true, msg: "فشل حفظ البيانات" });
    }
  } catch {
    return reply.code(500).send({ err: true, msg: "Server Error" });
  }
}

export async function registerWalletRoutes(app: FastifyInstance) {
  app.get("/wallet/topup.nd", handleWalletTopupRequest);
  app.post("/wallet/topup.nd", handleWalletTopupRequest);

  app.get("/wallet/center.nd", handleWalletCenterRequest);
  app.post("/wallet/center.nd", handleWalletCenterRequest);

  app.get("/agent/topup.nd", handleAgentTopupRequest);
  app.post("/agent/topup.nd", handleAgentTopupRequest);

  app.get("/agent/topup", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return reply.redirect("/agent-topup.html");
  });

  if (apiConfig.secretCoinsEnabled) {
    app.get(apiConfig.secretCoinsPath, async (req, reply) => {
      const q = req.query as { key?: string };
      const brute = await consumeBruteForceSlot("coins-page", getRequestRealIp(req) || "unknown-ip");
      if (brute.blocked) {
        reply.header("Retry-After", String(brute.retryAfterSec));
        return reply.code(429).type("text/plain; charset=utf-8").send("Too Many Requests");
      }
      if (!isSecretCoinsKeyValid(q.key)) {
        return reply.code(404).type("text/plain; charset=utf-8").send("Page Not Found 404");
      }
      await clearBruteForceSlot("coins-page", getRequestRealIp(req) || "unknown-ip");
      reply.header("Cache-Control", "no-store");
      return reply
        .type("text/html; charset=utf-8")
        .send(buildSecretCoinsHtml(apiConfig.secretCoinsApiPath));
    });

    app.get(apiConfig.secretCoinsApiPath, handleSecretCoinsApiRequest);
    app.post(apiConfig.secretCoinsApiPath, handleSecretCoinsApiRequest);
  }
}
