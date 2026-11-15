import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bot, Globe, Play, Plus, RefreshCw, Server, ShieldAlert, Square, Trash2 } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { CpTabProps } from "./CpOverviewLogs.js";

export function CpBotsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [bots, setBots] = useState<Array<Record<string, unknown>>>([]);
  const [nameb, setNameb] = useState("");
  const [msgbot, setMsgbot] = useState("منورين الشات");
  const [rommbot, setRommbot] = useState("");
  const [chatMsg, setChatMsg] = useState("السلام عليكم");
  const [chatRate, setChatRate] = useState("25");

  const load = useCallback(async () => {
    const res = await getApiClient().cpCommand(token, "bots");
    if (Array.isArray(res.msg)) setBots(res.msg as Array<Record<string, unknown>>);
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameb.trim()) return;
    const res = await getApiClient().cpCommand(token, "addbots", {
      db: { nameb: nameb.trim(), msgbot: msgbot.trim(), rommbot: rommbot.trim(), countrybot: "SA" },
    });
    onNotify(String(res.msg || "تم الإنشاء"), !res.err);
    if (!res.err) {
      setNameb("");
      void load();
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-sky-400" />
            البوتات ({bots.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={async () => {
                const res = await getApiClient().cpCommand(token, "enterbotall");
                onNotify(String(res.msg || "تم"), !res.err);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              إدخال الكل
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await getApiClient().cpCommand(token, "exitbotall");
                onNotify(String(res.msg || "تم"), !res.err);
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
            >
              إخراج الكل
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await getApiClient().cpCommand(token, "addbots100", { room: rommbot.trim() });
                onNotify(String(res.msg || "تمت الإضافة"), !res.err);
                void load();
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
            >
              +100 بوت ناطق
            </button>
          </div>
        </div>

        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input type="text" value={nameb} onChange={(e) => setNameb(e.target.value)} placeholder="اسم البوت" required className={inputCls} />
          <input type="text" value={msgbot} onChange={(e) => setMsgbot(e.target.value)} placeholder="الحالة" className={inputCls} />
          <input type="text" value={rommbot} onChange={(e) => setRommbot(e.target.value)} placeholder="معرف الغرفة (اختياري)" className={inputCls} />
          <button type="submit" className="py-2 rounded-xl bg-sky-600 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            إضافة بوت
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/40">
          <input type="text" value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="رسالة الدردشة الآلية..." className={`flex-1 min-w-[160px] ${inputCls}`} />
          <input type="number" min={1} max={200} value={chatRate} onChange={(e) => setChatRate(e.target.value)} className={`w-20 ${inputCls}`} />
          <button
            type="button"
            onClick={async () => {
              const res = await getApiClient().cpCommand(token, "startbotchat", { message: chatMsg, rate: Number(chatRate) || 25 });
              onNotify(String(res.msg || "تم البدء"), !res.err);
            }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            <Play className="w-3.5 h-3.5" />
            بدء التحدث
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await getApiClient().cpCommand(token, "stopbotchat");
              onNotify(String(res.msg || "تم الإيقاف"), !res.err);
            }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold"
          >
            <Square className="w-3.5 h-3.5" />
            إيقاف
          </button>
        </div>
      </div>

      <div className={`p-4 rounded-3xl border space-y-2 max-h-[460px] overflow-y-auto chat-scroll ${cardCls}`}>
        {bots.map((b) => {
          const bid = String(b.id || "");
          return (
            <div key={bid} className={`p-2.5 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-2 ${subCls}`}>
              <div>
                <strong>{String(b.topic)}</strong> <span className="opacity-65">({String(b.country)} | غرفة: {String(b.room || "الافتراضية")})</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await getApiClient().cpCommand(token, "enterbot", { id: bid });
                    onNotify(String(res.msg || "تم التحديث"), true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-sky-600 text-white text-[11px] font-bold"
                >
                  دخول / خروج
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await getApiClient().cpCommand(token, "deltbot", { id: bid });
                    void load();
                  }}
                  className="p-1.5 rounded-xl bg-rose-600 text-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CpHostingTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [hosts, setHosts] = useState<Array<Record<string, unknown>>>([]);
  const [ddos, setDdos] = useState<Record<string, unknown> | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [tvUrl, setTvUrl] = useState("");
  const [maxRepVal, setMaxRepVal] = useState("10");
  const [blockIp, setBlockIp] = useState("");
  const [states, setStates] = useState({ rc: false, coom: false, bnr: false, offline: false, vpn: false });

  const load = useCallback(async () => {
    const api = getApiClient();
    const [h, d, r1, r2, r3, r4, r5, tvR, mrR] = await Promise.all([
      api.cpCommand(token, "hostnames").catch(() => null),
      api.cpCommand(token, "ddos_status").catch(() => null),
      api.cpCommand(token, "rc").catch(() => null),
      api.cpCommand(token, "coom").catch(() => null),
      api.cpCommand(token, "bnr").catch(() => null),
      api.cpCommand(token, "hostinge").catch(() => null),
      api.cpCommand(token, "hostingr").catch(() => null),
      api.cpCommand(token, "tvtv").catch(() => null),
      api.cpCommand(token, "maxrep").catch(() => null),
    ]);
    if (Array.isArray((h as { msg?: unknown } | null)?.msg)) {
      setHosts((h as { msg: Array<Record<string, unknown>> }).msg);
    }
    if ((d as { data?: Record<string, unknown> } | null)?.data) {
      setDdos((d as { data: Record<string, unknown> }).data);
    }
    setStates({
      rc: Boolean((r1 as { msg?: unknown } | null)?.msg),
      coom: Boolean((r2 as { msg?: unknown } | null)?.msg),
      bnr: Boolean((r3 as { msg?: unknown } | null)?.msg),
      offline: Boolean((r4 as { msg?: unknown } | null)?.msg),
      vpn: Boolean((r5 as { msg?: unknown } | null)?.msg),
    });
    if (typeof (tvR as { msg?: unknown } | null)?.msg === "string") setTvUrl(String((tvR as { msg: string }).msg));
    if (typeof (mrR as { msg?: unknown } | null)?.msg === "number") setMaxRepVal(String((mrR as { msg: number }).msg));
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const runDelfpc = async (evt: string) => {
    const res = await getApiClient().cpCommand(token, "delfpc", { event: evt });
    onNotify(String((res as { data?: unknown }).data || res.msg || "تم التنفيذ"), !res.err);
    void load();
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <Server className="w-4 h-4 text-sky-400" />
          مفاتيح التحكم الفورية وأدوات التنظيف
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            { evt: "rc", label: "إعادة الاتصال التلقائي", active: states.rc },
            { evt: "coom", label: "تعليقات الحائط", active: states.coom },
            { evt: "mbnr", label: "البنر العلوي", active: states.bnr },
            { evt: "fixuser", label: "تثبيت العضويات", active: states.offline },
            { evt: "vpns", label: "حظر VPN/البروكسي", active: states.vpn },
            { evt: "ficbar", label: "تثبيت الحائط", active: true },
          ].map((btn) => (
            <button
              key={btn.evt}
              type="button"
              onClick={() => void runDelfpc(btn.evt)}
              className={`p-2.5 rounded-2xl border font-bold text-right flex justify-between items-center ${subCls}`}
            >
              <span>{btn.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] text-white ${btn.active ? "bg-emerald-600" : "bg-slate-600"}`}>
                {btn.active ? "مفعل" : "متوقف"}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/40 text-xs">
          {[
            { evt: "purgecache", label: "مسح الكاش" },
            { evt: "warmcache", label: "بناء الكاش" },
            { evt: "bars", label: "حذف الحائط" },
            { evt: "strdel", label: "حذف القصص" },
            { evt: "fps", label: "حذف سجل الدخول" },
            { evt: "actions", label: "حذف سجل الحالات" },
            { evt: "names", label: "حذف كشف الأسماء" },
            { evt: "filesClear", label: "تنظيف المرفقات" },
          ].map((c) => (
            <button
              key={c.evt}
              type="button"
              onClick={() => void runDelfpc(c.evt)}
              className="px-3 py-1.5 rounded-xl bg-rose-600/85 hover:bg-rose-600 text-white font-bold"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
          <h3 className="text-xs font-extrabold flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-400" />
            الدومينات والراديو ({hosts.length})
          </h3>
          <div className="flex gap-2">
            <input type="text" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" className={inputCls} />
            <button
              type="button"
              onClick={async () => {
                if (!newDomain.trim()) return;
                const res = await getApiClient().cpCommand(token, "adddmoin", { event: newDomain.trim() });
                onNotify(String((res as { data?: unknown }).data || "تم"), !res.err);
                setNewDomain("");
                void load();
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0"
            >
              إضافة دومين
            </button>
          </div>
          <div className="space-y-1.5">
            {hosts.map((h) => (
              <div key={String(h.id)} className={`p-2 rounded-xl border text-xs flex justify-between items-center ${subCls}`}>
                <span>{String(h.hostname)}</span>
                {Number(h.id) > 1 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await getApiClient().cpCommand(token, "removedmoin", { event: h.id });
                      void load();
                    }}
                    className="text-rose-400 text-[11px] font-bold"
                  >
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-800/40">
            <input type="text" value={tvUrl} onChange={(e) => setTvUrl(e.target.value)} placeholder="رابط البث المباشر / الراديو..." className={inputCls} />
            <button
              type="button"
              onClick={async () => {
                await getApiClient().cpCommand(token, "addtv", { event: tvUrl.trim() });
                onNotify("تم تحديث رابط الراديو");
              }}
              className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0"
            >
              حفظ
            </button>
          </div>
          <div className="flex gap-2">
            <input type="number" min={4} max={99} value={maxRepVal} onChange={(e) => setMaxRepVal(e.target.value)} className={inputCls} />
            <button
              type="button"
              onClick={async () => {
                const res = await getApiClient().cpCommand(token, "addrep", { event: maxRepVal });
                onNotify(String((res as { data?: unknown }).data || "تم"));
              }}
              className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold shrink-0"
            >
              أقصى لايكات
            </button>
          </div>
        </div>

        <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              حماية DDoS
            </h3>
            <button type="button" onClick={() => void load()} className="p-1.5 rounded-lg bg-slate-800 text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className={`p-3 rounded-2xl border text-xs space-y-1 ${subCls}`}>
            <div>الوضع الحالي: <strong className="text-amber-400">{ddos?.strict ? "متشدد (STRICT)" : "عادي (NORMAL)"}</strong></div>
            <div className="flex gap-2 pt-1.5">
              <button
                type="button"
                onClick={async () => {
                  await getApiClient().cpCommand(token, "ddos_mode", { mode: ddos?.strict ? "normal" : "strict" });
                  onNotify("تم تغيير وضع الحماية");
                  void load();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold"
              >
                تبديل الوضع
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input type="text" value={blockIp} onChange={(e) => setBlockIp(e.target.value)} placeholder="حظر IP يدوي..." className={inputCls} />
            <button
              type="button"
              onClick={async () => {
                if (!blockIp.trim()) return;
                const res = await getApiClient().cpCommand(token, "ddos_block_ip", { ip: blockIp.trim() });
                onNotify(String(res.msg || "تم الحظر"), !res.err);
                setBlockIp("");
                void load();
              }}
              className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0"
            >
              حظر IP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
