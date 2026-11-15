import { memo, useMemo } from "react";
import { Crown, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Star } from "lucide-react";
import {
  getLudoTokenCoords,
  LUDO_COLOR_LABELS_AR,
  LUDO_COORD_TO_HOME_CELL,
  LUDO_COORD_TO_TRACK_INDEX,
  LUDO_MAIN_TRACK,
  LUDO_STAR_TRACK_INDICES,
  LUDO_START_TRACK_INDEX,
  LUDO_YARD_SPOTS,
  type LudoColor,
  type LudoPublicState,
  type LudoToken,
} from "@newchat/shared";

interface LudoBoardProps {
  game: LudoPublicState | null;
  myColor: LudoColor | null;
  isMyTurn: boolean;
  rollingVisual?: boolean;
  onRollDice?: () => void;
  onMoveToken?: (tokenId: string) => void;
  dark?: boolean;
}

const TOKEN_STYLE_MAP: Record<
  LudoColor,
  { fill: string; border: string; ring: string; glow: string; badgeBg: string }
> = {
  red: {
    fill: "bg-rose-500",
    border: "border-rose-100",
    ring: "ring-rose-300",
    glow: "shadow-[0_0_14px_rgba(244,63,94,0.85)]",
    badgeBg: "bg-rose-600 text-white",
  },
  green: {
    fill: "bg-emerald-500",
    border: "border-emerald-100",
    ring: "ring-emerald-300",
    glow: "shadow-[0_0_14px_rgba(16,185,129,0.85)]",
    badgeBg: "bg-emerald-600 text-white",
  },
  yellow: {
    fill: "bg-amber-400",
    border: "border-amber-50",
    ring: "ring-amber-200",
    glow: "shadow-[0_0_14px_rgba(251,191,36,0.9)]",
    badgeBg: "bg-amber-500 text-slate-950",
  },
  blue: {
    fill: "bg-sky-500",
    border: "border-sky-100",
    ring: "ring-sky-300",
    glow: "shadow-[0_0_14px_rgba(14,165,233,0.85)]",
    badgeBg: "bg-sky-600 text-white",
  },
};

const START_CELL_COLOR_BY_INDEX = new Map<number, LudoColor>([
  [LUDO_START_TRACK_INDEX.red, "red"],
  [LUDO_START_TRACK_INDEX.green, "green"],
  [LUDO_START_TRACK_INDEX.yellow, "yellow"],
  [LUDO_START_TRACK_INDEX.blue, "blue"],
]);

const HOME_CELL_BG: Record<LudoColor, string> = {
  red: "bg-rose-500/85 text-white",
  green: "bg-emerald-500/85 text-white",
  yellow: "bg-amber-400/90 text-slate-950",
  blue: "bg-sky-500/85 text-white",
};

const YARD_RING_BG: Record<LudoColor, string> = {
  red: "border-rose-500/70 bg-rose-500/15",
  green: "border-emerald-500/70 bg-emerald-500/15",
  yellow: "border-amber-400/80 bg-amber-400/15",
  blue: "border-sky-500/70 bg-sky-500/15",
};

interface StaticTrackCell {
  key: string;
  row: number;
  col: number;
  startColor: LudoColor | null;
  homeColor: LudoColor | null;
  isStar: boolean;
}

const STATIC_TRACK_CELLS: readonly StaticTrackCell[] = (() => {
  const cells: StaticTrackCell[] = [];
  for (let r = 0; r < 15; r += 1) {
    for (let c = 0; c < 15; c += 1) {
      // Skip 4 corner 6x6 yards and 3x3 center box (rendered as dedicated crisp overlays)
      const inTop = r < 6;
      const inBottom = r >= 9;
      const inLeft = c < 6;
      const inRight = c >= 9;
      if ((inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft) || (inBottom && inRight)) {
        continue;
      }
      if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;

      const key = `${r},${c}`;
      const trackIdx = LUDO_COORD_TO_TRACK_INDEX.get(key);
      const homeInfo = LUDO_COORD_TO_HOME_CELL.get(key);
      const startColor =
        trackIdx !== undefined ? (START_CELL_COLOR_BY_INDEX.get(trackIdx) ?? null) : null;
      const isStar = trackIdx !== undefined && LUDO_STAR_TRACK_INDICES.has(trackIdx);

      cells.push({
        key,
        row: r,
        col: c,
        startColor,
        homeColor: homeInfo && !homeInfo.isFinish ? homeInfo.color : null,
        isStar,
      });
    }
  }
  return cells;
})();

