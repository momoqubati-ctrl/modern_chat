import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  CreditCard,
  LogIn,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Sun,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic, resolveAssetUrl } from "../lib/mediaUrl.js";
import { playSoundCue } from "../lib/soundFx.js";

interface AgentPortalPageProps {
  dark: boolean;
  onToggleTheme: () => void;
  onBackToChat: () => void;
}

const AGENT_SID_KEY = "newchat_agent_sid";

export default function AgentPortalPage({
  dark,
  onToggleTheme,
  onBackToChat,
}: AgentPortalPageProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);

  const [sid, setSid] = useState<string>(() => {
    try {
      return window.localStorage.getItem(AGENT_SID_KEY) || "";
    } catch {
      return "";
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<"pending" | "history" | "methods" | "report">("pending");

  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("الإيصال غير واضح أو غير مكتمل");
  const [approveNoteMap, setApproveNoteMap] = useState<Record<number, string>>({});

  // Payment method editor
  const [editingMethodId, setEditingMethodId] = useState<number | null>(null);
  const [methodName, setMethodName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [instructions, setInstructions] = useState("");
  const [sortOrder, setSortOrder] = useState("1");

  const prevPendingCountRef = useRef<number>(0);

  const persistSid = useCallback((nextSid: string) => {
    setSid(nextSid);
    try {
      if (nextSid) window.localStorage.setItem(AGENT_SID_KEY, nextSid);
      else window.localStorage.removeItem(AGENT_SID_KEY);
    } catch {
      // ignore storage quota
    }
  }, []);

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!sid) return;
      if (!silent) setLoading(true);
      try {
        const res = await getApiClient().agentTopupCommand("dashboard", undefined, sid);
        if (res.session?.sid) persistSid(res.session.sid);
        if (res.err) {
          if (String(res.msg || "").includes("الجلسة")) {
            persistSid("");
            setDashboard(null);
          }
          if (!silent) setBannerMsg({ text: res.msg || "تعذر تحميل البيانات", ok: false });
          return;
        }
        if (res.data) {
          const nextPending = Array.isArray((res.data as { pendingOrders?: unknown[] }).pendingOrders)
            ? ((res.data as { pendingOrders: unknown[] }).pendingOrders.length)
            : 0;
          if (silent && nextPending > prevPendingCountRef.current) {
            playSoundCue("notice");
          }
          prevPendingCountRef.current = nextPending;
          setDashboard(res.data);
        }
      } catch (err) {
        if (!silent) {
          setBannerMsg({ text: err instanceof Error ? err.message : "خطأ في الاتصال", ok: false });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [sid, getApiClient, persistSid],
  );

  useEffect(() => {
    if (!sid) return;
    void loadDashboard(false);
    const timer = window.setInterval(() => {
      void loadDashboard(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [sid, loadDashboard]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoggingIn(true);
    setBannerMsg(null);
    try {
      const res = await getApiClient().agentTopupCommand("login", {
        username: username.trim(),
        password,
      });
      if (res.err || !res.session?.sid) {
        setBannerMsg({ text: res.msg || "بيانات الدخول غير صحيحة", ok: false });
        return;
      }
      persistSid(res.session.sid);
      setPassword("");
      setBannerMsg({ text: "تم تسجيل الدخول لبوابة الوكيل", ok: true });
    } catch (err) {
      setBannerMsg({ text: err instanceof Error ? err.message : "تعذر تسجيل الدخول", ok: false });
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (sid) {
      await getApiClient().agentTopupCommand("logout", undefined, sid).catch(() => null);
    }
    persistSid("");
    setDashboard(null);
    setBannerMsg({ text: "تم تسجيل الخروج", ok: true });
  };

  const handleApproveOrder = async (orderId: number) => {
    if (!sid) return;
    try {
      const res = await getApiClient().agentTopupCommand(
        "order_approve",
        { id: orderId, note: approveNoteMap[orderId] || "" },
        sid,
      );
      if (res.session?.sid) persistSid(res.session.sid);
      setBannerMsg({ text: res.msg || (res.err ? "تعذر الاعتماد" : "تم الاعتماد"), ok: !res.err });
      await loadDashboard(false);
    } catch (err) {
      setBannerMsg({ text: err instanceof Error ? err.message : "خطأ", ok: false });
    }
  };

  const handleRejectOrder = async (orderId: number) => {
    if (!sid) return;
    try {
      const res = await getApiClient().agentTopupCommand(
        "order_reject",
        { id: orderId, reason: rejectReason.trim() },
        sid,
      );
      if (res.session?.sid) persistSid(res.session.sid);
      setRejectId(null);
      setBannerMsg({ text: res.msg || (res.err ? "تعذر الرفض" : "تم الرفض"), ok: !res.err });
      await loadDashboard(false);
    } catch (err) {
      setBannerMsg({ text: err instanceof Error ? err.message : "خطأ", ok: false });
    }
  };

  const handleSaveMethod = async (e: FormEvent) => {
    e.preventDefault();
    if (!sid || !methodName.trim() || !accountIdentifier.trim()) return;
    try {
      const res = await getApiClient().agentTopupCommand(
        "payment_method_save",
        {
          data: {
            ...(editingMethodId ? { id: editingMethodId } : {}),
            method_name: methodName.trim(),
            account_name: accountName.trim(),
            account_identifier: accountIdentifier.trim(),
            instructions: instructions.trim(),
            sort_order: Number(sortOrder) || 1,
            is_active: true,
          },
        },
        sid,
      );
      if (res.session?.sid) persistSid(res.session.sid);
      setBannerMsg({ text: res.msg || (res.err ? "تعذر الحفظ" : "تم حفظ وسيلة الدفع"), ok: !res.err });
      if (!res.err) {
        setEditingMethodId(null);
        setMethodName("");
        setAccountName("");
        setAccountIdentifier("");
        setInstructions("");
        setSortOrder("1");
        await loadDashboard(false);
      }
    } catch (err) {
      setBannerMsg({ text: err instanceof Error ? err.message : "خطأ", ok: false });
    }
  };

  const handleToggleMethod = async (id: number, nextActive: boolean) => {
    if (!sid) return;
    try {
      const res = await getApiClient().agentTopupCommand(
        "payment_method_toggle",
        { id, active: nextActive },
        sid,
      );
      if (res.session?.sid) persistSid(res.session.sid);
      setBannerMsg({ text: res.msg || "تم التحديث", ok: !res.err });
      await loadDashboard(false);
    } catch (err) {
      setBannerMsg({ text: err instanceof Error ? err.message : "خطأ", ok: false });
    }
  };

  const pageCls = dark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark
      ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-emerald-500"
      : "bg-white border-slate-300 text-slate-900 focus:border-emerald-600"
  }`;

  const agent = (dashboard?.agent || null) as Record<string, unknown> | null;
  const wallet = (dashboard?.wallet || null) as Record<string, unknown> | null;
  const pendingOrders = Array.isArray(dashboard?.pendingOrders)
    ? (dashboard.pendingOrders as Array<Record<string, unknown>>)
    : [];
  const recentOrders = Array.isArray(dashboard?.recentOrders)
    ? (dashboard.recentOrders as Array<Record<string, unknown>>)
    : [];
  const paymentMethods = Array.isArray(dashboard?.paymentMethods)
    ? (dashboard.paymentMethods as Array<Record<string, unknown>>)
    : [];
  const recentLedger = Array.isArray(dashboard?.recentLedger)
    ? (dashboard.recentLedger as Array<Record<string, unknown>>)
    : [];
  const recentTransfers = Array.isArray(dashboard?.recentTransfers)
    ? (dashboard.recentTransfers as Array<Record<string, unknown>>)
    : [];
  const report = (dashboard?.report || {}) as Record<string, unknown>;

  return (
    <div className={`min-h-screen flex flex-col ${pageCls}`}>
      {/* Header */}
      <header
        className={`border-b px-4 py-3 flex items-center justify-between gap-3 ${
          dark ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold">بوابة وكيل الشحن المعتمد</h1>
            <p className="text-[11px] opacity-65">إدارة الطلبات ووسائل الدفع والمحفظة</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition ${
              dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-100"
            }`}
            aria-label="تبديل المظهر"
          >
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للدردشة
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 space-y-4">
        {bannerMsg && (
          <div
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold ${
              bannerMsg.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {bannerMsg.text}
          </div>
        )}

        {!sid ? (
          <div className="max-w-md mx-auto mt-10">
            <form onSubmit={handleLogin} className={`p-6 rounded-3xl border shadow-xl space-y-4 ${cardCls}`}>
              <div className="text-center space-y-1">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-base font-extrabold">تسجيل دخول الوكيل</h2>
                <p className="text-xs opacity-65">أدخل اسم المستخدم وكلمة المرور الخاصة بحساب الوكيل</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم مستخدم الوكيل"
                  required
                  className={inputCls}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  required
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 transition"
              >
                <LogIn className="w-4 h-4" />
                {loggingIn ? "جارٍ الدخول..." : "دخول لبوابة الوكيل"}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Top Balance & Summary Card */}
            <div className={`p-4 rounded-3xl border flex flex-wrap items-center justify-between gap-4 ${cardCls}`}>
              <div>
                <div className="text-xs opacity-70">مرحباً، {String(agent?.name || "الوكيل")} ({String(agent?.code || "")})</div>
                <div className="text-2xl font-extrabold text-amber-400 flex items-center gap-2 mt-0.5">
                  <Coins className="w-6 h-6" />
                  {Number(wallet?.balance_coins ?? agent?.wallet_balance_coins ?? 0)} كوينز متاح
                </div>
                <div className="text-[11px] opacity-65 mt-0.5">
                  محجوز للطلبات المعلقة: {Number(wallet?.reserved_coins ?? 0)} كوينز | الحالة:{" "}
                  {String(wallet?.status || "active")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadDashboard(false)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  تحديث
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  خروج
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "pending", label: `الطلبات المعلقة (${pendingOrders.length})` },
                { id: "history", label: "الأرشيف والسجل" },
                { id: "methods", label: `وسائل الدفع (${paymentMethods.length})` },
                { id: "report", label: "التقارير والأرباح" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition ${
                    tab === t.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : dark
                        ? "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Pending Orders */}
            {tab === "pending" && (
              <div className="space-y-3">
                {pendingOrders.length === 0 ? (
                  <div className={`p-10 rounded-3xl border text-center text-xs opacity-65 ${cardCls}`}>
                    لا توجد طلبات شحن معلقة حالياً (يتم التحديث تلقائياً كل 5 ثوانٍ)
                  </div>
                ) : (
                  pendingOrders.map((ord) => {
                    const oid = Number(ord.id);
                    const receiptUrl = ord.receipt_path ? resolveAssetUrl(String(ord.receipt_path), "", "") : "";
                    return (
                      <div key={oid} className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-extrabold text-amber-400">{String(ord.order_no || `#${oid}`)}</span>
                            <div className="text-sm font-extrabold mt-0.5">
                              {String(ord.user_topic || ord.user_username || "مستخدم")} (#{String(ord.user_idreg || "-")})
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-extrabold text-emerald-400">
                              {Number(ord.package_coins || 0)} كوينز
                            </div>
                            <div className="text-xs opacity-75">
                              {String(ord.customer_price_local || 0)} {String(ord.currency || "")}
                            </div>
                          </div>
                        </div>

                        <div className={`p-3 rounded-2xl border text-xs grid grid-cols-1 sm:grid-cols-2 gap-2 ${subCls}`}>
                          <div>وسيلة الدفع: <strong>{String(ord.payment_method_name || "-")}</strong></div>
                          <div>المرجع: <strong>{String(ord.payment_reference || "-")}</strong></div>
                          <div>وقت الطلب: <strong>{formatDateTimeArabic(ord.requested_at)}</strong></div>
                          <div>ملاحظة: <strong>{String(ord.payment_note || "-")}</strong></div>
                        </div>

                        {receiptUrl && (
                          <div>
                            <a
                              href={receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded-2xl overflow-hidden border border-slate-700"
                            >
                              <img src={receiptUrl} alt="سند الدفع" className="max-h-48 object-contain bg-black" />
                            </a>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={approveNoteMap[oid] || ""}
                            onChange={(e) => setApproveNoteMap((m) => ({ ...m, [oid]: e.target.value }))}
                            placeholder="ملاحظة الاعتماد (اختياري)..."
                            className={`flex-1 min-w-[180px] ${inputCls}`}
                          />
                          <button
                            type="button"
                            onClick={() => void handleApproveOrder(oid)}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            اعتماد وشحن
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectId(rejectId === oid ? null : oid)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
                          >
                            <XCircle className="w-4 h-4" />
                            رفض
                          </button>
                        </div>

                        {rejectId === oid && (
                          <div className={`p-3 rounded-2xl border flex gap-2 ${subCls}`}>
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="سبب الرفض..."
                              className={inputCls}
                            />
                            <button
                              type="button"
                              onClick={() => void handleRejectOrder(oid)}
                              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shrink-0"
                            >
                              تأكيد الرفض
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* History & Ledger */}
            {tab === "history" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`p-4 rounded-3xl border space-y-2.5 ${cardCls}`}>
                  <h3 className="text-xs font-extrabold">أحدث الطلبات</h3>
                  {recentOrders.length === 0 ? (
                    <p className="text-xs opacity-60">لا توجد طلبات</p>
                  ) : (
                    recentOrders.map((o, i) => (
                      <div key={String(o.id || i)} className={`p-2.5 rounded-2xl border text-xs flex justify-between gap-2 ${subCls}`}>
                        <div>
                          <div className="font-bold">{String(o.order_no)} — {String(o.user_topic || o.user_username)}</div>
                          <div className="text-[10px] opacity-65">{Number(o.package_coins || 0)} كوينز | {formatDateTimeArabic(o.requested_at)}</div>
                        </div>
                        <span className="font-extrabold text-[11px]">{String(o.status)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-4">
                  <div className={`p-4 rounded-3xl border space-y-2.5 ${cardCls}`}>
                    <h3 className="text-xs font-extrabold">دفتر محفظة الوكيل</h3>
                    {recentLedger.map((l, i) => (
                      <div key={String(l.id || i)} className={`p-2.5 rounded-2xl border text-xs flex justify-between gap-2 ${subCls}`}>
                        <div>
                          <div className="font-bold">{String(l.note || l.event_type)}</div>
                          <div className="text-[10px] opacity-65">{formatDateTimeArabic(l.created_at)}</div>
                        </div>
                        <span className={`font-mono font-bold ${Number(l.amount) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {Number(l.amount) >= 0 ? `+${Number(l.amount)}` : String(l.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={`p-4 rounded-3xl border space-y-2.5 ${cardCls}`}>
                    <h3 className="text-xs font-extrabold">التحويلات من الإدارة</h3>
                    {recentTransfers.length === 0 ? (
                      <p className="text-xs opacity-60">لا توجد تحويلات مسجلة</p>
                    ) : (
                      recentTransfers.map((tr, i) => (
                        <div key={String(tr.id || i)} className={`p-2.5 rounded-2xl border text-xs flex justify-between gap-2 ${subCls}`}>
                          <div>
                            <div className="font-bold">تمويل {Number(tr.coins_amount || 0)} كوينز</div>
                            <div className="text-[10px] opacity-65">{String(tr.note || "-")}</div>
                          </div>
                          <span className="text-[10px] opacity-70">{formatDateTimeArabic(tr.created_at)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Methods */}
            {tab === "methods" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <form onSubmit={handleSaveMethod} className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
                  <h3 className="text-xs font-extrabold flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    {editingMethodId ? "تعديل وسيلة دفع" : "إضافة وسيلة دفع جديدة"}
                  </h3>
                  <input
                    type="text"
                    value={methodName}
                    onChange={(e) => setMethodName(e.target.value)}
                    placeholder="اسم البنك / المحفظة (مثلاً: الراجحي)"
                    required
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="اسم صاحب الحساب"
                    required
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={accountIdentifier}
                    onChange={(e) => setAccountIdentifier(e.target.value)}
                    placeholder="رقم الحساب / الآيبان / رقم الهاتف"
                    required
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="تعليمات إضافية للعميل (اختياري)"
                    className={inputCls}
                  />
                  <input
                    type="number"
                    min={1}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    placeholder="الترتيب"
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
                    >
                      حفظ وسيلة الدفع
                    </button>
                    {editingMethodId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMethodId(null);
                          setMethodName("");
                          setAccountName("");
                          setAccountIdentifier("");
                          setInstructions("");
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>

                <div className="space-y-2.5">
                  {paymentMethods.map((m) => {
                    const mid = Number(m.id);
                    const isActive = m.is_active !== false;
                    return (
                      <div key={mid} className={`p-3.5 rounded-3xl border space-y-2 ${cardCls}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold inline-flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-sky-400" />
                            {String(m.method_name)}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMethodId(mid);
                                setMethodName(String(m.method_name || ""));
                                setAccountName(String(m.account_name || ""));
                                setAccountIdentifier(String(m.account_identifier || ""));
                                setInstructions(String(m.instructions || ""));
                                setSortOrder(String(m.sort_order || 1));
                              }}
                              className="text-[11px] text-sky-400 hover:underline font-bold"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleMethod(mid, !isActive)}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                                isActive ? "text-emerald-400" : "text-slate-400"
                              }`}
                            >
                              {isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                              {isActive ? "مفعلة" : "معطلة"}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs opacity-80">{String(m.account_name)} — <code>{String(m.account_identifier)}</code></div>
                        {Boolean(m.instructions) && <p className="text-[11px] opacity-65">{String(m.instructions)}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Report */}
            {tab === "report" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "معتمدة اليوم", val: Number(report.approved_orders_today || 0) },
                  { label: "كوينز اليوم", val: Number(report.approved_coins_today || 0) },
                  { label: "معتمدة الشهر", val: Number(report.approved_orders_month || 0) },
                  { label: "كوينز الشهر", val: Number(report.approved_coins_month || 0) },
                  { label: "ربح الوكيل اليوم", val: Number(report.approved_profit_today_local || 0) },
                  { label: "ربح الوكيل الشهر", val: Number(report.approved_profit_month_local || 0) },
                ].map((item) => (
                  <div key={item.label} className={`p-4 rounded-3xl border text-center ${cardCls}`}>
                    <div className="text-lg font-extrabold text-amber-400">{item.val}</div>
                    <div className="text-xs opacity-70 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
