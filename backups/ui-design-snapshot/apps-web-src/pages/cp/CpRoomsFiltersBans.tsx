import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Ban, DoorOpen, Filter, MessageSquare, Plus, RefreshCw, Scissors, ShieldBan, Trash2, Upload } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic, resolveAssetUrl } from "../../lib/mediaUrl.js";
import type { CpTabProps } from "./CpOverviewLogs.js";

export function CpRoomsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [rooms, setRooms] = useState<Array<Record<string, unknown>>>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApiClient().cpCommand(token, "rooms");
      if (res.err) onNotify(String(res.msg || "لا تملك صلاحية"), false);
      else {
        if (Array.isArray(res.msg)) setRooms(res.msg);
        if (res.data && typeof res.data === "object") setCounts(res.data as Record<string, number>);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    } finally {
      setLoading(false);
    }
  }, [token, getApiClient, onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (cmd: string, roomId: string) => {
    const res = await getApiClient().cpCommand(token, cmd, { id: roomId });
    onNotify(String(res.msg || (res.err ? "فشلت العملية" : "تم التنفيذ")), !res.err);
    if (!res.err) await load();
  };

  const handleUploadPic = async (roomId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const up = await getApiClient().uploadCpRoomPic(file, token, file.name);
      if (up.err || !up.msg) throw new Error(up.msg || "فشل الرفع");
      const picName = String(up.msg).split("/").pop() || "";
      const r2 = await getApiClient().cpCommand(token, "roomspic", { id: roomId, pic: picName });
      onNotify(r2.err ? String(r2.msg || "فشل") : "تم تحديث صورة الغرفة", !r2.err);
      if (!r2.err) await load();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    }
  };

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";

  return (
    <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <DoorOpen className="w-4 h-4 text-emerald-400" />
          إدارة الغرف ({rooms.length})
        </h2>
        <button type="button" onClick={() => void load()} disabled={loading} className="p-2 rounded-xl bg-slate-800 text-white">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-2 max-h-[580px] overflow-y-auto chat-scroll">
        {rooms.map((r) => {
          const rid = String(r.id || "");
          return (
            <div key={rid} className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${subCls}`}>
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={resolveAssetUrl(r.pic || "room.png", "picroom", "/room.png")}
                  alt={String(r.topic || "")}
                  className="w-11 h-11 rounded-2xl object-cover border border-slate-700 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">{String(r.topic)}</div>
                  <div className="text-[11px] opacity-65">
                    متواجدون: {counts[rid] ?? 0} / {Number(r.max || 0)} | المالك: {String(r.owner || "-")} | {r.needpass ? "مقفلة" : "مفتوحة"}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <label className="px-2.5 py-1.5 rounded-xl bg-sky-600 text-white font-bold cursor-pointer inline-flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  صورة
                  <input type="file" accept="image/*" onChange={(ev) => void handleUploadPic(rid, ev)} className="hidden" />
                </label>
                <button type="button" onClick={() => void act("roomspicdel", rid)} className="px-2.5 py-1.5 rounded-xl bg-slate-700 text-white font-bold">
                  مسح الصورة
                </button>
                {Boolean(r.needpass) && (
                  <button type="button" onClick={() => void act("roompass", rid)} className="px-2.5 py-1.5 rounded-xl bg-amber-600 text-white font-bold">
                    إزالة كلمة السر
                  </button>
                )}
                <button type="button" onClick={() => void act("roomsver", rid)} className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold">
                  افتراضية
                </button>
                {rid !== "D8D8A9A9C0" && (
                  <button type="button" onClick={() => void act("roomsdel", rid)} className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold">
                    حذف
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CpFiltersTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [intercepted, setIntercepted] = useState<Array<Record<string, unknown>>>([]);
  const [word, setWord] = useState("");
  const [pathKind, setPathKind] = useState<"bmsgs" | "amsgs" | "wmsgs">("bmsgs");

  const load = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      getApiClient().cpCommand(token, "fltr").catch(() => []),
      getApiClient().cpCommand(token, "fltred").catch(() => []),
    ]);
    if (Array.isArray(r1)) setRules(r1);
    if (Array.isArray(r2)) setIntercepted(r2);
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!word.trim()) return;
    const res = await getApiClient().cpCommand(token, "fltrit", { path: pathKind, v: word.trim() });
    if ((res as { err?: boolean }).err) {
      onNotify(String((res as { msg?: string }).msg || "فشل"), false);
    } else {
      setWord("");
      onNotify("تمت إضافة الكلمة للفلتر");
      void load();
    }
  };

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-rose-400" />
          قواعد الفلتر ({rules.length})
        </h2>
        <form onSubmit={handleAdd} className="flex gap-1.5">
          <select value={pathKind} onChange={(e) => setPathKind(e.target.value as typeof pathKind)} className={`w-36 ${inputCls}`}>
            <option value="bmsgs">كلمات ممنوعة</option>
            <option value="wmsgs">كلمات مراقبة</option>
            <option value="amsgs">كلمات مسموحة</option>
          </select>
          <input type="text" value={word} onChange={(e) => setWord(e.target.value)} placeholder="الكلمة..." className={inputCls} />
          <button type="submit" className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </form>
        <div className="space-y-1.5 max-h-[450px] overflow-y-auto chat-scroll">
          {rules.map((r) => (
            <div key={String(r.id)} className={`p-2 rounded-xl border text-xs flex justify-between items-center ${subCls}`}>
              <span>
                <strong>{String(r.v)}</strong> <span className="opacity-65">({String(r.type || r.path)})</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await getApiClient().cpCommand(token, "fltrdel", { id: r.id, v: r.v });
                  void load();
                }}
                className="text-rose-400 hover:text-rose-300 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <h2 className="text-sm font-extrabold">الرسائل المرصودة ({intercepted.length})</h2>
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto chat-scroll">
          {intercepted.map((row, idx) => (
            <div key={String(row.id || idx)} className={`p-2.5 rounded-xl border text-xs ${subCls}`}>
              <div className="font-bold">{String(row.topic || row.username || "-")}</div>
              <div className="opacity-80 mt-0.5">{String(row.msg || row.v || "")}</div>
              <div className="text-[10px] opacity-55 mt-0.5">{formatDateTimeArabic(row.time)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CpBansTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [bans, setBans] = useState<Array<Record<string, unknown>>>([]);
  const [banInput, setBanInput] = useState("");
  const [systems, setSystems] = useState<Record<string, unknown>>({});
  const [browsers, setBrowsers] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    const [b1, b2] = await Promise.all([
      getApiClient().cpCommand(token, "bansU").catch(() => []),
      getApiClient().cpCommand(token, "bans").catch(() => ({})),
    ]);
    if (Array.isArray(b1)) setBans(b1);
    if (b2 && typeof b2 === "object") {
      const obj = b2 as { system1?: Record<string, unknown>; browser1?: Record<string, unknown> };
      if (obj.system1) setSystems(obj.system1);
      if (obj.browser1) setBrowsers(obj.browser1);
    }
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const handleAddBan = async (e: FormEvent) => {
    e.preventDefault();
    if (!banInput.trim()) return;
    await getApiClient().cpCommand(token, "ban", { type: banInput.trim() });
    setBanInput("");
    onNotify("تمت إضافة الحظر");
    void load();
  };

  const toggleSysBrowser = async (kind: "system7" | "browser9", key: string) => {
    const current = kind === "system7" ? { ...systems } : { ...browsers };
    current[kind] = true;
    current[key] = !current[key];
    const res = await getApiClient().cpCommand(token, "ban", { type: JSON.stringify(current) });
    const obj = res as { system1?: Record<string, unknown>; browser1?: Record<string, unknown> };
    if (obj.system1) setSystems(obj.system1);
    if (obj.browser1) setBrowsers(obj.browser1);
    onNotify("تم تحديث القيود");
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <Ban className="w-4 h-4 text-rose-400" />
          قائمة الحظر ({bans.length})
        </h2>
        <form onSubmit={handleAddBan} className="flex gap-2">
          <input
            type="text"
            value={banInput}
            onChange={(e) => setBanInput(e.target.value)}
            placeholder="اسم مستخدم، IP، رمز دولة (SA)، أو بصمة جهاز..."
            className={inputCls}
          />
          <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0">
            حظر
          </button>
        </form>
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto chat-scroll">
          {bans.map((b) => (
            <div key={String(b.id)} className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${subCls}`}>
              <div>
                <strong>{String(b.ip_band || b.device_band || b.country_band || b.decoderDans || "-")}</strong>
                <span className="opacity-65 mr-2">بواسطة: {String(b.name_band || "-")}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await getApiClient().cpCommand(token, "unban", { id: b.id });
                  onNotify(String(res.msg || "تم فك الحظر"), !res.err);
                  void load();
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
              >
                فك الحظر
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-3xl border space-y-2 ${cardCls}`}>
          <h3 className="text-xs font-extrabold flex items-center gap-1.5">
            <ShieldBan className="w-4 h-4 text-amber-400" />
            حظر أنظمة التشغيل
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {["windows", "android", "ios", "linux", "mac os", "chromium os"].map((sysName) => (
              <label key={sysName} className={`flex items-center gap-2 p-2 rounded-xl border text-xs ${subCls}`}>
                <input
                  type="checkbox"
                  checked={Boolean(systems[sysName])}
                  onChange={() => void toggleSysBrowser("system7", sysName)}
                  className="accent-rose-500"
                />
                <span>{sysName}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={`p-4 rounded-3xl border space-y-2 ${cardCls}`}>
          <h3 className="text-xs font-extrabold">حظر المتصفحات</h3>
          <div className="grid grid-cols-2 gap-2">
            {["chrome", "safari", "firefox", "edge", "opera", "Samsung browser", "Chrome WebView"].map((brName) => (
              <label key={brName} className={`flex items-center gap-2 p-2 rounded-xl border text-xs ${subCls}`}>
                <input
                  type="checkbox"
                  checked={Boolean(browsers[brName])}
                  onChange={() => void toggleSysBrowser("browser9", brName)}
                  className="accent-rose-500"
                />
                <span>{brName}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CpShortcutsAndMsgsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [shortcuts, setShortcuts] = useState<Array<Record<string, unknown>>>([]);
  const [msgs, setMsgs] = useState<Array<Record<string, unknown>>>([]);
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  const [msgType, setMsgType] = useState<"w" | "d">("w");
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([
      getApiClient().cpCommand(token, "shrt").catch(() => []),
      getApiClient().cpCommand(token, "msgs").catch(() => []),
    ]);
    if (Array.isArray(s)) setShortcuts(s);
    if (Array.isArray(m)) setMsgs(m);
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <Scissors className="w-4 h-4 text-sky-400" />
          الاختصارات ({shortcuts.length})
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!t1.trim() || !t2.trim()) return;
            await getApiClient().cpCommand(token, "shrtadd", { name: t1.trim(), value: t2.trim() });
            setT1("");
            setT2("");
            onNotify("تمت إضافة الاختصار");
            void load();
          }}
          className="flex gap-1.5"
        >
          <input type="text" value={t1} onChange={(e) => setT1(e.target.value)} placeholder="الاختصار..." className={inputCls} />
          <input type="text" value={t2} onChange={(e) => setT2(e.target.value)} placeholder="النص الكامل..." className={inputCls} />
          <button type="submit" className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0">
            إضافة
          </button>
        </form>
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto chat-scroll">
          {shortcuts.map((s) => (
            <div key={String(s.id)} className={`p-2 rounded-xl border text-xs flex justify-between items-center ${subCls}`}>
              <span>
                <strong className="text-sky-400">{String(s.text1)}</strong> ← {String(s.text2)}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await getApiClient().cpCommand(token, "shrtdel", { id: s.id });
                  void load();
                }}
                className="text-rose-400 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          رسائل الترحيب واليومية ({msgs.length})
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!msgBody.trim()) return;
            await getApiClient().cpCommand(token, "msgsit", { type: msgType, t: msgTitle.trim(), m: msgBody.trim() });
            setMsgTitle("");
            setMsgBody("");
            onNotify("تمت إضافة الرسالة");
            void load();
          }}
          className="space-y-2"
        >
          <div className="flex gap-1.5">
            <select value={msgType} onChange={(e) => setMsgType(e.target.value as "w" | "d")} className={`w-32 ${inputCls}`}>
              <option value="w">ترحيبية</option>
              <option value="d">يومية</option>
            </select>
            <input type="text" value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} placeholder="العنوان..." className={inputCls} />
          </div>
          <div className="flex gap-1.5">
            <input type="text" value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="نص الرسالة..." className={inputCls} />
            <button type="submit" className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0">
              إضافة
            </button>
          </div>
        </form>
        <div className="space-y-1.5 max-h-[380px] overflow-y-auto chat-scroll">
          {msgs.map((m) => (
            <div key={String(m.id)} className={`p-2.5 rounded-xl border text-xs flex justify-between items-start gap-2 ${subCls}`}>
              <div>
                <div className="font-bold">
                  [{m.category === "d" ? "يومية" : "ترحيب"}] {String(m.adresse || "")}
                </div>
                <div className="opacity-80 mt-0.5">{String(m.msg || "")}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await getApiClient().cpCommand(token, "msgsdel", { id: m.id, type: m.category });
                  void load();
                }}
                className="text-rose-400 p-1 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
