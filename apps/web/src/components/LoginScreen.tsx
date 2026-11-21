import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  DoorOpen,
  EyeOff,
  Gamepad2,
  Dices,
  LogIn,
  Menu,
  Moon,
  Palette,
  RotateCcw,
  Shield,
  ShieldCheck,
  Store,
  Sun,
  User,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
  Sparkles,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot } from "@newchat/shared";
import {
  adjustColorForTheme,
  getCountryNameArabic,
  getUserNameStyle,
  normalizeHexColor,
  resolveAssetUrl,
  resolveCountryFlagUrl,
} from "../lib/mediaUrl.js";
import { getUserCover, getUserTheme } from "../lib/userCosmetics.js";
import {
  MemberAvatar,
  MemberBadgesInline,
  MemberPrefixIcons,
  getStatusLabel,
} from "./MemberAvatar.js";

interface LoginScreenProps {
  dark: boolean;
  onToggleTheme: () => void;
  onNavigate?: (path: string) => void;
}

// Preset color options matching the Chetos reference palette
const COLOR_PRESETS = [
  { hex: "#624b01", sec: "#8b6d0d", label: "ذهبي ملكي" },
  { hex: "#581845", sec: "#900C3F", label: "برقوقي داكن" },
  { hex: "#870000", sec: "#972727", label: "عنابي كلاسيكي" },
  { hex: "#286c65", sec: "#00b19f", label: "زيتي زمردي" },
  { hex: "#880E4F", sec: "#C2185B", label: "توتي مخملي" },
  { hex: "#40404f", sec: "#49494c", label: "رمادي هادئ" },
  { hex: "#808080", sec: "#C0C0C0", label: "فضي عصري" },
];

