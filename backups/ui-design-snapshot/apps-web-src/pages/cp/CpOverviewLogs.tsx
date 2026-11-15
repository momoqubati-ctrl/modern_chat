import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, FileText, RefreshCw, Search, Shield, Users } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic } from "../../lib/mediaUrl.js";

export interface CpTabProps {
  dark: boolean;
  token: string;
  onNotify: (msg: string, ok?: boolean) => void;
}

export function CpOverviewTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApiClient().cpCommand(token, "dashboardfull");
      if (res.err) onNotify(String(res.msg || "تعذر تحميل الإحصائيات"), false);
      else setData(res);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    } finally {
      setLoading(false);
    }
  }, [token, getApiClient, onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const stats = (data?.stats || {}) as Record<string, number>;
  const status = (data?.status || {}) as Record<string, unknown>;
  const recent = Array.isArray(data?.recentActions)
    ? (data.recentActions as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          نظرة عامة على النظام
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "الأعضاء", val: stats.users ?? 0, color: "text-sky-400" },
          { label: "الضيوف", val: stats.guests ?? 0, color: "text-emerald-400" },
          { label: "الزوار", val: stats.visitors ?? 0, color: "text-indigo-400" },
          { label: "الغرف", val: stats.rooms ?? 0, color: "text-amber-400" },
          { label: "المحظورين", val: stats.bans ?? 0, color: "text-rose-400" },
          { label: "الهدايا", val: stats.gifts ?? 0, color: "text-pink-400" },
          { label: "الدومينات", val: stats.hosts ?? 0, color: "text-teal-400" },
          { label: "الترحيب / اليومية", val: `${stats.welcomeMsgs ?? 0} / ${stats.dailyMsgs ?? 0}`, color: "text-slate-300" },
        ].map((item) => (
          <div key={item.label} className={`p-3.5 rounded-2xl border text-center ${cardCls}`}>
            <div className={`text-lg font-extrabold ${item.color}`}>{item.val}</div>
            <div className="text-[11px] opacity-70 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      <div className={`p-4 rounded-3xl border space-y-2 ${cardCls}`}>
        <h3 className="text-xs font-extrabold">حالة التشغيل السريعة</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl border ${subCls}`}>تثبيت الحائط: <strong>{status.wallFixed ? "مفعل" : "متوقف"}</strong></div>
          <div className={`p-2.5 rounded-xl border ${subCls}`}>تثبيت العضويات: <strong>{status.usersFixed ? "مفعل" : "متوقف"}</strong></div>
          <div className={`p-2.5 rounded-xl border ${subCls}`}>إعادة الاتصال: <strong>{status.reconnect ? "مفعل" : "متوقف"}</strong></div>
          <div className={`p-2.5 rounded-xl border ${subCls}`}>التعليقات: <strong>{status.comments ? "مفعلة" : "معطلة"}</strong></div>
          <div className={`p-2.5 rounded-xl border ${subCls}`}>أقصى لايكات يومية: <strong>{Number(status.maxRep || 3)}</strong></div>
          <div className={`p-2.5 rounded-xl border ${subCls}`}>الاشتراك المتبقي: <strong>{Number(status.finishDays || 0)} يوم</strong></div>
        </div>
      </div>

      <div className={`p-4 rounded-3xl border space-y-2 ${cardCls}`}>
        <h3 className="text-xs font-extrabold">أحدث الإجراءات</h3>
        {recent.length === 0 ? (
          <p className="text-xs opacity-60">لا توجد أحداث مسجلة</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((act, idx) => (
              <div key={idx} className={`p-2.5 rounded-xl border text-xs flex flex-wrap justify-between gap-2 ${subCls}`}>
                <span>
                  <strong className="text-amber-400">{String(act.state || "")}</strong> — {String(act.topic || "")}
                  {act.topic1 ? ` ← ${String(act.topic1)}` : ""}
                  {act.room ? ` (${String(act.room)})` : ""}
                </span>
                <span className="text-[11px] opacity-60">{formatDateTimeArabic(act.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CpLogsAndActionsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [subTab, setSubTab] = useState<"fps" | "actions">("fps");
  const [q, setQ] = useState("");
  const [fpsRows, setFpsRows] = useState<Array<Record<string, unknown>>>([]);
  const [actionRows, setActionRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);

  const loadFps = useCallback(
    async (queryText = q) => {
      setLoading(true);
      try {
        const res = await getApiClient().cpCommand(token, "fps", queryText ? { q: queryText } : undefined);
        setFpsRows(Array.isArray(res) ? res : []);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : "خطأ", false);
      } finally {
        setLoading(false);
      }
    },
    [token, q, getApiClient, onNotify],
  );

  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApiClient().cpCommand(token, "actions");
      setActionRows(Array.isArray(res) ? res : []);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    } finally {
      setLoading(false);
    }
  }, [token, getApiClient, onNotify]);

  useEffect(() => {
    if (subTab === "fps") void loadFps();
    else void loadActions();
  }, [subTab, loadFps, loadActions]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    void loadFps(q);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab("fps")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold ${
              subTab === "fps" ? "bg-sky-600 text-white" : cardCls + " border"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            سجل الدخول ({fpsRows.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("actions")}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold ${
              subTab === "actions" ? "bg-indigo-600 text-white" : cardCls + " border"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            سجل الحالات ({actionRows.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => (subTab === "fps" ? void loadFps() : void loadActions())}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {subTab === "fps" && (
        <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم، اسم المستخدم، IP، الدولة أو الجهاز..."
              className={inputCls}
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1">
              <Search className="w-3.5 h-3.5" />
              بحث
            </button>
          </form>

          <div className="space-y-1.5 max-h-[540px] overflow-y-auto chat-scroll">
            {fpsRows.map((row, i) => (
              <div key={String(row.id || i)} className={`p-2.5 rounded-2xl border text-xs grid grid-cols-1 sm:grid-cols-4 gap-1.5 ${subCls}`}>
                <div className="font-bold truncate">
                  {String(row.topic || "-")} <span className="opacity-65">({String(row.username || "-")})</span>
                </div>
                <div className="text-[11px] font-mono opacity-80">{String(row.ip || "-")}</div>
                <div className="text-[11px] opacity-75">
                  {String(row.state || "-")} | {String(row.device || "-")} | {String(row.code || "")}
                </div>
                <div className="text-[11px] opacity-60 sm:text-left">{formatDateTimeArabic(row.time)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "actions" && (
        <div className={`p-4 rounded-3xl border space-y-2 max-h-[600px] overflow-y-auto chat-scroll ${cardCls}`}>
          {actionRows.map((row, i) => (
            <div key={String(row.id || i)} className={`p-2.5 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 ${subCls}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-extrabold text-amber-400">{String(row.state || "-")}</span>
                <span className="truncate">
                  {String(row.topic || "")} {row.username ? `← ${String(row.username)}` : ""} {row.room ? `(${String(row.room)})` : ""}
                </span>
              </div>
              <div className="text-[11px] opacity-60 font-mono">
                {String(row.ip || "")} • {formatDateTimeArabic(row.time)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
