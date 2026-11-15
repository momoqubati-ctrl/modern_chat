import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Globe, Mic, Radio, RefreshCw, Save, Server, ShieldCheck, Trash2 } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { MicProviderMode } from "@newchat/shared";
import type { CpTabProps } from "./CpOverviewLogs.js";

interface LiveKitPublicMeta {
  wsUrl: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  source: "db" | "env" | "none";
  ready: boolean;
}

const PROVIDER_CATALOG: Array<{
  id: MicProviderMode;
  title: string;
  badge: string;
  description: string;
  accent: "emerald" | "sky" | "violet";
}> = [
  {
    id: "WEBRTC",
    title: "WebRTC (مباشر)",
    badge: "مدمج ويعمل فوراً",
    description:
      "اتصال صوتي فوري عبر WebRTC + STUN وإشارات الغرفة الآمنة، مناسب للعمل الفوري مع توهج التحدث اللحظي بدون الحاجة لخادم إضافي.",
    accent: "emerald",
  },
  {
    id: "LIVEKIT",
    title: "LiveKit SFU",
    badge: "سعة الآلاف من المستمعين",
    description:
      "خادم SFU احترافي عالي السعة (Adaptive Stream & Dynacast) يتحمل آلاف المستمعين في الغرفة الواحدة مع أذونات نشر صارمة.",
    accent: "sky",
  },
  {
    id: "JITSI",
    title: "Jitsi Meet",
    badge: "جسر صوتي خارجي",
    description:
      "جسر غرف صوتي خارجي عبر Jitsi Meet مضمن في الغرفة الصوتية حسب التخصيص.",
    accent: "violet",
  },
];

