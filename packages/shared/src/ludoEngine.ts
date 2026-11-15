import type {
  LudoColor,
  LudoGameState,
  LudoMoveOutcome,
  LudoPlayer,
  LudoPublicState,
  LudoToken,
} from "./types.js";
import { LUDO_TURN_TIMEOUT_MS } from "./constants.js";

/**
 * Seat-to-color mapping puts seats 0 & 1 on opposite corners (red vs yellow)
 * so 2-player games are always geometrically balanced, while 3-4 player games
 * fill green (top-right) and blue (bottom-left).
 */
export const LUDO_SEAT_COLORS: readonly [LudoColor, LudoColor, LudoColor, LudoColor] = [
  "red",
  "yellow",
  "green",
  "blue",
];

/** Clockwise visual order around the 15x15 board */
export const LUDO_CLOCKWISE_COLORS: readonly LudoColor[] = [
  "red",
  "green",
  "yellow",
  "blue",
];

export const LUDO_COLOR_LABELS_AR: Record<LudoColor, string> = {
  red: "الأحمر",
  green: "الأخضر",
  yellow: "الأصفر",
  blue: "الأزرق",
};

export const LUDO_START_TRACK_INDEX: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/**
 * 52-cell outer main track in clockwise order starting from Red's start square (6, 1).
 * Precomputed once as a flat readonly tuple array for O(1) coordinate lookup.
 */
export const LUDO_MAIN_TRACK: readonly (readonly [number, number])[] = [
  // 0..4: Red arm top row moving right
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // 5..10: Top arm left col moving up
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  // 11: Top center
  [0, 7],
  // 12..17: Top arm right col moving down (13 = Green start)
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // 18..23: Right arm top row moving right
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  // 24: Right center
  [7, 14],
  // 25..30: Right arm bottom row moving left (26 = Yellow start)
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // 31..36: Bottom arm right col moving down
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  // 37: Bottom center
  [14, 7],
  // 38..43: Bottom arm left col moving up (39 = Blue start)
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // 44..49: Left arm bottom row moving left
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  // 50: Left center
  [7, 0],
  // 51: Left arm top row before Red start
  [6, 0],
];

/** Colored home stretch cells (progress 51..55) + finish triangle (progress 56) */
export const LUDO_HOME_COLUMNS: Record<LudoColor, readonly (readonly [number, number])[]> = {
  red: [
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6],
  ],
  green: [
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
  ],
  yellow: [
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8],
  ],
  blue: [
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7],
  ],
};

/** Exact [row, col] positions inside each 6x6 yard (0..14 grid centers) */
export const LUDO_YARD_SPOTS: Record<LudoColor, readonly (readonly [number, number])[]> = {
  red: [
    [1.6, 1.6], [1.6, 3.4], [3.4, 1.6], [3.4, 3.4],
  ],
  green: [
    [1.6, 10.6], [1.6, 12.4], [3.4, 10.6], [3.4, 12.4],
  ],
  yellow: [
    [10.6, 10.6], [10.6, 12.4], [12.4, 10.6], [12.4, 12.4],
  ],
  blue: [
    [10.6, 1.6], [10.6, 3.4], [12.4, 1.6], [12.4, 3.4],
  ],
};

/** 8 official safe squares on the 52-cell main track (4 start squares + 4 star squares) */
export const LUDO_SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);
export const LUDO_STAR_TRACK_INDICES = new Set<number>([8, 21, 34, 47]);

/** Precomputed reverse lookup: "row,col" -> main track index (O(1)) */
export const LUDO_COORD_TO_TRACK_INDEX: ReadonlyMap<string, number> = new Map(
  LUDO_MAIN_TRACK.map(([r, c], idx) => [`${r},${c}`, idx]),
);

/** Precomputed reverse lookup: "row,col" -> { color, isFinish } for home columns (O(1)) */
export const LUDO_COORD_TO_HOME_CELL: ReadonlyMap<string, { color: LudoColor; step: number; isFinish: boolean }> = (() => {
  const map = new Map<string, { color: LudoColor; step: number; isFinish: boolean }>();
  for (const color of LUDO_CLOCKWISE_COLORS) {
    LUDO_HOME_COLUMNS[color].forEach(([r, c], idx) => {
      map.set(`${r},${c}`, { color, step: idx, isFinish: idx === 5 });
    });
  }
  return map;
})();

