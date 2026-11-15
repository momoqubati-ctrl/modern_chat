import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeftRight, CheckCircle2, Coins, Plus, RefreshCw, Store, Wallet, XCircle } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic } from "../../lib/mediaUrl.js";
import type { CpTabProps } from "./CpOverviewLogs.js";

export function CpEconomyTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const [mwAmount, setMwAmount] = useState("1000");
  const [mwDir, setMwDir] = useState<"add" | "subtract">("add");
  const [mwNote, setMwNote] = useState("");

  const [agentForm, setAgentForm] = useState({ name: "", username: "", password: "", country_code: "SA", city: "", phone: "", commission_type: "percent", commission_value: "10" });
  const [transferAgentId, setTransferAgentId] = useState("");
  const [transferCoins, setTransferCoins] = useState("500");
  const [transferPaid, setTransferPaid] = useState("100");
  const [transferCurrency, setTransferCurrency] = useState("SAR");

  const [pkgForm, setPkgForm] = useState({ title: "", coins_amount: "100", price_local: "20", currency: "SAR", country_code: "SA" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApiClient().cpCommand(token, "agent_wallet_dashboard");
      if (res.err) onNotify(String(res.msg || "لا تملك صلاحية"), false);
      else if (res.data) setData(res.data as Record<string, unknown>);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    } finally {
      setLoading(false);
    }
  }, [token, getApiClient, onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  const masterWallet = (data?.masterWallet || {}) as Record<string, unknown>;
  const agents = Array.isArray(data?.agents) ? (data.agents as Array<Record<string, unknown>>) : [];
  const packages = Array.isArray(data?.topupPackages) ? (data.topupPackages as Array<Record<string, unknown>>) : [];
  const pendingOrders = Array.isArray(data?.pendingTopupOrders) ? (data.pendingTopupOrders as Array<Record<string, unknown>>) : [];

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const handleAdjustMaster = async (e: FormEvent) => {
    e.preventDefault();
    const res = await getApiClient().cpCommand(token, "master_wallet_adjust", {
      amount: Number(mwAmount) || 0,
      direction: mwDir,
      note: mwNote.trim(),
    });
    onNotify(String(res.msg || "تم التنفيذ"), !res.err);
    if (!res.err) void load();
  };

  const handleCreateAgent = async (e: FormEvent) => {
    e.preventDefault();
    const res = await getApiClient().cpCommand(token, "agent_wallet_create", { data: agentForm });
    onNotify(String(res.msg || "تم التنفيذ"), !res.err);
    if (!res.err) {
      setAgentForm({ name: "", username: "", password: "", country_code: "SA", city: "", phone: "", commission_type: "percent", commission_value: "10" });
      void load();
    }
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    const res = await getApiClient().cpCommand(token, "owner_agent_transfer", {
      data: {
        agent_id: Number(transferAgentId),
        coins_amount: Number(transferCoins) || 0,
        amount_paid_local: Number(transferPaid) || 0,
        currency: transferCurrency,
      },
    });
    onNotify(String(res.msg || "تم التحويل"), !res.err);
    if (!res.err) void load();
  };

  const handleCreatePkg = async (e: FormEvent) => {
    e.preventDefault();
    const res = await getApiClient().cpCommand(token, "topup_package_save", {
      data: {
        ...pkgForm,
        coins_amount: Number(pkgForm.coins_amount) || 100,
        price_local: Number(pkgForm.price_local) || 1,
        is_active: true,
      },
    });
    onNotify(String(res.msg || "تم الحفظ"), !res.err);
    if (!res.err) {
      setPkgForm({ title: "", coins_amount: "100", price_local: "20", currency: "SAR", country_code: "SA" });
      void load();
    }
  };

  return (
    <div className="space-y-4">
      {/* Master Wallet */}
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-extrabold">محفظة الموقع الرئيسية: {Number(masterWallet.balance_coins || 0)} كوينز</h2>
              <p className="text-[11px] opacity-65">تمويل الوكلاء وإدارة باقات وطلبات الشحن</p>
            </div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="p-2 rounded-xl bg-slate-800 text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <form onSubmit={handleAdjustMaster} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select value={mwDir} onChange={(e) => setMwDir(e.target.value as "add" | "subtract")} className={inputCls}>
            <option value="add">إيداع رصيد</option>
            <option value="subtract">سحب / خصم</option>
          </select>
          <input type="number" min={1} value={mwAmount} onChange={(e) => setMwAmount(e.target.value)} className={inputCls} />
          <input type="text" value={mwNote} onChange={(e) => setMwNote(e.target.value)} placeholder="ملاحظة..." className={inputCls} />
          <button type="submit" className="py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold">
            تنفيذ الحركة
          </button>
        </form>
      </div>

      {/* Pending Topup Orders */}
      <div className={`p-4 rounded-3xl border space-y-2.5 ${cardCls}`}>
        <h3 className="text-xs font-extrabold">طلبات الشحن المعلقة ({pendingOrders.length})</h3>
        {pendingOrders.length === 0 ? (
          <p className="text-xs opacity-60">لا توجد طلبات معلقة</p>
        ) : (
          pendingOrders.map((ord) => (
            <div key={String(ord.id)} className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs ${subCls}`}>
              <div>
                <div className="font-extrabold">
                  {String(ord.order_no)} — {String(ord.user_topic || ord.user_username)} ({Number(ord.package_coins || 0)} كوينز)
                </div>
                <div className="text-[11px] opacity-65">
                  الوكيل: {String(ord.agent_name)} | {formatDateTimeArabic(ord.requested_at)}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await getApiClient().cpCommand(token, "topup_order_approve", { id: ord.id });
                    onNotify(String(res.msg || "تم الاعتماد"), !res.err);
                    void load();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  اعتماد
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await getApiClient().cpCommand(token, "topup_order_reject", { id: ord.id, reason: "مرفوض من الإدارة" });
                    onNotify(String(res.msg || "تم الرفض"), !res.err);
                    void load();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  رفض
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Agents + Transfer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={handleCreateAgent} className={`p-4 rounded-3xl border space-y-2.5 ${cardCls}`}>
          <h3 className="text-xs font-extrabold flex items-center gap-1.5">
            <Store className="w-4 h-4 text-emerald-400" />
            إضافة وكيل شحن
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={agentForm.name} onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))} placeholder="الاسم" required className={inputCls} />
            <input type="text" value={agentForm.username} onChange={(e) => setAgentForm((f) => ({ ...f, username: e.target.value }))} placeholder="اسم المستخدم" required className={inputCls} />
            <input type="password" value={agentForm.password} onChange={(e) => setAgentForm((f) => ({ ...f, password: e.target.value }))} placeholder="كلمة المرور" required className={inputCls} />
            <input type="text" value={agentForm.country_code} onChange={(e) => setAgentForm((f) => ({ ...f, country_code: e.target.value }))} placeholder="الدولة (SA)" className={inputCls} />
          </div>
          <button type="submit" className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold">
            إنشاء الوكيل
          </button>
        </form>

        <form onSubmit={handleTransfer} className={`p-4 rounded-3xl border space-y-2.5 ${cardCls}`}>
          <h3 className="text-xs font-extrabold flex items-center gap-1.5">
            <ArrowLeftRight className="w-4 h-4 text-sky-400" />
            تمويل محفظة وكيل
          </h3>
          <select value={transferAgentId} onChange={(e) => setTransferAgentId(e.target.value)} required className={inputCls}>
            <option value="">اختر الوكيل...</option>
            {agents.map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.name)} (رصيده: {Number(a.wallet_balance_coins || 0)})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min={1} value={transferCoins} onChange={(e) => setTransferCoins(e.target.value)} placeholder="كوينز" className={inputCls} />
            <input type="number" min={0} value={transferPaid} onChange={(e) => setTransferPaid(e.target.value)} placeholder="المدفوع" className={inputCls} />
            <input type="text" value={transferCurrency} onChange={(e) => setTransferCurrency(e.target.value)} placeholder="العملة" className={inputCls} />
          </div>
          <button type="submit" className="w-full py-2 rounded-xl bg-sky-600 text-white text-xs font-extrabold">
            تحويل الكوينز للوكيل
          </button>
        </form>
      </div>

      {/* Agents List & Packages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`p-4 rounded-3xl border space-y-2 ${cardCls}`}>
          <h3 className="text-xs font-extrabold">الوكلاء ({agents.length})</h3>
          {agents.map((a) => (
            <div key={String(a.id)} className={`p-2.5 rounded-2xl border text-xs flex justify-between items-center ${subCls}`}>
              <div>
                <div className="font-extrabold">{String(a.name)} ({String(a.code || a.username)})</div>
                <div className="text-[11px] opacity-65">الرصيد: {Number(a.wallet_balance_coins || 0)} كوينز | الحالة: {String(a.status)}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const nextStatus = a.status === "active" ? "suspended" : "active";
                  await getApiClient().cpCommand(token, "agent_wallet_toggle", { id: a.id, status: nextStatus });
                  void load();
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-700 text-white text-[11px] font-bold"
              >
                {a.status === "active" ? "إيقاف" : "تفعيل"}
              </button>
            </div>
          ))}
        </div>

        <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
          <h3 className="text-xs font-extrabold flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            باقات الشحن ({packages.length})
          </h3>
          <form onSubmit={handleCreatePkg} className="grid grid-cols-2 gap-2">
            <input type="text" value={pkgForm.title} onChange={(e) => setPkgForm((f) => ({ ...f, title: e.target.value }))} placeholder="اسم الباقة" required className={inputCls} />
            <input type="number" min={1} value={pkgForm.coins_amount} onChange={(e) => setPkgForm((f) => ({ ...f, coins_amount: e.target.value }))} placeholder="كوينز" required className={inputCls} />
            <input type="number" min={1} value={pkgForm.price_local} onChange={(e) => setPkgForm((f) => ({ ...f, price_local: e.target.value }))} placeholder="السعر" required className={inputCls} />
            <input type="text" value={pkgForm.currency} onChange={(e) => setPkgForm((f) => ({ ...f, currency: e.target.value }))} placeholder="العملة" required className={inputCls} />
            <button type="submit" className="col-span-2 py-2 rounded-xl bg-amber-600 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              إضافة باقة
            </button>
          </form>
          <div className="space-y-1.5">
            {packages.map((p) => (
              <div key={String(p.id)} className={`p-2 rounded-xl border text-xs flex justify-between items-center ${subCls}`}>
                <span>
                  <strong>{String(p.title)}</strong> — {Number(p.coins_amount)} كوينز ({String(p.price_local)} {String(p.currency)})
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await getApiClient().cpCommand(token, "topup_package_toggle", { id: p.id, active: !p.is_active });
                    void load();
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold text-white ${p.is_active ? "bg-emerald-600" : "bg-slate-600"}`}
                >
                  {p.is_active ? "مفعلة" : "متوقفة"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
