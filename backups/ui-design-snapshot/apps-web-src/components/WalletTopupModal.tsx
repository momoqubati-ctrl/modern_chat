import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  FileImage,
  RefreshCw,
  Send,
  Upload,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic, resolveAssetUrl } from "../lib/mediaUrl.js";

interface WalletTopupModalProps {
  dark: boolean;
  open: boolean;
  onClose: () => void;
}

interface PackageRow {
  id: number;
  title: string;
  coins_amount: number;
  price_local: number | string;
  currency: string;
  country_code?: string;
  city?: string;
  is_active?: boolean;
  notes?: string;
}

interface PaymentMethodRow {
  id: number;
  method_name: string;
  account_name: string;
  account_identifier: string;
  instructions?: string;
  is_active?: boolean;
}

interface AgentRow {
  id: number;
  code?: string;
  name: string;
  country_code?: string;
  city?: string;
  phone?: string;
  wallet_balance_coins?: number;
  payment_methods: PaymentMethodRow[];
}

interface OrderRow {
  id: number;
  order_no: string;
  package_title: string;
  package_coins: number;
  customer_price_local: number | string;
  currency: string;
  agent_name: string;
  payment_method_name: string;
  receipt_path?: string;
  payment_reference?: string;
  payment_note?: string;
  status: string;
  reject_reason?: string;
  requested_at?: number;
}

