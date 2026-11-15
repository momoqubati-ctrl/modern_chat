import { useState } from "react";
import { Bot, Play, Square, Target, Trophy, Users, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { CompetitionBotKind } from "@newchat/shared";
import { canManageTalkingBots, canUseCompetitionBots } from "../lib/permissions.js";

interface CompetitionBotModalProps {
  dark: boolean;
  onClose: () => void;
}

const COMPETITION_KINDS: Array<{ id: CompetitionBotKind; label: string; desc: string }> = [
  { id: "brb", label: "المسابقة السريعة (BRB)", desc: "كتابة الكود الرقمي الأسرع" },
  { id: "capitals", label: "عواصم الدول", desc: "سؤال وجواب عن عواصم العالم" },
  { id: "general_questions", label: "ثقافة عامة", desc: "أسئلة متنوعة في المعرفة" },
  { id: "english_word", label: "كلمات إنجليزية", desc: "ترجم الكلمة الإنجليزية للعربية" },
  { id: "fast_challenge", label: "التحدي السريع", desc: "أحرف معكوسة وألغاز سريعة" },
  { id: "odd_number", label: "الرقم المختلف", desc: "استخرج الرقم الغريب من التسلسل" },
  { id: "missing_letters", label: "الحروف الناقصة", desc: "أكمل الكلمة بالحروف المفقودة" },
  { id: "guess_number", label: "تخمين الرقم", desc: "خمن الرقم السري بين 1 و 15" },
  { id: "confession_chair", label: "كرسي الاعتراف", desc: "أسئلة تفاعلية للأعضاء" },
  { id: "lucky_wheel", label: "عجلة الحظ", desc: "جوائز وتحديات عشوائية" },
];

export function CompetitionBotModal({ dark, onClose }: CompetitionBotModalProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const competitionState = useChatStore((s) => s.competitionState);
  const controlCompetitionBot = useChatStore((s) => s.controlCompetitionBot);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [tab, setTab] = useState<"competitions" | "talking">("competitions");
  const [selectedKind, setSelectedKind] = useState<CompetitionBotKind>(
    (competitionState?.kind as CompetitionBotKind) || "brb",
  );
  const [targetType, setTargetType] = useState<"room" | "wall">("room");

  const [targetPoints, setTargetPoints] = useState<number>(() => competitionState?.targetPoints ?? 5);
  const [maxQuestions, setMaxQuestions] = useState<number>(() => competitionState?.maxQuestions ?? 10);
  const [isUnlimitedQuestions, setIsUnlimitedQuestions] = useState<boolean>(
    () => competitionState?.maxQuestions === 0,
  );

  const [botPrefix, setBotPrefix] = useState("ضيف");
  const [botCount, setBotCount] = useState(10);
  const [botTalkMsg, setBotTalkMsg] = useState("مرحبا بالجميع منورين الشات");

  const canComp = canUseCompetitionBots(me, powers, myPowerRole);
  const canTalking = canManageTalkingBots(me, powers, myPowerRole);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-800/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-extrabold">بوتات المسابقات والتفاعل</h3>
              <p className="text-[11px] text-slate-400">
                {competitionState?.active
                  ? `نشط الآن (${competitionState.kind}) • جولة #${competitionState.roundNumber ?? 1}`
                  : "اختر مسابقة لتشغيلها داخل الغرفة أو الحائط"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-800/50 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {canTalking && (
          <div className="px-4 pt-2.5 shrink-0">
            <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${dark ? "bg-slate-950" : "bg-slate-100"}`}>
              <button
                type="button"
                onClick={() => setTab("competitions")}
                className={`py-1.5 rounded-lg text-xs font-bold ${
                  tab === "competitions" ? "bg-amber-600 text-white" : "text-slate-400"
                }`}
              >
                المسابقات التفاعلية
              </button>
              <button
                type="button"
                onClick={() => setTab("talking")}
                className={`py-1.5 rounded-lg text-xs font-bold ${
                  tab === "talking" ? "bg-sky-600 text-white" : "text-slate-400"
                }`}
              >
                البوتات الناطقة
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll">
          {tab === "competitions" ? (
            <>
              {/* Live Bot Status Card */}
              {competitionState?.active ? (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div>
                      <div className="text-xs font-black flex items-center gap-1.5">
                        <span>البوت نشط ويعمل حالياً</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 font-mono">
                          {targetType === "room" ? "داخل الغرفة" : "على الحائط"}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-200/80 mt-0.5">
                        {COMPETITION_KINDS.find((k) => k.id === competitionState.kind)?.label || competitionState.kind} • الجولة #{competitionState.roundNumber ?? 1} {competitionState.maxQuestions ? `من ${competitionState.maxQuestions}` : ""} • هدف الفوز: {competitionState.targetPoints ?? 5} نقاط
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      controlCompetitionBot("botbrb", {
                        op: "stop",
                        targetType,
                        targetId: targetType === "room" ? currentRoomId : "wall",
                      });
                      pushNotice("تم إيقاف بوت المسابقات بنجاح 🛑", { topic: "بوت المسابقات" });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-90 shadow-sm shrink-0"
                  >
                    إيقاف فوري
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0"></span>
                  <div className="text-xs">
                    <span className="font-bold text-slate-200">البوت متوقف حالياً:</span> اختر نوع المسابقة من القائمة أدناه واضغط على <strong className="text-emerald-400">"تشغيل المسابقة"</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType("room")}
                  className={`py-2 rounded-xl border text-xs font-bold transition active:scale-95 ${
                    targetType === "room"
                      ? "border-amber-500 bg-amber-500/15 text-amber-300 shadow-sm"
                      : dark
                        ? "border-slate-800 text-slate-400 hover:bg-slate-800/40"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  داخل الغرفة الحالية
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("wall")}
                  className={`py-2 rounded-xl border text-xs font-bold transition active:scale-95 ${
                    targetType === "wall"
                      ? "border-amber-500 bg-amber-500/15 text-amber-300 shadow-sm"
                      : dark
                        ? "border-slate-800 text-slate-400 hover:bg-slate-800/40"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  على الحائط العام
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMPETITION_KINDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedKind(item.id)}
                    className={`text-right p-2.5 rounded-2xl border transition active:scale-95 ${
                      selectedKind === item.id
                        ? "border-amber-500 bg-amber-500/10 shadow-xs"
                        : dark
                          ? "border-slate-800 hover:bg-slate-800/60"
                          : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{item.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>

              {/* Competition Rules Settings: Target Points & Max Questions */}
              <div
                className={`p-3.5 rounded-2xl border space-y-3 ${
                  dark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black flex items-center gap-1.5 text-amber-400">
                    <Target className="w-4 h-4" />
                    <span>قواعد الفوز وعدد الأسئلة</span>
                  </div>
                  <span className="text-[10px] text-slate-400">تحدد شروط إنهاء المسابقة وتتويج الفائز</span>
                </div>

                {/* 1. Target Points (نقاط الفوز) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <label htmlFor="targetPointsInput" className="flex items-center gap-1 text-slate-300">
                      <span>النقاط المحددة للفوز:</span>
                      <span className="text-emerald-400 font-mono text-xs font-black">({targetPoints} نقاط)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">أول من يصل إليها يفوز فوراً 👑</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[3, 5, 10, 15, 20].map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setTargetPoints(pts)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 ${
                          targetPoints === pts
                            ? "bg-emerald-600 border-emerald-500 text-white shadow-xs"
                            : dark
                              ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {pts} نقاط
                      </button>
                    ))}
                    <input
                      id="targetPointsInput"
                      type="number"
                      min={1}
                      max={50}
                      value={targetPoints}
                      onChange={(e) => setTargetPoints(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      className={`w-16 px-2 py-1 rounded-xl text-xs text-center border font-mono font-bold outline-none ${
                        dark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                      }`}
                      title="نقاط الفوز مخصصة"
                    />
                  </div>
                </div>

                {/* 2. Max Questions / Rounds (عدد الأسئلة) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/30">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <label htmlFor="maxQuestionsInput" className="flex items-center gap-1 text-slate-300">
                      <span>إجمالي عدد الأسئلة:</span>
                      <span className="text-sky-400 font-mono text-xs font-black">
                        {isUnlimitedQuestions ? "(غير محدود)" : `(${maxQuestions} سؤال)`}
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-400">تنتهي المسابقة بعد طرحها 🏁</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 10, 15, 20, 30].map((qCount) => (
                      <button
                        key={qCount}
                        type="button"
                        onClick={() => {
                          setMaxQuestions(qCount);
                          setIsUnlimitedQuestions(false);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 ${
                          !isUnlimitedQuestions && maxQuestions === qCount
                            ? "bg-sky-600 border-sky-500 text-white shadow-xs"
                            : dark
                              ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        {qCount}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsUnlimitedQuestions(!isUnlimitedQuestions)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 ${
                        isUnlimitedQuestions
                          ? "bg-purple-600 border-purple-500 text-white shadow-xs"
                          : dark
                            ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      بلا حد (مستمر)
                    </button>
                    {!isUnlimitedQuestions && (
                      <input
                        id="maxQuestionsInput"
                        type="number"
                        min={1}
                        max={100}
                        value={maxQuestions}
                        onChange={(e) => setMaxQuestions(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                        className={`w-16 px-2 py-1 rounded-xl text-xs text-center border font-mono font-bold outline-none ${
                          dark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                        title="عدد الأسئلة مخصص"
                      />
                    )}
                  </div>
                </div>
              </div>

              {canComp ? (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const finalPoints = Math.max(1, Math.min(50, Number(targetPoints) || 5));
                      const finalQuestions = isUnlimitedQuestions ? 0 : Math.max(1, Math.min(100, Number(maxQuestions) || 10));

                      controlCompetitionBot("botbrb", {
                        op: "start",
                        kind: selectedKind,
                        targetType,
                        targetId: targetType === "room" ? currentRoomId : "wall",
                        targetPoints: finalPoints,
                        maxQuestions: finalQuestions,
                      });

                      const kindLabel = COMPETITION_KINDS.find((k) => k.id === selectedKind)?.label || "المسابقة";
                      const rulesText = finalQuestions > 0
                        ? `هدف الفوز: ${finalPoints} نقاط • إجمالي الأسئلة: ${finalQuestions}`
                        : `هدف الفوز: ${finalPoints} نقاط • الأسئلة مستمرة`;
                      pushNotice(`تم تشغيل ${kindLabel} بنجاح (${rulesText}) 🚀`, { topic: "بوت المسابقات" });
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition active:scale-90 shadow-md shadow-emerald-950/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>تشغيل المسابقة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      controlCompetitionBot("botbrb", {
                        op: "scores",
                        targetType,
                        targetId: targetType === "room" ? currentRoomId : "wall",
                      });
                      pushNotice("تم إرسال طلب عرض قائمة النقاط الحالية 🏆", { topic: "بوت المسابقات" });
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition active:scale-90"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>عرض النقاط</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      controlCompetitionBot("botbrb", {
                        op: "stop",
                        targetType,
                        targetId: targetType === "room" ? currentRoomId : "wall",
                      });
                      pushNotice("تم إيقاف بوت المسابقات بنجاح 🛑", { topic: "بوت المسابقات" });
                    }}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition active:scale-90"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>إيقاف المسابقة</span>
                  </button>
                </div>
              ) : (
                <div className="text-center text-xs text-amber-400 py-2">
                  يتطلب صلاحية إدارة المسابقات لتشغيل أو إيقاف البوت
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    controlCompetitionBot("enterbotall", {});
                    pushNotice("تم إدخال جميع البوتات إلى الغرفة بنجاح 🤖", { topic: "البوتات" });
                  }}
                  className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-90"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>إدخال كل البوتات</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    controlCompetitionBot("exitbotall", {});
                    pushNotice("تم إخراج جميع البوتات من الغرفة بنجاح 🚪", { topic: "البوتات" });
                  }}
                  className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-90"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>إخراج كل البوتات</span>
                </button>
              </div>

              <div
                className={`p-3 rounded-2xl border space-y-2 ${
                  dark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="text-xs font-extrabold flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-sky-400" />
                  <span>توليد وإدارة البوتات الناطقة</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={botPrefix}
                    onChange={(e) => setBotPrefix(e.target.value)}
                    placeholder="بادئة الاسم"
                    className={`rounded-xl px-3 py-1.5 text-xs border outline-none ${
                      dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                    }`}
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={botCount}
                    onChange={(e) => setBotCount(Number(e.target.value) || 10)}
                    className={`rounded-xl px-3 py-1.5 text-xs border outline-none ${
                      dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                    }`}
                  />
                </div>
                <input
                  type="text"
                  value={botTalkMsg}
                  onChange={(e) => setBotTalkMsg(e.target.value)}
                  placeholder="رسالة البوتات..."
                  className={`w-full rounded-xl px-3 py-1.5 text-xs border outline-none ${
                    dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  }`}
                />
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      controlCompetitionBot("addbots", {
                        count: botCount,
                        prefix: botPrefix,
                        room: currentRoomId,
                        msg: botTalkMsg,
                      });
                      pushNotice(`تم توليد ${botCount} بوت بالاسم (${botPrefix}) بنجاح ✨`, { topic: "البوتات" });
                    }}
                    className="py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition active:scale-90"
                  >
                    توليد ({botCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      controlCompetitionBot("startbotchat", {
                        msg: botTalkMsg,
                        intervalMs: 6000,
                      });
                      pushNotice("تم تشغيل الحوار الآلي للبوتات بنجاح 💬", { topic: "البوتات" });
                    }}
                    className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-90"
                  >
                    تشغيل الحوار
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      controlCompetitionBot("stopbotchat", {});
                      pushNotice("تم إيقاف الحوار الآلي للبوتات 🛑", { topic: "البوتات" });
                    }}
                    className="py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition active:scale-90"
                  >
                    إيقاف الحوار
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
