import { useState } from "react";
import { Bot, Play, Square, Trophy, Users, X } from "lucide-react";
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

  const [tab, setTab] = useState<"competitions" | "talking">("competitions");
  const [selectedKind, setSelectedKind] = useState<CompetitionBotKind>(
    (competitionState?.kind as CompetitionBotKind) || "brb",
  );
  const [targetType, setTargetType] = useState<"room" | "wall">("room");

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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType("room")}
                  className={`py-2 rounded-xl border text-xs font-bold ${
                    targetType === "room"
                      ? "border-amber-500 bg-amber-500/15 text-amber-300"
                      : dark
                        ? "border-slate-800 text-slate-400"
                        : "border-slate-200 text-slate-600"
                  }`}
                >
                  داخل الغرفة الحالية
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("wall")}
                  className={`py-2 rounded-xl border text-xs font-bold ${
                    targetType === "wall"
                      ? "border-amber-500 bg-amber-500/15 text-amber-300"
                      : dark
                        ? "border-slate-800 text-slate-400"
                        : "border-slate-200 text-slate-600"
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
                    className={`text-right p-2.5 rounded-2xl border transition ${
                      selectedKind === item.id
                        ? "border-amber-500 bg-amber-500/10"
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

              {canComp ? (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      controlCompetitionBot("botbrb", {
                        op: "start",
                        kind: selectedKind,
                        targetType,
                        targetId: targetType === "room" ? currentRoomId : "wall",
                      });
                      onClose();
                    }}
                    className="inline-flex items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>تشغيل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      controlCompetitionBot("botbrb", {
                        op: "scores",
                        targetType,
                        targetId: targetType === "room" ? currentRoomId : "wall",
                      })
                    }
                    className="inline-flex items-center justify-center gap-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>النقاط</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      controlCompetitionBot("botbrb", {
                        op: "stop",
                        targetType,
                        targetId: targetType === "room" ? currentRoomId : "wall",
                      })
                    }
                    className="inline-flex items-center justify-center gap-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>إيقاف</span>
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
                  onClick={() => controlCompetitionBot("enterbotall", {})}
                  className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>إدخال كل البوتات</span>
                </button>
                <button
                  type="button"
                  onClick={() => controlCompetitionBot("exitbotall", {})}
                  className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
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
                    onClick={() =>
                      controlCompetitionBot("addbots", {
                        count: botCount,
                        prefix: botPrefix,
                        room: currentRoomId,
                        msg: botTalkMsg,
                      })
                    }
                    className="py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                  >
                    توليد ({botCount})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      controlCompetitionBot("startbotchat", {
                        msg: botTalkMsg,
                        intervalMs: 6000,
                      })
                    }
                    className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    تشغيل الحوار
                  </button>
                  <button
                    type="button"
                    onClick={() => controlCompetitionBot("stopbotchat", {})}
                    className="py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
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
