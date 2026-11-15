import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Award,
  Bell,
  BellOff,
  Coins,
  Eye,
  EyeOff,
  Gamepad2,
  KeyRound,
  LogOut,
  MessageSquareOff,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic, normalizeHexColor, resolveAssetUrl } from "../lib/mediaUrl.js";
import {
  canAccessControlPanel,
  canToggleStealth,
  hasRoleFlag,
} from "../lib/permissions.js";
import { isSoundMuted, setSoundMuted } from "../lib/soundFx.js";
import { MemberAvatar, MemberBadgesInline, getStatusDotClass } from "./MemberAvatar.js";

interface SettingsProfilePanelProps {
  dark: boolean;
  onOpenWallet: () => void;
  onNavigate?: (path: string) => void;
}

export function SettingsProfilePanel({
  dark,
  onOpenWallet,
  onNavigate,
}: SettingsProfilePanelProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const themes = useChatStore((s) => s.themes);
  const covers = useChatStore((s) => s.covers);
  const dro3 = useChatStore((s) => s.dro3);
  const siteBadges = useChatStore((s) => s.siteBadges);
  const visitorsCount = useChatStore((s) => s.visitorsCount);
  const visitorsList = useChatStore((s) => s.visitorsList);

  const getApiClient = useChatStore((s) => s.getApiClient);
  const saveProfile = useChatStore((s) => s.saveProfile);
  const setAvatar = useChatStore((s) => s.setAvatar);
  const changePassword = useChatStore((s) => s.changePassword);
  const setCosmetic = useChatStore((s) => s.setCosmetic);
  const setSiteBadge = useChatStore((s) => s.setSiteBadge);
  const setUserStat = useChatStore((s) => s.setUserStat);
  const toggleBusy = useChatStore((s) => s.toggleBusy);
  const toggleNoPm = useChatStore((s) => s.toggleNoPm);
  const toggleNoNot = useChatStore((s) => s.toggleNoNot);
  const toggleAlerts = useChatStore((s) => s.toggleAlerts);
  const toggleStealthLogin = useChatStore((s) => s.toggleStealthLogin);
  const toggleCallPrivacy = useChatStore((s) => s.toggleCallPrivacy);
  const fetchProfileVisitors = useChatStore((s) => s.fetchProfileVisitors);
  const markProfileVisitsSeen = useChatStore((s) => s.markProfileVisitsSeen);
  const pushNotice = useChatStore((s) => s.pushNotice);
  const logout = useChatStore((s) => s.logout);

  const [topic, setTopic] = useState(me?.topic || "");
  const [statusMsg, setStatusMsg] = useState(me?.msg || "");
  const [bgColor, setBgColor] = useState(normalizeHexColor(me?.bg, "#ffffff"));
  const [uColor, setUColor] = useState(normalizeHexColor(me?.ucol, "#0f172a"));
  const [mColor, setMColor] = useState(normalizeHexColor(me?.mcol, "#0f172a"));
  const [gColor, setGColor] = useState(normalizeHexColor(me?.gcol, "#ffffff"));
  const [ytUrl, setYtUrl] = useState(me?.yp || "");

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());
  const [showVisitors, setShowVisitors] = useState(false);
  const [activeSection, setActiveSection] = useState<"profile" | "cosmetics" | "privacy" | "security">("profile");

  useEffect(() => {
    if (!me) return;
    setTopic(me.topic || "");
    setStatusMsg(me.msg || "");
    setBgColor(normalizeHexColor(me.bg, "#ffffff"));
    setUColor(normalizeHexColor(me.ucol, "#0f172a"));
    setMColor(normalizeHexColor(me.mcol, "#0f172a"));
    setGColor(normalizeHexColor(me.gcol, "#ffffff"));
    setYtUrl(me.yp || "");
  }, [me?.id, me?.topic, me?.msg, me?.bg, me?.ucol, me?.mcol, me?.gcol, me?.yp]);

  useEffect(() => {
    fetchProfileVisitors();
  }, [fetchProfileVisitors]);

  const isRegistered = Boolean(me && me.islogin === "عضو");
  const isCpAllowed = canAccessControlPanel(me, powers);
  const isStealthAllowed = canToggleStealth(me, powers);
  const canCustomBg = hasRoleFlag(me, powers, "custombg", myPowerRole);
  const canTheme = hasRoleFlag(me, powers, "chattem", myPowerRole);
  const canFrame = hasRoleFlag(me, powers, "frame", myPowerRole);
  const canBanner = hasRoleFlag(me, powers, "banner", myPowerRole);

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    saveProfile({
      topic: topic.trim() || me?.topic,
      msg: statusMsg,
      bg: bgColor,
      ucol: uColor,
      mcol: mColor,
      gcol: gColor,
      yp: ytUrl.trim(),
    });
    pushNotice("تم إرسال تحديث الملف الشخصي");
  };

  const handleUploadAvatar = async (e: ChangeEvent<HTMLInputElement>, isSecondary: boolean) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (isSecondary) setUploadingCover(true);
    else setUploadingAvatar(true);

    try {
      const api = getApiClient();
      const uploadedPath = isSecondary
        ? (await api.uploadProfileCover(file, file.name)).trim()
        : (await api.uploadAvatar(file, file.name)).trim();
      if (uploadedPath) {
        setAvatar(uploadedPath, isSecondary, false);
        pushNotice(isSecondary ? "تم تحديث غلاف البروفايل" : "تم تحديث الصورة الشخصية");
      }
    } catch {
      pushNotice("تعذر رفع الصورة، تحقق من الحجم والرتبة", { force: 1 });
    } finally {
      setUploadingAvatar(false);
      setUploadingCover(false);
    }
  };

  const handleChangePassword = (e: FormEvent) => {
    e.preventDefault();
    if (!oldPass || newPass.length < 4) {
      pushNotice("أدخل كلمة المرور الحالية وكلمة مرور جديدة (4 أحرف على الأقل)", { force: 1 });
      return;
    }
    changePassword(oldPass, newPass);
    setOldPass("");
    setNewPass("");
  };

  const handleToggleVisitors = () => {
    const next = !showVisitors;
    setShowVisitors(next);
    if (next) {
      fetchProfileVisitors();
      markProfileVisitsSeen();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto p-3 space-y-3 chat-scroll">
      {/* Identity Card */}
      <div
        className={`rounded-2xl p-3 border relative overflow-hidden ${
          dark ? "bg-slate-950/70 border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        {me?.pich && (
          <img
            src={resolveAssetUrl(me.pich, "pic2", "")}
            alt=""
            className="absolute inset-0 w-full h-24 object-cover opacity-35 pointer-events-none"
          />
        )}
        <div className="relative flex items-center gap-3">
          <MemberAvatar
            pic={me?.pic}
            cover={me?.cover}
            topic={me?.topic}
            stat={me?.stat}
            offline={me?.offline}
            size="lg"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-extrabold truncate">{me?.topic || "مستخدم"}</span>
              {me && <MemberBadgesInline user={me} />}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
              <span>{me?.power || me?.islogin || "زائر"}</span>
              {me?.idreg ? <span>• #{me.idreg}</span> : null}
              <span>• ❤️ {me?.rep ?? 0}</span>
              <span>• ⭐ {me?.evaluation ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Status Quick Selector */}
        <div className="relative grid grid-cols-4 gap-1 mt-3 pt-2.5 border-t border-slate-800/30">
          {[
            { stat: 0, label: "متواجد" },
            { stat: 1, label: "خارج" },
            { stat: 2, label: "مشغول" },
            { stat: 3, label: "خاص" },
          ].map((item) => {
            const active = Number(me?.stat ?? 0) === item.stat;
            return (
              <button
                key={item.stat}
                type="button"
                onClick={() => setUserStat(item.stat)}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                  active
                    ? "bg-sky-600 text-white"
                    : dark
                      ? "bg-slate-900 hover:bg-slate-800 text-slate-300"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${getStatusDotClass(item.stat)}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Action Pills: Wallet, Visitors, CP, Agent, Carrom */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenWallet}
          className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition ${
            dark
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="w-4 h-4" />
            <span>المحفظة</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" />
            <span>{me?.coins ?? 0}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={handleToggleVisitors}
          className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition ${
            dark ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sky-400" />
            <span>زواري</span>
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px]">
            {visitorsCount || visitorsList.length}
          </span>
        </button>

        {isCpAllowed && (
          <button
            type="button"
            onClick={() => onNavigate?.("/cp")}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600/30 text-xs font-bold transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>لوحة التحكم</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate?.("/carrom")}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/35 text-emerald-400 hover:bg-emerald-600/25 text-xs font-bold transition"
        >
          <Gamepad2 className="w-4 h-4" />
          <span>بطولة الكيرم</span>
        </button>
      </div>

      {showVisitors && (
        <div
          className={`rounded-2xl p-3 border space-y-2 ${
            dark ? "bg-slate-950/70 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span>آخر زوار الملف الشخصي</span>
            <button
              type="button"
              onClick={() => setShowVisitors(false)}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              إغلاق
            </button>
          </div>
          {visitorsList.length === 0 ? (
            <div className="text-[11px] text-slate-400 py-2">لا يوجد زوار مسجلون بعد</div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto chat-scroll">
              {visitorsList.map((v, idx) => (
                <div key={String(v.visitor_uid || idx)} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <MemberAvatar pic={String(v.visitor_pic || "")} topic={String(v.visitor_topic || "")} size="xs" showStatus={false} />
                    <span className="truncate font-bold">{String(v.visitor_topic || v.visitor_username || "زائر")}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDateTimeArabic(v.visited_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section Tabs */}
      <div
        className={`grid grid-cols-4 gap-1 p-1 rounded-xl ${
          dark ? "bg-slate-950" : "bg-slate-200/70"
        }`}
      >
        {[
          { id: "profile" as const, label: "الملف" },
          { id: "cosmetics" as const, label: "المظهر" },
          { id: "privacy" as const, label: "الخصوصية" },
          { id: "security" as const, label: "الأمان" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveSection(t.id)}
            className={`py-1.5 rounded-lg text-[11px] font-bold transition ${
              activeSection === t.id
                ? "bg-sky-600 text-white"
                : dark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Section: Profile Edit + Avatars */}
      {activeSection === "profile" && (
        <div className="space-y-3">
          {/* Avatar & Secondary Cover Upload */}
          <div
            className={`rounded-2xl p-3 border space-y-2.5 ${
              dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <div className="text-xs font-extrabold">الصور الشخصية</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingAvatar ? "رفع..." : "تغيير الصورة"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleUploadAvatar(e, false)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setAvatar("", false, true)}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-[11px] font-bold ${
                  dark ? "border-slate-800 hover:bg-slate-800 text-rose-400" : "border-slate-200 hover:bg-rose-50 text-rose-600"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الصورة</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-[11px] font-bold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingCover ? "رفع..." : "تغيير الغلاف"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleUploadAvatar(e, true)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => setAvatar("", true, true)}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-[11px] font-bold ${
                  dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الغلاف</span>
              </button>
            </div>
          </div>

          {/* Profile Info & Colors */}
          <form
            onSubmit={handleSaveProfile}
            className={`rounded-2xl p-3 border space-y-2.5 ${
              dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">الزخرفة / الاسم المعروض</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={50}
                className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                  dark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">الحالة الشخصية</label>
              <input
                type="text"
                value={statusMsg}
                onChange={(e) => setStatusMsg(e.target.value)}
                maxLength={120}
                placeholder="اكتب حالتك هنا..."
                className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                  dark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">رابط مقطع يوتيوب (المفضل)</label>
              <input
                type="url"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                  dark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-xl border border-slate-800/50">
                <span>لون الاسم</span>
                <input type="color" value={uColor} onChange={(e) => setUColor(e.target.value)} className="w-6 h-6 bg-transparent border-0 cursor-pointer" />
              </label>
              <label className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-xl border border-slate-800/50">
                <span>لون الخط</span>
                <input type="color" value={mColor} onChange={(e) => setMColor(e.target.value)} className="w-6 h-6 bg-transparent border-0 cursor-pointer" />
              </label>
              {canCustomBg && (
                <>
                  <label className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-xl border border-slate-800/50">
                    <span>خلفية الاسم</span>
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-6 h-6 bg-transparent border-0 cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-xl border border-slate-800/50">
                    <span>لون التدرج</span>
                    <input type="color" value={gColor} onChange={(e) => setGColor(e.target.value)} className="w-6 h-6 bg-transparent border-0 cursor-pointer" />
                  </label>
                </>
              )}
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ التعديلات</span>
            </button>
          </form>
        </div>
      )}

      {/* Section: Cosmetics (Themes, Frames, Dro3 Banners, Site Badges) */}
      {activeSection === "cosmetics" && (
        <div className="space-y-3">
          {/* Site Badges */}
          <div
            className={`rounded-2xl p-3 border space-y-2 ${
              dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>شارات العضوية</span>
              </span>
              {me?.site_badge_id && (
                <button
                  type="button"
                  onClick={() => setSiteBadge("")}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  إزالة الشارة
                </button>
              )}
            </div>
            {siteBadges.length === 0 ? (
              <div className="text-[11px] text-slate-400">لا توجد شارات مضافة حالياً</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {siteBadges.map((b, idx) => {
                  const id = String(b.id || idx);
                  const active = String(me?.site_badge_id || "") === id;
                  const iconUrl = b.icon ? resolveAssetUrl(String(b.icon), "site_badges", "") : "";
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSiteBadge(id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-bold transition ${
                        active
                          ? "border-sky-500 bg-sky-500/15"
                          : dark
                            ? "border-slate-800 hover:bg-slate-800"
                            : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {iconUrl && <img src={iconUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                      <span className="truncate">{String(b.name || "شارة")}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Avatar Covers / Frames */}
          <div
            className={`rounded-2xl p-3 border space-y-2 ${
              dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>إطارات الصورة {!canFrame && "(تتطلب صلاحية)"}</span>
              </span>
              {me?.cover && (
                <button
                  type="button"
                  onClick={() => setCosmetic("ucover", null)}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  إزالة
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto chat-scroll">
              {covers.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCosmetic("ucover", c)}
                  className={`p-1.5 rounded-xl border flex items-center justify-center transition ${
                    me?.cover === c
                      ? "border-sky-500 bg-sky-500/15"
                      : dark
                        ? "border-slate-800 hover:bg-slate-800"
                        : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <img src={resolveAssetUrl(c, "cover", "")} alt="" className="w-9 h-9 object-contain" />
                </button>
              ))}
            </div>
          </div>

          {/* Chat Themes */}
          <div
            className={`rounded-2xl p-3 border space-y-2 ${
              dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span>خلفيات الاسم {!canTheme && "(تتطلب صلاحية)"}</span>
              {me?.them && (
                <button
                  type="button"
                  onClick={() => setCosmetic("uthem", null)}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  إزالة
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto chat-scroll">
              {themes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCosmetic("uthem", t)}
                  className={`h-10 rounded-xl border overflow-hidden transition ${
                    me?.them === t ? "border-sky-500 ring-2 ring-sky-500/40" : "border-slate-800"
                  }`}
                >
                  <img src={resolveAssetUrl(t, "them", "")} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Dro3 Icons / Banners */}
          <div
            className={`rounded-2xl p-3 border space-y-2 ${
              dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold">
              <span>أيقونات / دروع الاسم {!canBanner && "(تتطلب صلاحية)"}</span>
              {me?.ico && (
                <button
                  type="button"
                  onClick={() => setCosmetic("bnr", null)}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  إزالة
                </button>
              )}
            </div>
            <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto chat-scroll">
              {dro3.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setCosmetic("bnr", d)}
                  className={`p-1.5 rounded-xl border flex items-center justify-center transition ${
                    me?.ico === d
                      ? "border-sky-500 bg-sky-500/15"
                      : dark
                        ? "border-slate-800 hover:bg-slate-800"
                        : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <img src={resolveAssetUrl(d, "dro3", "")} alt="" className="w-6 h-6 object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section: Privacy & Notification Toggles */}
      {activeSection === "privacy" && (
        <div
          className={`rounded-2xl p-3 border space-y-2 ${
            dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <PrivacySwitch
            dark={dark}
            icon={MessageSquareOff}
            label="تعطيل الرسائل الخاصة"
            checked={Boolean(me?.nopm)}
            onToggle={toggleNoPm}
          />
          <PrivacySwitch
            dark={dark}
            icon={BellOff}
            label="تعطيل التنبيهات الواردة"
            checked={Boolean(me?.nonot)}
            onToggle={toggleNoNot}
          />
          <PrivacySwitch
            dark={dark}
            icon={Bell}
            label="تنبيهات الإشعارات الفورية"
            checked={Boolean(me?.alerts)}
            onToggle={toggleAlerts}
          />
          <PrivacySwitch
            dark={dark}
            icon={EyeOff}
            label="تفعيل وضع مشغول"
            checked={Boolean(me?.busy)}
            onToggle={toggleBusy}
          />
          <PrivacySwitch
            dark={dark}
            icon={Phone}
            label="السماح بالمكالمات الصوتية"
            checked={!me?.nopmcall}
            onToggle={() => toggleCallPrivacy("audio", Boolean(me?.nopmcall))}
          />
          <PrivacySwitch
            dark={dark}
            icon={Video}
            label="السماح بمكالمات الفيديو"
            checked={!me?.nopmvideocall}
            onToggle={() => toggleCallPrivacy("video", Boolean(me?.nopmvideocall))}
          />
          <PrivacySwitch
            dark={dark}
            icon={soundMuted ? VolumeX : Volume2}
            label="كتم مؤثرات الصوت"
            checked={soundMuted}
            onToggle={() => {
              const next = !soundMuted;
              setSoundMuted(next);
              setSoundMutedState(next);
            }}
          />

          {isStealthAllowed && (
            <PrivacySwitch
              dark={dark}
              icon={Eye}
              label="الدخول المخفي (Stealth)"
              checked={Boolean(me?.s)}
              onToggle={() => toggleStealthLogin(!me?.s)}
            />
          )}
        </div>
      )}

      {/* Section: Security / Password / Agent & Logout */}
      {activeSection === "security" && (
        <div className="space-y-3">
          {isRegistered && (
            <form
              onSubmit={handleChangePassword}
              className={`rounded-2xl p-3 border space-y-2.5 ${
                dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold">
                <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                <span>تغيير كلمة المرور</span>
              </div>
              <input
                type="password"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                placeholder="كلمة المرور الحالية"
                className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                  dark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="كلمة المرور الجديدة"
                className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                  dark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold"
              >
                تحديث كلمة المرور
              </button>
            </form>
          )}

          <div
            className={`rounded-2xl p-3 border space-y-2 ${
              dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => onNavigate?.("/agent/topup")}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold text-right ${
                dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              بوابة وكلاء الشحن (/agent/topup)
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج من الدردشة</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrivacySwitch({
  dark,
  icon: Icon,
  label,
  checked,
  onToggle,
}: {
  dark: boolean;
  icon: typeof Bell;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition ${
        dark ? "border-slate-800/80 hover:bg-slate-900" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span className="inline-flex items-center gap-2 font-bold">
        <Icon className="w-4 h-4 text-sky-400" />
        <span>{label}</span>
      </span>
      <span
        className={`w-9 h-5 rounded-full p-0.5 transition flex items-center ${
          checked ? "bg-sky-600 justify-end" : "bg-slate-600 justify-start"
        }`}
      >
        <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
      </span>
    </button>
  );
}
