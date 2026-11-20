import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Award, Check, Coins, Gift, Image, Palette, Pencil, Plus, RotateCcw, Save, Settings2, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import {
  giftFeeSlabSchema,
  giftSettingsSchema,
  type EvaluationAwardActionKey,
} from "@newchat/shared";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { getBadgeStyle } from "../../lib/badgeStyle.js";
import type { CpTabProps } from "./CpOverviewLogs.js";

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === "object") return raw as T;
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function CpSiteAndAssetsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [siteJson, setSiteJson] = useState<Record<string, unknown>>({});
  const [wallLikes, setWallLikes] = useState<Record<string, number>>({});
  const [logoFile, setLogoFile] = useState("");
  const [bannerFile, setBannerFile] = useState("");
  const [entrySlides, setEntrySlides] = useState<Array<{ file?: string; url?: string }>>([]);
  const [lists, setLists] = useState<Record<string, string[]>>({
    sico: [],
    emo: [],
    them: [],
    cover: [],
    dro3: [],
  });
  const [activeFolder, setActiveFolder] = useState<"sico" | "emo" | "them" | "cover" | "dro3">("sico");
  const [siteBadges, setSiteBadges] = useState<Array<Record<string, unknown>>>([]);
  const [roomBadges, setRoomBadges] = useState<Array<Record<string, unknown>>>([]);
  const [badgeType, setBadgeType] = useState<"site" | "room">("site");
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState("");
  const [badgeBgType, setBadgeBgType] = useState<"static" | "animated">("static");
  const [badgeC1, setBadgeC1] = useState("#ff0000");
  const [badgeC2, setBadgeC2] = useState("#fff200");
  const [badgeC3, setBadgeC3] = useState("#ff0000");
  const [badgeC4, setBadgeC4] = useState("#ffffff");
  const [badgeBg, setBadgeBg] = useState("linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)");
  const [badgeIcon, setBadgeIcon] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [badgeSaving, setBadgeSaving] = useState(false);

  const updateGradientColors = (c1: string, c2: string, c3: string, c4: string) => {
    setBadgeC1(c1);
    setBadgeC2(c2);
    setBadgeC3(c3);
    setBadgeC4(c4);
    setBadgeBg(`linear-gradient(60deg, ${c1}, ${c2}, ${c3}, ${c4})`);
  };

  const handleStartEditBadge = (b: Record<string, unknown>) => {
    const id = String(b.id || "");
    const name = String(b.name || "");
    const bg = String(b.bg || "").trim() || "linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)";
    const bgType = String(b.bg_type || b.bgType || "static").toLowerCase() === "animated" ? "animated" : "static";
    const icon = String(b.icon || "");

    setEditingBadgeId(id);
    setBadgeName(name);
    setBadgeBg(bg);
    setBadgeBgType(bgType);
    setBadgeIcon(icon);

    const hexColors = bg.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) || [];
    if (hexColors[0]) setBadgeC1(hexColors[0]);
    if (hexColors[1]) setBadgeC2(hexColors[1]);
    if (hexColors[2]) setBadgeC3(hexColors[2]);
    if (hexColors[3]) setBadgeC4(hexColors[3]);
  };

  const handleResetBadgeForm = () => {
    setEditingBadgeId(null);
    setBadgeName("");
    setBadgeC1("#ff0000");
    setBadgeC2("#fff200");
    setBadgeC3("#ff0000");
    setBadgeC4("#ffffff");
    setBadgeBg("linear-gradient(60deg, #ff0000, #fff200, #ff0000, #ffffff)");
    setBadgeBgType("static");
    setBadgeIcon("");
    setShowIconPicker(false);
  };

  const load = useCallback(async () => {
    const api = getApiClient();
    const [ownRes, slideRes, sbRes, rbRes] = await Promise.all([
      api.cpCommand(token, "owner", { domin: 1 }).catch(() => null),
      api.cpCommand(token, "entry_slide_get").catch(() => null),
      api.cpCommand(token, "site_badges").catch(() => null),
      api.cpCommand(token, "room_badges").catch(() => null),
    ]);
    if (Array.isArray(ownRes) && ownRes[0]) {
      const stg = ownRes[0] as Record<string, unknown>;
      const extras = (ownRes[1] || {}) as Record<string, unknown>;
      const parsedSite = parseJsonSafe<Record<string, unknown>>(stg.site, {});
      setSiteJson(parsedSite);
      setWallLikes(parseJsonSafe<Record<string, number>>(parsedSite.walllikes, {}));
      setLogoFile(String(extras.logo || ""));
      setBannerFile(String(extras.banner || ""));
      setLists({
        sico: parseJsonSafe<string[]>(stg.sico, []),
        emo: parseJsonSafe<string[]>(stg.emo, []),
        them: parseJsonSafe<string[]>(stg.them, []),
        cover: parseJsonSafe<string[]>(stg.cover, []),
        dro3: parseJsonSafe<string[]>(stg.dro3, []),
      });
    }
    const slData = (slideRes as { data?: { slides?: Array<{ file?: string; url?: string }> } } | null)?.data;
    if (Array.isArray(slData?.slides)) setEntrySlides(slData.slides);
    if (Array.isArray((sbRes as { data?: unknown[] } | null)?.data)) {
      setSiteBadges((sbRes as { data: Array<Record<string, unknown>> }).data);
    }
    if (Array.isArray((rbRes as { data?: unknown[] } | null)?.data)) {
      setRoomBadges((rbRes as { data: Array<Record<string, unknown>> }).data);
    }
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveSite = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...siteJson,
      walllikes: JSON.stringify(wallLikes),
    };
    const res = await getApiClient().cpCommand(token, "sitesave", { domin: 1, data: payload });
    onNotify(res.err ? String(res.msg || "فشل الحفظ") : "تم حفظ إعدادات الموقع بنجاح", !res.err);
  };

  const handleUploadAsset = async (
    target: "logo" | "banner" | "entry_slides" | "sico" | "emo" | "them" | "cover" | "dro3",
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const up = await getApiClient().uploadAdminAsset(target, file, token, file.name);
      if (up.err || up.error) throw new Error(up.msg || "فشل الرفع");
      if (target !== "entry_slides") {
        const pid = String(up.msg || "").split("/").pop() || "";
        if (pid) {
          await getApiClient().cpCommand(token, "addico", { tar: target, pid, hs: 1 });
        }
      }
      onNotify("تم رفع الملف وتحديث الإعدادات");
      await load();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ في الرفع", false);
    }
  };

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div className="space-y-4">
      {/* Main Site Config */}
      <form onSubmit={handleSaveSite} className={`p-4 rounded-3xl border space-y-4 ${cardCls}`}>
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <Settings2 className="w-4 h-4 text-sky-400" />
          إعدادات الموقع والمظهر
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold mb-1">اسم / عنوان الموقع</label>
            <input
              type="text"
              value={String(siteJson.title || "")}
              onChange={(e) => setSiteJson((s) => ({ ...s, title: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">مزود المايكات</label>
            <select
              value={String(siteJson.micprovider || "WEBRTC")}
              onChange={(e) => setSiteJson((s) => ({ ...s, micprovider: e.target.value }))}
              className={inputCls}
            >
              <option value="WEBRTC">WebRTC (مباشر)</option>
              <option value="LIVEKIT">LiveKit (مباشر)</option>
              <option value="JITSI">Jitsi Meet</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">تصميم رسائل الغرفة</label>
            <select
              value={String(siteJson.roomMessageTheme || "classic")}
              onChange={(e) => setSiteJson((s) => ({ ...s, roomMessageTheme: e.target.value }))}
              className={inputCls}
            >
              <option value="classic">كلاسيك (Classic)</option>
              <option value="bubble">فقاعات (Bubble)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold mb-1">لون الخلفية العام</label>
            <input
              type="color"
              value={String(siteJson.background || "#0f172a")}
              onChange={(e) => setSiteJson((s) => ({ ...s, background: e.target.value }))}
              className="w-full h-9 rounded-xl cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">لون الأزرار</label>
            <input
              type="color"
              value={String(siteJson.buttons || "#203d69")}
              onChange={(e) => setSiteJson((s) => ({ ...s, buttons: e.target.value }))}
              className="w-full h-9 rounded-xl cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">اللون الثانوي (BG)</label>
            <input
              type="color"
              value={String(siteJson.bg || "#0a6e8c")}
              onChange={(e) => setSiteJson((s) => ({ ...s, bg: e.target.value }))}
              className="w-full h-9 rounded-xl cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { k: "pmlikes", l: "لايكات الخاص" },
            { k: "miclikes", l: "لايكات المايك" },
            { k: "notlikes", l: "لايكات التنبيه" },
            { k: "fileslikes", l: "لايكات الملفات" },
            { k: "bclikes", l: "لايكات الحائط" },
            { k: "msgst", l: "تكرار الحائط (ث)" },
            { k: "wallminutes", l: "دقائق الحائط" },
          ].map((f) => (
            <div key={f.k}>
              <label className="block text-[11px] font-bold mb-1">{f.l}</label>
              <input
                type="number"
                value={Number(siteJson[f.k] || 0)}
                onChange={(e) => setSiteJson((s) => ({ ...s, [f.k]: Number(e.target.value) || 0 }))}
                className={inputCls}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <label className={`flex items-center gap-2 p-2.5 rounded-xl border ${subCls}`}>
            <input
              type="checkbox"
              checked={siteJson.allowg !== false}
              onChange={(e) => setSiteJson((s) => ({ ...s, allowg: e.target.checked }))}
              className="accent-sky-500"
            />
            السماح بدخول الضيوف
          </label>
          <label className={`flex items-center gap-2 p-2.5 rounded-xl border ${subCls}`}>
            <input
              type="checkbox"
              checked={siteJson.allowreg !== false}
              onChange={(e) => setSiteJson((s) => ({ ...s, allowreg: e.target.checked }))}
              className="accent-sky-500"
            />
            السماح بالتسجيل
          </label>
        </div>

        <button type="submit" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold">
          <Save className="w-4 h-4" />
          حفظ إعدادات الموقع
        </button>
      </form>

      {/* Logo, Banner & Entry Slides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
          <h3 className="text-xs font-extrabold flex items-center gap-1.5">
            <Image className="w-4 h-4 text-amber-400" />
            الشعار والبنر
          </h3>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">الشعار: {logoFile || "-"}</span>
            <label className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              تغيير الشعار
              <input type="file" accept="image/*" onChange={(e) => void handleUploadAsset("logo", e)} className="hidden" />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">البنر: {bannerFile || "-"}</span>
            <label className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              تغيير البنر
              <input type="file" accept="image/*" onChange={(e) => void handleUploadAsset("banner", e)} className="hidden" />
            </label>
          </div>
        </div>

        <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold">شرائح الدخول ({entrySlides.length})</h3>
            <label className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              رفع شريحة
              <input type="file" accept="image/*" onChange={(e) => void handleUploadAsset("entry_slides", e)} className="hidden" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {entrySlides.map((sl, i) => (
              <div key={String(sl.file || i)} className={`p-2 rounded-xl border flex items-center gap-2 text-xs ${subCls}`}>
                <img src={resolveAssetUrl(sl.url || sl.file, "entry_slides", "")} alt="" className="w-10 h-10 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={async () => {
                    await getApiClient().cpCommand(token, "entry_slide_del", { file: sl.file });
                    void load();
                  }}
                  className="text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Media Galleries (sico, emo, them, cover, dro3) */}
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "sico", label: "الابتسامات (Sico)" },
              { id: "emo", label: "الفيسات (Emo)" },
              { id: "dro3", label: "الأيقونات (Dro3)" },
              { id: "them", label: "الثيمات (Them)" },
              { id: "cover", label: "الإطارات (Cover)" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFolder(f.id as typeof activeFolder)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  activeFolder === f.id ? "bg-indigo-600 text-white" : subCls + " border"
                }`}
              >
                {f.label} ({(lists[f.id] || []).length})
              </button>
            ))}
          </div>
          <label className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1">
            <Upload className="w-3.5 h-3.5" />
            رفع عنصر
            <input type="file" accept="image/*" onChange={(e) => void handleUploadAsset(activeFolder, e)} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 max-h-60 overflow-y-auto chat-scroll">
          {(lists[activeFolder] || []).map((file) => (
            <div key={file} className={`p-2 rounded-2xl border flex flex-col items-center gap-1 ${subCls}`}>
              <img src={resolveAssetUrl(file, activeFolder, "")} alt={file} className="w-10 h-10 object-contain" />
              <button
                type="button"
                onClick={async () => {
                  await getApiClient().cpCommand(token, "del_ico", { pid: `${activeFolder}/${file}` });
                  onNotify("تم الحذف");
                  void load();
                }}
                className="text-[10px] text-rose-400 hover:underline"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Site & Room Badges */}
      <div className={`p-4 rounded-3xl border space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-extrabold flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              الشارات والأوسمة
            </h3>
            <span className="text-[11px] opacity-60">
              ({badgeType === "site" ? "شارات عامة للموقع تُمنح للأعضاء المميزين" : "شارات مخصصة لمالكي وإدارات الغرف"})
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setBadgeType("site");
                handleResetBadgeForm();
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                badgeType === "site" ? "bg-amber-600 text-white shadow-sm" : subCls + " border opacity-75 hover:opacity-100"
              }`}
            >
              شارات الموقع ({siteBadges.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setBadgeType("room");
                handleResetBadgeForm();
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                badgeType === "room" ? "bg-amber-600 text-white shadow-sm" : subCls + " border opacity-75 hover:opacity-100"
              }`}
            >
              شارات الغرف ({roomBadges.length})
            </button>
          </div>
        </div>

        {/* Live Badge Preview Card */}
        <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${subCls}`}>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-extrabold opacity-75 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-sky-400" />
              معاينة الشارة الحية:
            </span>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md ${
                badgeBgType === "animated" ? "badge-animated-gradient" : ""
              }`}
              style={getBadgeStyle(badgeBg, badgeBgType === "animated")}
            >
              {badgeIcon ? (
                <img
                  src={resolveAssetUrl(badgeIcon, "dro3", "")}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/50 bg-black/20"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
              <span>{badgeName.trim() || "اسم الشارة"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            {badgeBgType === "animated" ? (
              <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                <Sparkles className="w-3 h-3" />
                تأثير متدفق ومتحرك (Shimmer)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 opacity-60 bg-slate-500/10 px-2 py-0.5 rounded-lg border border-slate-500/20">
                خلفية ثابتة
              </span>
            )}
            {editingBadgeId && (
              <span className="text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                وضع التعديل النشط
              </span>
            )}
          </div>
        </div>

        {/* Badge Creation & Editing Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!badgeName.trim()) {
              onNotify("اسم الشارة مطلوب", false);
              return;
            }
            setBadgeSaving(true);
            try {
              const cmd = badgeType === "site" ? "site_badges_save" : "room_badges_save";
              const payload: Record<string, unknown> = {
                name: badgeName.trim(),
                bg: badgeBg.trim() || "#0284c7",
                icon: badgeIcon.trim(),
                bg_type: badgeBgType,
              };
              if (editingBadgeId) {
                payload.id = editingBadgeId;
              }
              const res = await getApiClient().cpCommand(token, cmd, { data: payload });
              onNotify(String(res.msg || (editingBadgeId ? "تم تحديث الشارة" : "تمت إضافة الشارة")), !res.err);
              handleResetBadgeForm();
              void load();
            } catch (err) {
              onNotify(err instanceof Error ? err.message : "فشل حفظ الشارة", false);
            } finally {
              setBadgeSaving(false);
            }
          }}
          className={`p-3.5 rounded-2xl border space-y-3 ${subCls}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5">
              {editingBadgeId ? (
                <>
                  <Pencil className="w-3.5 h-3.5 text-sky-400" />
                  تعديل بيانات الشارة
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  إضافة شارة جديدة
                </>
              )}
            </span>
            {editingBadgeId && (
              <button
                type="button"
                onClick={handleResetBadgeForm}
                className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                إلغاء التعديل
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Badge Name */}
            <div>
              <label className="block text-[11px] font-bold mb-1">اسم الشارة *</label>
              <input
                type="text"
                value={badgeName}
                onChange={(e) => setBadgeName(e.target.value)}
                placeholder="مثال: مالك الموقع / VIP / المشرف"
                className={inputCls}
                required
              />
            </div>

            {/* Background Type */}
            <div>
              <label className="block text-[11px] font-bold mb-1">نوع الخلفية</label>
              <select
                value={badgeBgType}
                onChange={(e) => setBadgeBgType(e.target.value as "static" | "animated")}
                className={inputCls}
              >
                <option value="static">ثابت (Static)</option>
                <option value="animated">متحرك بانسيابية (Animated Shimmer)</option>
              </select>
            </div>

            {/* Icon Picker / Path */}
            <div>
              <label className="block text-[11px] font-bold mb-1 flex items-center justify-between">
                <span>أيقونة الشارة</span>
                <button
                  type="button"
                  onClick={() => setShowIconPicker((v) => !v)}
                  className="text-sky-400 hover:underline text-[10px]"
                >
                  {showIconPicker ? "إغلاق المكتبة" : "اختيار من الدروع (Dro3)"}
                </button>
              </label>
              <div className="flex items-center gap-2">
                {badgeIcon && (
                  <img
                    src={resolveAssetUrl(badgeIcon, "dro3", "")}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-600 bg-black/20"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <input
                  type="text"
                  value={badgeIcon}
                  onChange={(e) => setBadgeIcon(e.target.value)}
                  placeholder="مسار الأيقونة (dro3/...)"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Quick Dro3 Icon Picker Grid */}
          {showIconPicker && (
            <div className="p-2.5 rounded-xl border border-sky-500/30 bg-sky-950/20 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>اختر أيقونة من قائمة الدروع (Dro3):</span>
                <span className="opacity-60">{lists.dro3?.length || 0} عنصر متاح</span>
              </div>
              {lists.dro3 && lists.dro3.length > 0 ? (
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-2 max-h-36 overflow-y-auto chat-scroll p-1">
                  {lists.dro3.map((ico) => {
                    const icoPath = `/dro3/${ico}`;
                    const selected = badgeIcon === icoPath || badgeIcon === ico;
                    return (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => {
                          setBadgeIcon(icoPath);
                          setShowIconPicker(false);
                        }}
                        className={`p-1 rounded-xl border flex flex-col items-center justify-center transition ${
                          selected
                            ? "border-sky-400 bg-sky-500/20 ring-1 ring-sky-400"
                            : "border-slate-700/60 hover:border-slate-500 hover:bg-white/5"
                        }`}
                        title={ico}
                      >
                        <img src={resolveAssetUrl(ico, "dro3", "")} alt="" className="w-7 h-7 object-contain" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] opacity-60">لا توجد أيقونات مرفوعة في قسم الدروع (dro3) حالياً</p>
              )}
            </div>
          )}

          {/* Gradient Colors & CSS String */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold">
              تدرج الألوان (4 درجات لونية تلقائية) أو كتابة كود CSS مخصص:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-700/60 bg-black/10">
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="color"
                    value={badgeC1}
                    onChange={(e) => updateGradientColors(e.target.value, badgeC2, badgeC3, badgeC4)}
                    title="اللون 1"
                    className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <input
                    type="color"
                    value={badgeC2}
                    onChange={(e) => updateGradientColors(badgeC1, e.target.value, badgeC3, badgeC4)}
                    title="اللون 2"
                    className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <input
                    type="color"
                    value={badgeC3}
                    onChange={(e) => updateGradientColors(badgeC1, badgeC2, e.target.value, badgeC4)}
                    title="اللون 3"
                    className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <input
                    type="color"
                    value={badgeC4}
                    onChange={(e) => updateGradientColors(badgeC1, badgeC2, badgeC3, e.target.value)}
                    title="اللون 4"
                    className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0"
                  />
                </div>
                <span className="text-[10px] opacity-60 px-1">توليد تلقائي</span>
              </div>
              <input
                type="text"
                value={badgeBg}
                onChange={(e) => setBadgeBg(e.target.value)}
                placeholder="linear-gradient(60deg, #ff0000, #fff200, ...)"
                className={inputCls}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {editingBadgeId && (
              <button
                type="button"
                onClick={handleResetBadgeForm}
                className="px-4 py-2 rounded-xl border border-slate-600 hover:bg-slate-700/30 text-xs font-bold inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إلغاء التعديل
              </button>
            )}
            <button
              type="submit"
              disabled={badgeSaving}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md inline-flex items-center gap-1.5 transition"
            >
              {editingBadgeId ? (
                <>
                  <Save className="w-3.5 h-3.5" />
                  حفظ التعديلات
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  إضافة الشارة
                </>
              )}
            </button>
          </div>
        </form>

        {/* Existing Badges Catalog Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold opacity-80">
            <span>
              قائمة {badgeType === "site" ? "شارات الموقع" : "شارات الغرف"} المسجلة (
              {(badgeType === "site" ? siteBadges : roomBadges).length}):
            </span>
          </div>

          {(badgeType === "site" ? siteBadges : roomBadges).length === 0 ? (
            <div className={`p-4 rounded-2xl border text-center text-xs opacity-60 ${subCls}`}>
              لا توجد شارات مسجلة حالياً في هذا القسم. يمكنك إنشاء أول شارة من النموذج أعلاه.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(badgeType === "site" ? siteBadges : roomBadges).map((b) => {
                const bId = String(b.id || "");
                const bName = String(b.name || "شارة");
                const bBg = String(b.bg || "").trim() || "#0284c7";
                const bIcon = String(b.icon || "");
                const isAnim = String(b.bg_type || b.bgType || "static").toLowerCase() === "animated";
                const isEditing = editingBadgeId === bId;

                return (
                  <div
                    key={bId}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      isEditing
                        ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500"
                        : subCls + " hover:border-slate-600"
                    }`}
                  >
                    {/* Badge Visual Representation */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md max-w-[180px] shrink-0 ${
                          isAnim ? "badge-animated-gradient" : ""
                        }`}
                        style={getBadgeStyle(bBg, isAnim)}
                        title={bName}
                      >
                        {bIcon ? (
                          <img
                            src={resolveAssetUrl(bIcon, "dro3", "")}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/50 bg-black/20"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className="truncate">{bName}</span>
                      </div>

                      {/* Animation indicator tag */}
                      {isAnim ? (
                        <span
                          className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5"
                          title="خلفية متحركة انسيابية"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          متحرك
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-40 shrink-0">ثابت</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditBadge(b)}
                        className={`p-1.5 rounded-xl transition ${
                          isEditing
                            ? "bg-amber-600 text-white"
                            : "hover:bg-sky-500/20 text-sky-400"
                        }`}
                        title="تعديل الشارة"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            if (!window.confirm(`هل أنت متأكد من حذف الشارة "${bName}"؟`)) return;
                            try {
                              const cmd = badgeType === "site" ? "site_badges_del" : "room_badges_del";
                              const res = await getApiClient().cpCommand(token, cmd, { id: bId });
                              onNotify(String(res.msg || "تم حذف الشارة"), !res.err);
                              if (editingBadgeId === bId) {
                                handleResetBadgeForm();
                              }
                              void load();
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : "فشل حذف الشارة", false);
                            }
                          })();
                        }}
                        className="p-1.5 rounded-xl hover:bg-rose-500/20 text-rose-400 transition"
                        title="حذف الشارة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CpGiftsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [gifts, setGifts] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [giftSettings, setGiftSettings] = useState<{
    maxQty: number;
    rateLimitMax: number;
    rateLimitWindowMs: number;
    giftEnabled: boolean;
  } | null>(null);
  const [slabs, setSlabs] = useState<Array<{
    id: number;
    slab_min_coin: number;
    slab_max_coin: number | null;
    platform_fee_bps: number;
  }>>([]);
  const [slabMin, setSlabMin] = useState("");
  const [slabMax, setSlabMax] = useState("");
  const [slabFeePercent, setSlabFeePercent] = useState("");
  const [editingSlabId, setEditingSlabId] = useState<number | null>(null);
  const [savingGiftConfig, setSavingGiftConfig] = useState(false);
  const [catName, setCatName] = useState("");
  const [giftName, setGiftName] = useState("");
  const [giftCoin, setGiftCoin] = useState("10");
  const [giftCat, setGiftCat] = useState("افتراضي");

  const load = useCallback(async () => {
    const api = getApiClient();
    const [res, configRes] = await Promise.all([
      api.cpCommand(token, "gifts_git_get").catch(() => null),
      api.cpCommand(token, "gift_settings_get").catch(() => null),
    ]);
    const msg = (res as { msg?: { gifts?: Array<Record<string, unknown>>; categories?: Array<string | { name?: string }> } } | null)?.msg;
    if (msg) {
      setGifts(Array.isArray(msg.gifts) ? msg.gifts : []);
      setCategories(
        Array.isArray(msg.categories)
          ? msg.categories.map((c) => (typeof c === "string" ? c : String(c?.name || ""))).filter(Boolean)
          : [],
      );
    }
    const giftConfig = (configRes as {
      data?: {
        settings?: typeof giftSettings;
        slabs?: typeof slabs;
      };
    } | null)?.data;
    if (giftConfig?.settings) setGiftSettings(giftConfig.settings);
    if (Array.isArray(giftConfig?.slabs)) setSlabs(giftConfig.slabs);
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUploadGift = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const up = await getApiClient().uploadAdminAsset("gifts_git", file, token, file.name);
      if (up.err) throw new Error(up.msg || "فشل الرفع");
      const pid = String(up.msg || "").split("/").pop() || "";
      const res = await getApiClient().cpCommand(token, "gift_git_add", {
        pid,
        coin: Number(giftCoin) || 10,
        name: giftName.trim() || file.name,
        category: giftCat || "افتراضي",
      });
      onNotify(res.err ? String(res.msg || "فشل") : "تمت إضافة الهدية بنجاح", !res.err);
      setGiftName("");
      void load();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "خطأ", false);
    }
  };

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  const saveGiftSettings = async () => {
    if (!giftSettings) return;
    const parsed = giftSettingsSchema.safeParse(giftSettings);
    if (!parsed.success) {
      onNotify("تحقق من حدود الكمية ومعدل الإرسال", false);
      return;
    }
    setSavingGiftConfig(true);
    try {
      const res = await getApiClient().cpCommand(token, "gift_settings_save", { data: parsed.data });
      onNotify(String(res.msg || "تعذر حفظ إعدادات الهدايا"), !res.err);
      if (!res.err) void load();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "تعذر حفظ إعدادات الهدايا", false);
    } finally {
      setSavingGiftConfig(false);
    }
  };

  const saveGiftSlab = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = giftFeeSlabSchema.safeParse({
      slabMin: Number(slabMin),
      slabMax: slabMax.trim() ? Number(slabMax) : null,
      platformFeeBps: Number(slabFeePercent) * 100,
    });
    if (!parsed.success) {
      onNotify("بيانات شريحة الرسوم غير صالحة", false);
      return;
    }
    setSavingGiftConfig(true);
    try {
      const res = await getApiClient().cpCommand(token, "gift_slab_upsert", {
        ...parsed.data,
        ...(editingSlabId ? { id: editingSlabId } : {}),
      });
      onNotify(String(res.msg || "تعذر حفظ الشريحة"), !res.err);
      if (!res.err) {
        setEditingSlabId(null);
        setSlabMin("");
        setSlabMax("");
        setSlabFeePercent("");
        void load();
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "تعذر حفظ الشريحة", false);
    } finally {
      setSavingGiftConfig(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-pink-400" />
          الأقسام وإضافة هدية جديدة ({gifts.length})
        </h2>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!catName.trim()) return;
            const res = await getApiClient().cpCommand(token, "gift_category_add", { category: catName.trim() });
            onNotify(res.err ? String(res.msg || "فشل") : "تمت إضافة القسم", !res.err);
            setCatName("");
            void load();
          }}
          className="flex gap-2"
        >
          <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="اسم قسم هدايا جديد..." className={inputCls} />
          <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            قسم
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <span key={c} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${subCls}`}>
              {c}
              <button
                type="button"
                onClick={async () => {
                  const res = await getApiClient().cpCommand(token, "gift_category_del", { category: c });
                  onNotify(res.err ? String(res.msg || "فشل") : "تم الحذف", !res.err);
                  void load();
                }}
                className="text-rose-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/40">
          <input type="text" value={giftName} onChange={(e) => setGiftName(e.target.value)} placeholder="اسم الهدية..." className={inputCls} />
          <input type="number" min={1} value={giftCoin} onChange={(e) => setGiftCoin(e.target.value)} placeholder="الكوينز" className={inputCls} />
          <select value={giftCat} onChange={(e) => setGiftCat(e.target.value)} className={inputCls}>
            <option value="افتراضي">افتراضي</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-extrabold text-center cursor-pointer inline-flex items-center justify-center gap-1">
            <Upload className="w-3.5 h-3.5" />
            رفع صورة الهدية
            <input type="file" accept="image/*" onChange={handleUploadGift} className="hidden" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {gifts.map((g) => (
          <div key={String(g.id)} className={`p-3 rounded-3xl border flex flex-col items-center gap-2 text-center ${cardCls}`}>
            <img src={resolveAssetUrl(g.file, "gifts_git", "")} alt={String(g.name || "")} className="w-16 h-16 object-contain" />
            <div className="text-xs font-extrabold truncate w-full">{String(g.name || g.file)}</div>
            <div className="text-[11px] text-amber-400 font-bold inline-flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {Number(g.coin || 0)}
            </div>
            <div className="flex gap-1.5 w-full">
              <button
                type="button"
                onClick={async () => {
                  const res = await getApiClient().cpCommand(token, "gift_git_del", { id: g.id });
                  onNotify(res.err ? String(res.msg || "فشل") : "تم حذف الهدية", !res.err);
                  void load();
                }}
                className="flex-1 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className={`p-4 rounded-3xl border space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-sky-400" />
            إعدادات نظام الهدايا والرسوم
          </h2>
          <span className="text-xs text-slate-400">نسبة مالك الاستضافة محددة من بيئة النشر</span>
        </div>
        {giftSettings ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <label className="text-xs space-y-1">
              <span>الحد الأقصى لكمية الهدية</span>
              <input type="number" min={1} max={100} value={giftSettings.maxQty} onChange={(e) => setGiftSettings({ ...giftSettings, maxQty: Number(e.target.value) })} className={inputCls} />
            </label>
            <label className="text-xs space-y-1">
              <span>عدد الهدايا ضمن فترة الحد</span>
              <input type="number" min={1} max={100} value={giftSettings.rateLimitMax} onChange={(e) => setGiftSettings({ ...giftSettings, rateLimitMax: Number(e.target.value) })} className={inputCls} />
            </label>
            <label className="text-xs space-y-1">
              <span>فترة الحد (مللي ثانية)</span>
              <input type="number" min={1000} max={60000} step={1000} value={giftSettings.rateLimitWindowMs} onChange={(e) => setGiftSettings({ ...giftSettings, rateLimitWindowMs: Number(e.target.value) })} className={inputCls} />
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold">
              <input type="checkbox" checked={giftSettings.giftEnabled} onChange={(e) => setGiftSettings({ ...giftSettings, giftEnabled: e.target.checked })} className="accent-sky-500" />
              إرسال الهدايا مفعّل
            </label>
          </div>
        ) : (
          <p className="text-xs text-slate-400">جارٍ تحميل الإعدادات...</p>
        )}
        <button type="button" disabled={!giftSettings || savingGiftConfig} onClick={() => void saveGiftSettings()} className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold disabled:opacity-50">
          <Save className="inline w-3.5 h-3.5 ml-1" />
          حفظ الإعدادات
        </button>
      </section>

      <section className={`p-4 rounded-3xl border space-y-4 ${cardCls}`}>
        <h2 className="text-sm font-extrabold">شرائح رسوم المنصة</h2>
        <div className="space-y-2">
          {slabs.map((slab) => (
            <div key={slab.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs ${subCls}`}>
              <span>{slab.slab_min_coin} إلى {slab.slab_max_coin ?? "∞"} كوينز</span>
              <span className="font-bold text-amber-400">{(slab.platform_fee_bps / 100).toLocaleString("ar")}٪</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => {
                  setEditingSlabId(slab.id);
                  setSlabMin(String(slab.slab_min_coin));
                  setSlabMax(slab.slab_max_coin === null ? "" : String(slab.slab_max_coin));
                  setSlabFeePercent(String(slab.platform_fee_bps / 100));
                }} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1">
                  <Pencil className="w-3 h-3" /> تعديل
                </button>
                <button type="button" disabled={savingGiftConfig} onClick={async () => {
                  setSavingGiftConfig(true);
                  try {
                    const res = await getApiClient().cpCommand(token, "gift_slab_delete", { id: slab.id });
                    onNotify(String(res.msg || "تعذر حذف الشريحة"), !res.err);
                    if (!res.err) void load();
                  } catch (err) {
                    onNotify(err instanceof Error ? err.message : "تعذر حذف الشريحة", false);
                  } finally {
                    setSavingGiftConfig(false);
                  }
                }} className="inline-flex items-center gap-1 rounded-lg border border-rose-900 px-2 py-1 text-rose-400 disabled:opacity-50">
                  <Trash2 className="w-3 h-3" /> حذف
                </button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={(event) => void saveGiftSlab(event)} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <label className="text-xs space-y-1"><span>من كوين</span><input type="number" min={1} value={slabMin} onChange={(e) => setSlabMin(e.target.value)} className={inputCls} required /></label>
          <label className="text-xs space-y-1"><span>إلى كوين (فارغ = بلا حد)</span><input type="number" min={1} value={slabMax} onChange={(e) => setSlabMax(e.target.value)} className={inputCls} /></label>
          <label className="text-xs space-y-1"><span>رسوم المنصة %</span><input type="number" min={0} max={50} step={0.01} value={slabFeePercent} onChange={(e) => setSlabFeePercent(e.target.value)} className={inputCls} required /></label>
          <button type="submit" disabled={savingGiftConfig} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">
            <Save className="inline w-3.5 h-3.5 ml-1" />
            {editingSlabId ? "تحديث الشريحة" : "إضافة شريحة"}
          </button>
          {editingSlabId && <button type="button" onClick={() => {
            setEditingSlabId(null);
            setSlabMin("");
            setSlabMax("");
            setSlabFeePercent("");
          }} className="text-xs text-slate-400">إلغاء التعديل</button>}
        </form>
      </section>
    </div>
  );
}

export function CpEvalPointsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const res = await getApiClient().cpCommand(token, "evaluation_points_get");
    if (!res.err && res.data && typeof res.data === "object") {
      setConfig(res.data as Record<string, unknown>);
    }
  }, [token, getApiClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-2.5 py-1.5 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  if (!config) {
    return <div className={`p-6 rounded-3xl border text-center text-xs ${cardCls}`}>جارٍ التحميل...</div>;
  }

  const actions = (config.actions || {}) as Record<EvaluationAwardActionKey, Record<string, unknown>>;
  const labels: Record<EvaluationAwardActionKey, string> = {
    room_message: "رسائل الغرف",
    wall_post: "منشورات الحائط",
    private_message: "الرسائل الخاصة",
    online_duration: "مدة الاتصال",
    daily_login: "الدخول اليومي",
    game_win: "الفوز بالألعاب والمسابقات",
  };

  const updateRule = (key: EvaluationAwardActionKey, field: string, value: unknown) => {
    setConfig((c) => ({
      ...(c ?? {}),
      actions: {
        ...((c?.actions as Record<string, unknown>) ?? {}),
        [key]: {
          ...(((c?.actions as Record<string, Record<string, unknown>>)?.[key]) ?? {}),
          [field]: value,
        },
      },
    }));
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await getApiClient().cpCommand(token, "evaluation_points_save", { data: config });
        onNotify(String(res.msg || "تم الحفظ"), !res.err);
      }}
      className={`p-4 rounded-3xl border space-y-4 ${cardCls}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          نظام احتساب نقاط التقييم التلقائي
        </h2>
        <label className="inline-flex items-center gap-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={Boolean(config.enabled)}
            onChange={(e) => setConfig((c) => ({ ...(c ?? {}), enabled: e.target.checked }))}
            className="accent-amber-500"
          />
          مفعل
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.keys(labels) as EvaluationAwardActionKey[]).map((key) => {
          const rule = actions[key] || {};
          return (
            <div key={key} className={`p-3 rounded-2xl border space-y-2 text-xs ${subCls}`}>
              <div className="font-extrabold text-sky-400">{labels[key]}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] opacity-65">النقاط</span>
                  <input
                    type="number"
                    value={Number(rule.points || 0)}
                    onChange={(e) => updateRule(key, "points", Number(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <span className="text-[10px] opacity-65">الحد اليومي</span>
                  <input
                    type="number"
                    value={Number(rule.dailyLimit || 0)}
                    onChange={(e) => updateRule(key, "dailyLimit", Number(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <span className="text-[10px] opacity-65">التبريد (ث)</span>
                  <input
                    type="number"
                    value={Math.round(Number(rule.cooldownMs || 0) / 1000)}
                    onChange={(e) => updateRule(key, "cooldownMs", (Number(e.target.value) || 0) * 1000)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <span className="text-[10px] opacity-65">أدنى طول للنص</span>
                  <input
                    type="number"
                    value={Number(rule.minLength || 0)}
                    onChange={(e) => updateRule(key, "minLength", Number(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button type="submit" className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold">
        حفظ قواعد النقاط
      </button>
    </form>
  );
}
