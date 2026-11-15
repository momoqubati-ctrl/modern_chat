import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Gamepad2, Play, RefreshCw, RotateCcw, Square, Trophy, Users, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import {
  CARROM_BASELINE_OFFSET,
  CARROM_BOARD_SIZE,
  CARROM_OUTER_MARGIN,
  CARROM_PLAY_MAX,
  CARROM_PLAY_MIN,
  CARROM_POCKET_RADIUS,
  carromClamp,
  type CarromPiece,
} from "@newchat/shared";
import { canUseRoomManagement } from "../lib/permissions.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface RoomCarromModalProps {
  dark: boolean;
  open: boolean;
  onClose: () => void;
}

const POCKETS = [
  { x: CARROM_OUTER_MARGIN + 10, y: CARROM_OUTER_MARGIN + 10 },
  { x: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10, y: CARROM_OUTER_MARGIN + 10 },
  { x: CARROM_OUTER_MARGIN + 10, y: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10 },
  { x: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10, y: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10 },
];

export function drawCarromBoardCanvas(
  ctx: CanvasRenderingContext2D,
  opts: {
    pieces: CarromPiece[];
    seatView: number;
    offset: number;
    angleDeg: number;
    power: number;
    canShowStriker: boolean;
    aimPreview?: { offset?: number; angle?: number; power?: number } | null;
    pullVec?: { dx: number; dy: number; power: number } | null;
  },
) {
  const S = CARROM_BOARD_SIZE;
  ctx.clearRect(0, 0, S, S);

  // Outer wood bezel
  ctx.fillStyle = "#5c341b";
  ctx.beginPath();
  ctx.roundRect(0, 0, S, S, 28);
  ctx.fill();

  ctx.strokeStyle = "#8a522c";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(10, 10, S - 20, S - 20, 22);
  ctx.stroke();

  // Inner cream playing board
  ctx.fillStyle = "#f4e6cb";
  ctx.fillRect(
    CARROM_OUTER_MARGIN - 10,
    CARROM_OUTER_MARGIN - 10,
    S - (CARROM_OUTER_MARGIN - 10) * 2,
    S - (CARROM_OUTER_MARGIN - 10) * 2,
  );

  ctx.strokeStyle = "#7c5230";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    CARROM_PLAY_MIN,
    CARROM_PLAY_MIN,
    CARROM_PLAY_MAX - CARROM_PLAY_MIN,
    CARROM_PLAY_MAX - CARROM_PLAY_MIN,
  );

  // Center circle decoration
  const cx = S / 2;
  const cy = S / 2;
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(180, 83, 9, 0.14)";
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b91c1c";
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Baselines top & bottom
  const topY = CARROM_OUTER_MARGIN + CARROM_BASELINE_OFFSET;
  const botY = S - CARROM_OUTER_MARGIN - CARROM_BASELINE_OFFSET;
  for (const by of [topY, botY]) {
    ctx.strokeStyle = "#6b4423";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(132, by - 12);
    ctx.lineTo(S - 132, by - 12);
    ctx.moveTo(132, by + 12);
    ctx.lineTo(S - 132, by + 12);
    ctx.stroke();

    for (const endX of [132, S - 132]) {
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(endX, by, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Diagonal arrows pointing toward pockets
  const arrows: Array<[number, number, number, number]> = [
    [182, 182, 118, 118],
    [S - 182, 182, S - 118, 118],
    [182, S - 182, 118, S - 118],
    [S - 182, S - 182, S - 118, S - 118],
  ];
  ctx.strokeStyle = "#7c5230";
  ctx.lineWidth = 1.4;
  for (const [x1, y1, x2, y2] of arrows) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Pockets
  for (const p of POCKETS) {
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(p.x, p.y, CARROM_POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#44403c";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Active pieces
  for (const piece of opts.pieces) {
    if (piece.alive === false) continue;
    ctx.save();
    ctx.beginPath();
    ctx.arc(piece.x, piece.y, piece.r || 14, 0, Math.PI * 2);
    if (piece.kind === "queen") {
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else if (piece.kind === "dark") {
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#fef3c7";
      ctx.fill();
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(piece.x, piece.y, Math.max(4, (piece.r || 14) * 0.45), 0, Math.PI * 2);
    ctx.strokeStyle = piece.kind === "dark" ? "#475569" : "rgba(180, 83, 9, 0.35)";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }

  // Striker & Aim trajectory
  if (opts.canShowStriker) {
    const activeOffset = opts.aimPreview?.offset ?? opts.offset;
    const sx = carromClamp(cx + activeOffset * 0.92, CARROM_PLAY_MIN + 22, CARROM_PLAY_MAX - 22);
    const sy = opts.seatView === 1 ? topY : botY;

    const rad = ((opts.aimPreview?.angle ?? opts.angleDeg) * Math.PI) / 180;
    const pwr = opts.aimPreview?.power ?? opts.power;
    const lineLen = 50 + (pwr / 100) * 140;
    const tx = opts.pullVec ? sx + (opts.pullVec.dx / (Math.hypot(opts.pullVec.dx, opts.pullVec.dy) || 1)) * lineLen : sx + Math.cos(rad) * lineLen;
    const ty = opts.pullVec ? sy + (opts.pullVec.dy / (Math.hypot(opts.pullVec.dx, opts.pullVec.dy) || 1)) * lineLen : sy + Math.sin(rad) * lineLen;

    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#0ea5e9";
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "#bae6fd";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function RoomCarromModal({ dark, open, onClose }: RoomCarromModalProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const carromState = useChatStore((s) => s.carromState);
  const carromPreviewState = useChatStore((s) => s.carromPreviewState);
  const carromJoin = useChatStore((s) => s.carromJoin);
  const carromLeave = useChatStore((s) => s.carromLeave);
  const carromSync = useChatStore((s) => s.carromSync);
  const carromManage = useChatStore((s) => s.carromManage);
  const carromPreview = useChatStore((s) => s.carromPreview);
  const carromShot = useChatStore((s) => s.carromShot);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPreviewAtRef = useRef(0);

  const [offset, setOffset] = useState(0);
  const [angleDeg, setAngleDeg] = useState(-90);
  const [power, setPower] = useState(65);
  const [pullVec, setPullVec] = useState<{ dx: number; dy: number; power: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    carromJoin();
    carromSync();
    return () => {
      carromLeave();
    };
  }, [open, carromJoin, carromSync, carromLeave]);

  const myPlayer = useMemo(() => {
    if (!carromState || !me) return null;
    return carromState.players.find(
      (p) => p.socketId === me.id || (me.uid && p.userId === me.uid),
    ) ?? null;
  }, [carromState, me]);

  const isMyTurn = Boolean(
    carromState?.status === "active" &&
      !carromState.shotInProgress &&
      myPlayer &&
      myPlayer.seat === carromState.turnSeat,
  );

  useEffect(() => {
    if (myPlayer?.seat === 1 && angleDeg === -90) {
      setAngleDeg(90);
    } else if (myPlayer?.seat === 0 && angleDeg === 90) {
      setAngleDeg(-90);
    }
  }, [myPlayer?.seat, angleDeg]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const pieces = carromState?.pieces ?? [];
    const activeTurnSeat = carromState?.turnSeat ?? 0;
    const remotePreview =
      !isMyTurn && carromPreviewState
        ? {
            offset: Number(carromPreviewState.offset ?? 0),
            angle: Number(carromPreviewState.angle ?? (activeTurnSeat === 1 ? 90 : -90)),
            power: Number(carromPreviewState.power ?? 50),
          }
        : null;

    drawCarromBoardCanvas(ctx, {
      pieces,
      seatView: activeTurnSeat,
      offset,
      angleDeg,
      power,
      canShowStriker: carromState?.status === "active" && !carromState?.shotInProgress,
      aimPreview: remotePreview,
      pullVec: isMyTurn ? pullVec : null,
    });
  }, [open, carromState, carromPreviewState, isMyTurn, offset, angleDeg, power, pullVec]);

  if (!open) return null;

  const p0 = carromState?.players.find((p) => p.seat === 0) ?? null;
  const p1 = carromState?.players.find((p) => p.seat === 1) ?? null;
  const canManageGame = canUseRoomManagement(me, powers) || Boolean(myPlayer);

  const emitAimPreview = (nextOffset: number, nextAngle: number, nextPower: number) => {
    if (!isMyTurn) return;
    const now = Date.now();
    if (now - lastPreviewAtRef.current < 85) return;
    lastPreviewAtRef.current = now;
    carromPreview({ offset: nextOffset, angle: nextAngle, power: nextPower });
  };

  const toBoardPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CARROM_BOARD_SIZE / rect.width;
    const scaleY = CARROM_BOARD_SIZE / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isMyTurn) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toBoardPoint(e);
    dragStartRef.current = pt;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !dragStartRef.current) return;
    const pt = toBoardPoint(e);
    const pullDx = dragStartRef.current.x - pt.x;
    const pullDy = dragStartRef.current.y - pt.y;
    const pullLen = Math.hypot(pullDx, pullDy);
    if (pullLen < 8) {
      setPullVec(null);
      return;
    }
    const nextAngle = Math.round((Math.atan2(pullDy, pullDx) * 180) / Math.PI);
    const nextPower = Math.round(carromClamp(pullLen * 0.9, 18, 100));
    setAngleDeg(nextAngle);
    setPower(nextPower);
    setPullVec({ dx: pullDx, dy: pullDy, power: carromClamp(pullLen * 1.4, 20, 230) });
    emitAimPreview(offset, nextAngle, nextPower);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !dragStartRef.current) {
      dragStartRef.current = null;
      setPullVec(null);
      return;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (pullVec && Math.hypot(pullVec.dx, pullVec.dy) >= 12) {
      carromShot({
        offset,
        angle: angleDeg,
        power,
        pullDx: pullVec.dx,
        pullDy: pullVec.dy,
        pullPower: pullVec.power,
      });
    }
    dragStartRef.current = null;
    setPullVec(null);
  };

  const fireManualShot = () => {
    if (!isMyTurn) return;
    carromShot({ offset, angle: angleDeg, power });
  };

  const modalCls = dark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900";
  const boxCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl max-h-[94vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${modalCls}`}
      >
        {/* Top bar */}
        <div className="px-4 py-2.5 border-b border-slate-800/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-extrabold">طاولة الكيرم — الغرفة</h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 text-[10px] font-bold">
              <Users className="w-3 h-3" />
              {carromState?.spectators ?? 0} مشاهد
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={carromSync}
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
          {/* Canvas Board */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={CARROM_BOARD_SIZE}
              height={CARROM_BOARD_SIZE}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full max-w-[460px] aspect-square rounded-2xl shadow-xl touch-none select-none cursor-crosshair"
            />
            {isMyTurn && (
              <p className="text-[11px] text-sky-400 font-bold mt-2">
                دورك الآن! اسحب على اللوحة عكس اتجاه الضربة أو استخدم أشرطة التحكم ثم اضغط تسديد
              </p>
            )}
          </div>

          {/* Controls & Scoreboard */}
          <div className="lg:col-span-5 space-y-3">
            {/* Players & Scores */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { seat: 0, player: p0, score: carromState?.scores?.[0] ?? 0 },
                { seat: 1, player: p1, score: carromState?.scores?.[1] ?? 0 },
              ].map(({ seat, player, score }) => {
                const activeTurn = carromState?.status === "active" && carromState.turnSeat === seat;
                return (
                  <div
                    key={seat}
                    className={`p-2.5 rounded-2xl border space-y-2 ${
                      activeTurn ? "border-amber-500 bg-amber-500/10" : boxCls
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>المقعد {seat + 1}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                        {score} نقطة
                      </span>
                    </div>
                    {player ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <MemberAvatar pic={player.pic} topic={player.topic} size="sm" showStatus={false} />
                        <span className="text-xs font-extrabold truncate">{player.topic}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => carromManage("sit", seat)}
                        className="w-full py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                      >
                        الجلوس هنا
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Game Status Banner */}
            <div className={`p-3 rounded-2xl border text-xs space-y-1 ${boxCls}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold">الحالة:</span>
                <span className="font-extrabold text-amber-400">
                  {carromState?.status === "active"
                    ? `دور ${carromState.turnTopic || `المقعد ${(carromState.turnSeat ?? 0) + 1}`}`
                    : carromState?.status === "finished"
                      ? `فاز ${carromState.winnerTopic}`
                      : "بانتظار بدء الجولة"}
                </span>
              </div>
              {carromState?.lastActionText && (
                <p className="text-[11px] opacity-75">{carromState.lastActionText}</p>
              )}
              {carromState?.winnerTopic && carromState.status === "finished" && (
                <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold pt-1">
                  <Trophy className="w-4 h-4" />
                  الفائز: {carromState.winnerTopic}
                </div>
              )}
            </div>

            {/* Management Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {myPlayer && (
                <button
                  type="button"
                  onClick={() => carromManage("stand")}
                  className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold"
                >
                  قيام من المقعد
                </button>
              )}
              {canManageGame && (
                <>
                  <button
                    type="button"
                    onClick={() => carromManage("start")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    <Play className="w-3.5 h-3.5" />
                    بدء
                  </button>
                  <button
                    type="button"
                    onClick={() => carromManage("reset")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    تصفير
                  </button>
                  <button
                    type="button"
                    onClick={() => carromManage("stop")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    <Square className="w-3.5 h-3.5" />
                    إيقاف
                  </button>
                </>
              )}
            </div>

            {/* Manual Sliders for Precision / Mobile */}
            {isMyTurn && (
              <div className={`p-3 rounded-2xl border space-y-2.5 ${boxCls}`}>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>موضع السترايكر</span>
                    <span className="font-mono">{offset}</span>
                  </div>
                  <input
                    type="range"
                    min={-210}
                    max={210}
                    value={offset}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setOffset(val);
                      emitAimPreview(val, angleDeg, power);
                    }}
                    className="w-full accent-sky-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>الزاوية</span>
                    <span className="font-mono">{angleDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={angleDeg}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAngleDeg(val);
                      emitAimPreview(offset, val, power);
                    }}
                    className="w-full accent-amber-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>قوة الضربة</span>
                    <span className="font-mono">{power}%</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={100}
                    value={power}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPower(val);
                      emitAimPreview(offset, angleDeg, val);
                    }}
                    className="w-full accent-rose-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={fireManualShot}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition"
                >
                  تسديد الضربة الآن
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