const STACK_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-0.18, -0.18],
  [0.18, 0.18],
  [-0.18, 0.18],
  [0.18, -0.18],
];

function renderDiceIcon(value: number | null) {
  switch (value) {
    case 1:
      return <Dice1 className="w-7 h-7" />;
    case 2:
      return <Dice2 className="w-7 h-7" />;
    case 3:
      return <Dice3 className="w-7 h-7" />;
    case 4:
      return <Dice4 className="w-7 h-7" />;
    case 5:
      return <Dice5 className="w-7 h-7" />;
    default:
      return <Dice6 className="w-7 h-7" />;
  }
}

export const LudoBoard = memo(function LudoBoard({
  game,
  myColor,
  isMyTurn,
  rollingVisual = false,
  onRollDice,
  onMoveToken,
  dark = true,
}: LudoBoardProps) {
  const legalSet = useMemo(
    () => new Set(game?.legalTokenIds ?? []),
    [game?.legalTokenIds],
  );

  // Group active tokens sharing the exact same coordinate to fan them out cleanly
  const positionedTokens = useMemo(() => {
    const tokens = game?.tokens ?? [];
    const coordGroups = new Map<string, LudoToken[]>();
    const rawCoords = new Map<string, readonly [number, number]>();

    for (const t of tokens) {
      const [r, c] = getLudoTokenCoords(t);
      rawCoords.set(t.id, [r, c]);
      const gKey = `${r.toFixed(1)},${c.toFixed(1)}`;
      const list = coordGroups.get(gKey);
      if (list) list.push(t);
      else coordGroups.set(gKey, [t]);
    }

    return tokens.map((t) => {
      const [baseR, baseC] = rawCoords.get(t.id)!;
      const gKey = `${baseR.toFixed(1)},${baseC.toFixed(1)}`;
      const group = coordGroups.get(gKey)!;
      const idxInGroup = group.findIndex((x) => x.id === t.id);
      const count = group.length;
      const [offR, offC] =
        count <= 1
          ? [0, 0]
          : STACK_OFFSETS[Math.min(STACK_OFFSETS.length - 1, idxInGroup + 1)]!;

      const isLegal = Boolean(
        isMyTurn &&
          game?.phase === "awaiting_move" &&
          t.color === myColor &&
          legalSet.has(t.id),
      );

      return {
        token: t,
        topPct: ((baseR + 0.5 + offR) / 15) * 100,
        leftPct: ((baseC + 0.5 + offC) / 15) * 100,
        scale: count > 1 ? 0.82 : 1,
        isLegal,
      };
    });
  }, [game?.tokens, game?.phase, isMyTurn, myColor, legalSet]);

  const activeColor = game?.turnColor ?? null;
  const canRollNow = Boolean(
    isMyTurn && game?.status === "active" && game?.phase === "awaiting_roll",
  );

  const cellBorderCls = dark ? "border-slate-700/70" : "border-slate-300";
  const neutralCellBg = dark ? "bg-slate-800/85" : "bg-white";

  const playerByColor = useMemo(() => {
    const map = new Map<LudoColor, string>();
    for (const p of game?.players ?? []) {
      map.set(p.color, p.topic);
    }
    return map;
  }, [game?.players]);

  return (
    <div className="w-full max-w-[500px] mx-auto select-none">
      {/* Force LTR geometry for the 15x15 physical board coordinates */}
      <div
        dir="ltr"
        className={`relative w-full aspect-square rounded-3xl p-1.5 sm:p-2 border-2 shadow-2xl overflow-hidden ${
          dark
            ? "bg-slate-900 border-slate-700"
            : "bg-slate-200 border-slate-300"
        }`}
      >
        <div
          className="relative w-full h-full grid rounded-2xl overflow-hidden"
          style={{
            gridTemplateColumns: "repeat(15, minmax(0, 1fr))",
            gridTemplateRows: "repeat(15, minmax(0, 1fr))",
          }}
        >
          {/* 4 Corner Yards (6x6 each) */}
          {(
            [
              { color: "red" as LudoColor, rowStart: 1, colStart: 1, bg: "bg-rose-600" },
              { color: "green" as LudoColor, rowStart: 1, colStart: 10, bg: "bg-emerald-600" },
              { color: "blue" as LudoColor, rowStart: 10, colStart: 1, bg: "bg-sky-600" },
              { color: "yellow" as LudoColor, rowStart: 10, colStart: 10, bg: "bg-amber-500" },
            ] as const
          ).map((yard) => {
            const isTurn = game?.status === "active" && activeColor === yard.color;
            const ownerName = playerByColor.get(yard.color);
            return (
              <div
                key={yard.color}
                style={{
                  gridRow: `${yard.rowStart} / span 6`,
                  gridColumn: `${yard.colStart} / span 6`,
                }}
                className={`relative p-2.5 sm:p-3.5 ${yard.bg} transition-all duration-300 ${
                  isTurn ? "ring-4 ring-inset ring-white/90 brightness-110" : "opacity-95"
                }`}
              >
                <div
                  className={`w-full h-full rounded-2xl shadow-inner border ${
                    dark ? "bg-slate-950/90 border-white/15" : "bg-white/95 border-black/10"
                  }`}
                />
                {ownerName && (
                  <span
                    dir="rtl"
                    className={`absolute bottom-1 left-1.5 right-1.5 text-center truncate text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow ${TOKEN_STYLE_MAP[yard.color].badgeBg}`}
                  >
                    {ownerName}
                  </span>
                )}
              </div>
            );
          })}

          {/* Static Yard Token Sockets */}
          {(Object.keys(LUDO_YARD_SPOTS) as LudoColor[]).map((color) =>
            LUDO_YARD_SPOTS[color].map(([r, c], idx) => (
              <div
                key={`socket-${color}-${idx}`}
                style={{
                  top: `${((r + 0.5) / 15) * 100}%`,
                  left: `${((c + 0.5) / 15) * 100}%`,
                  width: "8%",
                  height: "8%",
                  transform: "translate(-50%, -50%)",
                }}
                className={`absolute rounded-full border-2 pointer-events-none ${YARD_RING_BG[color]}`}
              />
            )),
          )}

          {/* 52 Track + 20 Home-Column Cells */}
          {STATIC_TRACK_CELLS.map((cell) => {
            const bgCls = cell.startColor
              ? HOME_CELL_BG[cell.startColor]
              : cell.homeColor
                ? HOME_CELL_BG[cell.homeColor]
                : neutralCellBg;
            return (
              <div
                key={cell.key}
                style={{
                  gridRow: `${cell.row + 1} / span 1`,
                  gridColumn: `${cell.col + 1} / span 1`,
                }}
                className={`border-[0.5px] flex items-center justify-center ${cellBorderCls} ${bgCls}`}
              >
                {(cell.isStar || cell.startColor) && (
                  <Star
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${
                      cell.startColor
                        ? "opacity-90"
                        : dark
                          ? "text-amber-400"
                          : "text-amber-500"
                    }`}
                  />
                )}
              </div>
            );
          })}

          {/* Center 3x3 Finish Crown Zone */}
          <div
            style={{
              gridRow: "7 / span 3",
              gridColumn: "7 / span 3",
            }}
            className="relative border border-slate-700/60 overflow-hidden flex items-center justify-center"
          >
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <polygon points="0,0 50,50 0,100" fill="#e11d48" />
              <polygon points="0,0 100,0 50,50" fill="#059669" />
              <polygon points="100,0 100,100 50,50" fill="#f59e0b" />
              <polygon points="0,100 100,100 50,50" fill="#0284c7" />
              <circle cx="50" cy="50" r="18" fill="#0f172a" stroke="#f8fafc" strokeWidth="2.5" />
            </svg>
            <Crown className="relative z-10 w-5 h-5 text-amber-300 drop-shadow" />
          </div>

          {/* Animated Tokens Layer */}
          {positionedTokens.map(({ token, topPct, leftPct, scale, isLegal }) => {
            const st = TOKEN_STYLE_MAP[token.color];
            return (
              <button
                key={token.id}
                type="button"
                disabled={!isLegal}
                onClick={() => isLegal && onMoveToken?.(token.id)}
                title={
                  isLegal
                    ? `تحريك قطعة ${LUDO_COLOR_LABELS_AR[token.color]}`
                    : LUDO_COLOR_LABELS_AR[token.color]
                }
                aria-label={`قطعة ${LUDO_COLOR_LABELS_AR[token.color]} ${token.index + 1}`}
                style={{
                  top: `${topPct}%`,
                  left: `${leftPct}%`,
                  width: "5.4%",
                  height: "5.4%",
                  transform: `translate(-50%, -50%) scale(${isLegal ? scale * 1.16 : scale})`,
                }}
                className={`absolute rounded-full border-2 transition-all duration-300 ease-out flex items-center justify-center ${
                  st.fill
                } ${st.border} ${
                  isLegal
                    ? `z-30 cursor-pointer ring-4 ${st.ring} ${st.glow} animate-bounce`
                    : "z-20 cursor-default shadow-md"
                }`}
              >
                <span className="w-1/2 h-1/2 rounded-full bg-white/40 pointer-events-none" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Dice & Turn Status Strip */}
      <div
        dir="rtl"
        className={`mt-3 px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-3 ${
          dark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200"
        }`}
      >
        <div className="min-w-0">
          <div className="text-xs font-extrabold flex items-center gap-1.5">
            {game?.status === "active" && activeColor ? (
              <>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${TOKEN_STYLE_MAP[activeColor].fill}`}
                />
                <span>
                  {isMyTurn
                    ? game.phase === "awaiting_roll"
                      ? "دورك! ارمِ النرد الآن"
                      : "دورك! اختر قطعة متوهجة للتحرك"
                    : `دور ${game.turnTopic}`}
                </span>
              </>
            ) : game?.status === "finished" ? (
              <span className="text-emerald-400">🏆 الفائز: {game.winnerTopic}</span>
            ) : (
              <span>بانتظار بدء المباراة</span>
            )}
          </div>
          {game?.lastActionText && (
            <p className="text-[11px] opacity-75 truncate mt-0.5">{game.lastActionText}</p>
          )}
        </div>

        <button
          type="button"
          disabled={!canRollNow || rollingVisual}
          onClick={onRollDice}
          className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl font-extrabold text-xs transition shadow ${
            canRollNow
              ? "bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 cursor-pointer ring-2 ring-amber-300/60"
              : dark
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-slate-100 text-slate-500 cursor-not-allowed"
          }`}
        >
          <span className={rollingVisual ? "animate-spin" : ""}>
            {renderDiceIcon(game?.diceValue ?? 6)}
          </span>
          <span>
            {canRollNow
              ? "رمي النرد"
              : game?.diceValue
                ? `النرد: ${game.diceValue}`
                : "النرد"}
          </span>
        </button>
      </div>
    </div>
  );
});

export function getLudoMainTrackPreviewCount() {
  return LUDO_MAIN_TRACK.length;
}
