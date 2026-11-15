import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  Ban,
  Bot,
  Crown,
  DoorOpen,
  FileText,
  Filter,
  Gift,
  KeyRound,
  LogIn,
  Menu,
  Mic,
  Moon,
  Scissors,
  Server,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { CpLogsAndActionsTab, CpOverviewTab } from "./cp/CpOverviewLogs.js";
import { CpPowersTab, CpSubsTab, CpUsersTab } from "./cp/CpUsersRoles.js";
import { CpBansTab, CpFiltersTab, CpRoomsTab, CpShortcutsAndMsgsTab } from "./cp/CpRoomsFiltersBans.js";
import { CpEvalPointsTab, CpGiftsTab, CpSiteAndAssetsTab } from "./cp/CpSiteGiftsEval.js";
import { CpEconomyTab } from "./cp/CpEconomyTab.js";
import { CpBotsTab, CpHostingTab } from "./cp/CpBotsHostingTab.js";
import { CpVoiceProviderTab } from "./cp/CpVoiceProviderTab.js";

interface ControlPanelPageProps {
  dark: boolean;
  onToggleTheme: () => void;
  onBackToChat: () => void;
}

type CpTabId =
  | "dashboard"
  | "logs"
  | "users"
  | "subs"
  | "powers"
  | "rooms"
  | "filters"
  | "bans"
  | "shortcuts"
  | "site"
  | "gifts"
  | "eval_points"
  | "voice_provider"
  | "economy"
  | "bots"
  | "hosting";

function resolveInitialToken(storeToken: string | null): string {
  try {
    const qs = new URLSearchParams(window.location.search);
    const fromQuery = qs.get("token")?.trim();
    if (fromQuery) return fromQuery;
  } catch {
    // ignore URL parse error
  }
  if (storeToken?.trim()) return storeToken.trim();
  try {
    return window.localStorage.getItem("newchat_session_token")?.trim() || "";
  } catch {
    return "";
  }
}

