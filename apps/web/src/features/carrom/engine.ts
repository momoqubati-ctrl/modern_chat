import type { CarromDisc, CarromSnapshot, CoinKind, PlayerScoreState } from "./types.js";

export const BOARD_SIZE = 520;
export const WALL_MIN = 20;
export const WALL_MAX = 500;
export const COIN_RADIUS = 10;
export const STRIKER_RADIUS = 11;
export const POCKET_THRESHOLD = 32;
export const WALL_POCKET_SKIP_RADIUS = 40;
export const OVERLAP_THRESHOLD = 23;
export const BASELINE_MIN_X = 110;
export const BASELINE_MAX_X = 410;
export const BASELINE_Y: [number, number] = [430, 90];
export const BASELINE_DEFAULT_X = 260;

export const POCKETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 27, y: 27 },
  { x: 493, y: 27 },
  { x: 27, y: 493 },
  { x: 493, y: 493 },
];

export const COIN_COLORS: Record<CoinKind, string> = {
  striker: "#ffffff",
  black: "#2c2c2c",
  white: "#f3e5ab",
  red: "#e61938",
};

export function dist2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clampBoardNum(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

export function createInitialPlayers(): [PlayerScoreState, PlayerScoreState] {
  return [
    { score: 0, coins: { black: 0, white: 0 } },
    { score: 0, coins: { black: 0, white: 0 } },
  ];
}

export function createInitialDiscs(): CarromDisc[] {
  const striker: CarromDisc = {
    x: BASELINE_DEFAULT_X,
    y: BASELINE_Y[0],
    vx: 0,
    vy: 0,
    name: "striker",
    color: COIN_COLORS.striker,
    radius: STRIKER_RADIUS,
  };

  const blackPositions: Array<[number, number]> = [
    [260, 260 + 22],
    [260 + 20, 260 - 11],
    [260 - 20, 260 - 11],
    [260 + 20, 260 + 33],
    [260 - 20, 260 + 33],
    [260 + 40, 260],
    [260 - 40, 260],
    [260 + 20, 260 - 33],
    [260 - 20, 260 - 33],
  ];

  const whitePositions: Array<[number, number]> = [
    [260, 260 - 22],
    [260, 260 - 44],
    [260, 260 + 44],
    [260 + 20, 260 + 11],
    [260 + 40, 260 + 22],
    [260 - 20, 260 + 11],
    [260 - 40, 260 + 22],
    [260 - 40, 260 - 22],
    [260 + 40, 260 - 22],
  ];

  const coins: CarromDisc[] = [];
  for (const [x, y] of blackPositions) {
    coins.push({ x, y, vx: 0, vy: 0, name: "black", color: COIN_COLORS.black, radius: COIN_RADIUS });
  }
  coins.push({ x: 260, y: 260, vx: 0, vy: 0, name: "red", color: COIN_COLORS.red, radius: COIN_RADIUS });
  for (const [x, y] of whitePositions) {
    coins.push({ x, y, vx: 0, vy: 0, name: "white", color: COIN_COLORS.white, radius: COIN_RADIUS });
  }

  return [striker, ...coins];
}

export function isStrikerOverlapping(discs: readonly CarromDisc[], sx: number, sy: number): boolean {
  for (let i = 1; i < discs.length; i += 1) {
    const c = discs[i]!;
    if (dist2D(sx, sy, c.x, c.y) < OVERLAP_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Finds the nearest valid baseline X without coin overlap if the center has a coin on it.
 */
export function findAvailableBaselineX(discs: readonly CarromDisc[], y: number, preferredX = BASELINE_DEFAULT_X): number {
  const clamped = clampBoardNum(preferredX, BASELINE_MIN_X, BASELINE_MAX_X);
  if (!isStrikerOverlapping(discs, clamped, y)) return clamped;
  for (let offset = 6; offset <= 300; offset += 6) {
    const right = clamped + offset;
    if (right <= BASELINE_MAX_X && !isStrikerOverlapping(discs, right, y)) return right;
    const left = clamped - offset;
    if (left >= BASELINE_MIN_X && !isStrikerOverlapping(discs, left, y)) return left;
  }
  return clamped;
}

function getSegmentClosestDist(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  lineLen: number,
): { x: number; y: number } | null {
  const px = bx - ax;
  const py = by - ay;
  const dAB = px * px + py * py;
  if (dAB === 0) return null;
  const u = ((cx - ax) * px + (cy - ay) * py) / dAB;
  const x = ax + u * px;
  const y = ay + u * py;
  const dis = dist2D(cx, cy, x, y);
  const dA = dist2D(ax, ay, x, y);
  const dB = dist2D(bx, by, x, y);
  if (dA < lineLen + 10 && dB < lineLen + 10 && dis < 10) {
    return { x, y };
  }
  return null;
}

/**
 * Exact replica of legacy `drawHitAreas()` foul zone calculation.
 * Returns indices (in `discs`, 1..N) of coins positioned inside the active player's baseline/corner-arrow foul zone.
 */
export function computeBlueFoulCoinIndices(discs: readonly CarromDisc[], currPlayer: 0 | 1): number[] {
  const result: number[] = [];
  const diagLen = 141.422;

  for (let i = 1; i < discs.length; i += 1) {
    const c = discs[i]!;
    let foul = false;
    if (currPlayer === 1) {
      if (c.y < 190 && c.y > 65 && c.x > 65 && c.x < 455) {
        if (dist2D(c.x, c.y, 160, 160) < 30 || dist2D(c.x, c.y, 360, 160) < 30) {
          foul = true;
        }
        if (!foul && c.x < 180) {
          if (getSegmentClosestDist(75, 75, 175, 175, c.x, c.y, diagLen)) foul = true;
        } else if (!foul && c.x > 340) {
          if (getSegmentClosestDist(445, 75, 345, 175, c.x, c.y, diagLen)) foul = true;
        }
      }
    } else {
      if (c.y > 330 && c.y < 455 && c.x > 65 && c.x < 455) {
        if (dist2D(c.x, c.y, 160, 360) < 30 || dist2D(c.x, c.y, 360, 360) < 30) {
          foul = true;
        }
      }
      if (!foul && c.x < 180) {
        if (getSegmentClosestDist(75, 445, 175, 345, c.x, c.y, diagLen)) foul = true;
      } else if (!foul && c.x > 340) {
        if (getSegmentClosestDist(445, 445, 345, 345, c.x, c.y, diagLen)) foul = true;
      }
    }
    if (foul) result.push(i);
  }
  return result;
}

export function isNearAnyPocket(x: number, y: number, threshold = POCKET_THRESHOLD): boolean {
  for (let p = 0; p < POCKETS.length; p += 1) {
    const pkt = POCKETS[p]!;
    if (dist2D(x, y, pkt.x, pkt.y) < threshold) return true;
  }
  return false;
}

function reboundCoin(co: CarromDisc, dt: number, onWallHit?: (speed: number) => void): void {
  const r = co.radius;
  if (isNearAnyPocket(co.x, co.y, WALL_POCKET_SKIP_RADIUS)) return;

  if (co.x + r + co.vx * dt > WALL_MAX) {
    if (Math.abs(co.vx) > 0.3) onWallHit?.(Math.abs(co.vx));
    co.vx = -Math.abs(co.vx);
  } else if (co.x - r + co.vx * dt < WALL_MIN) {
    if (Math.abs(co.vx) > 0.3) onWallHit?.(Math.abs(co.vx));
    co.vx = Math.abs(co.vx);
  }

  if (co.y + r + co.vy * dt > WALL_MAX) {
    if (Math.abs(co.vy) > 0.3) onWallHit?.(Math.abs(co.vy));
    co.vy = -Math.abs(co.vy);
  } else if (co.y - r + co.vy * dt < WALL_MIN) {
    if (Math.abs(co.vy) > 0.3) onWallHit?.(Math.abs(co.vy));
    co.vy = Math.abs(co.vy);
  }
}

function collidePair(
  obj2: CarromDisc,
  obj1: CarromDisc,
  dt: number,
  onCoinHit?: (speed: number) => void,
): void {
  const nextX1 = obj1.x + obj1.vx * dt;
  const nextY1 = obj1.y + obj1.vy * dt;
  const nextX2 = obj2.x + obj2.vx * dt;
  const nextY2 = obj2.y + obj2.vy * dt;

  const collisionDist = obj1.radius + obj2.radius;
  const dis = dist2D(nextX1, nextY1, nextX2, nextY2);
  if (dis > collisionDist) return;

  const dx = obj1.x - obj2.x;
  const dy = obj1.y - obj2.y;
  if (dx === 0 && dy === 0) return;

  const relVx = obj1.vx - obj2.vx;
  const relVy = obj1.vy - obj2.vy;
  if (dx * relVx + dy * relVy > 0) return;

  const collisionAngle = Math.atan2(dy, dx);
  const speed1 = Math.sqrt(obj2.vx * obj2.vx + obj2.vy * obj2.vy);
  const speed2 = Math.sqrt(obj1.vx * obj1.vx + obj1.vy * obj1.vy);

  const dir1 = Math.atan2(obj2.vy, obj2.vx);
  const dir2 = Math.atan2(obj1.vy, obj1.vx);

  const vx1 = speed1 * Math.cos(dir1 - collisionAngle);
  const vy1 = speed1 * Math.sin(dir1 - collisionAngle);
  const vx2 = speed2 * Math.cos(dir2 - collisionAngle);
  const vy2 = speed2 * Math.sin(dir2 - collisionAngle);

  const cosA = Math.cos(collisionAngle);
  const sinA = Math.sin(collisionAngle);
  const cosB = Math.cos(collisionAngle + Math.PI / 2);
  const sinB = Math.sin(collisionAngle + Math.PI / 2);

  obj2.vx = cosA * vx2 + cosB * vy1;
  obj2.vy = sinA * vx2 + sinB * vy1;
  obj1.vx = cosA * vx1 + cosB * vy2;
  obj1.vy = sinA * vx1 + sinB * vy2;

  const maxSpeed = Math.max(Math.abs(obj1.vx), Math.abs(obj1.vy), Math.abs(obj2.vx), Math.abs(obj2.vy));
  if (maxSpeed > 0.3) {
    onCoinHit?.(maxSpeed);
  }
}

export interface PhysicsStepCallbacks {
  onTickSound?: (speed: number) => void;
  onCoinPocketed?: (coin: CarromDisc) => void;
  onStrikerPocketed?: () => void;
  onStatusMessage?: (msg: string) => void;
  onScoreChange?: () => void;
}

export interface MatchRuntimeState {
  currPlayer: 0 | 1;
  redPut: 0 | 1 | 2;
  strikerPot: boolean;
  coinPoted: boolean;
  firstHit: boolean;
  hitBlueCoin: boolean;
  turnSeq: number;
  blueCoins: number[];
  players: [PlayerScoreState, PlayerScoreState];
  discs: CarromDisc[];
}

export function createMatchRuntimeState(): MatchRuntimeState {
  return {
    currPlayer: 0,
    redPut: 0,
    strikerPot: false,
    coinPoted: false,
    firstHit: false,
    hitBlueCoin: false,
    turnSeq: 0,
    blueCoins: [],
    players: createInitialPlayers(),
    discs: createInitialDiscs(),
  };
}

export function applySnapshotToState(state: MatchRuntimeState, snap: CarromSnapshot): void {
  state.currPlayer = snap.currPlayer === 1 ? 1 : 0;
  state.redPut = snap.redPut === 1 || snap.redPut === 2 ? snap.redPut : 0;
  state.strikerPot = Boolean(snap.strikerPot);
  state.coinPoted = Boolean(snap.coinPoted);
  state.firstHit = Boolean(snap.firstHit);
  state.hitBlueCoin = Boolean(snap.hitBlueCoin);
  state.turnSeq = Number(snap.turnSeq || 0);
  if (Array.isArray(snap.players) && snap.players.length >= 2) {
    state.players = [
      {
        score: Number(snap.players[0]?.score || 0),
        coins: {
          black: Number(snap.players[0]?.coins?.black || 0),
          white: Number(snap.players[0]?.coins?.white || 0),
        },
      },
      {
        score: Number(snap.players[1]?.score || 0),
        coins: {
          black: Number(snap.players[1]?.coins?.black || 0),
          white: Number(snap.players[1]?.coins?.white || 0),
        },
      },
    ];
  }
  state.discs = snap.hittingObjs.map((obj, idx) => ({
    x: Number(obj.x || 260),
    y: Number(obj.y || 260),
    vx: Number(obj.vx || 0),
    vy: Number(obj.vy || 0),
    name: obj.name || (idx === 0 ? "striker" : "black"),
    color: obj.color || COIN_COLORS[obj.name || (idx === 0 ? "striker" : "black")],
    radius: Number(obj.radius || (idx === 0 ? STRIKER_RADIUS : COIN_RADIUS)),
  }));
}

export function serializeSnapshot(state: MatchRuntimeState): CarromSnapshot {
  state.turnSeq += 1;
  return {
    currPlayer: state.currPlayer,
    redPut: state.redPut,
    strikerPot: state.strikerPot,
    coinPoted: state.coinPoted,
    firstHit: state.firstHit,
    hitBlueCoin: state.hitBlueCoin,
    turnSeq: state.turnSeq,
    players: [
      { score: state.players[0].score, coins: { ...state.players[0].coins } },
      { score: state.players[1].score, coins: { ...state.players[1].coins } },
    ],
    hittingObjs: state.discs.map((d) => ({ ...d })),
  };
}

function hasRedCoin(discs: readonly CarromDisc[]): boolean {
  for (let i = 1; i < discs.length; i += 1) {
    if (discs[i]!.name === "red") return true;
  }
  return false;
}

function returnPenaltyCoin(state: MatchRuntimeState, playerIdx: 0 | 1): void {
  const player = state.players[playerIdx];
  if (player.coins.black > 0) {
    player.score -= 10;
    player.coins.black -= 1;
    state.discs.push({
      x: 260,
      y: 260,
      vx: 0,
      vy: 0,
      name: "black",
      color: COIN_COLORS.black,
      radius: COIN_RADIUS,
    });
  } else if (player.coins.white > 0) {
    player.score -= 20;
    player.coins.white -= 1;
    state.discs.push({
      x: 260,
      y: 260,
      vx: 0,
      vy: 0,
      name: "white",
      color: COIN_COLORS.white,
      radius: COIN_RADIUS,
    });
  }
}

/**
 * Advances Carrom physics by one 60Hz logical frame (16 substeps).
 * Returns:
 * - "moving" while discs are still in motion
 * - "turn_end" when all discs settled and rules/turn switch were applied
 * - "game_over" when only the striker remains
 */
export function stepCarromPhysicsFrame(
  state: MatchRuntimeState,
  cb: PhysicsStepCallbacks,
): "moving" | "turn_end" | "game_over" {
  const subSteps = 16;
  const dt = 1 / subSteps;
  const friction = Math.pow(0.985, dt);
  const discs = state.discs;
  const striker = discs[0];
  if (!striker) return "game_over";

  for (let s = 0; s < subSteps; s += 1) {
    // 1. Pairwise collisions + first-hit foul detection
    for (let i = 0; i < discs.length; i += 1) {
      for (let j = i + 1; j < discs.length; j += 1) {
        const obj1 = discs[j]!;
        const obj2 = discs[i]!;
        if (i === 0 && !state.firstHit) {
          const dNext = dist2D(
            obj1.x + obj1.vx * dt,
            obj1.y + obj1.vy * dt,
            obj2.x + obj2.vx * dt,
            obj2.y + obj2.vy * dt,
          );
          if (dNext <= 20) {
            state.firstHit = true;
            if (state.blueCoins.includes(j)) {
              state.hitBlueCoin = true;
            }
          }
        }
        collidePair(obj2, obj1, dt, cb.onTickSound);
      }
    }

    // 2. Wall rebound + integrate + sweep pocket test
    for (let i = 0; i < discs.length; i += 1) {
      const co = discs[i]!;
      const oldX = co.x;
      const oldY = co.y;

      reboundCoin(co, dt, cb.onTickSound);
      co.x += co.vx * dt;
      co.y += co.vy * dt;
      co.vx *= friction;
      co.vy *= friction;

      let hitPocket = false;
      if (isNearAnyPocket(co.x, co.y, POCKET_THRESHOLD)) {
        hitPocket = true;
      } else {
        const moveX = co.x - oldX;
        const moveY = co.y - oldY;
        const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
        if (moveDist > 2) {
          const sweepSteps = Math.ceil(moveDist / 2);
          for (let sw = 1; sw < sweepSteps; sw += 1) {
            const t = sw / sweepSteps;
            const tx = oldX + moveX * t;
            const ty = oldY + moveY * t;
            if (isNearAnyPocket(tx, ty, POCKET_THRESHOLD)) {
              co.x = tx;
              co.y = ty;
              hitPocket = true;
              break;
            }
          }
        }
      }

      if (hitPocket && i > 0) {
        state.coinPoted = true;
        const pCoin = co;
        const activePlayer = state.players[state.currPlayer];

        if (pCoin.name === "white" || pCoin.name === "black") {
          if (discs.length === 3 && hasRedCoin(discs)) {
            cb.onStatusMessage?.("خطأ (فoul) — لا يمكن إدخال آخر قرص قبل الملكة!");
            returnPenaltyCoin(state, state.currPlayer);
            state.currPlayer = state.currPlayer === 0 ? 1 : 0;
            discs.push({
              x: 260,
              y: 260,
              vx: 0,
              vy: 0,
              name: pCoin.name,
              color: pCoin.color,
              radius: COIN_RADIUS,
            });
          } else {
            if (pCoin.name === "white") {
              activePlayer.score += 20;
              activePlayer.coins.white += 1;
            } else {
              activePlayer.score += 10;
              activePlayer.coins.black += 1;
            }
            if (state.redPut === 1 || state.redPut === 2) {
              activePlayer.score += 50;
              state.redPut = 0;
              cb.onStatusMessage?.("تسديدة رائعة! تم تأكيد الملكة الحمراء (+50)");
            } else {
              cb.onStatusMessage?.("أحسنت! استمر في اللعب");
            }
          }
        } else if (pCoin.name === "red" && state.redPut === 0) {
          cb.onStatusMessage?.("تم إدخال الملكة الحمراء! أدخل قرصاً آخر لتأكيدها");
          state.redPut = 1;
        }

        cb.onCoinPocketed?.({ ...pCoin });
        cb.onScoreChange?.();
        discs.splice(i, 1);
        i -= 1;
      } else if (hitPocket && i === 0) {
        striker.vx = 0;
        striker.vy = 0;
        state.strikerPot = true;
        returnPenaltyCoin(state, state.currPlayer);
        cb.onStrikerPocketed?.();
        cb.onScoreChange?.();
        cb.onStatusMessage?.("سقط المضرب! جزاء إرجاع قرص وتبديل الدور");
        striker.x = -100;
        striker.y = -100;
      }
    }
  }

  // Clamp subtle residual drift to zero
  let allStopped = true;
  for (let i = 0; i < discs.length; i += 1) {
    const c = discs[i]!;
    if (Math.abs(c.vx) <= 0.3 && Math.abs(c.vy) <= 0.3) {
      c.vx = 0;
      c.vy = 0;
    } else {
      allStopped = false;
    }
  }

  if (discs.length === 1) {
    return "game_over";
  }

  const strikerStopped = (striker.vx === 0 && striker.vy === 0) || state.strikerPot;
  if (allStopped && strikerStopped) {
    if (state.hitBlueCoin) {
      returnPenaltyCoin(state, state.currPlayer);
      cb.onStatusMessage?.("خطأ: ضرب قرص داخل خط البداية — إرجاع قرص جزاء");
      cb.onScoreChange?.();
      state.hitBlueCoin = false;
    }
    state.firstHit = false;

    if (state.strikerPot || !state.coinPoted) {
      state.currPlayer = state.currPlayer === 0 ? 1 : 0;
    }

    if (state.redPut === 2) {
      state.redPut = 0;
      discs.push({
        x: 260,
        y: 260,
        vx: 0,
        vy: 0,
        name: "red",
        color: COIN_COLORS.red,
        radius: COIN_RADIUS,
      });
      cb.onStatusMessage?.("لم يتم تأكيد الملكة — عادت إلى المنتصف");
    } else if (state.redPut === 1) {
      state.redPut = 2;
    }

    state.strikerPot = false;
    state.coinPoted = false;
    return "turn_end";
  }

  return "moving";
}

/**
 * Computes launch velocity (vX, vY) from striker position and virtual aim pull point.
 */
export function computeShotVelocity(
  strikerX: number,
  strikerY: number,
  aimX: number,
  aimY: number,
): { vX: number; vY: number; power: number } {
  const dx = strikerX - aimX;
  const dy = strikerY - aimY;
  const power = Math.sqrt(dx * dx + dy * dy);
  if (power < 1) return { vX: 0, vY: 0, power: 0 };
  const ranger = Math.min(power / 2, 40);
  return {
    vX: (dx / power) * ranger,
    vY: (dy / power) * ranger,
    power,
  };
}

export interface PredictiveSegment {
  points: Array<{ x: number; y: number }>;
  hitPoint: { x: number; y: number } | null;
  coinRay: { x1: number; y1: number; x2: number; y2: number } | null;
}

function getRayCircleIntersection(
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const fx = startX - cx;
  const fy = startY - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const sq = Math.sqrt(discriminant);
  const t1 = (-b - sq) / (2 * a);
  return t1 >= 0.1 ? t1 : null;
}

export function computePredictivePath(
  discs: readonly CarromDisc[],
  startX: number,
  startY: number,
  angle: number,
  power: number,
): PredictiveSegment {
  let currentX = startX;
  let currentY = startY;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let remainingLen = Math.min(power * 4, 400);

  const points: Array<{ x: number; y: number }> = [{ x: currentX, y: currentY }];
  let hitPoint: { x: number; y: number } | null = null;
  let coinRay: { x1: number; y1: number; x2: number; y2: number } | null = null;

  for (let bounce = 0; bounce < 2; bounce += 1) {
    let minDist = remainingLen;
    let hitWall: "x" | "y" | null = null;
    let hitCoin: CarromDisc | null = null;

    if (dx < 0) {
      const d = (currentX - 31) / -dx;
      if (d > 0 && d < minDist) {
        minDist = d;
        hitWall = "x";
      }
    } else if (dx > 0) {
      const d = (489 - currentX) / dx;
      if (d > 0 && d < minDist) {
        minDist = d;
        hitWall = "x";
      }
    }

    if (dy < 0) {
      const d = (currentY - 31) / -dy;
      if (d > 0 && d < minDist) {
        minDist = d;
        hitWall = "y";
      }
    } else if (dy > 0) {
      const d = (489 - currentY) / dy;
      if (d > 0 && d < minDist) {
        minDist = d;
        hitWall = "y";
      }
    }

    for (let i = 1; i < discs.length; i += 1) {
      const coin = discs[i]!;
      const t = getRayCircleIntersection(currentX, currentY, dx, dy, coin.x, coin.y, 20);
      if (t !== null && t < minDist) {
        minDist = t;
        hitCoin = coin;
        hitWall = null;
      }
    }

    currentX += dx * minDist;
    currentY += dy * minDist;
    points.push({ x: currentX, y: currentY });

    remainingLen -= minDist;
    if (remainingLen <= 0 || (!hitWall && !hitCoin)) break;

    if (hitWall === "x") {
      dx = -dx;
    } else if (hitWall === "y") {
      dy = -dy;
    } else if (hitCoin) {
      const cDx = hitCoin.x - currentX;
      const cDy = hitCoin.y - currentY;
      const mag = Math.sqrt(cDx * cDx + cDy * cDy);
      if (mag > 0.001) {
        coinRay = {
          x1: hitCoin.x,
          y1: hitCoin.y,
          x2: hitCoin.x + (cDx / mag) * 100,
          y2: hitCoin.y + (cDy / mag) * 100,
        };
      }
      const nx = (currentX - hitCoin.x) / 20;
      const ny = (currentY - hitCoin.y) / 20;
      const dot = dx * nx + dy * ny;
      dx = dx - dot * nx;
      dy = dy - dot * ny;
      hitPoint = { x: currentX, y: currentY };
    }
  }

  return { points, hitPoint, coinRay };
}

/**
 * Smart AI Bot shot planner for Solo Practice mode (AI plays seat 1 at top baseline y=90).
 */
export function planAiShot(discs: readonly CarromDisc[]): {
  strikerX: number;
  vX: number;
  vY: number;
} {
  const y = BASELINE_Y[1];
  const coins = discs.slice(1);
  if (coins.length === 0) {
    return { strikerX: BASELINE_DEFAULT_X, vX: 0, vY: 16 };
  }

  const blueSet = new Set(computeBlueFoulCoinIndices(discs, 1));
  let bestScore = -Infinity;
  let bestStrikerX = findAvailableBaselineX(discs, y, 260);
  let bestDirX = 0;
  let bestDirY = 1;
  let bestPower = 55;

  // Prefer coins reachable from top baseline (shooting downward/diagonally into bottom/top pockets)
  const targetPockets = [POCKETS[2]!, POCKETS[3]!, POCKETS[0]!, POCKETS[1]!];

  for (let ci = 0; ci < coins.length; ci += 1) {
    const coin = coins[ci]!;
    const idxInDiscs = ci + 1;
    if (blueSet.has(idxInDiscs)) continue; // Avoid baseline foul coins

    for (const pocket of targetPockets) {
      const toPocketX = pocket.x - coin.x;
      const toPocketY = pocket.y - coin.y;
      const distToPocket = Math.sqrt(toPocketX * toPocketX + toPocketY * toPocketY);
      if (distToPocket < 5) continue;

      // Ghost ball aim point slightly behind target coin opposite to pocket
      const ghostX = coin.x - (toPocketX / distToPocket) * 20;
      const ghostY = coin.y - (toPocketY / distToPocket) * 20;
      if (ghostY <= y + 18) continue; // Only shoot forward from top baseline

      // Project backward ray from ghost through coin onto baseline y=90
      const t = (y - ghostY) / (ghostY - pocket.y || -1);
      const desiredX = clampBoardNum(ghostX + (ghostX - pocket.x) * t, BASELINE_MIN_X, BASELINE_MAX_X);
      const sx = findAvailableBaselineX(discs, y, desiredX);
      if (isStrikerOverlapping(discs, sx, y)) continue;

      const sToGx = ghostX - sx;
      const sToGy = ghostY - y;
      const sLen = Math.sqrt(sToGx * sToGx + sToGy * sToGy);
      if (sLen < 20) continue;

      const alignment = (sToGx / sLen) * (toPocketX / distToPocket) + (sToGy / sLen) * (toPocketY / distToPocket);
      if (alignment < 0.25) continue;

      const priorityBonus = coin.name === "red" ? 0.35 : coin.name === "white" ? 0.15 : 0;
      const candidateScore = alignment * 2.2 - distToPocket / 420 + priorityBonus;
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestStrikerX = sx;
        bestDirX = sToGx / sLen;
        bestDirY = sToGy / sLen;
        bestPower = clampBoardNum(26 + (distToPocket + sLen) * 0.085, 28, 72);
      }
    }
  }

  // Fallback if no clean pocket angle exists: strike the nearest non-foul center coin
  if (bestScore === -Infinity) {
    let target = coins[0]!;
    for (const c of coins) {
      if (c.y > target.y) target = c;
    }
    bestStrikerX = findAvailableBaselineX(discs, y, clampBoardNum(target.x, BASELINE_MIN_X, BASELINE_MAX_X));
    const dx = target.x - bestStrikerX;
    const dy = Math.max(25, target.y - y);
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    bestDirX = dx / len;
    bestDirY = dy / len;
    bestPower = 52;
  }

  // Add subtle natural human-like error so AI feels fair and fun
  const jitterAngle = (Math.random() - 0.5) * 0.045;
  const cosJ = Math.cos(jitterAngle);
  const sinJ = Math.sin(jitterAngle);
  const jx = bestDirX * cosJ - bestDirY * sinJ;
  const jy = bestDirX * sinJ + bestDirY * cosJ;

  const ranger = Math.min(bestPower / 2, 38);
  return {
    strikerX: bestStrikerX,
    vX: jx * ranger,
    vY: jy * ranger,
  };
}