export const LUDO_MAX_PROGRESS = 56;

export function getLudoTrackIndex(color: LudoColor, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (LUDO_START_TRACK_INDEX[color] + progress) % 52;
}

export function getLudoTokenCoords(token: Pick<LudoToken, "color" | "index" | "progress">): readonly [number, number] {
  if (token.progress < 0) {
    return LUDO_YARD_SPOTS[token.color][token.index]!;
  }
  if (token.progress <= 50) {
    const trackIdx = (LUDO_START_TRACK_INDEX[token.color] + token.progress) % 52;
    return LUDO_MAIN_TRACK[trackIdx]!;
  }
  const homeIdx = Math.min(5, Math.max(0, token.progress - 51));
  return LUDO_HOME_COLUMNS[token.color][homeIdx]!;
}

export function createLudoTokensForColors(colors: readonly LudoColor[]): LudoToken[] {
  const tokens: LudoToken[] = [];
  for (const color of colors) {
    for (let i = 0; i < 4; i += 1) {
      tokens.push({
        id: `${color}-${i}`,
        color,
        index: i as 0 | 1 | 2 | 3,
        progress: -1,
      });
    }
  }
  return tokens;
}

export function createLudoGame(roomId: string, starterTopic = "", title = ""): LudoGameState {
  return {
    roomId: String(roomId || ""),
    title: title || undefined,
    status: "waiting",
    phase: "awaiting_roll",
    players: [],
    tokens: [],
    turnSeat: 0,
    diceValue: null,
    consecutiveSixes: 0,
    legalTokenIds: [],
    winnerSeat: null,
    winnerColor: null,
    winnerTopic: "",
    lastActionText: starterTopic
      ? `تم تجهيز طاولة اللودو بواسطة ${starterTopic}`
      : "طاولة اللودو جاهزة لانضمام اللاعبين",
    turnStartedAt: 0,
    updatedAt: Date.now(),
  };
}

export function getOrderedSeatedPlayers(players: readonly LudoPlayer[]): LudoPlayer[] {
  const orderMap = new Map<LudoColor, number>(
    LUDO_CLOCKWISE_COLORS.map((c, idx) => [c, idx]),
  );
  return [...players].sort((a, b) => (orderMap.get(a.color) ?? 0) - (orderMap.get(b.color) ?? 0));
}

export function getNextActiveSeat(players: readonly LudoPlayer[], currentSeat: number): 0 | 1 | 2 | 3 {
  const ordered = getOrderedSeatedPlayers(players);
  if (ordered.length === 0) return 0;
  const idx = ordered.findIndex((p) => p.seat === currentSeat);
  if (idx === -1) return ordered[0]!.seat;
  return ordered[(idx + 1) % ordered.length]!.seat;
}

export function getLegalLudoTokenIds(
  tokens: readonly LudoToken[],
  color: LudoColor,
  diceValue: number,
): string[] {
  if (!Number.isInteger(diceValue) || diceValue < 1 || diceValue > 6) return [];
  const ids: string[] = [];
  for (const t of tokens) {
    if (t.color !== color) continue;
    if (t.progress === -1) {
      if (diceValue === 6) ids.push(t.id);
    } else if (t.progress < LUDO_MAX_PROGRESS && t.progress + diceValue <= LUDO_MAX_PROGRESS) {
      ids.push(t.id);
    }
  }
  return ids;
}

export function startLudoMatch(game: LudoGameState, starterTopic = ""): boolean {
  if (game.players.length < 2) return false;
  const ordered = getOrderedSeatedPlayers(game.players);
  game.players = ordered.map((p) => ({ ...p, finishedCount: 0 }));
  game.tokens = createLudoTokensForColors(ordered.map((p) => p.color));
  game.status = "active";
  game.phase = "awaiting_roll";
  game.turnSeat = ordered[0]!.seat;
  game.diceValue = null;
  game.consecutiveSixes = 0;
  game.legalTokenIds = [];
  game.winnerSeat = null;
  game.winnerColor = null;
  game.winnerTopic = "";
  game.turnStartedAt = Date.now();
  game.updatedAt = Date.now();
  game.lastActionText = starterTopic
    ? `بدأت مباراة اللودو بواسطة ${starterTopic}! دور ${ordered[0]!.topic}`
    : `بدأت مباراة اللودو! دور ${ordered[0]!.topic}`;
  return true;
}

