import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Award, Check, Crown, KeyRound, Plus, RefreshCw, Search, Shield, Trash2, Users } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { PowerRole } from "@newchat/shared";
import { formatDateTimeArabic } from "../../lib/mediaUrl.js";
import type { CpTabProps } from "./CpOverviewLogs.js";

const POWER_BOOLEAN_FLAGS: Array<{ key: keyof PowerRole; label: string }> = [
  { key: "cp", label: "لوحة التحكم" },
  { key: "setpower", label: "إدارة الصلاحيات والترقيات" },
  { key: "edituser", label: "تعديل العضويات" },
  { key: "subs", label: "الترقيات والانتهاء" },
  { key: "kick", label: "الطرد" },
  { key: "ban", label: "الحظر" },
  { key: "meiut", label: "كتم الأعضاء" },
  { key: "alert", label: "التنبيهات" },
  { key: "mynick", label: "تغيير لقبي" },
  { key: "unick", label: "تغيير ألقاب الأعضاء" },
  { key: "ulike", label: "تعديل اللايكات" },
  { key: "delmsg", label: "حذف رسائل الغرفة" },
  { key: "delbc", label: "حذف الحائط" },
  { key: "delpic", label: "حذف الصور" },
  { key: "publicmsg", label: "إعلان عام" },
  { key: "publicmsghide", label: "إعلان عام مخفي" },
  { key: "forcepm", label: "تجاوز غلق الخاص" },
  { key: "roomowner", label: "إدارة الغرف" },
  { key: "createroom", label: "إنشاء الغرف" },
  { key: "stealth", label: "الدخول المخفي" },
  { key: "history", label: "كشف الأسماء" },
  { key: "flter", label: "إدارة الفلتر" },
  { key: "shrt", label: "إدارة الاختصارات" },
  { key: "msgs", label: "رسائل الترحيب" },
  { key: "bootedit", label: "إدارة البوتات" },
  { key: "brbbot", label: "بوت المسابقات" },
  { key: "micprovideredit", label: "مزود المايك" },
  { key: "gifticon", label: "أيقونة إهداء" },
  { key: "evaluationpoints", label: "نقاط التقييم" },
  { key: "hostcleanup", label: "استضافة: التنظيف" },
  { key: "hostcontrols", label: "استضافة: التحكم" },
  { key: "hostsettings", label: "استضافة: الإعدادات" },
  { key: "hostdomains", label: "استضافة: الدومينات" },
  { key: "owner", label: "صلاحية المالك" },
];

