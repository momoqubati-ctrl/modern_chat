import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { resolveApiBaseUrl } from "../lib/mediaUrl.js";

type FundingEntry = {
  id: number;
  amount_coins: number;
  external_ref: string;
  note: string | null;
  created_at: number;
};

type EarningEntry = {
  id: number;
  event_type: string;
  amount: number;
  created_at: number;
};

type HostingDashboard = {
  hostingOwnerBalance: number;
  siteWalletBalance: number;
  funding: FundingEntry[];
  earnings: EarningEntry[];
  withdrawalsEnabled: boolean;
};

class PortalRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PortalRequestError";
  }
}

function createIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function currentPortalPath(): string {
  let pathname = window.location.pathname.replace(/\/+$/, "");
  for (const suffix of ["/dashboard", "/fund", "/audit"]) {
    if (pathname.endsWith(suffix)) {
      pathname = pathname.slice(0, -suffix.length);
      break;
    }
  }
  return pathname || "/";
}

function getApiBase(): string {
  const configured = resolveApiBaseUrl();
  if (configured) return configured;
  if (window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:3003`;
  }
  return "";
}

function formatDate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function HostingOwnerPortal() {
  const basePath = useMemo(currentPortalPath, []);
  const apiBase = useMemo(getApiBase, []);
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dashboard, setDashboard] = useState<HostingDashboard | null>(null);
  const [audit, setAudit] = useState<FundingEntry[] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [amount, setAmount] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const currentPath = window.location.pathname.replace(/\/+$/, "");
  const isFundPage = currentPath === `${basePath}/fund`;
  const isAuditPage = currentPath === `${basePath}/audit`;

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${apiBase}${basePath}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      let payload: Record<string, unknown>;
      try {
        payload = (await response.json()) as Record<string, unknown>;
      } catch {
        throw new Error("استجابة غير صالحة من الخادم");
      }
      if (!response.ok) {
        if (response.status === 401) {
          throw new PortalRequestError("انتهت الجلسة أو بيانات الدخول غير صحيحة", response.status);
        }
        throw new PortalRequestError(String(payload.message || "تعذر تنفيذ الطلب"), response.status);
      }
      return payload as T;
    },
    [apiBase, basePath],
  );

  const loadDashboard = useCallback(async () => {
    const data = await request<HostingDashboard & { ok: boolean }>("/dashboard");
    setDashboard(data);
    setAuthenticated(true);
  }, [request]);

  useEffect(() => {
    let active = true;
    void request<HostingDashboard & { ok: boolean }>("/dashboard")
      .then((data) => {
        if (!active) return;
        setDashboard(data);
        setAuthenticated(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setAuthenticated(false);
        if (err instanceof PortalRequestError && err.status === 401) {
          setMessage("");
          setError(false);
        } else {
          setMessage("تعذر الاتصال ببوابة الاستضافة");
          setError(true);
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (!authenticated || !isAuditPage) return;
    void request<{ entries: FundingEntry[] }>("/audit?page=1&limit=50")
      .then((data) => setAudit(data.entries))
      .catch((err: unknown) => {
        setError(true);
        setMessage(err instanceof Error ? err.message : "تعذر تحميل سجل الإيداعات");
      });
  }, [authenticated, isAuditPage, request]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      await request("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      await loadDashboard();
      window.location.assign(`${basePath}/dashboard`);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "تعذر تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  };

  const handleFunding = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      await request("/fund", {
        method: "POST",
        body: JSON.stringify({
          amount_coins: Number(amount),
          external_ref: externalRef.trim(),
          note: note.trim(),
          idempotency_key: idempotencyKey,
        }),
      });
      setAmount("");
      setExternalRef("");
      setNote("");
      setIdempotencyKey(createIdempotencyKey());
      await loadDashboard();
      setMessage("تم تسجيل الإيداع وتحديث رصيد محفظة الموقع");
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "تعذر تسجيل الإيداع");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await request("/logout", { method: "POST" });
      setAuthenticated(false);
      setDashboard(null);
      window.location.assign(basePath);
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "تعذر تسجيل الخروج");
    }
  };

  const card = "rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl";
  const input =
    "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500";

  if (checkingSession) {
    return <main className="min-h-screen bg-slate-950 p-6 text-center text-slate-200">جارٍ التحقق من الجلسة...</main>;
  }

  if (!authenticated) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
        <form onSubmit={handleLogin} className={`${card} mx-auto max-w-md space-y-4`}>
          <div>
            <h1 className="text-xl font-extrabold">بوابة مالك الاستضافة</h1>
            <p className="mt-1 text-sm text-slate-400">تسجيل دخول منفصل عن لوحة إدارة الموقع.</p>
          </div>
          <label className="block space-y-1.5 text-sm">
            <span>اسم المستخدم</span>
            <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={input} required />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span>كلمة المرور</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} required />
          </label>
          {message && <p role="alert" className="text-sm text-rose-300">{message}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold disabled:opacity-50">
            {busy ? "جارٍ تسجيل الدخول..." : "دخول"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <h1 className="text-xl font-extrabold">بوابة مالك الاستضافة</h1>
            <p className="mt-1 text-xs text-slate-400">إدارة أرصدة الاستضافة وتمويل محفظة الموقع</p>
          </div>
          <button onClick={() => void handleLogout()} className="rounded-xl border border-slate-700 px-3 py-2 text-sm">تسجيل الخروج</button>
        </header>

        <nav className="flex flex-wrap gap-2 text-sm">
          <a className="rounded-xl bg-slate-800 px-4 py-2" href={`${basePath}/dashboard`}>الرصيد</a>
          <a className="rounded-xl bg-slate-800 px-4 py-2" href={`${basePath}/fund`}>تمويل محفظة الموقع</a>
          <a className="rounded-xl bg-slate-800 px-4 py-2" href={`${basePath}/audit`}>سجل الإيداعات</a>
        </nav>

        {message && <p role={error ? "alert" : "status"} className={error ? "text-sm text-rose-300" : "text-sm text-emerald-300"}>{message}</p>}

        {isFundPage ? (
          <form onSubmit={handleFunding} className={`${card} mx-auto max-w-xl space-y-4`}>
            <h2 className="text-lg font-bold">إيداع في محفظة الموقع</h2>
            <label className="block space-y-1.5 text-sm">
              <span>المبلغ بالكوينز</span>
              <input type="number" min={1} max={1_000_000_000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={input} required />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>مرجع التحويل الخارجي</span>
              <input maxLength={255} value={externalRef} onChange={(e) => setExternalRef(e.target.value)} className={input} required />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>ملاحظة (اختياري)</span>
              <textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={input} rows={3} />
            </label>
            <button disabled={busy} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold disabled:opacity-50">
              {busy ? "جارٍ التسجيل..." : "تأكيد الإيداع"}
            </button>
          </form>
        ) : isAuditPage ? (
          <section className={`${card} space-y-3`}>
            <h2 className="text-lg font-bold">سجل إيداعات محفظة الموقع</h2>
            {audit === null ? <p className="text-sm text-slate-400">جارٍ التحميل...</p> : audit.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد إيداعات مسجلة.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-right text-sm">
                  <thead><tr className="border-b border-slate-700 text-slate-400"><th className="p-2">التاريخ</th><th className="p-2">المبلغ</th><th className="p-2">المرجع</th><th className="p-2">ملاحظة</th></tr></thead>
                  <tbody>{audit.map((entry) => <tr key={entry.id} className="border-b border-slate-800"><td className="p-2">{formatDate(entry.created_at)}</td><td className="p-2">{entry.amount_coins.toLocaleString("ar")} كوينز</td><td className="p-2">{entry.external_ref}</td><td className="p-2">{entry.note || "—"}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              <div className={card}>
                <p className="text-sm text-slate-400">رصيد مالك الاستضافة</p>
                <p className="mt-2 text-3xl font-extrabold text-emerald-300">{(dashboard?.hostingOwnerBalance || 0).toLocaleString("ar")} <span className="text-base">كوينز</span></p>
              </div>
              <div className={card}>
                <p className="text-sm text-slate-400">رصيد محفظة الموقع</p>
                <p className="mt-2 text-3xl font-extrabold text-sky-300">{(dashboard?.siteWalletBalance || 0).toLocaleString("ar")} <span className="text-base">كوينز</span></p>
              </div>
            </section>
            <section className={`${card} space-y-2`}>
              <h2 className="font-bold">رسوم الاستضافة</h2>
              <p className="text-sm text-slate-300">تُسجّل تلقائياً في محفظة مالك الاستضافة مع سجل تدقيق دائم.</p>
              {!dashboard?.withdrawalsEnabled && <p className="text-sm text-amber-300">السحب الخارجي غير مفعّل حالياً؛ الرصيد محفوظ لحين إضافة مسار سحب معتمد.</p>}
            </section>
            <section className={`${card} space-y-3`}>
              <h2 className="font-bold">آخر حركات محفظة الاستضافة</h2>
              {dashboard?.earnings.length ? dashboard.earnings.map((entry) => (
                <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-800 py-2 text-sm">
                  <span>{entry.amount.toLocaleString("ar")} كوينز · رسوم هدية</span>
                  <time className="text-slate-400">{formatDate(entry.created_at)}</time>
                </div>
              )) : <p className="text-sm text-slate-400">لا توجد رسوم مسجلة.</p>}
            </section>
            <section className={`${card} space-y-3`}>
              <h2 className="font-bold">آخر الإيداعات في محفظة الموقع</h2>
              {dashboard?.funding.length ? dashboard.funding.map((entry) => (
                <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-800 py-2 text-sm">
                  <span>{entry.amount_coins.toLocaleString("ar")} كوينز · {entry.external_ref}</span>
                  <time className="text-slate-400">{formatDate(entry.created_at)}</time>
                </div>
              )) : <p className="text-sm text-slate-400">لا توجد إيداعات مسجلة.</p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