export default function ControlPanelPage({
  dark,
  onToggleTheme,
  onBackToChat,
}: ControlPanelPageProps) {
  const storeToken = useChatStore((s) => s.sessionToken);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [token, setToken] = useState<string>(() => resolveInitialToken(storeToken));
  const [cpMe, setCpMe] = useState<Record<string, unknown> | null>(null);
  const [caps, setCaps] = useState({
    setpower: false,
    owner: false,
    hosting: false,
    evalPoints: false,
    micProvider: false,
  });
  const [authChecking, setAuthChecking] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [activeTab, setActiveTab] = useState<CpTabId>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const handleNotify = useCallback((text: string, ok = true) => {
    setNotice({ text, ok });
    pushNotice(text, { topic: "لوحة التحكم", force: ok ? 0 : 1 });
  }, [pushNotice]);

  const verifySession = useCallback(
    async (candidateToken: string) => {
      if (!candidateToken.trim()) {
        setCpMe(null);
        return;
      }
      setAuthChecking(true);
      try {
        const api = getApiClient();
        const meRes = await api.cpCommand(candidateToken, "cpme");
        if (meRes.err || !meRes.data) {
          setCpMe(null);
          handleNotify(String(meRes.msg || "التوكن لا يملك صلاحية الدخول للوحة"), false);
          return;
        }
        setCpMe(meRes.data as Record<string, unknown>);
        try {
          window.localStorage.setItem("newchat_session_token", candidateToken.trim());
        } catch {
          // ignore
        }

        const [p1, p2, p3, p4, p5] = await Promise.all([
          api.cpCommand(candidateToken, "IsStartap").catch(() => ({ msg: false })),
          api.cpCommand(candidateToken, "IsStarta").catch(() => ({ msg: false })),
          api.cpCommand(candidateToken, "IsStart").catch(() => ({ msg: false })),
          api.cpCommand(candidateToken, "IsStartEvaluationPoints").catch(() => ({ msg: false })),
          api.cpCommand(candidateToken, "IsStartMicProvider").catch(() => ({ msg: false })),
        ]);
        setCaps({
          setpower: Boolean((p1 as { msg?: boolean }).msg),
          owner: Boolean((p2 as { msg?: boolean }).msg),
          hosting: Boolean((p3 as { msg?: boolean }).msg),
          evalPoints: Boolean((p4 as { msg?: boolean }).msg),
          micProvider: Boolean((p5 as { msg?: boolean }).msg),
        });
      } catch (err) {
        setCpMe(null);
        handleNotify(err instanceof Error ? err.message : "فشل التحقق", false);
      } finally {
        setAuthChecking(false);
      }
    },
    [getApiClient, handleNotify],
  );

  useEffect(() => {
    if (token) void verifySession(token);
  }, [token, verifySession]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    try {
      const res = await getApiClient().loginMember({ username: username.trim(), password, refr: "cp" });
      if (!res.sessionToken) {
        handleNotify(res.message || "بيانات الدخول غير صحيحة", false);
        return;
      }
      setToken(res.sessionToken);
    } catch (err) {
      handleNotify(err instanceof Error ? err.message : "تعذر تسجيل الدخول", false);
    }
  };

  const navItems: Array<{ id: CpTabId; label: string; icon: typeof Activity; show?: boolean }> = [
    { id: "dashboard", label: "نظرة عامة", icon: Activity, show: true },
    { id: "logs", label: "سجل الدخول والحالات", icon: FileText, show: true },
    { id: "users", label: "إدارة الأعضاء", icon: Users, show: true },
    { id: "subs", label: "الترقيات والانتهاء", icon: Crown, show: true },
    { id: "powers", label: "الصلاحيات والمجموعات", icon: Shield, show: caps.setpower || caps.owner },
    { id: "rooms", label: "إدارة الغرف", icon: DoorOpen, show: true },
    { id: "filters", label: "الفلتر والكلمات", icon: Filter, show: true },
    { id: "bans", label: "الحظر والقيود", icon: Ban, show: true },
    { id: "shortcuts", label: "الاختصارات والترحيب", icon: Scissors, show: true },
    { id: "site", label: "إعدادات الموقع والشارات", icon: Settings2, show: caps.owner },
    { id: "voice_provider", label: "مزود الصوت والمايكات", icon: Mic, show: caps.micProvider || caps.owner },
    { id: "gifts", label: "الهدايا والأقسام", icon: Gift, show: caps.owner },
    { id: "eval_points", label: "نقاط التقييم", icon: Sparkles, show: caps.evalPoints || caps.owner },
    { id: "economy", label: "المحفظة والوكلاء والشحن", icon: Wallet, show: caps.owner },
    { id: "bots", label: "البوتات والناطق", icon: Bot, show: caps.owner || caps.hosting },
    { id: "hosting", label: "الاستضافة والحماية", icon: Server, show: caps.hosting || caps.owner },
  ];

  const visibleNav = navItems.filter((n) => n.show !== false);
  const pageCls = dark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const surfaceCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div className={`min-h-screen flex flex-col ${pageCls}`}>
      <header className={`border-b px-4 py-3 flex items-center justify-between gap-2 shrink-0 ${surfaceCls}`}>
        <div className="flex items-center gap-2.5">
          {cpMe && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-800/40"
              aria-label="قائمة الإدارة"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold">لوحة تحكم الإدارة</h1>
            {cpMe && (
              <p className="text-[11px] opacity-65">
                {String(cpMe.topic || cpMe.username)} ({String(cpMe.power || "")})
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition ${
              dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-100"
            }`}
          >
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold"
          >
            <ArrowRight className="w-4 h-4" />
            الدردشة
          </button>
        </div>
      </header>

      {notice && (
        <div className="max-w-7xl w-full mx-auto px-4 pt-3">
          <div
            className={`px-4 py-2 rounded-2xl border text-xs font-bold flex justify-between items-center ${
              notice.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!cpMe ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 ${surfaceCls}`}>
            <div className="text-center space-y-1">
              <KeyRound className="w-10 h-10 mx-auto text-amber-400" />
              <h2 className="text-base font-extrabold">تسجيل دخول المشرف / المالك</h2>
              <p className="text-xs opacity-65">
                {authChecking ? "جارٍ التحقق من الصلاحية..." : "سجل بحساب إداري أو الصق التوكن الخاص بك"}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-2.5">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="اسم المستخدم" className={inputCls} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" className={inputCls} />
              <button type="submit" className="w-full py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5">
                <LogIn className="w-4 h-4" />
                دخول
              </button>
            </form>

            <div className="pt-3 border-t border-slate-800/40 space-y-2">
              <label className="block text-[11px] opacity-70">أو الدخول عبر Token الجلسة:</label>
              <div className="flex gap-2">
                <input type="text" value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="الصق التوكن..." className={inputCls} />
                <button
                  type="button"
                  onClick={() => manualToken.trim() && setToken(manualToken.trim())}
                  className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0"
                >
                  تحقق
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Desktop Sidebar */}
          <aside className={`hidden lg:block lg:col-span-3 p-3 rounded-3xl border space-y-1 sticky top-4 ${surfaceCls}`}>
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full px-3 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2.5 transition ${
                    active ? "bg-sky-600 text-white shadow-sm" : "opacity-80 hover:opacity-100 hover:bg-slate-800/35"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex bg-black/60 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)}>
              <aside
                onClick={(e) => e.stopPropagation()}
                className={`w-72 h-full p-4 border-l overflow-y-auto chat-scroll space-y-1.5 ${surfaceCls}`}
              >
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/40">
                  <span className="text-sm font-extrabold">أقسام الإدارة</span>
                  <button type="button" onClick={() => setMobileMenuOpen(false)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2.5 ${
                        active ? "bg-sky-600 text-white" : "hover:bg-slate-800/30"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </aside>
            </div>
          )}

          {/* Main Tab Content */}
          <section className="lg:col-span-9 min-w-0">
            {activeTab === "dashboard" && <CpOverviewTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "logs" && <CpLogsAndActionsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "users" && <CpUsersTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "subs" && <CpSubsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "powers" && <CpPowersTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "rooms" && <CpRoomsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "filters" && <CpFiltersTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "bans" && <CpBansTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "shortcuts" && <CpShortcutsAndMsgsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "site" && <CpSiteAndAssetsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "voice_provider" && <CpVoiceProviderTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "gifts" && <CpGiftsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "eval_points" && <CpEvalPointsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "economy" && <CpEconomyTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "bots" && <CpBotsTab dark={dark} token={token} onNotify={handleNotify} />}
            {activeTab === "hosting" && <CpHostingTab dark={dark} token={token} onNotify={handleNotify} />}
          </section>
        </div>
      )}
    </div>
  );
}
