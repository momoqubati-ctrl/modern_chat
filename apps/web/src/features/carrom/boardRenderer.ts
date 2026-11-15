import {
  BOARD_SIZE,
  COIN_RADIUS,
  POCKETS,
  STRIKER_RADIUS,
  computePredictivePath,
  dist2D,
} from "./engine.js";
import type { BoardSkinId, CarromDisc, PotBurstEffect, RoseSkinId } from "./types.js";

export interface LoadedBoardAssets {
  wood1?: HTMLImageElement;
  wood2?: HTMLImageElement;
  windRose?: HTMLImageElement;
  windRose1?: HTMLImageElement;
  corner1?: HTMLImageElement;
  corner2?: HTMLImageElement;
  corner3?: HTMLImageElement;
  corner4?: HTMLImageElement;
}

const ASSET_URLS: Record<keyof LoadedBoardAssets, string> = {
  wood1: "/carrom-game/assets/images/b1.jpg",
  wood2: "/carrom-game/assets/images/b2.jpg",
  windRose: "/carrom-game/assets/images/windRose.svg",
  windRose1: "/carrom-game/assets/images/windRose1.svg",
  corner1: "/carrom-game/assets/images/corner1.png",
  corner2: "/carrom-game/assets/images/corner2.png",
  corner3: "/carrom-game/assets/images/corner3.png",
  corner4: "/carrom-game/assets/images/corner4.png",
};

let cachedAssetsPromise: Promise<LoadedBoardAssets> | null = null;
let loadedAssetsSnapshot: LoadedBoardAssets = {};

export function preloadBoardAssets(): Promise<LoadedBoardAssets> {
  if (cachedAssetsPromise) return cachedAssetsPromise;
  cachedAssetsPromise = new Promise((resolve) => {
    const out: LoadedBoardAssets = {};
    const keys = Object.keys(ASSET_URLS) as Array<keyof LoadedBoardAssets>;
    let done = 0;
    const finishOne = () => {
      done += 1;
      if (done >= keys.length) {
        loadedAssetsSnapshot = out;
        resolve(out);
      }
    };
    for (const k of keys) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        out[k] = img;
        finishOne();
      };
      img.onerror = finishOne;
      img.src = ASSET_URLS[k];
    }
  });
  return cachedAssetsPromise;
}

export function getLoadedBoardAssets(): LoadedBoardAssets {
  return loadedAssetsSnapshot;
}

/**
 * Configures high-DPI scale safely (capped at 2x so GPU fill cost stays constant on 3x phones).
 */
export function ensureCanvasHiDpi(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const targetSize = Math.round(BOARD_SIZE * dpr);
  if (canvas.width !== targetSize || canvas.height !== targetSize) {
    canvas.width = targetSize;
    canvas.height = targetSize;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawBgLayer(
  canvas: HTMLCanvasElement,
  skin: BoardSkinId,
  assets: LoadedBoardAssets,
): void {
  const ctx = ensureCanvasHiDpi(canvas);
  if (!ctx) return;

  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
  // Crisp walnut outer frame underneath board surface
  ctx.fillStyle = "#3f2014";
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  const img = skin === "wood1" ? assets.wood1 : skin === "wood2" ? assets.wood2 : undefined;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 20, 20, 480, 480);
  } else {
    ctx.fillStyle = "#ebdfc3";
    ctx.fillRect(20, 20, 480, 480);
  }
}

function drawPocketRings(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < POCKETS.length; i += 1) {
    const { x, y } = POCKETS[i]!;
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffd700";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a0505";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 16, 0, 2 * Math.PI);
    ctx.fillStyle = "#000000";
    ctx.fill();
  }
}

function drawBaseRedCircle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, COIN_RADIUS, 0, 2 * Math.PI);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000000";
  ctx.stroke();

  const grd = ctx.createRadialGradient(x, y, 4, x, y, 10);
  grd.addColorStop(0, "#ef4444");
  grd.addColorStop(1, "#800000");
  ctx.fillStyle = grd;
  ctx.fill();
}

