import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Award, Coins, Gift, Image, Plus, Save, Settings2, Sparkles, Trash2, Upload } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { EvaluationAwardActionKey } from "@newchat/shared";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
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
  const [badgeName, setBadgeName] = useState("");
  const [badgeBg, setBadgeBg] = useState("#0284c7");
  const [badgeIcon, setBadgeIcon] = useState("");

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
      <div className={`p-4 rounded-3xl border space-y-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            الشارات والأوسمة
          </h3>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setBadgeType("site")}
              className={`px-3 py-1 rounded-xl text-xs font-bold ${badgeType === "site" ? "bg-amber-600 text-white" : subCls + " border"}`}
            >
              شارات الموقع ({siteBadges.length})
            </button>
            <button
              type="button"
              onClick={() => setBadgeType("room")}
              className={`px-3 py-1 rounded-xl text-xs font-bold ${badgeType === "room" ? "bg-amber-600 text-white" : subCls + " border"}`}
            >
              شارات الغرف ({roomBadges.length})
            </button>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!badgeName.trim()) return;
            const cmd = badgeType === "site" ? "site_badges_save" : "room_badges_save";
            const res = await getApiClient().cpCommand(token, cmd, {
              data: { name: badgeName.trim(), bg: badgeBg, icon: badgeIcon.trim(), bg_type: "static" },
            });
            onNotify(String(res.msg || "تم الحفظ"), !res.err);
            setBadgeName("");
            setBadgeIcon("");
            void load();
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2"
        >
          <input type="text" value={badgeName} onChange={(e) => setBadgeName(e.target.value)} placeholder="اسم الشارة..." className={inputCls} />
          <input type="color" value={badgeBg} onChange={(e) => setBadgeBg(e.target.value)} className="w-full h-9 rounded-xl" />
          <input type="text" value={badgeIcon} onChange={(e) => setBadgeIcon(e.target.value)} placeholder="ملف الأيقونة (dro3)" className={inputCls} />
          <button type="submit" className="py-2 rounded-xl bg-amber-600 text-white text-xs font-bold">
            إضافة شارة
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {(badgeType === "site" ? siteBadges : roomBadges).map((b) => (
            <div key={String(b.id)} className={`px-3 py-1.5 rounded-2xl border flex items-center gap-2 text-xs ${subCls}`}>
              <span className="font-bold">{String(b.name)}</span>
              <button
                type="button"
                onClick={async () => {
                  const cmd = badgeType === "site" ? "site_badges_del" : "room_badges_del";
                  await getApiClient().cpCommand(token, cmd, { id: b.id });
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
  );
}

export function CpGiftsTab({ dark, token, onNotify }: CpTabProps) {
  const getApiClient = useChatStore((s) => s.getApiClient);
  const [gifts, setGifts] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [catName, setCatName] = useState("");
  const [giftName, setGiftName] = useState("");
  const [giftCoin, setGiftCoin] = useState("10");
  const [giftCat, setGiftCat] = useState("افتراضي");

  const load = useCallback(async () => {
    const res = await getApiClient().cpCommand(token, "gifts_git_get").catch(() => null);
    const msg = (res as { msg?: { gifts?: Array<Record<string, unknown>>; categories?: Array<string | { name?: string }> } } | null)?.msg;
    if (msg) {
      setGifts(Array.isArray(msg.gifts) ? msg.gifts : []);
      setCategories(
        Array.isArray(msg.categories)
          ? msg.categories.map((c) => (typeof c === "string" ? c : String(c?.name || ""))).filter(Boolean)
          : [],
      );
    }
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