export function CpUsersTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [powersList, setPowersList] = useState<PowerRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null);
  const [repDraft, setRepDraft] = useState("0");
  const [pwdDraft, setPwdDraft] = useState("");
  const [powerDraft, setPowerDraft] = useState("");
  const [daysDraft, setDaysDraft] = useState("30");
  const [staleDays, setStaleDays] = useState("90");

  const load = useCallback(
    async (queryText = q) => {
      setLoading(true);
      try {
        const [usersRes, powersRes] = await Promise.all([
          getApiClient().cpCommand(token, "logins", queryText ? { q: queryText } : undefined),
          getApiClient().cpCommand(token, "powers").catch(() => []),
        ]);
        if (Array.isArray(usersRes)) setRows(usersRes);
        else if ((usersRes as { err?: boolean; msg?: string }).err) {
          onNotify(String((usersRes as { msg?: string }).msg || "لا تملك صلاحية"), false);
        }
        if (Array.isArray(powersRes)) setPowersList(powersRes as PowerRole[]);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : "خطأ", false);
      } finally {
        setLoading(false);
      }
    },
    [token, q, getApiClient, onNotify],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const runAction = async (cmd: string, params: Record<string, unknown>) => {
    try {
      const res = await getApiClient().cpCommand(token, cmd, params);
      onNotify(String(res.msg || (res.err ? "فشلت العملية" : "تم الحفظ")), !res.err);
      if (!res.err) await load(q);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sky-400" />
            إدارة الأعضاء ({rows.length})
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAction("delloginDay", { d: Number(staleDays) || 90 });
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="number"
              min={7}
              value={staleDays}
              onChange={(e) => setStaleDays(e.target.value)}
              className="w-16 rounded-xl px-2 py-1 text-xs border border-slate-700 bg-slate-950 text-center"
            />
            <button type="submit" className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-[11px] font-bold">
              حذف الخاملين (يوم)
            </button>
          </form>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث باسم المستخدم، اللقب، IP أو البصمة..."
            className={inputCls}
          />
          <button type="submit" className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1">
            <Search className="w-3.5 h-3.5" />
            بحث
          </button>
          <button
            type="button"
            onClick={() => void load(q)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-white shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className={`lg:col-span-7 p-3 rounded-3xl border space-y-2 max-h-[560px] overflow-y-auto chat-scroll ${cardCls}`}>
          {rows.map((u) => {
            const idreg = Number(u.idreg || 0);
            const active = selectedUser && Number(selectedUser.idreg) === idreg;
            return (
              <div
                key={idreg}
                onClick={() => {
                  setSelectedUser(u);
                  setRepDraft(String(u.rep ?? 0));
                  setPowerDraft(String(u.power || ""));
                  setPwdDraft("");
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => ev.key === "Enter" && setSelectedUser(u)}
                className={`p-2.5 rounded-2xl border text-xs cursor-pointer transition flex items-center justify-between gap-2 ${
                  active ? "border-sky-500 bg-sky-500/10" : subCls
                }`}
              >
                <div className="min-w-0">
                  <div className="font-extrabold truncate">
                    #{idreg} {String(u.topic || u.username)} <span className="opacity-60">({String(u.username)})</span>
                  </div>
                  <div className="text-[11px] opacity-65 mt-0.5">
                    الرتبة: {String(u.power || "عضو")} | لايك: {Number(u.rep || 0)} | كوينز: {Number(u.coins || 0)}
                    {Number(u.documentationc || 0) > 0 ? " | موثق" : ""}
                    {u.loginG ? " | دخول مميز" : ""}
                  </div>
                </div>
                <span className="text-[10px] font-mono opacity-60 shrink-0">{String(u.ip || "")}</span>
              </div>
            );
          })}
        </div>

        <div className={`lg:col-span-5 p-4 rounded-3xl border space-y-3 ${cardCls}`}>
          {!selectedUser ? (
            <div className="py-12 text-center text-xs opacity-60">اختر عضواً من القائمة لتعديله</div>
          ) : (
            <>
              <div className="border-b border-slate-800/40 pb-2">
                <div className="text-sm font-extrabold">{String(selectedUser.topic)}</div>
                <div className="text-[11px] opacity-65">#{String(selectedUser.idreg)} • {String(selectedUser.username)}</div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold">الترقية والرتبة</label>
                <div className="flex gap-1.5">
                  <select value={powerDraft} onChange={(e) => setPowerDraft(e.target.value)} className={inputCls}>
                    <option value="">بدون رتبة</option>
                    {powersList.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.rank})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={daysDraft}
                    onChange={(e) => setDaysDraft(e.target.value)}
                    placeholder="أيام"
                    className={`w-20 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void runAction("setpower", {
                        id: String(selectedUser.idreg),
                        power: powerDraft,
                        days: Number(daysDraft) || 0,
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold">تعديل اللايكات</label>
                <div className="flex gap-1.5">
                  <input type="number" min={0} value={repDraft} onChange={(e) => setRepDraft(e.target.value)} className={inputCls} />
                  <button
                    type="button"
                    onClick={() => void runAction("likes", { id: String(selectedUser.idreg), rep: Number(repDraft) || 0 })}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0"
                  >
                    حفظ
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold">تغيير كلمة المرور</label>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={pwdDraft}
                    onChange={(e) => setPwdDraft(e.target.value)}
                    placeholder="كلمة مرور جديدة..."
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => void runAction("pwd", { id: String(selectedUser.idreg), pwd: pwdDraft })}
                    className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/40">
                <button
                  type="button"
                  onClick={() => {
                    const doc = !(Number(selectedUser.documentationc || 0) > 0);
                    void runAction("documentation", {
                      id: String(selectedUser.idreg),
                      documentation: { documentation: doc, loginG: Boolean(selectedUser.loginG) },
                    });
                  }}
                  className="py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                >
                  <Award className="w-3.5 h-3.5" />
                  {Number(selectedUser.documentationc || 0) > 0 ? "إلغاء التوثيق" : "توثيق العضو"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextG = !selectedUser.loginG;
                    void runAction("documentation", {
                      id: String(selectedUser.idreg),
                      documentation: { documentation: Number(selectedUser.documentationc || 0) > 0, loginG: nextG },
                    });
                  }}
                  className="py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  {selectedUser.loginG ? "إلغاء المميز" : "دخول مميز"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => void runAction("dellogin", { id: String(selectedUser.idreg) })}
                className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف العضوية نهائياً
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CpSubsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApiClient().cpCommand(token, "subs");
      if (res.err) onNotify(String(res.msg || "لا تملك صلاحية"), false);
      else if (Array.isArray(res.data)) setRows(res.data);
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

  return (
    <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold">الاشتراكات والترقيات ({rows.length})</h2>
        <button type="button" onClick={() => void load()} disabled={loading} className="p-2 rounded-xl bg-slate-800 text-white">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="space-y-2 max-h-[560px] overflow-y-auto chat-scroll">
        {rows.map((s) => (
          <div key={String(s.id)} className={`p-3 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 ${subCls}`}>
            <div>
              <div className="font-extrabold">
                #{String(s.iduser)} {String(s.topic1 || s.topic || "")}
              </div>
              <div className="text-[11px] opacity-65">
                الصلاحية: <strong className="text-amber-400">{String(s.sub || "بدون")}</strong> | المدة: {String(s.timeis || "0")} يوم | ينتهي:{" "}
                {formatDateTimeArabic(Number(s.timefinish || 0))}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const res = await getApiClient().cpCommand(token, "setpower", {
                  id: String(s.iduser),
                  power: "",
                  days: 0,
                });
                onNotify(String(res.msg || "تم تنزيل الرتبة"), !res.err);
                void load();
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold"
            >
              إزالة الرتبة
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CpPowersTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [roles, setRoles] = useState<PowerRole[]>([]);
  const [editingRole, setEditingRole] = useState<PowerRole | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getApiClient().cpCommand(token, "powers");
      if (Array.isArray(res)) {
        setRoles(res as PowerRole[]);
        if (!editingRole && res.length > 0) setEditingRole({ ...(res[0] as PowerRole) });
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    }
  }, [token, getApiClient, onNotify, editingRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRole?.name?.trim()) return;
    try {
      const res = await getApiClient().cpCommand(token, "powers_save", {
        name: editingRole.name.trim(),
        power: JSON.stringify(editingRole),
      });
      onNotify(String(res.msg || (res.err ? "تعذر الحفظ" : "تم حفظ الصلاحية")), !res.err);
      if (!res.err) {
        setIsNew(false);
        await load();
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const res = await getApiClient().cpCommand(token, "powers_del", { name });
      onNotify(String(res.msg || "تم الحذف"), !res.err);
      if (!res.err) {
        setEditingRole(null);
        await load();
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div className={`lg:col-span-4 p-3 rounded-3xl border space-y-2 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-400" />
            الصلاحيات ({roles.length})
          </h2>
          <button
            type="button"
            onClick={() => {
              setIsNew(true);
              setEditingRole({ rank: 100, name: "", ico: "" });
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            جديد
          </button>
        </div>

        <div className="space-y-1.5 max-h-[540px] overflow-y-auto chat-scroll">
          {roles.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => {
                setIsNew(false);
                setEditingRole({ ...r });
              }}
              className={`w-full p-2.5 rounded-2xl border text-right text-xs flex justify-between items-center ${
                editingRole?.name === r.name && !isNew ? "border-amber-500 bg-amber-500/10" : subCls
              }`}
            >
              <span className="font-extrabold">{r.name}</span>
              <span className="font-mono text-[11px] opacity-70">ترتيب {r.rank}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`lg:col-span-8 p-4 rounded-3xl border ${cardCls}`}>
        {!editingRole ? (
          <div className="py-12 text-center text-xs opacity-60">اختر صلاحية لتعديلها</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold mb-1">اسم المجموعة</label>
                <input
                  type="text"
                  value={editingRole.name}
                  disabled={!isNew && ["chatmaster", "Hide", "ispower"].includes(editingRole.name)}
                  onChange={(e) => setEditingRole((r) => (r ? { ...r, name: e.target.value } : r))}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">الرتبة (Rank)</label>
                <input
                  type="number"
                  value={editingRole.rank}
                  onChange={(e) => setEditingRole((r) => (r ? { ...r, rank: Number(e.target.value) || 0 } : r))}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">أيقونة (ICO)</label>
                <input
                  type="text"
                  value={editingRole.ico || ""}
                  onChange={(e) => setEditingRole((r) => (r ? { ...r, ico: e.target.value } : r))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {POWER_BOOLEAN_FLAGS.map((flag) => {
                const checked = Number(editingRole[flag.key] || 0) > 0;
                return (
                  <label
                    key={String(flag.key)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer ${subCls}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setEditingRole((r) => (r ? { ...r, [flag.key]: e.target.checked ? 1 : 0 } : r))
                      }
                      className="accent-amber-500"
                    />
                    <span className="truncate">{flag.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/40">
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${subCls}`}>
                <input
                  type="checkbox"
                  checked={Number(editingRole.auto_enabled || editingRole.auto_promote || 0) > 0}
                  onChange={(e) =>
                    setEditingRole((r) =>
                      r ? { ...r, auto_enabled: e.target.checked ? 1 : 0, auto_promote: e.target.checked ? 1 : 0 } : r,
                    )
                  }
                  className="accent-emerald-500"
                />
                ترقية آلية بالنقاط
              </label>
              <input
                type="number"
                min={0}
                value={Number(editingRole.auto_points || 0)}
                onChange={(e) => setEditingRole((r) => (r ? { ...r, auto_points: Number(e.target.value) || 0 } : r))}
                placeholder="نقاط الترقية الآلية"
                className={inputCls}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold">
                حفظ التغييرات
              </button>
              {!isNew && !["chatmaster", "Hide", "ispower"].includes(editingRole.name) && (
                <button
                  type="button"
                  onClick={() => void handleDelete(editingRole.name)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
                >
                  حذف الصلاحية
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