export function LoginScreen({ dark, onToggleTheme, onNavigate }: LoginScreenProps) {
  const site = useChatStore((s) => s.site);
  const connected = useChatStore((s) => s.connected);
  const onlineCount = useChatStore((s) => s.onlineCount);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const onlineIds = useChatStore((s) => s.onlineIds);
  const rooms = useChatStore((s) => s.rooms);
  const powers = useChatStore((s) => s.powers);
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
  const [stealth, setStealth] = useState(false);

  const [slideIdx, setSlideIdx] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Custom theme color selected from the Chetos color bar, persisted in localStorage
  const [customColor, setCustomColor] = useState<string | null>(() => {
    try {
      return localStorage.getItem("colorLo");
    } catch {
      return null;
    }
  });

  const defaultThemeColor = useMemo(
    () => normalizeHexColor(site?.colors?.btcolor || site?.colors?.bgcolor, "#4F46E5"),
    [site?.colors?.btcolor, site?.colors?.bgcolor],
  );

  const activeColor = customColor || defaultThemeColor;

  const handleSelectColor = (hex: string) => {
    setCustomColor(hex);
    try {
      localStorage.setItem("colorLo", hex);
    } catch {}
    setShowColorPicker(false);
  };

  const handleResetColor = () => {
    setCustomColor(null);
    try {
      localStorage.removeItem("colorLo");
    } catch {}
    setShowColorPicker(false);
  };

  // Enforce allowg / allowreg dynamically
  useEffect(() => {
    if (!allowGuest && tab === "guest") setTab("member");
    if (!allowRegister && tab === "register") setTab(allowGuest ? "guest" : "member");
  }, [allowGuest, allowRegister, tab]);

  // Slides configuration matching the reference project with graceful fallbacks
  const slides = useMemo(() => {
    const raw = Array.isArray(site?.entrySlides) ? site.entrySlides : [];
    const valid = raw.filter((s) => Boolean(s?.file || s?.image || s?.src || s?.img));
    if (valid.length > 0) {
      return valid.map((s) =>
        resolveAssetUrl(String(s.file || s.image || s.src || s.img), "entry_slides", ""),
      );
    }
    return [
      "/uploads/entry_slides/1773889389802.jpg",
      "/uploads/entry_slides/1773889558137.jpg",
      "/uploads/entry_slides/1773889564385.jpg",
    ].map((path) => resolveAssetUrl(path, "entry_slides", path));
  }, [site?.entrySlides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  const onlineUsersList = useMemo(
    () =>
      onlineIds
        .map((id) => onlineMap[id])
        .filter((u): u is NonNullable<typeof u> => Boolean(u && !u.s && u.id)),
    [onlineIds, onlineMap],
  );

  const deepLinkRoom = useMemo(
    () =>
      pendingDeepLinkRoomId
        ? rooms.find((r) => r.id === pendingDeepLinkRoomId || String(r.idroom) === pendingDeepLinkRoomId)
        : null,
    [pendingDeepLinkRoomId, rooms],
  );

  const siteTitle = site?.title || site?.name || "شات العرب";
  const siteDesc =
    site?.description || "منصة الدردشة العربية التفاعلية للصوت والكتابة والحائط والمسابقات.";

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
      loginMember(username, password, { stealth } as any);
    } else {
      if (!allowRegister) return;
      registerMember(username, password, { topic: topic.trim() || username.trim() });
    }
  };

  return (
    <div
      dir="rtl"
      className={`min-h-screen w-full relative overflow-hidden select-none font-sans ${
        dark ? "bg-slate-950 text-slate-100" : "bg-slate-100/90 text-slate-900"
      }`}
    >
      {/* =========================================================================
          1. Left Presentation Stage (Slideshow) on Screens > 980px
          ========================================================================= */}
      <div
        className="hidden lg:block fixed left-0 top-0 bottom-0 z-0 overflow-hidden bg-[#090d16]"
        style={{ right: "380px" }}
      >
        <ul className="w-full h-full m-0 p-0 list-none relative">
          {slides.map((slideUrl, idx) => (
            <li
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === slideIdx ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <img
                src={slideUrl}
                alt={`entry-slide-${idx + 1}`}
                className="w-full h-full object-cover object-center animate-entry-kenburns"
                loading={idx === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </li>
          ))}
        </ul>

        {/* Ambient Dark Gradient & Vignette Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, rgba(15, 23, 42, 0.45) 0%, rgba(15, 23, 42, 0.10) 50%, rgba(15, 23, 42, 0.70) 100%)",
          }}
        />

        {/* Bottom Floating Tagline on Slides */}
        <div className="absolute bottom-6 right-8 left-8 flex items-center justify-between text-white/90 pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md px-4 py-2 border border-white/10 text-xs font-semibold shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{siteTitle} — محادثات صوتية ونصية فورية ومسابقات تفاعلية</span>
          </div>

          {slides.length > 1 && (
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === slideIdx ? "w-5 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. Right-Anchored Modern 380px Panel (Same Divisions & Boundaries)
          ========================================================================= */}
      <div
        className={`w-full lg:w-[380px] lg:fixed lg:right-0 lg:top-0 lg:bottom-0 z-10 h-screen max-w-[380px] mx-auto flex flex-col shadow-2xl transition-colors border-s border-e ${
          dark
            ? "bg-slate-900/95 border-slate-800 backdrop-blur-xl"
            : "bg-white/95 border-slate-200/90 backdrop-blur-xl"
        }`}
      >
        <div id="Hchat" className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* ----------------- Color Picker Dropdown (.divColorLo) ----------------- */}
          {showColorPicker && (
            <div
              className={`absolute top-12 inset-x-2 z-40 p-3 rounded-2xl shadow-2xl border backdrop-blur-xl flex flex-col gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                dark ? "bg-slate-900/95 border-slate-700/80 text-slate-100" : "bg-white/95 border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold px-0.5">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-sky-400" />
                  <span>اختر نمط الألوان</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetColor}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-500 transition"
                >
                  الافتراضي
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 pt-1">
                {COLOR_PRESETS.map((p) => {
                  const isSelected = activeColor === p.hex;
                  return (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => handleSelectColor(p.hex)}
                      title={p.label}
                      className={`h-7 rounded-xl border transition-all flex items-center justify-center relative ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-sky-400 ring-offset-slate-900 scale-105"
                          : "border-white/20 hover:scale-105"
                      }`}
                      style={{ backgroundColor: p.hex }}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ----------------- Menu Dropdown (.listHome) ----------------- */}
          {showMenu && (
            <div
              className={`absolute top-12 left-2 z-40 w-48 rounded-2xl shadow-2xl border p-1.5 space-y-1 text-xs font-bold backdrop-blur-xl transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                dark ? "bg-slate-900/95 border-slate-700 text-slate-200" : "bg-white/95 border-slate-200 text-slate-700"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowInfoModal(true);
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl flex items-center justify-between transition ${
                  dark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                <span>قوانين الموقع</span>
                <ShieldCheck className="w-4 h-4 text-sky-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onNavigate?.("/carrom");
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl flex items-center justify-between transition ${
                  dark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                <span>صالة الكيرم المستقلة</span>
                <Gamepad2 className="w-4 h-4 text-sky-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onNavigate?.("/ludo");
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl flex items-center justify-between transition ${
                  dark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                <span>صالة اللودو المستقلة</span>
                <Dices className="w-4 h-4 text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onNavigate?.("/agent/topup");
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl flex items-center justify-between transition ${
                  dark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                <span>بوابة الوكلاء</span>
                <Store className="w-4 h-4 text-emerald-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onNavigate?.("/cp");
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl flex items-center justify-between transition ${
                  dark ? "hover:bg-slate-800" : "hover:bg-slate-100"
                }`}
              >
                <span>لوحة التحكم</span>
                <Shield className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          )}

          {/* ----------------- Top Header Bar (label-primary fl) ----------------- */}
          <div
            className="w-full h-11 px-3 flex items-center justify-between text-white shrink-0 select-none shadow-sm transition-all"
            style={{
              background: `linear-gradient(135deg, ${activeColor}, ${activeColor}dd)`,
            }}
          >
            {/* Right: Logo and Site Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={siteTitle}
                  className="w-7 h-7 rounded-xl object-cover border border-white/25 shrink-0 shadow-xs"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-xs">
                  {siteTitle.slice(0, 1)}
                </div>
              )}
              <span className="font-extrabold text-sm truncate tracking-tight text-white drop-shadow-xs max-w-[155px]">
                {siteTitle}
              </span>
            </div>

            {/* Left: Action Buttons (Refresh, Palette, Menu, Theme) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => window.location.reload()}
                title="تحديث الصفحة"
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker((prev) => !prev);
                  setShowMenu(false);
                }}
                title="ألوان المظهر"
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition active:scale-95"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu((prev) => !prev);
                  setShowColorPicker(false);
                }}
                title="قائمة الموقع"
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition active:scale-95"
              >
                <Menu className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                title={dark ? "الوضع النهاري" : "الوضع الليلي"}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition active:scale-95"
              >
                {dark ? (
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-sky-200" />
                )}
              </button>
            </div>
          </div>

          {/* ----------------- Banner Image (.isbnr) ----------------- */}
          {site?.ifbanner !== false && bannerUrl && (
            <div className="w-full shrink-0 max-h-28 overflow-hidden bg-slate-950/20 border-b border-slate-200/60 dark:border-slate-800/60">
              <img
                src={bannerUrl}
                alt={siteTitle}
                className="w-full h-28 object-cover block"
                onError={(e) => {
                  e.currentTarget.parentElement!.style.display = "none";
                }}
              />
            </div>
          )}

          {/* ----------------- Form Container (.homeTop / tabs) ----------------- */}
          <div className="shrink-0 w-full">
            {/* Deep Link indicator if user arrived via room share */}
            {pendingDeepLinkRoomId && (
              <div className="mx-3 mt-2 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-500 text-xs font-semibold flex items-center gap-2">
                <DoorOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  ستنضم مباشرة إلى: {deepLinkRoom?.topic || `غرفة #${pendingDeepLinkRoomId}`}
                </span>
              </div>
            )}

            {/* Modern Segmented Auth Tabs Bar (nav-tabs) */}
            <div className="p-1.5 m-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 flex items-center gap-1 shadow-inner">
              {allowGuest && (
                <button
                  type="button"
                  onClick={() => handleTabChange("guest")}
                  className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold transition-all duration-200 ${
                    tab === "guest"
                      ? "text-white shadow-md shadow-sky-500/20"
                      : dark
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                  style={
                    tab === "guest"
                      ? {
                          background: `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`,
                        }
                      : undefined
                  }
                >
                  <User className="w-3.5 h-3.5" />
                  <span>دخول الزوار</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleTabChange("member")}
                className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold transition-all duration-200 ${
                  tab === "member"
                    ? "text-white shadow-md shadow-sky-500/20"
                    : dark
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-600 hover:text-slate-900"
                }`}
                style={
                  tab === "member"
                    ? {
                        background: `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`,
                      }
                    : undefined
                }
              >
                <User className="w-3.5 h-3.5" />
                <span>دخول الاعضاء</span>
              </button>

              {allowRegister && (
                <button
                  type="button"
                  onClick={() => handleTabChange("register")}
                  className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-extrabold transition-all duration-200 ${
                    tab === "register"
                      ? "text-white shadow-md shadow-sky-500/20"
                      : dark
                        ? "text-slate-400 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                  style={
                    tab === "register"
                      ? {
                          background: `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`,
                        }
                      : undefined
                  }
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>تسجيل عضويه</span>
                </button>
              )}
            </div>

            {/* Error Banner */}
            {lastAuthError && (
              <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 px-3 py-2 text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{lastAuthError}</span>
              </div>
            )}

            {/* ----------------- Active Tab Form (.entry-login-tabs) ----------------- */}
            <form onSubmit={handleSubmit} className="px-3 pb-2 space-y-2.5">
              {/* Tab 1: Guest Login */}
              {tab === "guest" && (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (lastAuthError) clearAuthError();
                    }}
                    placeholder="اكتب الاسم المستعار..."
                    required
                    maxLength={40}
                    className={`w-full h-10 px-3.5 text-xs font-bold rounded-xl border outline-none text-right transition-all ${
                      dark
                        ? "border-slate-700 bg-slate-800/80 text-slate-100 focus:border-sky-500 focus:bg-slate-800"
                        : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!connected}
                    className="w-full h-10 rounded-xl text-white font-extrabold text-xs shadow-md shadow-sky-500/20 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      background: `linear-gradient(135deg, ${activeColor}, ${activeColor}dd)`,
                    }}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>دخول مباشر</span>
                  </button>
                </div>
              )}

              {/* Tab 2: Member Login */}
              {tab === "member" && (
                <div className="flex flex-col gap-2">
                  {/* Two inputs side-by-side */}
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (lastAuthError) clearAuthError();
                      }}
                      placeholder="اسم العضو"
                      required
                      maxLength={40}
                      className={`flex-1 min-w-0 h-10 px-3 text-xs font-bold rounded-xl border outline-none text-right transition-all ${
                        dark
                          ? "border-slate-700 bg-slate-800/80 text-slate-100 focus:border-sky-500 focus:bg-slate-800"
                          : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
                      }`}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (lastAuthError) clearAuthError();
                      }}
                      placeholder="كلمة المرور"
                      required
                      className={`flex-1 min-w-0 h-10 px-3 text-xs font-bold rounded-xl border outline-none text-right transition-all ${
                        dark
                          ? "border-slate-700 bg-slate-800/80 text-slate-100 focus:border-sky-500 focus:bg-slate-800"
                          : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
                      }`}
                    />
                  </div>

                  {/* Actions Row: Stealth checkbox + Login button */}
                  <div className="flex items-center justify-between w-full gap-2 pt-0.5">
                    <label
                      title="دخول مخفي"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={stealth}
                        onChange={(e) => setStealth(e.target.checked)}
                        className="rounded-md border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      <span>دخول مخفي</span>
                    </label>

                    <button
                      type="submit"
                      disabled={!connected}
                      className="w-1/2 h-10 rounded-xl text-white font-extrabold text-xs shadow-md shadow-sky-500/20 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{
                        background: `linear-gradient(135deg, ${activeColor}, ${activeColor}dd)`,
                      }}
                    >
                      <LogIn className="w-4 h-4" />
                      <span>دخول</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Register */}
              {tab === "register" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (lastAuthError) clearAuthError();
                      }}
                      placeholder="اسم العضو"
                      required
                      maxLength={40}
                      className={`flex-1 min-w-0 h-10 px-3 text-xs font-bold rounded-xl border outline-none text-right transition-all ${
                        dark
                          ? "border-slate-700 bg-slate-800/80 text-slate-100 focus:border-sky-500 focus:bg-slate-800"
                          : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
                      }`}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (lastAuthError) clearAuthError();
                      }}
                      placeholder="كلمة المرور"
                      required
                      className={`flex-1 min-w-0 h-10 px-3 text-xs font-bold rounded-xl border outline-none text-right transition-all ${
                        dark
                          ? "border-slate-700 bg-slate-800/80 text-slate-100 focus:border-sky-500 focus:bg-slate-800"
                          : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
                      }`}
                    />
                  </div>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="الاسم الظاهر في الدردشة (اختياري)"
                    maxLength={50}
                    className={`w-full h-10 px-3.5 text-xs font-bold rounded-xl border outline-none text-right transition-all ${
                      dark
                        ? "border-slate-700 bg-slate-800/80 text-slate-100 focus:border-sky-500 focus:bg-slate-800"
                        : "border-slate-200 bg-slate-50 text-slate-900 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={!connected}
                    className="w-full h-10 rounded-xl text-white font-extrabold text-xs shadow-md shadow-sky-500/20 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      background: `linear-gradient(135deg, ${activeColor}, ${activeColor}dd)`,
                    }}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إنشاء عضوية جديدة</span>
                  </button>
                </div>
              )}
            </form>

            {/* ----------------- Modern Presence & Status Bar ----------------- */}
            <div className="mx-3 my-1 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs select-none">
              {/* Online user count */}
              <div
                title="المتواجدين الآن"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px]"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{onlineCount} متواجد</span>
              </div>

              {/* Connection Status Label */}
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                  connected
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}
              >
                {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>{connected ? "متصل" : "جاري الاتصال..."}</span>
              </div>

              {/* Version Chip */}
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60 font-mono">
                الإصدار 2026
              </span>
            </div>
          </div>

          {/* ----------------- Online Users List (.lonline) ----------------- */}
          {/* Exact same user card design as inside the chat (VirtualizedMembersList), but without opening profile */}
          <div className="flex-1 min-h-0 overflow-y-auto chat-scroll px-3 py-2 space-y-1.5">
            {onlineUsersList.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                سجّل دخولك لتظهر هنا وتتواصل مع المتواجدين مباشرة
              </div>
            ) : (
              onlineUsersList.map((u) => {
                const isBot = u.islogin === "بوت";
                const userTheme = getUserTheme(u, powers);
                const userCover = getUserCover(u, powers) || u.cover;

                return (
                  <div
                    key={u.id}
                    style={{
                      backgroundImage: userTheme ? `url("${userTheme}")` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-2xl px-2.5 py-2 border transition relative overflow-hidden select-none cursor-default ${
                      dark
                        ? userTheme
                          ? "border-slate-700/80 shadow-xs"
                          : "bg-slate-900/70 border-slate-800/80"
                        : userTheme
                          ? "border-slate-300 shadow-xs"
                          : "bg-white border-slate-200 shadow-2xs"
                    }`}
                  >
                    {/* Theme Overlay if Custom Theme is active */}
                    {userTheme && (
                      <div
                        className={`absolute inset-0 pointer-events-none transition-opacity ${
                          dark
                            ? "bg-gradient-to-r from-slate-950/80 via-slate-950/65 to-slate-950/45"
                            : "bg-gradient-to-r from-white/85 via-white/75 to-white/55"
                        }`}
                      />
                    )}

                    {/* Member Avatar */}
                    <div className="relative z-[1] shrink-0">
                      <MemberAvatar
                        pic={u.pic}
                        cover={userCover}
                        topic={u.topic}
                        stat={u.stat}
                        offline={u.offline}
                        size="md"
                        statusPosition="right"
                      />
                    </div>

                    {/* Member Details */}
                    <div className="relative z-[1] min-w-0 flex-1 text-right flex flex-col justify-center gap-0.5">
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* Prefix Icons (Crowns, Stars, Admin Badges) */}
                          <MemberPrefixIcons user={u} powers={powers} size="sm" />

                          {/* Username */}
                          <span
                            dir="auto"
                            className="text-xs font-extrabold truncate"
                            style={getUserNameStyle(u, dark)}
                          >
                            {u.topic}
                          </span>

                          {/* Badges Inline (Verified etc.) */}
                          <MemberBadgesInline user={u} showFlag={false} showIco={false} showGift={false} />
                        </div>

                        {/* Country Flag & Reg ID */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {resolveCountryFlagUrl(u.co) && (
                            <img
                              src={resolveCountryFlagUrl(u.co)}
                              alt={getCountryNameArabic(u.co)}
                              title={getCountryNameArabic(u.co)}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                              className="w-4.5 h-3 rounded-[2px] object-cover shrink-0 border border-slate-700/40 shadow-xs"
                            />
                          )}
                          {Number(u.idreg || 0) > 0 && (
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                              #{u.idreg}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Message / Bio */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 min-w-0">
                          <span dir="auto" className="truncate">
                            {u.msg || getStatusLabel(u.stat, u.offline)}
                          </span>
                          {isBot && (
                            <span className="px-1.5 py-0 rounded bg-amber-500/15 text-amber-500 text-[10px] font-bold shrink-0">
                              بوت
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ----------------- Modern Copyright Footer (borderg bg) ----------------- */}
          <div className="w-full shrink-0 py-2 px-3 bg-slate-50 dark:bg-slate-950/90 text-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-200/70 dark:border-slate-800/70 select-none">
            <span>Copyright © 2026 </span>
            <span className="text-sky-500 font-bold">{siteTitle}</span>
            <span>. All Rights Reserved</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. Site Rules & Info Modal
          ========================================================================= */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-3xl border p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800/30 pb-3">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span>معلومات وقوانين {siteTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <p className="text-slate-300">{siteDesc}</p>
              <div
                className={`rounded-2xl p-3.5 border ${
                  dark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="font-bold mb-1.5 text-sky-400">حدود وشروط التفاعل:</div>
                <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                  <li>النشر على الحائط يتطلب {site?.bclikes ?? 10} إعجاب</li>
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
                className="px-5 py-2 rounded-xl text-white text-xs font-bold transition hover:brightness-110 shadow-md shadow-sky-500/20"
                style={{ backgroundColor: activeColor }}
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
