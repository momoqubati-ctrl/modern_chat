import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Dices,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import {
  LUDO_COLOR_LABELS_AR,
  LUDO_SEAT_COLORS,
  type LudoColor,
} from "@newchat/shared";
import { canUseRoomManagement } from "../lib/permissions.js";
import { playSoundCue } from "../lib/soundFx.js";
import { LudoBoard } from "./LudoBoard.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface RoomLudoModalProps {
  dark: boolean;
  open: boolean;
  onClose: () => void;
}

const SEAT_BADGE_MAP: Record<LudoColor, string> = {
  red: "bg-rose-500/20 text-rose-400 border-rose-500/40",
  green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  yellow: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  blue: "bg-sky-500/20 text-sky-400 border-sky-500/40",
};

export default function RoomLudoModal({ dark, open, onClose }: RoomLudoModalProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const ludoState = useChatStore((s) => s.ludoState);
  const lastLudoEventFx = useChatStore((s) => s.lastLudoEventFx);
  const ludoManage = useChatStore((s) => s.ludoManage);
  const ludoSync = useChatStore((s) => s.ludoSync);
  const ludoRoll = useChatStore((s) => s.ludoRoll);
  const ludoMove = useChatStore((s) => s.ludoMove);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [rollingVisual, setRollingVisual] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    ludoSync();
  }, [open, ludoSync]);

  // Lightweight countdown tick only while match is active
  useEffect(() => {
    if (!open || ludoState?.status !== "active") return;
    const id = setInterval(() => setNowTs(Date.now()), 500);
    return () => clearInterval(id);
  }, [open, ludoState?.status]);

  // Trigger sound cue on notable game events
  useEffect(() => {
    if (!open || !lastLudoEventFx) return;
    const kind = String(lastLudoEventFx.kind || "");
    if (kind === "move") {
      if (lastLudoEventFx.finished) playSoundCue("win");
      else if (Array.isArray(lastLudoEventFx.capturedTokenIds) && lastLudoEventFx.capturedTokenIds.length > 0) {
        playSoundCue("gift");
      } else {
        playSoundCue("notice");
      }
    }
  }, [open, lastLudoEventFx]);

  useEffect(() => {
    return () => {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    };
  }, []);

  const myPlayer = useMemo(() => {
    if (!ludoState || !me) return null;
    return (
      ludoState.players.find(
        (p) => !p.isBot && (p.socketId === me.id || (me.uid && p.userId === me.uid)),
      ) ?? null
    );
  }, [ludoState, me]);

  const isMyTurn = Boolean(
    ludoState?.status === "active" && myPlayer && myPlayer.seat === ludoState.turnSeat,
  );

  const handleRollDice = useCallback(() => {
    if (!isMyTurn || ludoState?.phase !== "awaiting_roll") return;
    setRollingVisual(true);
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    rollTimeoutRef.current = setTimeout(() => setRollingVisual(false), 420);
    ludoRoll();
  }, [isMyTurn, ludoState?.phase, ludoRoll]);

  const handleMoveToken = useCallback(
    (tokenId: string) => {
      if (!isMyTurn || ludoState?.phase !== "awaiting_move") return;
      ludoMove(tokenId);
    },
    [isMyTurn, ludoState?.phase, ludoMove],
  );

  if (!open) return null;

  const canManageGame = canUseRoomManagement(me, powers) || Boolean(myPlayer);
  const canJoinSeat = ludoState?.status !== "active" && !myPlayer;
  const hasBots = Boolean(ludoState?.players.some((p) => p.isBot));
  const turnTimeoutMs = ludoState?.turnTimeoutMs || 28_000;
  const remainingSec =
    ludoState?.status === "active" && ludoState.turnStartedAt > 0
      ? Math.max(0, Math.ceil((turnTimeoutMs - (nowTs - ludoState.turnStartedAt)) / 1000))
      : 0;

  const modalCls = dark
    ? "bg-slate-900 border-slate-800 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const boxCls = dark
    ? "bg-slate-950/75 border-slate-800"
    : "bg-slate-50 border-slate-200";

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-5xl max-h-[94vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${modalCls}`}
      >
        {/* Top bar */}
        <div className="px-4 py-2.5 border-b border-slate-800/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Dices className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-extrabold">طاولة اللودو — الغرفة</h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 text-[10px] font-bold">
              <Users className="w-3 h-3" />
              {ludoState?.spectators ?? 0} مشاهد
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={ludoSync}
              className="p-2 rounded-xl hover:bg-slate-800/50 transition"
              title="مزامنة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800/50 transition"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Responsive Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto chat-scroll p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Ludo Board */}
          <div className="lg:col-span-7">
            <LudoBoard
              game={ludoState}
              myColor={myPlayer?.color ?? null}
              isMyTurn={isMyTurn}
              rollingVisual={rollingVisual}
              onRollDice={handleRollDice}
              onMoveToken={handleMoveToken}
              dark={dark}
            />
          </div>

          {/* Seats & Controls */}
          <div className="lg:col-span-5 space-y-3">
            {/* 4 Seats Grid */}
            <div className="grid grid-cols-2 gap-2">
              {([0, 1, 2, 3] as const).map((seat) => {
                const color = LUDO_SEAT_COLORS[seat];
                const player = ludoState?.players.find((p) => p.seat === seat) ?? null;
                const activeTurn =
                  ludoState?.status === "active" && ludoState.turnSeat === seat;

                return (
                  <div
                    key={seat}
                    className={`p-2.5 rounded-2xl border space-y-2 transition ${
                      activeTurn ? "border-amber-500 bg-amber-500/10" : boxCls
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] ${SEAT_BADGE_MAP[color]}`}>
                        {LUDO_COLOR_LABELS_AR[color]}
                      </span>
                      <span className="text-[10px] opacity-75">
                        {player ? `${player.finishedCount ?? 0}/4 👑` : `مقعد ${seat + 1}`}
                      </span>
                    </div>

                    {player ? (
                      <div className="flex items-center gap-2 min-w-0">
                        {player.isBot ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4" />
                          </div>
                        ) : (
                          <MemberAvatar
                            pic={player.pic}
                            topic={player.topic}
                            size="sm"
                            showStatus={false}
                          />
                        )}
                        <span className="text-xs font-extrabold truncate">{player.topic}</span>
                      </div>
                    ) : canJoinSeat ? (
                      <button
                        type="button"
                        onClick={() => ludoManage("sit", seat)}
                        className="w-full py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition"
                      >
                        الجلوس هنا
                      </button>
                    ) : (
                      <div className="text-[11px] opacity-55 py-1 text-center">مقعد شاغر</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Match Status & Turn Timer */}
            <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${boxCls}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold">الحالة:</span>
                <span className="font-extrabold text-amber-400">
                  {ludoState?.status === "active"
                    ? `دور ${ludoState.turnTopic} (${remainingSec}ث)`
                    : ludoState?.status === "finished"
                      ? `فاز ${ludoState.winnerTopic}`
                      : "بانتظار بدء الجولة"}
                </span>
              </div>
              {ludoState?.lastActionText && (
                <p className="text-[11px] opacity-80">{ludoState.lastActionText}</p>
              )}
              {ludoState?.winnerTopic && ludoState.status === "finished" && (
                <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold pt-1">
                  <Trophy className="w-4 h-4" />
                  الفائز: {ludoState.winnerTopic}
                </div>
              )}
            </div>

            {/* Action Controls */}
            <div className="flex flex-wrap gap-1.5">
              {myPlayer && (
                <button
                  type="button"
                  onClick={() => {
                    ludoManage("stand");
                    pushNotice("تم القيام من المقعد", { topic: "لودو" });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition active:scale-90"
                >
                  قيام من المقعد
                </button>
              )}
              {ludoState?.status !== "active" && (ludoState?.players.length ?? 0) < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    ludoManage("add_bot");
                    pushNotice("تمت إضافة بوت للعبة اللودو 🤖", { topic: "لودو" });
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition active:scale-90"
                >
                  <Bot className="w-3.5 h-3.5" />
                  إضافة بوت
                </button>
              )}
              {ludoState?.status !== "active" && hasBots && (
                <button
                  type="button"
                  onClick={() => {
                    ludoManage("remove_bot");
                    pushNotice("تمت إزالة البوت من طاولة اللودو 🚪", { topic: "لودو" });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition active:scale-90"
                >
                  إزالة البوت
                </button>
              )}
              {canManageGame && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      ludoManage("start");
                      pushNotice("بدأت لعبة اللودو 🎲 حظاً موفقاً!", { topic: "لودو" });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition active:scale-90"
                  >
                    <Play className="w-3.5 h-3.5" />
                    بدء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ludoManage("reset");
                      pushNotice("تمت إعادة ضبط طاولة اللودو 🔄", { topic: "لودو" });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition active:scale-90"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    تصفير
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ludoManage("stop");
                      pushNotice("تم إيقاف لعبة اللودو 🛑", { topic: "لودو" });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition active:scale-90"
                  >
                    <Square className="w-3.5 h-3.5" />
                    إيقاف
                  </button>
                </>
              )}
            </div>

            {/* Quick Rules Summary */}
            <div className={`p-3 rounded-2xl border text-[11px] space-y-1 opacity-80 ${boxCls}`}>
              <div className="font-extrabold text-xs">قواعد اللعب الرسمية:</div>
              <p>• يلزم رقم 6 لإخراج قطعة من القاعدة أو الحصول على رمية إضافية.</p>
              <p>• ثلاث ستات متتالية (6-6-6) تُلغي الدور وتنقله للتالي.</p>
              <p>• المربعات ذات النجمة ★ وبدايات الألوان محمية من الأكل.</p>
              <p>• أكل قطعة خصم أو إدخال قطعة لبيت الفوز يمنحك رمية إضافية.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