export function drawBoardLinesLayer(
  canvas: HTMLCanvasElement,
  roseSkin: RoseSkinId,
  assets: LoadedBoardAssets,
): void {
  const ctx = ensureCanvasHiDpi(canvas);
  if (!ctx) return;

  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Corner graphic decals beneath pocket rings
  if (assets.corner1?.complete) ctx.drawImage(assets.corner1, 17, 17, 20, 20);
  if (assets.corner2?.complete) ctx.drawImage(assets.corner2, 483, 17, 20, 20);
  if (assets.corner4?.complete) ctx.drawImage(assets.corner4, 17, 483, 20, 20);
  if (assets.corner3?.complete) ctx.drawImage(assets.corner3, 483, 483, 20, 20);

  drawPocketRings(ctx);

  // Center circle & windRose emblem
  ctx.strokeStyle = "#1f140e";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(260, 260, 55, 0, 2 * Math.PI);
  ctx.stroke();

  const rose = roseSkin === "classic" ? assets.windRose : assets.windRose1;
  if (rose && rose.complete && rose.naturalWidth > 0) {
    ctx.drawImage(rose, 220, 220, 80, 80);
  }

  const drawThinLine = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
  };

  const drawThickLine = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
  };

  const drawSmallRing = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
  };

  const drawFoulArc = (x: number, y: number, start: number, end: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 20, start, end, false);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
  };

  // Top Left
  drawSmallRing(100, 100, 5);
  drawBaseRedCircle(ctx, 110, 90);
  drawBaseRedCircle(ctx, 90, 110);
  drawThinLine(110, 100, 410, 100);
  drawThickLine(110, 80, 410, 80);
  drawThinLine(75, 75, 175, 175);
  drawFoulArc(160, 160, 1.5 * Math.PI, Math.PI);

  // Top Right
  drawSmallRing(420, 100, 5);
  drawBaseRedCircle(ctx, 410, 90);
  drawBaseRedCircle(ctx, 430, 110);
  drawThinLine(420, 110, 420, 410);
  drawThickLine(440, 110, 440, 410);
  drawThinLine(445, 75, 345, 175);
  drawFoulArc(360, 160, 0, 1.5 * Math.PI);

  // Bottom Right
  drawSmallRing(420, 420, 5);
  drawBaseRedCircle(ctx, 410, 430);
  drawBaseRedCircle(ctx, 430, 410);
  drawThinLine(410, 420, 110, 420);
  drawThickLine(410, 440, 110, 440);
  drawThinLine(445, 445, 345, 345);
  drawFoulArc(360, 360, 0.5 * Math.PI, 0);

  // Bottom Left
  drawSmallRing(100, 420, 5);
  drawBaseRedCircle(ctx, 110, 430);
  drawBaseRedCircle(ctx, 90, 410);
  drawThinLine(100, 410, 100, 110);
  drawThickLine(80, 410, 80, 110);
  drawThinLine(75, 445, 175, 345);
  drawFoulArc(160, 360, Math.PI, 0.5 * Math.PI);
}

function drawDisc(ctx: CanvasRenderingContext2D, disc: CarromDisc, highlightedBlue: boolean): void {
  const { x, y, radius, name } = disc;
  if (x < -20 || y < -20) return;

  ctx.save();
  // Subtle drop shadow
  ctx.beginPath();
  ctx.arc(x + 1, y + 1.5, radius, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  if (highlightedBlue) {
    ctx.fillStyle = "#2563eb";
  } else if (name === "red") {
    const grd = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, radius);
    grd.addColorStop(0, "#ff4d6d");
    grd.addColorStop(1, "#c9184a");
    ctx.fillStyle = grd;
  } else if (name === "white") {
    const grd = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, radius);
    grd.addColorStop(0, "#fffbeb");
    grd.addColorStop(1, "#e7d08d");
    ctx.fillStyle = grd;
  } else {
    const grd = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, radius);
    grd.addColorStop(0, "#4b5563");
    grd.addColorStop(1, "#18181b");
    ctx.fillStyle = grd;
  }
  ctx.fill();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = highlightedBlue ? "#93c5fd" : "#0f0f0f";
  ctx.stroke();

  // Inner concentric Carrom groove
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2, radius - 5), 0, 2 * Math.PI);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle =
    highlightedBlue
      ? "#dbeafe"
      : name === "black"
        ? "rgba(255,255,255,0.2)"
        : "rgba(0,0,0,0.28)";
  ctx.stroke();
  ctx.restore();
}

function drawStrikerDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  overlap: boolean,
  isInteractive: boolean,
): void {
  if (x < -20 || y < -20) return;
  const r = STRIKER_RADIUS;

  ctx.save();
  // Placement feedback halo when active
  if (isInteractive) {
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
    ctx.strokeStyle = overlap ? "rgba(239, 68, 68, 0.9)" : "rgba(34, 197, 94, 0.72)";
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(x + 1, y + 1.5, r, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = overlap ? "#fecaca" : "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#111111";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r - 3, 0, 2 * Math.PI);
  ctx.strokeStyle = "#0091ff";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, r - 6, 0, 2 * Math.PI);
  ctx.strokeStyle = "#bb00ff";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.5, r - 9), 0, 2 * Math.PI);
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.restore();
}

function drawAimGuide(
  ctx: CanvasRenderingContext2D,
  discs: readonly CarromDisc[],
  sx: number,
  sy: number,
  aimX: number,
  aimY: number,
): void {
  const dx = sx - aimX;
  const dy = sy - aimY;
  const power = Math.sqrt(dx * dx + dy * dy);
  const arrowLen = Math.min(power * 1.5, 120);
  if (arrowLen <= 15) return;

  const angle = Math.atan2(dy, dx);
  const toX = sx + Math.cos(angle) * arrowLen;
  const toY = sy + Math.sin(angle) * arrowLen;

  // Power ring around striker
  const powerRatio = Math.min(1, power / 85);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, 18 + powerRatio * 26, 0, 2 * Math.PI);
  ctx.strokeStyle = powerRatio > 0.75 ? "rgba(239,68,68,0.45)" : "rgba(250,204,21,0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.restore();

  // Predictive trajectory
  const pred = computePredictivePath(discs, sx, sy, angle, power);
  if (pred.points.length >= 2) {
    ctx.save();
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(pred.points[0]!.x, pred.points[0]!.y);
    for (let i = 1; i < pred.points.length; i += 1) {
      ctx.lineTo(pred.points[i]!.x, pred.points[i]!.y);
    }
    ctx.strokeStyle = "rgba(239, 68, 68, 0.72)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  if (pred.coinRay) {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(pred.coinRay.x1, pred.coinRay.y1);
    ctx.lineTo(pred.coinRay.x2, pred.coinRay.y2);
    ctx.stroke();
    ctx.restore();
  }

  if (pred.hitPoint) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pred.hitPoint.x, pred.hitPoint.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.restore();
  }

  // Gradient aim arrow
  const headlen = 14;
  const grad = ctx.createLinearGradient(sx, sy, toX, toY);
  grad.addColorStop(0, "#facc15");
  grad.addColorStop(1, "#ef4444");

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(toX, toY);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = "#ef4444";
  ctx.fill();
  ctx.restore();
}

export interface ActiveLayerRenderOptions {
  discs: readonly CarromDisc[];
  blueCoins: readonly number[];
  overlap: boolean;
  isInteractivePlaceOrAim: boolean;
  aimPoint: { x: number; y: number } | null;
  potBursts: PotBurstEffect[];
  now: number;
}

export function drawActiveLayer(canvas: HTMLCanvasElement, opts: ActiveLayerRenderOptions): void {
  const ctx = ensureCanvasHiDpi(canvas);
  if (!ctx) return;

  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
  drawPocketRings(ctx);

  const blueSet = opts.blueCoins.length > 0 ? new Set(opts.blueCoins) : null;
  const discs = opts.discs;

  // Draw coins (1..N)
  for (let i = 1; i < discs.length; i += 1) {
    const c = discs[i]!;
    drawDisc(ctx, c, Boolean(blueSet && blueSet.has(i)));
  }

  // Draw striker (0)
  const striker = discs[0];
  if (striker && dist2D(striker.x, striker.y, -100, -100) > 10) {
    drawStrikerDisc(ctx, striker.x, striker.y, opts.overlap, opts.isInteractivePlaceOrAim);
    if (opts.aimPoint) {
      drawAimGuide(ctx, discs, striker.x, striker.y, opts.aimPoint.x, opts.aimPoint.y);
    }
  }

  // Pocket drop bursts (280ms short gold ring animation)
  for (let i = opts.potBursts.length - 1; i >= 0; i -= 1) {
    const burst = opts.potBursts[i]!;
    const elapsed = opts.now - burst.startedAt;
    if (elapsed >= 320) {
      opts.potBursts.splice(i, 1);
      continue;
    }
    const progress = elapsed / 320;
    const radius = 10 + progress * 22;
    const alpha = 1 - progress;
    ctx.save();
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(250, 204, 21, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 3 * (1 - progress * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(burst.x, burst.y, 10 * (1 - progress), 0, Math.PI * 2);
    ctx.fillStyle = burst.color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.restore();
  }
}