export function resetLudoMatch(game: LudoGameState, message?: string): void {
  const ordered = getOrderedSeatedPlayers(game.players);
  game.players = ordered.map((p) => ({ ...p, finishedCount: 0 }));
  game.tokens = createLudoTokensForColors(ordered.map((p) => p.color));
  game.diceValue = null;
  game.consecutiveSixes = 0;
  game.legalTokenIds = [];
  game.winnerSeat = null;
  game.winnerColor = null;
  game.winnerTopic = "";
  if (ordered.length >= 2) {
    game.status = "active";
    game.phase = "awaiting_roll";
    game.turnSeat = ordered[0]!.seat;
    game.turnStartedAt = Date.now();
  } else {
    game.status = "waiting";
    game.phase = "awaiting_roll";
    game.turnSeat = ordered[0]?.seat ?? 0;
    game.turnStartedAt = 0;
  }
  game.lastActionText = message || "تمت إعادة تهيئة طاولة اللودو.";
  game.updatedAt = Date.now();
}

export function applyLudoDiceRoll(
  game: LudoGameState,
  roll: number,
  playerTopic: string,
): {
  valid: boolean;
  forfeitedByThreeSixes: boolean;
  autoSkipped: boolean;
  legalTokenIds: string[];
} {
  if (game.status !== "active" || game.phase !== "awaiting_roll") {
    return { valid: false, forfeitedByThreeSixes: false, autoSkipped: false, legalTokenIds: [] };
  }
  const activePlayer = game.players.find((p) => p.seat === game.turnSeat);
  if (!activePlayer) {
    return { valid: false, forfeitedByThreeSixes: false, autoSkipped: false, legalTokenIds: [] };
  }

  const nextSixes = roll === 6 ? game.consecutiveSixes + 1 : 0;
  game.diceValue = roll;
  game.consecutiveSixes = nextSixes;

  if (nextSixes >= 3) {
    const nextSeat = getNextActiveSeat(game.players, activePlayer.seat);
    const nextPlayer = game.players.find((p) => p.seat === nextSeat);
    game.turnSeat = nextSeat;
    game.phase = "awaiting_roll";
    game.consecutiveSixes = 0;
    game.legalTokenIds = [];
    game.turnStartedAt = Date.now();
    game.updatedAt = Date.now();
    game.lastActionText = `🎲 ${playerTopic} رمى 6 ثلاث مرات متتالية! ينتقل الدور إلى ${nextPlayer?.topic || "التالي"}.`;
    return { valid: true, forfeitedByThreeSixes: true, autoSkipped: true, legalTokenIds: [] };
  }

  const legalTokenIds = getLegalLudoTokenIds(game.tokens, activePlayer.color, roll);
  if (legalTokenIds.length === 0) {
    const nextSeat = getNextActiveSeat(game.players, activePlayer.seat);
    const nextPlayer = game.players.find((p) => p.seat === nextSeat);
    game.turnSeat = nextSeat;
    game.phase = "awaiting_roll";
    game.consecutiveSixes = 0;
    game.legalTokenIds = [];
    game.turnStartedAt = Date.now();
    game.updatedAt = Date.now();
    game.lastActionText = `🎲 ${playerTopic} حصل على ${roll} ولا توجد نقلة متاحة — الدور لـ ${nextPlayer?.topic || "التالي"}.`;
    return { valid: true, forfeitedByThreeSixes: false, autoSkipped: true, legalTokenIds: [] };
  }

  game.phase = "awaiting_move";
  game.legalTokenIds = legalTokenIds;
  game.turnStartedAt = Date.now();
  game.updatedAt = Date.now();
  game.lastActionText = `🎲 ${playerTopic} رمى ${roll} — اختر قطعة للتحرك.`;
  return { valid: true, forfeitedByThreeSixes: false, autoSkipped: false, legalTokenIds };
}

