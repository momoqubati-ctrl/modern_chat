import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Gamepad2,
  Info,
  LogIn,
  MessageSquareHeart,
  Moon,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { normalizeHexColor, resolveAssetUrl, resolveCountryFlagUrl } from "../lib/mediaUrl.js";
import { MemberAvatar, MemberBadgesInline } from "./MemberAvatar.js";

interface LoginScreenProps {
  dark: boolean;
  onToggleTheme: () => void;
  onNavigate?: (path: string) => void;
}

export function LoginScreen({ dark, onToggleTheme, onNavigate }: LoginScreenProps) {
  const site = useChatStore((s) => s.site);
  const connected = useChatStore((s) => s.connected);
  const onlineCount = useChatStore((s) => s.onlineCount);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const onlineIds = useChatStore((s) => s.onlineIds);
  const rooms = useChatStore((s) => s.rooms);
  const lastAuthError = useChatStore((s) => s.lastAuthError);
  const pendingDeepLinkRoomId = useChatStore((s) => s.pendingDeepLinkRoomId);

  const loginGuest = useChatStore((s) => s.loginGuest);
  const loginMember = useChatStore((s) => s.loginMember);
  const registerMember = useChatStore((s) => s.registerMember);
  const clearAuthError = useChatStore((s) => s.clearAuthError);

  const allowGuest = site?.allowg !== false;
  const allowRegister = site?.allowreg !== false;

  const [tab, setTab] = useState<"guest" | "member" | "register">(() =>
    allowGuest ? "guest" : "member",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [topic, setTopic] = useState("");
  const [slideIdx, setSlideIdx] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Enforce allowg / allowreg dynamically when site config loads
  useEffect(() => {
    if (!allowGuest && tab === "guest") setTab("member");
    if (!allowRegister && tab === "register") setTab(allowGuest ? "guest" : "member");
  }, [allowGuest, allowRegister, tab]);

  const slides = useMemo(() => {
    const raw = Array.isArray(site?.entrySlides) ? site.entrySlides : [];
    return raw.filter((s) => Boolean(s?.file || s?.image || s?.src || s?.img));
  }, [site?.entrySlides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  const onlinePreview = useMemo(
    () =>
      onlineIds
        .slice(0, 24)
        .map((id) => onlineMap[id])
        .filter((u): u is NonNullable<typeof u> => Boolean(u && !u.s)),
    [onlineIds, onlineMap],
  );

  const deepLinkRoom = useMemo(
    () =>
      pendingDeepLinkRoomId
        ? rooms.find((r) => r.id === pendingDeepLinkRoomId || String(r.idroom) === pendingDeepLinkRoomId)
        : null,
    [pendingDeepLinkRoomId, rooms],
  );

  const siteTitle = site?.title || site?.name || "NewChat";
  const siteDesc =
    site?.description || "منصة الدردشة العربية الحديثة للصوت والكتابة والحائط والقصص والألعاب التفاعلية.";
  const accentBg = normalizeHexColor(site?.colors?.bgcolor, "#0A6E8C");
  const buttonBg = normalizeHexColor(site?.colors?.btcolor, "#4F46E5");

  const logoUrl = site?.logoOptimized
    ? resolveAssetUrl(site.logoOptimized, "site", "")
    : site?.logo
      ? resolveAssetUrl(site.logo, "site", "")
      : "";
  const bannerUrl = site?.bannerOptimized
    ? resolveAssetUrl(site.bannerOptimized, "site", "")
    : site?.banner
      ? resolveAssetUrl(site.banner, "site", "")
      : "";

  const availableTabs = useMemo(() => {
    const list: Array<{ key: "guest" | "member" | "register"; label: string }> = [];
    if (allowGuest) list.push({ key: "guest", label: "دخول زائر" });
    list.push({ key: "member", label: "دخول عضو" });
    if (allowRegister) list.push({ key: "register", label: "تسجيل" });
    return list;
  }, [allowGuest, allowRegister]);

  const handleTabChange = (nextTab: "guest" | "member" | "register") => {
    clearAuthError();
    setTab(nextTab);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !connected) return;
    if (tab === "guest") {
      if (!allowGuest) return;
      loginGuest(username);
    } else if (tab === "member") {
      loginMember(username, password);
    } else {
      if (!allowRegister) return;
      registerMember(username, password, { topic: topic.trim() || username.trim() });
    }
  };

  const currentSlide = slides[slideIdx];
  const currentSlideImg = currentSlide
    ? resolveAssetUrl(String(currentSlide.file || currentSlide.image || currentSlide.src || currentSlide.img), "entry_slides", "")
    : "";

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors ${
        dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Top Navbar with optional site banner tint */}
      <header
        className={`w-full border-b px-4 sm:px-6 py-3 ${
          dark ? "bg-slate-900/90 border-slate-800" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={siteTitle}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="w-11 h-11 rounded-2xl object-cover border border-slate-700/40 shrink-0 shadow"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                style={{ background: `linear-gradient(135deg, ${accentBg}, ${buttonBg})` }}
              >
                <MessageSquareHeart className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold truncate">{siteTitle}</h1>
              <p className={`text-xs truncate max-w-xs sm:max-w-md ${dark ? "text-slate-400" : "text-slate-500"}`}>
                {siteDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                connected
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/30"
              }`}
            >
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{connected ? "متصل" : "جاري الاتصال..."}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                dark
                  ? "border-slate-700 bg-slate-900 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>عن الدردشة</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                dark
                  ? "border-slate-700 bg-slate-900 hover:bg-slate-800"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              {dark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
              <span className="hidden sm:inline">{dark ? "نهاري" : "ليلي"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 grid lg:grid-cols-12 gap-6 items-start flex-1">
        {/* Login Card (First on mobile, 5 cols on desktop) */}
        <section
          className={`lg:col-span-5 lg:order-2 rounded-3xl p-5 sm:p-6 border shadow-xl ${
            dark ? "bg-slate-900/95 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          {site?.ifbanner !== false && bannerUrl && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-slate-800/40 max-h-28 bg-slate-950/30">
              <img
                src={bannerUrl}
                alt={siteTitle}
                onError={(e) => {
                  e.currentTarget.parentElement!.style.display = "none";
                }}
                className="w-full h-28 object-cover"
              />
            </div>
          )}

          {pendingDeepLinkRoomId && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 px-3 py-2 text-xs font-semibold">
              <DoorOpen className="w-4 h-4 shrink-0" />
              <span>
                ستنضم مباشرة إلى: {deepLinkRoom?.topic || `غرفة #${pendingDeepLinkRoomId}`}
              </span>
            </div>
          )}

          {/* Auth Tabs */}
          <div
            className={`grid gap-1 p-1 rounded-2xl mb-4 ${
              availableTabs.length === 3
                ? "grid-cols-3"
                : availableTabs.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-1"
            } ${dark ? "bg-slate-950" : "bg-slate-100"}`}
          >
            {availableTabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleTabChange(item.key)}
                className={`py-2.5 rounded-xl text-xs font-bold transition ${
                  tab === item.key
                    ? "text-white shadow"
                    : dark
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                }`}
                style={tab === item.key ? { backgroundColor: buttonBg } : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>

          {lastAuthError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{lastAuthError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {tab === "guest" ? "الاسم المستعار" : "اسم المستخدم"}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (lastAuthError) clearAuthError();
                }}
                placeholder={tab === "guest" ? "اكتب اسمك المستعار..." : "اسم الحساب..."}
                required
                maxLength={50}
                className={`w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none transition ${
                  dark
                    ? "bg-slate-950 border-slate-800 focus:border-sky-500"
                    : "bg-slate-50 border-slate-200 focus:border-sky-500"
                }`}
              />
            </div>

            {tab === "register" && (
              <div>
                <label className="block text-xs font-semibold mb-1.5">الاسم الظاهر في الدردشة (اختياري)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="اتركه فارغاً لاستخدام اسم المستخدم"
                  maxLength={60}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none transition ${
                    dark
                      ? "bg-slate-950 border-slate-800 focus:border-sky-500"
                      : "bg-slate-50 border-slate-200 focus:border-sky-500"
                  }`}
                />
              </div>
            )}

            {tab !== "guest" && (
              <div>
                <label className="block text-xs font-semibold mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (lastAuthError) clearAuthError();
                  }}
                  placeholder="••••••••"
                  required
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none transition ${
                    dark
                      ? "bg-slate-950 border-slate-800 focus:border-sky-500"
                      : "bg-slate-50 border-slate-200 focus:border-sky-500"
                  }`}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={!connected}
              className="w-full flex items-center justify-center gap-2 rounded-xl disabled:opacity-50 text-white font-bold py-3 text-sm shadow-lg transition hover:brightness-110"
              style={{ background: `linear-gradient(135deg, ${buttonBg}, ${accentBg})` }}
            >
              {tab === "register" ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              <span>
                {tab === "guest"
                  ? "دخول مباشر للدردشة"
                  : tab === "member"
                    ? "تسجيل الدخول"
                    : "إنشاء عضوية جديدة"}
              </span>
            </button>
          </form>

          {!allowGuest && (
            <p className="mt-3 text-[11px] text-amber-400 text-center">
              دخول الزوار مغلق حالياً من قبل الإدارة — متاح للأعضاء المسجلين فقط.
            </p>
          )}
          {!allowRegister && (
            <p className="mt-2 text-[11px] text-slate-400 text-center">
              التسجيل الجديد مغلق مؤقتاً من قبل الإدارة.
            </p>
          )}

          {/* Quick Stats Pills */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800/30 text-center">
            <div className={`rounded-xl p-2.5 ${dark ? "bg-slate-950/70" : "bg-slate-50"}`}>
              <div className="text-base sm:text-lg font-extrabold text-emerald-400">{onlineCount}</div>
              <div className="text-[11px] text-slate-400">متواجد الآن</div>
            </div>
            <div className={`rounded-xl p-2.5 ${dark ? "bg-slate-950/70" : "bg-slate-50"}`}>
              <div className="text-base sm:text-lg font-extrabold text-sky-400">{rooms.length || 1}</div>
              <div className="text-[11px] text-slate-400">الغرف النشطة</div>
            </div>
            <div className={`rounded-xl p-2.5 ${dark ? "bg-slate-950/70" : "bg-slate-50"}`}>
              <div className="text-base sm:text-lg font-extrabold text-violet-400">
                {site?.micProvider === "WEBRTC"
                  ? "WebRTC"
                  : site?.micProvider === "JITSI"
                    ? "Jitsi"
                    : "LiveKit"}
              </div>
              <div className="text-[11px] text-slate-400">البث الصوتي</div>
            </div>
          </div>
        </section>

        {/* Left Column on Desktop: Slides + Online Users Preview (7 cols) */}
        <section className="lg:col-span-7 lg:order-1 space-y-5">
          {slides.length > 0 && currentSlideImg ? (
            <div
              className={`relative rounded-3xl overflow-hidden border shadow-lg ${
                dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <img
                src={currentSlideImg}
                alt={String(currentSlide?.title || "عرض الدردشة")}
                className="w-full h-56 sm:h-64 object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white">
                <div className="font-bold text-sm">
                  {String(currentSlide?.title || siteTitle)}
                </div>
                {Boolean(currentSlide?.subtitle || currentSlide?.caption) && (
                  <div className="text-xs text-slate-200 mt-0.5">
                    {String(currentSlide?.subtitle || currentSlide?.caption)}
                  </div>
                )}
              </div>
              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSlideIdx((slideIdx - 1 + slides.length) % slides.length)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/75"
                    aria-label="الشريحة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideIdx((slideIdx + 1) % slides.length)}
                    className="absolute top-1/2 left-3 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/75"
                    aria-label="الشريحة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSlideIdx(i)}
                        aria-label={`شريحة ${i + 1}`}
                        className={`h-1.5 rounded-full transition ${
                          i === slideIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              className={`rounded-3xl p-6 border ${
                dark
                  ? "bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/40 border-slate-800"
                  : "bg-gradient-to-br from-white to-sky-50 border-slate-200 shadow-sm"
              }`}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 text-sky-400 px-3 py-1 text-xs font-semibold border border-sky-500/20 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>تجربة عربية متكاملة على الويب والجوال</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-snug mb-2">
                أهلاً بك في {siteTitle}
              </h2>
              <p className={`text-xs sm:text-sm leading-relaxed ${dark ? "text-slate-400" : "text-slate-600"}`}>
                تواصل صوتي ونصي فوري، غرف عامة وخاصة، حائط منشورات، قصص يومية، بريد داخلي، مسابقات ذكية،
                وطاولة كيرم جماعية مباشرة مع جميع الميزات دون نقصان.
              </p>
            </div>
          )}

          {/* Live Online Members Preview Strip */}
          <div
            className={`rounded-3xl p-4 sm:p-5 border ${
              dark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>المتواجدون في الدردشة الآن</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                {onlineCount} عضو وزائر
              </span>
            </div>

            {onlinePreview.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">
                سجّل دخولك لتظهر هنا وتتواصل مع المتواجدين مباشرة
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto chat-scroll pl-1">
                {onlinePreview.map((u) => {
                  const flag = resolveCountryFlagUrl(u.co);
                  return (
                    <div
                      key={u.id}
                      className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 border ${
                        dark ? "bg-slate-950/70 border-slate-800/80" : "bg-slate-50 border-slate-200/80"
                      }`}
                    >
                      <MemberAvatar
                        pic={u.pic}
                        cover={u.cover}
                        topic={u.topic}
                        stat={u.stat}
                        offline={u.offline}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-bold truncate" style={{ color: u.ucol || undefined }}>
                            {u.topic}
                          </span>
                          <MemberBadgesInline user={u} />
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <span>{u.msg || "متصل الآن"}</span>
                          {!flag && u.co && <span>({u.co})</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Standalone Tools / Portals Quick Links */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.("/carrom")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                dark ? "bg-slate-900 border-slate-800 hover:border-sky-500/40" : "bg-white border-slate-200 hover:border-sky-400"
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-sky-400" />
              <span>صالة الكيرم المستقلة</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("/agent/topup")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                dark ? "bg-slate-900 border-slate-800 hover:border-emerald-500/40" : "bg-white border-slate-200 hover:border-emerald-400"
              }`}
            >
              <Store className="w-4 h-4 text-emerald-400" />
              <span>بوابة الوكلاء</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.("/cp")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                dark ? "bg-slate-900 border-slate-800 hover:border-amber-500/40" : "bg-white border-slate-200 hover:border-amber-400"
              }`}
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>لوحة التحكم</span>
            </button>
          </div>
        </section>
      </main>

      <footer className={`py-3 px-4 text-center text-[11px] border-t ${dark ? "border-slate-900 text-slate-500" : "border-slate-200 text-slate-500"}`}>
        {siteTitle} • جميع الحقوق محفوظة
      </footer>

      {/* Site Info & Rules Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-3xl border p-5 sm:p-6 shadow-2xl space-y-4 ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/30 pb-3">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span>معلومات وقوانين {siteTitle}</span>
              </div>
              <button type="button" onClick={() => setShowInfoModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs leading-relaxed">
              <p>{siteDesc}</p>
              <div className={`rounded-2xl p-3.5 border ${dark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="font-bold mb-1.5 text-sky-400">حدود وشروط التفاعل:</div>
                <ul className="space-y-1 list-disc list-inside text-slate-400">
                  <li>النشر على الحائط يتطلب {site?.bclikes ?? 10} إعجاب (لايك)</li>
                  <li>الرسائل والمكالمات الخاصة تتطلب {site?.pmlikes ?? 2000} إعجاب</li>
                  <li>الصعود على المايك الصوتي يتطلب {site?.miclikes ?? 5000} إعجاب</li>
                  <li>رفع الملفات والصوتيات يتطلب {site?.fileslikes ?? 90000} إعجاب</li>
                  <li>يمنع التكرار أو السبام أو مخالفة القوانين العامة للغرف</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