interface LedgerRow {
  id: number;
  txid: string;
  event_type: string;
  amount: number;
  before_balance: number;
  after_balance: number;
  note?: string;
  created_at?: number;
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `topup_${crypto.randomUUID()}`;
  }
  return `topup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function WalletTopupModal({ dark, open, onClose }: WalletTopupModalProps) {
  const me = useChatStore((s) => s.me);
  const sessionToken = useChatStore((s) => s.sessionToken);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [tab, setTab] = useState<"overview" | "topup" | "orders">("overview");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [selectedPkgId, setSelectedPkgId] = useState<number>(0);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(0);
  const [selectedMethodId, setSelectedMethodId] = useState<number>(0);
  const [receiptPath, setReceiptPath] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());
  const [submitting, setSubmitting] = useState(false);

  const isMember = Boolean(sessionToken && me?.islogin === "عضو");

  const loadData = useCallback(async () => {
    if (!sessionToken || !isMember) return;
    setLoading(true);
    try {
      const api = getApiClient();
      const [centerRes, topupRes] = await Promise.all([
        api.getWalletCenterDashboard(sessionToken),
        api.getTopupUserDashboard(sessionToken),
      ]);
      if (!centerRes.err && centerRes.data) {
        const d = centerRes.data as Record<string, unknown>;
        if (d.summary && typeof d.summary === "object") {
          setSummary(d.summary as Record<string, number>);
        }
        if (Array.isArray(d.ledger)) {
          setLedger(d.ledger as LedgerRow[]);
        }
      }
      if (!topupRes.err && topupRes.data) {
        const d = topupRes.data as Record<string, unknown>;
        const pkgs = Array.isArray(d.packages) ? (d.packages as PackageRow[]) : [];
        const agts = Array.isArray(d.agents) ? (d.agents as AgentRow[]) : [];
        const ords = Array.isArray(d.orders) ? (d.orders as OrderRow[]) : [];
        setPackages(pkgs);
        setAgents(agts);
        setOrders(ords);
        if (pkgs.length > 0 && !selectedPkgId) setSelectedPkgId(pkgs[0]!.id);
        if (agts.length > 0 && !selectedAgentId) {
          setSelectedAgentId(agts[0]!.id);
          const firstMethod = agts[0]!.payment_methods?.[0];
          if (firstMethod) setSelectedMethodId(firstMethod.id);
        }
      }
    } catch (err) {
      pushNotice(err instanceof Error ? err.message : "تعذر تحميل بيانات المحفظة", { topic: "المحفظة" });
    } finally {
      setLoading(false);
    }
  }, [sessionToken, isMember, getApiClient, pushNotice, selectedPkgId, selectedAgentId]);

  useEffect(() => {
    if (open && isMember) {
      void loadData();
    }
  }, [open, isMember, loadData]);

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPkgId) ?? null,
    [packages, selectedPkgId],
  );

  const sortedAgents = useMemo(() => {
    const pkgCc = String(selectedPackage?.country_code || "").trim().toUpperCase();
    return [...agents].sort((a, b) => {
      const aMatch = pkgCc && String(a.country_code || "").toUpperCase() === pkgCc ? 1 : 0;
      const bMatch = pkgCc && String(b.country_code || "").toUpperCase() === pkgCc ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [agents, selectedPackage]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? sortedAgents[0] ?? null,
    [agents, selectedAgentId, sortedAgents],
  );

  const activeMethods = useMemo(
    () => (selectedAgent?.payment_methods ?? []).filter((m) => m.is_active !== false),
    [selectedAgent],
  );

  useEffect(() => {
    if (!activeMethods.length) {
      setSelectedMethodId(0);
    } else if (!activeMethods.some((m) => m.id === selectedMethodId)) {
      setSelectedMethodId(activeMethods[0]!.id);
    }
  }, [activeMethods, selectedMethodId]);

  if (!open) return null;

  const handleUploadReceipt = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !sessionToken) return;
    setUploadingReceipt(true);
    try {
      const res = await getApiClient().uploadTopupReceipt(file, sessionToken, file.name);
      if (res.err || !res.data?.receipt_path) {
        throw new Error(res.msg || "فشل رفع الإيصال");
      }
      setReceiptPath(res.data.receipt_path);
      pushNotice("تم رفع صورة الإيصال بنجاح", { topic: "الشحن" });
    } catch (err) {
      pushNotice(err instanceof Error ? err.message : "تعذر رفع صورة الإيصال", { topic: "الشحن" });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmitOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !selectedPackage || !selectedAgent || !selectedMethodId) {
      pushNotice("يرجى اختيار الباقة والوكيل وطريقة الدفع", { topic: "الشحن" });
      return;
    }
    if (!receiptPath) {
      pushNotice("يرجى رفع صورة إيصال التحويل أولاً", { topic: "الشحن" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await getApiClient().createTopupOrder(sessionToken, {
        package_id: selectedPackage.id,
        agent_id: selectedAgent.id,
        payment_method_id: selectedMethodId,
        receipt_path: receiptPath,
        payment_reference: paymentRef.trim(),
        payment_note: paymentNote.trim(),
        idempotency_key: idempotencyKey,
      });
      if (res.err) {
        throw new Error(res.msg || "تعذر إنشاء طلب الشحن");
      }
      pushNotice(res.msg || "تم إرسال طلب الشحن بنجاح", { topic: "الشحن", force: 1 });
      setReceiptPath("");
      setPaymentRef("");
      setPaymentNote("");
      setIdempotencyKey(makeIdempotencyKey());
      setTab("orders");
      await loadData();
    } catch (err) {
      pushNotice(err instanceof Error ? err.message : "فشل إرسال الطلب", { topic: "الشحن" });
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      pushNotice("تم النسخ للحافظة", { topic: "المحفظة" });
    } catch {
      // ignore clipboard restrictions
    }
  };

  const myCoins = Number(me?.coins ?? me?.coin ?? 0);
  const modalCls = dark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900";
  const cardCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark
      ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-amber-500"
      : "bg-white border-slate-300 text-slate-900 focus:border-amber-600"
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${modalCls}`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">محفظة الكوينز والشحن</h3>
              <p className="text-[11px] opacity-65">الرصيد الحالي: {myCoins} كوينز</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isMember && (
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="p-2 rounded-xl hover:bg-slate-800/50 transition"
                title="تحديث"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800/50 transition"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMember ? (
          <div className="p-8 text-center space-y-2">
            <Coins className="w-10 h-10 mx-auto text-amber-400 opacity-80" />
            <div className="text-sm font-extrabold">المحفظة متاحة للأعضاء المسجلين فقط</div>
            <p className="text-xs opacity-70">قم بتسجيل حساب عضو للاستفادة من الكوينز وشحن الرصيد والهدايا.</p>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="px-4 pt-2.5 pb-2 border-b border-slate-800/30 flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setTab("overview")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "overview" ? "bg-amber-600 text-white" : "opacity-75 hover:opacity-100"
                }`}
              >
                الملخص والسجل
              </button>
              <button
                type="button"
                onClick={() => setTab("topup")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "topup" ? "bg-emerald-600 text-white" : "opacity-75 hover:opacity-100"
                }`}
              >
                طلب شحن رصيد
              </button>
              <button
                type="button"
                onClick={() => setTab("orders")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  tab === "orders" ? "bg-sky-600 text-white" : "opacity-75 hover:opacity-100"
                }`}
              >
                طلباتي ({orders.length})
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto chat-scroll p-4 space-y-4">
              {tab === "overview" && (
                <>
                  <div className="rounded-3xl bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-slate-900 border border-amber-500/30 p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs opacity-75">الرصيد المتاح</div>
                      <div className="text-2xl font-extrabold text-amber-400 flex items-center gap-1.5 mt-0.5">
                        <Coins className="w-6 h-6" />
                        {myCoins}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("topup")}
                      className="px-4 py-2 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold transition"
                    >
                      شحن كوينز
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className={`p-3 rounded-2xl border ${cardCls}`}>
                      <div className="text-sm font-extrabold text-emerald-500">+{Number(summary.total_added_coins || 0)}</div>
                      <div className="text-[11px] opacity-65">إجمالي المضاف</div>
                    </div>
                    <div className={`p-3 rounded-2xl border ${cardCls}`}>
                      <div className="text-sm font-extrabold text-rose-500">-{Number(summary.total_spent_coins || 0)}</div>
                      <div className="text-[11px] opacity-65">إجمالي المصروف</div>
                    </div>
                    <div className={`p-3 rounded-2xl border ${cardCls}`}>
                      <div className="text-sm font-extrabold text-amber-500">{Number(summary.pending_orders || 0)}</div>
                      <div className="text-[11px] opacity-65">طلبات قيد الانتظار</div>
                    </div>
                    <div className={`p-3 rounded-2xl border ${cardCls}`}>
                      <div className="text-sm font-extrabold text-sky-500">{Number(summary.approved_orders || 0)}</div>
                      <div className="text-[11px] opacity-65">طلبات معتمدة</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold opacity-80">أحدث حركات المحفظة</h4>
                    {ledger.length === 0 ? (
                      <div className={`p-6 rounded-2xl border text-center text-xs opacity-60 ${cardCls}`}>
                        لا توجد حركات مسجلة حتى الآن
                      </div>
                    ) : (
                      ledger.map((row) => (
                        <div
                          key={row.id || row.txid}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${cardCls}`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold truncate">{row.note || row.event_type}</div>
                            <div className="text-[10px] opacity-60 mt-0.5">
                              {formatDateTimeArabic(row.created_at)} | الرصيد: {row.before_balance} ← {row.after_balance}
                            </div>
                          </div>
                          <span
                            className={`font-extrabold font-mono shrink-0 ${
                              row.amount >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {row.amount >= 0 ? `+${row.amount}` : row.amount}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {tab === "topup" && (
                <form onSubmit={handleSubmitOrder} className="space-y-4">
                  {/* Packages */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold block">1. اختر باقة الكوينز</label>
                    {packages.length === 0 ? (
                      <div className={`p-4 rounded-2xl border text-center text-xs opacity-65 ${cardCls}`}>
                        لا توجد باقات شحن مفعلة حالياً
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {packages.map((pkg) => {
                          const active = pkg.id === selectedPkgId;
                          return (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => setSelectedPkgId(pkg.id)}
                              className={`p-3 rounded-2xl border text-right transition ${
                                active
                                  ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/40"
                                  : cardCls
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-extrabold">{pkg.title}</span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-extrabold">
                                  {pkg.coins_amount} كوينز
                                </span>
                              </div>
                              <div className="text-[11px] opacity-75 mt-1">
                                السعر: {pkg.price_local} {pkg.currency}
                                {pkg.country_code ? ` (${pkg.country_code})` : ""}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Agents */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold block">2. اختر وكيل الشحن</label>
                    <select
                      value={selectedAgent?.id || ""}
                      onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                      className={inputCls}
                    >
                      {sortedAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} {a.country_code ? `(${a.country_code})` : ""} {a.city ? `- ${a.city}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Methods */}
                  {selectedAgent && (
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold block">3. وسيلة التحويل</label>
                      {activeMethods.length === 0 ? (
                        <div className={`p-3 rounded-2xl border text-xs opacity-65 ${cardCls}`}>
                          لم يضف الوكيل وسائل دفع نشطة بعد
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeMethods.map((m) => {
                            const selected = m.id === selectedMethodId;
                            return (
                              <div
                                key={m.id}
                                onClick={() => setSelectedMethodId(m.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(ev) => ev.key === "Enter" && setSelectedMethodId(m.id)}
                                className={`p-3 rounded-2xl border cursor-pointer transition space-y-1 ${
                                  selected
                                    ? "border-emerald-500 bg-emerald-500/10"
                                    : cardCls
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-extrabold inline-flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                                    {m.method_name}
                                  </span>
                                  <span className="text-[11px] opacity-75">{m.account_name}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <code className="text-xs font-mono bg-black/25 px-2 py-0.5 rounded-lg">
                                    {m.account_identifier}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      void copyText(m.account_identifier);
                                    }}
                                    className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    نسخ
                                  </button>
                                </div>
                                {m.instructions && (
                                  <p className="text-[11px] opacity-70 pt-0.5">{m.instructions}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Receipt & Notes */}
                  <div className={`p-3 rounded-2xl border space-y-3 ${cardCls}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">4. إيصال التحويل</span>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingReceipt ? "جارٍ الرفع..." : "رفع الإيصال"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUploadReceipt}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {receiptPath && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <FileImage className="w-4 h-4" />
                        <span className="truncate">تم رفع الإيصال: {receiptPath}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="رقم العملية / المرجع (اختياري)"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      placeholder="ملاحظة للوكيل (اختياري)"
                      className={inputCls}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedPackage || !selectedAgent || !selectedMethodId || !receiptPath}
                    className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 transition"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? "جارٍ إرسال الطلب..." : "تأكيد وإرسال طلب الشحن"}
                  </button>
                </form>
              )}

              {tab === "orders" && (
                <div className="space-y-2.5">
                  {orders.length === 0 ? (
                    <div className={`p-8 rounded-2xl border text-center text-xs opacity-65 ${cardCls}`}>
                      لم ترسل أي طلبات شحن بعد
                    </div>
                  ) : (
                    orders.map((ord) => {
                      const badge =
                        ord.status === "approved"
                          ? { cls: "bg-emerald-500/15 text-emerald-400", label: "معتمد", icon: CheckCircle2 }
                          : ord.status === "rejected"
                            ? { cls: "bg-rose-500/15 text-rose-400", label: "مرفوض", icon: XCircle }
                            : { cls: "bg-amber-500/15 text-amber-400", label: "قيد المراجعة", icon: Clock };
                      const Icon = badge.icon;
                      return (
                        <div key={ord.id} className={`p-3 rounded-2xl border space-y-1.5 text-xs ${cardCls}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-[11px]">{ord.order_no}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.cls}`}>
                              <Icon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          </div>
                          <div className="font-extrabold">
                            {ord.package_title} ({ord.package_coins} كوينز) — {ord.customer_price_local} {ord.currency}
                          </div>
                          <div className="text-[11px] opacity-70">
                            الوكيل: {ord.agent_name} | الطريقة: {ord.payment_method_name}
                          </div>
                          <div className="flex items-center justify-between text-[11px] opacity-60">
                            <span>{formatDateTimeArabic(ord.requested_at)}</span>
                            {ord.receipt_path && (
                              <a
                                href={resolveAssetUrl(ord.receipt_path, "", "")}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:underline"
                              >
                                عرض الإيصال
                              </a>
                            )}
                          </div>
                          {ord.reject_reason && (
                            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 text-[11px]">
                              سبب الرفض: {ord.reject_reason}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