export function applyLudoTokenMove(
  game: LudoGameState,
  tokenId: string,
): LudoMoveOutcome | null {
  if (game.status !== "active" || game.phase !== "awaiting_move" || !game.diceValue) {
    return null;
  }
  const activePlayer = game.players.find((p) => p.seat === game.turnSeat);
  if (!activePlayer) return null;
  if (!game.legalTokenIds.includes(tokenId)) return null;

  const token = game.tokens.find((t) => t.id === tokenId && t.color === activePlayer.color);
  if (!token) return null;

  const roll = game.diceValue;
  const fromProgress = token.progress;
  const toProgress = fromProgress === -1 ? 0 : fromProgress + roll;
  if (toProgress > LUDO_MAX_PROGRESS) return null;

  token.progress = toProgress;

  // Check captures on shared main track (progress 0..50) outside safe squares
  const capturedTokenIds: string[] = [];
  const destTrackIdx = getLudoTrackIndex(token.color, toProgress);
  if (destTrackIdx !== null && !LUDO_SAFE_TRACK_INDICES.has(destTrackIdx)) {
    for (const other of game.tokens) {
      if (other.color === token.color) continue;
      const otherTrackIdx = getLudoTrackIndex(other.color, other.progress);
      if (otherTrackIdx !== null && otherTrackIdx === destTrackIdx) {
        other.progress = -1;
        capturedTokenIds.push(other.id);
      }
    }
  }

  const reachedHome = toProgress === LUDO_MAX_PROGRESS;
  const finishedCount = game.tokens.filter(
    (t) => t.color === activePlayer.color && t.progress === LUDO_MAX_PROGRESS,
  ).length;
  activePlayer.finishedCount = finishedCount;

  const isWinner = finishedCount === 4;
  if (isWinner) {
    game.status = "finished";
    game.phase = "awaiting_roll";
    game.legalTokenIds = [];
    game.winnerSeat = activePlayer.seat;
    game.winnerColor = activePlayer.color;
    game.winnerTopic = activePlayer.topic;
    game.turnStartedAt = 0;
    game.updatedAt = Date.now();
    game.lastActionText = `🏆 فاز ${activePlayer.topic} (${LUDO_COLOR_LABELS_AR[activePlayer.color]}) بمباراة اللودو!`;
    return {
      movedTokenId: token.id,
      fromProgress,
      toProgress,
      capturedTokenIds,
      reachedHome,
      retainTurn: false,
      finished: true,
    };
  }

  // Bonus turn on rolling 6, capturing an opponent, or bringing a token home
  const retainTurn = roll === 6 || capturedTokenIds.length > 0 || reachedHome;
  if (!retainTurn) {
    game.turnSeat = getNextActiveSeat(game.players, activePlayer.seat);
    game.consecutiveSixes = 0;
  } else if (roll !== 6) {
    // Capture / home bonus does not count toward consecutive 6s limit
    game.consecutiveSixes = 0;
  }

  const nextPlayer = game.players.find((p) => p.seat === game.turnSeat);
  game.phase = "awaiting_roll";
  game.legalTokenIds = [];
  game.turnStartedAt = Date.now();
  game.updatedAt = Date.now();

  if (capturedTokenIds.length > 0) {
    game.lastActionText = `⚔️ ${activePlayer.topic} أكل قطعة خصم وحصل على رمية إضافية!`;
  } else if (reachedHome) {
    game.lastActionText = `⭐ ${activePlayer.topic} أدخل قطعة لبيت الفوز وحصل على رمية إضافية!`;
  } else if (fromProgress === -1) {
    game.lastActionText = `🚀 ${activePlayer.topic} أخرج قطعة جديدة — رمية إضافية!`;
  } else if (retainTurn) {
    game.lastActionText = `🎲 ${activePlayer.topic} حرّك قطعة ويحتفظ بالدور!`;
  } else {
    game.lastActionText = `➡️ ${activePlayer.topic} حرّك قطعة — الدور الآن لـ ${nextPlayer?.topic || "التالي"}.`;
  }

  return {
    movedTokenId: token.id,
    fromProgress,
    toProgress,
    capturedTokenIds,
    reachedHome,
    retainTurn,
    finished: false,
  };
}