export function CpVoiceProviderTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [selectedProvider, setSelectedProvider] = useState<MicProviderMode>("WEBRTC");
  const [livekitMeta, setLivekitMeta] = useState<LiveKitPublicMeta>({
    wsUrl: "",
    hasApiKey: false,
    hasApiSecret: false,
    source: "none",
    ready: false,
  });
  const [wsUrlDraft, setWsUrlDraft] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiSecretDraft, setApiSecretDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProviderState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getApiClient().cpCommand(token, "micproviderget", { domin: 1 });
      if (res.err) {
        onNotify(String(res.msg || "تعذر تحميل إعدادات مزود الصوت"), false);
        return;
      }
      const data = (res.data || {}) as {
        micprovider?: MicProviderMode;
        livekit?: LiveKitPublicMeta;
      };
      if (data.micprovider) {
        setSelectedProvider(data.micprovider);
      }
      if (data.livekit) {
        setLivekitMeta(data.livekit);
        setWsUrlDraft(String(data.livekit.wsUrl || ""));
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "تعذر جلب مزود الصوت", false);
    } finally {
      setLoading(false);
    }
  }, [token, getApiClient, onNotify]);

  useEffect(() => {
    void loadProviderState();
  }, [loadProviderState]);

  const handleSelectProvider = async (nextProvider: MicProviderMode) => {
    setSaving(true);
    try {
      const res = await getApiClient().cpCommand(token, "micprovidersave", {
        domin: 1,
        provider: nextProvider,
      });
      if (res.err) {
        onNotify(String(res.msg || "فشل حفظ مزود الصوت"), false);
        return;
      }
      const data = (res.data || {}) as {
        micprovider?: MicProviderMode;
        livekit?: LiveKitPublicMeta;
      };
      if (data.micprovider) setSelectedProvider(data.micprovider);
      if (data.livekit) setLivekitMeta(data.livekit);
      onNotify(`تم تفعيل مزود الصوت (${nextProvider}) وتحديث الغرف المتصلة`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "تعذر تحديث مزود الصوت", false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLiveKitCreds = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        domin: 1,
        provider: selectedProvider,
        livekitWsUrl: wsUrlDraft.trim(),
      };
      if (apiKeyDraft.trim()) payload.livekitApiKey = apiKeyDraft.trim();
      if (apiSecretDraft.trim()) payload.livekitApiSecret = apiSecretDraft.trim();

      const res = await getApiClient().cpCommand(token, "micprovidersave", payload);
      if (res.err) {
        onNotify(String(res.msg || "تعذر حفظ بيانات LiveKit"), false);
        return;
      }
      const data = (res.data || {}) as {
        micprovider?: MicProviderMode;
        livekit?: LiveKitPublicMeta;
      };
      if (data.livekit) {
        setLivekitMeta(data.livekit);
        setWsUrlDraft(String(data.livekit.wsUrl || ""));
      }
      setApiKeyDraft("");
      setApiSecretDraft("");
      onNotify("تم حفظ إعدادات خادم LiveKit المشفرة بنجاح");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ أثناء الحفظ", false);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDbCreds = async () => {
    setSaving(true);
    try {
      const res = await getApiClient().cpCommand(token, "micprovidersave", {
        domin: 1,
        provider: selectedProvider,
        clearLivekit: true,
      });
      if (res.err) {
        onNotify(String(res.msg || "تعذر مسح البيانات المحفوظة"), false);
        return;
      }
      const data = (res.data || {}) as { livekit?: LiveKitPublicMeta };
      if (data.livekit) {
        setLivekitMeta(data.livekit);
        setWsUrlDraft(String(data.livekit.wsUrl || ""));
      }
      setApiKeyDraft("");
      setApiSecretDraft("");
      onNotify("تم مسح بيانات LiveKit من قاعدة البيانات والعودة لإعدادات الخادم");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    } finally {
      setSaving(false);
    }
  };

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div className="space-y-4">
      {/* Header Summary Card */}
      <div className={`p-4 rounded-3xl border space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-400" />
              مزود الصوت والمايكات (الاستيج الصوتي)
            </h2>
            <p className="text-[11px] opacity-70 mt-0.5">
              اختر محرك البث الصوتي النشط للموقع بالكامل؛ يتم تطبيق التغيير فورياً على جميع الغرف المتصلة بدون إعادة تشغيل.
            </p>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void loadProviderState()}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-100"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>

        {/* Provider Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PROVIDER_CATALOG.map((item) => {
            const active = selectedProvider === item.id;
            const icon =
              item.id === "WEBRTC" ? (
                <Radio className="w-4 h-4 text-emerald-400" />
              ) : item.id === "LIVEKIT" ? (
                <Server className="w-4 h-4 text-sky-400" />
              ) : (
                <Globe className="w-4 h-4 text-violet-400" />
              );

            const ringClass = active
              ? item.accent === "emerald"
                ? "border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/5"
                : item.accent === "sky"
                  ? "border-sky-500 ring-2 ring-sky-500/25 bg-sky-500/5"
                  : "border-violet-500 ring-2 ring-violet-500/25 bg-violet-500/5"
              : `${subCls} hover:border-sky-500/40`;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition ${ringClass}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-extrabold text-xs">
                      {icon}
                      <span>{item.title}</span>
                    </div>
                    {active && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold">
                        <CheckCircle2 className="w-3 h-3" />
                        نشط الآن
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold opacity-75">{item.badge}</div>
                  <p className="text-[11px] leading-relaxed opacity-80">{item.description}</p>
                  {item.id === "LIVEKIT" && (
                    <div
                      className={`text-[10px] px-2.5 py-1 rounded-xl border font-bold ${
                        livekitMeta.ready
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {livekitMeta.ready
                        ? `LiveKit جاهز (${livekitMeta.source === "db" ? "من لوحة التحكم" : "من .env"})`
                        : "بيانات LiveKit غير مكتملة — أكمل الإعداد بالأسفل قبل التفعيل"}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={saving || active}
                  onClick={() => void handleSelectProvider(item.id)}
                  className={`w-full py-2 rounded-xl text-xs font-extrabold transition ${
                    active
                      ? "bg-emerald-600/20 text-emerald-400 cursor-default"
                      : "bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50"
                  }`}
                >
                  {active ? "المزود المُختار حالياً" : `تفعيل ${item.title}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* LiveKit Credentials Card */}
      <form onSubmit={handleSaveLiveKitCreds} className={`p-4 rounded-3xl border space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-extrabold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              إعدادات خادم LiveKit SFU (تخزين مشفّر AES-256-GCM)
            </h3>
            <p className="text-[11px] opacity-65 mt-0.5">
              اترك حقول API Key أو Secret فارغة عند الرغبة بالإبقاء على القيم المحفوظة حالياً.
            </p>
          </div>
          {livekitMeta.source === "db" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleResetDbCreds()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 text-[11px] font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              الرجوع لإعدادات .env
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold mb-1">رابط الخادم (WebSocket URL)</label>
            <input
              type="url"
              dir="ltr"
              placeholder="wss://your-project.livekit.cloud"
              value={wsUrlDraft}
              onChange={(e) => setWsUrlDraft(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">
              API Key {livekitMeta.hasApiKey ? "(محفوظ ✓)" : "(غير محفوظ)"}
            </label>
            <input
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder={livekitMeta.hasApiKey ? "•••••••••••• (اتركه فارغاً للإبقاء)" : "APIxxxxxxxx"}
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">
              API Secret {livekitMeta.hasApiSecret ? "(محفوظ ✓)" : "(غير محفوظ)"}
            </label>
            <input
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder={
                livekitMeta.hasApiSecret
                  ? "•••••••••••• (اتركه فارغاً للإبقاء)"
                  : "لا يقل عن 32 حرفاً"
              }
              value={apiSecretDraft}
              onChange={(e) => setApiSecretDraft(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-extrabold"
        >
          <Save className="w-4 h-4" />
          حفظ بيانات LiveKit
        </button>
      </form>
    </div>
  );
}
