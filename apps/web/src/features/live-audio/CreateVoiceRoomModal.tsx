import { useState, type FormEvent } from "react";
import {
  Gift,
  Globe,
  KeyRound,
  Lock,
  Mic,
  Radio,
  Sliders,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { canCreateVoiceRoomUser } from "../../lib/permissions.js";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";

interface CreateVoiceRoomModalProps {
  dark: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated?: (roomId: string) => void;
}

export function CreateVoiceRoomModal({
  dark,
  isOpen,
  onClose,
  onRoomCreated,
}: CreateVoiceRoomModalProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const createRoom = useChatStore((s) => s.createRoom);
  const joinRoom = useChatStore((s) => s.joinRoom);
  const pushNotice = useChatStore((s) => s.pushNotice);
  const site = useChatStore((s) => s.site);

  const canCreate = canCreateVoiceRoomUser(me, powers, myPowerRole);

  const [topic, setTopic] = useState("");
  const [coverPic, setCoverPic] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "pin">("public");
  const [pinCode, setPinCode] = useState("");
  const [joinMode, setJoinMode] = useState<"free" | "request">("free");
  const [stageCount, setStageCount] = useState<number>(12);
  const [submitting, setSubmitting] = useState(false);

  const gifts = useChatStore((s) => s.gifts);
  const [selectedGiftId, setSelectedGiftId] = useState<string>(() => {
    return (
      gifts.find((g) => g.file === "rose.png" || g.name === "وردة" || g.coin === 1)?.id ||
      gifts[0]?.id ||
      "rose_standard"
    );
  });
  const [giftTargetCount, setGiftTargetCount] = useState<number>(100);

  if (!isOpen || !canCreate) {
    return null;
  }

  const defaultAvatar = me?.pic || "pic.png";
  const effectiveCover = coverPic.trim() || defaultAvatar;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalTopic = topic.trim() || `بث ${me?.topic || "المضيف"} الصوتي`;

    if (privacy === "pin" && !pinCode.trim()) {
      pushNotice("يرجى إدخال رمز الدخول (PIN Code) للقناة الخاصة", { force: 1 });
      return;
    }

    setSubmitting(true);

    try {
      const selectedGift = gifts.find((g) => g.id === selectedGiftId) || gifts[0];
      const goalData = {
        giftId: selectedGift?.id || "rose_standard",
        giftFile: selectedGift?.file || "rose.png",
        giftName: selectedGift?.name || "وردة",
        giftCoin: selectedGift?.coin || 1,
        giftIcon: "🎁",
        targetCount: giftTargetCount,
        currentCount: 0,
      };

      createRoom({
        topic: finalTopic,
        about: "قناة صوتية مباشرة (Live Audio Room)",
        welcome: `أهلاً بكم في بث ${me?.topic || "المضيف"} المباشر! شاركونا المحادثة والهدايا 🎙️`,
        pic: effectiveCover,
        color: dark ? "#080c14" : (site?.colors?.bgcolor && site.colors.bgcolor !== "#000000" ? site.colors.bgcolor : "#f8fafc"),
        max: 200,
        broadcast: true,
        delete: true,
        stage_count: stageCount,
        mic: stageCount,
        is_live_audio: true,
        room_type: "live_audio",
        join_mode: joinMode,
        pass: privacy === "pin" ? pinCode.trim() : "",
        gift_goal: goalData,
        pinned_notice:
          "مباشر وفي الوقت الفعلي، يلزم أن يكون عمر المذيعين 18 عاماً أو أكثر لبدء بث مباشر، ويلزم أن يكون عمر المشاهدين 18 عاماً أو أكثر لشحن الرصيد وإرسال الهدايا. تذكر اتباع إرشادات المجتمع لدينا.",
        hourly_rank: "🔥 ترتيب كل ساعة",
      });

      pushNotice("تم إنشاء القناة الصوتية المباشرة بنجاح! جاري الدخول...", { force: 1 });
      onClose();
      if (onRoomCreated) {
        onRoomCreated(finalTopic);
      }
    } catch {
      pushNotice("حدث خطأ أثناء إنشاء القناة الصوتية", { force: 1 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 animate-fade-in ${
        dark ? "bg-black/80 backdrop-blur-md" : "bg-slate-900/40 backdrop-blur-xs"
      }`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          dark
            ? "border-white/10 bg-[#0B0B0D] text-white"
            : "border-slate-200 bg-white text-slate-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
            dark ? "bg-sky-500/20" : "bg-sky-400/25"
          }`}
        />

        {/* Modal Header */}
        <div
          className={`relative flex items-center justify-between px-5 py-4 border-b ${
            dark ? "border-white/10 bg-white/5" : "border-slate-100 bg-slate-50/80"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2
                className={`text-base font-extrabold flex items-center gap-1.5 ${
                  dark ? "text-white" : "text-slate-900"
                }`}
              >
                بدء بث صوتي مباشر
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-500 border border-sky-500/30 font-bold">
                  Live Room
                </span>
              </h2>
              <p className={`text-[11px] ${dark ? "text-slate-400" : "text-slate-500"}`}>
                12 مقعداً صوتياً مع تحكم كامل بالبث والمقاعد
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
              dark
                ? "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
            }`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto chat-scroll flex-1">
          {/* Room Title */}
          <div>
            <label
              className={`block text-xs font-bold mb-1.5 ${
                dark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              عنوان القناة الصوتية <span className="text-sky-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`مثال: بث ${me?.topic || "المضيف"} - سوالف وضحك 🎙️`}
                maxLength={80}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm outline-none transition ${
                  dark
                    ? "bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-sky-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white"
                }`}
              />
              <span
                className={`absolute left-3 top-2.5 text-[10px] font-mono ${
                  dark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {topic.length}/80
              </span>
            </div>
          </div>

          {/* Cover Preview & Custom Cover */}
          <div>
            <label
              className={`block text-xs font-bold mb-1.5 ${
                dark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              صورة الغلاف (اختياري - افتراضياً صورتك الشخصية)
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-sky-500/50 bg-slate-900 shrink-0 shadow-md">
                <img
                  src={resolveAssetUrl(effectiveCover, "user", "/default-avatar.png")}
                  alt="غلاف القناة"
                  className="w-full h-full object-cover"
                />
              </div>
              <input
                type="text"
                value={coverPic}
                onChange={(e) => setCoverPic(e.target.value)}
                placeholder="رابط صورة الغلاف أو اتركها فارغة"
                className={`flex-1 px-3.5 py-2 rounded-xl border text-xs outline-none transition ${
                  dark
                    ? "bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-sky-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white"
                }`}
              />
            </div>
          </div>

          {/* Privacy Mode: Public vs PIN */}
          <div>
            <label
              className={`block text-xs font-bold mb-1.5 ${
                dark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              نمط الخصوصية
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPrivacy("public")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-bold transition ${
                  privacy === "public"
                    ? "bg-sky-500/15 border-sky-500 text-sky-500 shadow-xs"
                    : dark
                      ? "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Globe className="w-4 h-4 text-sky-500" />
                <span>عامة (Public)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrivacy("pin")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-bold transition ${
                  privacy === "pin"
                    ? "bg-amber-500/15 border-amber-500 text-amber-500 shadow-xs"
                    : dark
                      ? "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Lock className="w-4 h-4 text-amber-500" />
                <span>برمز دخول (PIN)</span>
              </button>
            </div>
            {privacy === "pin" && (
              <div className="mt-2 animate-fade-in">
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-amber-500 absolute right-3 top-2.5" />
                  <input
                    type="password"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="أدخل رمز الدخول (PIN Code)..."
                    maxLength={20}
                    className={`w-full pr-9 pl-3 py-2 rounded-xl border text-xs outline-none transition ${
                      dark
                        ? "bg-white/5 border-amber-500/40 text-white placeholder-slate-500 focus:border-amber-400"
                        : "bg-slate-50 border-amber-400/50 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:bg-white"
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Seat Join Mode: Free Join vs Request to Speak */}
          <div>
            <label
              className={`block text-xs font-bold mb-1.5 ${
                dark ? "text-slate-300" : "text-slate-700"
              }`}
            >
              وضع الانضمام للمقاعد الافتراضي
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setJoinMode("free")}
                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border text-center transition ${
                  joinMode === "free"
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-500 shadow-xs"
                    : dark
                      ? "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-xs font-extrabold ${
                    joinMode === "free" ? "text-emerald-500" : dark ? "text-white" : "text-slate-800"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-emerald-500" />
                  <span>صعود حر (Free)</span>
                </div>
                <span
                  className={`text-[10px] ${
                    joinMode === "free" ? "text-emerald-600/80" : dark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  يمكن لأي مستمع أخذ مقعد مباشرة
                </span>
              </button>

              <button
                type="button"
                onClick={() => setJoinMode("request")}
                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border text-center transition ${
                  joinMode === "request"
                    ? "bg-sky-500/15 border-sky-500 text-sky-500 shadow-xs"
                    : dark
                      ? "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-xs font-extrabold ${
                    joinMode === "request" ? "text-sky-500" : dark ? "text-white" : "text-slate-800"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-sky-500" />
                  <span>بطلب موافقة (Request)</span>
                </div>
                <span
                  className={`text-[10px] ${
                    joinMode === "request" ? "text-sky-600/80" : dark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  يلزم موافقة المضيف لصعود المايك
                </span>
              </button>
            </div>
          </div>

          {/* Number of Active Seats: 2 to 12 (Default 12) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className={`text-xs font-bold ${
                  dark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                عدد المقاعد النشطة مبدئياً
              </label>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-500 border border-sky-500/30 font-mono">
                {stageCount} مقاعد
              </span>
            </div>
            <div
              className={`flex items-center gap-3 p-3 rounded-2xl border ${
                dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
              }`}
            >
              <span className={`text-xs font-mono ${dark ? "text-slate-400" : "text-slate-500"}`}>2</span>
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={stageCount}
                onChange={(e) => setStageCount(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-sky-500">12</span>
            </div>
            <div
              className={`flex items-center justify-between text-[10px] mt-1 px-1 ${
                dark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <span>2 مقاعد (حواري)</span>
              <span>6 مقاعد</span>
              <span>12 مقعداً (الافتراضي - 12 Seats)</span>
            </div>
          </div>

          {/* Gift Goal Selection: تحديد هدف هدايا البث */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className={`text-xs font-bold flex items-center gap-1.5 ${
                  dark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                <Gift className="w-3.5 h-3.5 text-amber-500" />
                <span>هدف الهدايا المرجو للبث (Gift Goal)</span>
              </label>
              <span className="text-[11px] font-mono font-bold text-amber-500">
                الهدف: {giftTargetCount}
              </span>
            </div>

            {gifts && gifts.length > 0 ? (
              <div className="space-y-2">
                <div
                  className={`grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto chat-scroll p-1 rounded-2xl border ${
                    dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  {gifts.map((g) => {
                    const isSelected = selectedGiftId === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGiftId(g.id || g.file)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-center transition ${
                          isSelected
                            ? "bg-sky-500/20 border-sky-500 shadow-sm shadow-sky-500/20"
                            : dark
                              ? "bg-white/5 border-white/10 hover:bg-white/10"
                              : "bg-white border-slate-200 hover:bg-slate-100 shadow-xs"
                        }`}
                      >
                        <div className="w-9 h-9 flex items-center justify-center">
                          <img
                            src={resolveAssetUrl(g.file, "gifts_git")}
                            alt={g.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span
                          className={`text-[10px] font-extrabold truncate max-w-full ${
                            dark ? "text-white" : "text-slate-800"
                          }`}
                        >
                          {g.name}
                        </span>
                        <span className="text-[9px] font-mono text-amber-500 font-bold">
                          {g.coin} 🪙
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Target Count Quick Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <span
                    className={`text-[11px] font-bold shrink-0 ${
                      dark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    العدد المستهدف:
                  </span>
                  {[50, 100, 200, 500].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setGiftTargetCount(cnt)}
                      className={`flex-1 py-1 rounded-xl text-xs font-mono font-bold transition border ${
                        giftTargetCount === cnt
                          ? "bg-sky-500 border-sky-500 text-white shadow-xs"
                          : dark
                            ? "bg-white/5 border-white/10 text-slate-300 hover:text-white"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  dark ? "bg-white/5 border-white/10 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                لا توجد هدايا مخصصة في الكتالوج حالياً، سيتم استخدام الوردة كهدف افتراضي
              </div>
            )}
          </div>

          {/* Go Live Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-600 hover:brightness-105 active:scale-[0.99] text-white font-extrabold text-sm shadow-xl shadow-sky-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>{submitting ? "جارٍ بدء البث..." : "بدء البث الصوتي الآن (Go Live)"}</span>
              <Sparkles className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