/**
 * Smart heuristic AI bot move selector (O(16)).
 */
export function pickBestLudoBotMove(game: LudoGameState): string | null {
  const activePlayer = game.players.find((p) => p.seat === game.turnSeat);
  if (!activePlayer || !game.diceValue || game.legalTokenIds.length === 0) return null;
  if (game.legalTokenIds.length === 1) return game.legalTokenIds[0]!;

  const roll = game.diceValue;
  let bestId = game.legalTokenIds[0]!;
  let bestScore = -Infinity;

  for (const tokenId of game.legalTokenIds) {
    const token = game.tokens.find((t) => t.id === tokenId);
    if (!token) continue;
    const fromProg = token.progress;
    const toProg = fromProg === -1 ? 0 : fromProg + roll;
    let score = 0;

    if (toProg === LUDO_MAX_PROGRESS) score += 1000;
    if (fromProg === -1) score += 320;
    if (toProg >= 51 && fromProg <= 50) score += 260;

    const destTrack = getLudoTrackIndex(token.color, toProg);
    if (destTrack !== null) {
      if (LUDO_SAFE_TRACK_INDICES.has(destTrack)) {
        score += 180;
      } else {
        // Capture bonus
        for (const other of game.tokens) {
          if (other.color === token.color) continue;
          const otherTrack = getLudoTrackIndex(other.color, other.progress);
          if (otherTrack !== null && otherTrack === destTrack) {
            score += 650;
          }
        }
      }
    }

    // Prefer escaping danger when currently on an unsafe square near an opponent
    const curTrack = getLudoTrackIndex(token.color, fromProg);
    if (curTrack !== null && !LUDO_SAFE_TRACK_INDICES.has(curTrack)) {
      for (const other of game.tokens) {
        if (other.color === token.color) continue;
        const otherTrack = getLudoTrackIndex(other.color, other.progress);
        if (otherTrack === null) continue;
        const distBehind = (curTrack - otherTrack + 52) % 52;
        if (distBehind >= 1 && distBehind <= 6) {
          score += 140;
          break;
        }
      }
    }

    score += toProg * 2;
    if (score > bestScore) {
      bestScore = score;
      bestId = tokenId;
    }
  }

  return bestId;
}

export function toLudoPublicState(
  game: LudoGameState | null,
  roomId: string,
  spectators = 0,
): LudoPublicState {
  if (!game) {
    return {
      roomId,
      status: "stopped",
      phase: "awaiting_roll",
      players: [],
      tokens: [],
      turnSeat: 0,
      turnColor: null,
      turnTopic: "",
      diceValue: null,
      consecutiveSixes: 0,
      legalTokenIds: [],
      spectators,
      winnerSeat: null,
      winnerColor: null,
      winnerTopic: "",
      lastActionText: "",
      turnStartedAt: 0,
      turnTimeoutMs: LUDO_TURN_TIMEOUT_MS,
      updatedAt: Date.now(),
    };
  }
  const activePlayer = game.players.find((p) => p.seat === game.turnSeat) ?? null;
  return {
    roomId: game.roomId,
    title: game.title,
    status: game.status,
    phase: game.phase,
    players: game.players.map((p) => ({
      ...p,
      finishedCount: game.tokens.filter(
        (t) => t.color === p.color && t.progress === LUDO_MAX_PROGRESS,
      ).length,
    })),
    tokens: game.tokens.map((t) => ({ ...t })),
    turnSeat: game.turnSeat,
    turnColor: activePlayer?.color ?? null,
    turnTopic: activePlayer?.topic ?? "",
    diceValue: game.diceValue,
    consecutiveSixes: game.consecutiveSixes,
    legalTokenIds: [...game.legalTokenIds],
    spectators,
    winnerSeat: game.winnerSeat,
    winnerColor: game.winnerColor,
    winnerTopic: game.winnerTopic,
    lastActionText: game.lastActionText,
    turnStartedAt: game.turnStartedAt,
    turnTimeoutMs: LUDO_TURN_TIMEOUT_MS,
    updatedAt: game.updatedAt,
  };
}
