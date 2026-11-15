import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLudoDiceRoll,
  applyLudoTokenMove,
  createLudoGame,
  getLegalLudoTokenIds,
  getLudoTokenCoords,
  getLudoTrackIndex,
  LUDO_CLOCKWISE_COLORS,
  LUDO_COORD_TO_HOME_CELL,
  LUDO_COORD_TO_TRACK_INDEX,
  LUDO_HOME_COLUMNS,
  LUDO_MAIN_TRACK,
  LUDO_MAX_PROGRESS,
  LUDO_SAFE_TRACK_INDICES,
  LUDO_SEAT_COLORS,
  LUDO_START_TRACK_INDEX,
  pickBestLudoBotMove,
  startLudoMatch,
  type LudoPlayer,
} from "../packages/shared/src/index.js";

function makePlayer(seat: 0 | 1 | 2 | 3, topic: string, isBot = false): LudoPlayer {
  return {
    seat,
    color: LUDO_SEAT_COLORS[seat],
    socketId: `sock-${seat}`,
    topic,
    pic: "pic.png",
    isBot,
    finishedCount: 0,
  };
}

test("Ludo board track geometry has 52 unique cells and continuous Manhattan steps", () => {
  assert.equal(LUDO_MAIN_TRACK.length, 52);
  assert.equal(LUDO_COORD_TO_TRACK_INDEX.size, 52);
  assert.equal(LUDO_SAFE_TRACK_INDICES.size, 8);

  for (let i = 0; i < 52; i += 1) {
    const [r1, c1] = LUDO_MAIN_TRACK[i]!;
    const [r2, c2] = LUDO_MAIN_TRACK[(i + 1) % 52]!;
    const manhattan = Math.abs(r1 - r2) + Math.abs(c1 - c2);
    // Diagonal corner transitions between arm tips have Manhattan distance 2 (e.g. [6,5] -> [5,6])
    assert.ok(
      manhattan === 1 || manhattan === 2,
      `Track discontinuity between ${i} ([${r1},${c1}]) and ${(i + 1) % 52} ([${r2},${c2}])`,
    );
  }

  for (const color of LUDO_CLOCKWISE_COLORS) {
    assert.equal(LUDO_HOME_COLUMNS[color].length, 6);
    // Start cell must be in safe squares
    assert.equal(LUDO_SAFE_TRACK_INDICES.has(LUDO_START_TRACK_INDEX[color]), true);
  }
  assert.equal(LUDO_COORD_TO_HOME_CELL.size, 24);
});

test("2-player seat mapping places seats 0 and 1 on geometrically opposite corners (red vs yellow)", () => {
  assert.equal(LUDO_SEAT_COLORS[0], "red");
  assert.equal(LUDO_SEAT_COLORS[1], "yellow");
  assert.equal(
    Math.abs(LUDO_START_TRACK_INDEX.yellow - LUDO_START_TRACK_INDEX.red),
    26,
    "Opposite seats should be 26 steps apart on the 52-cell track",
  );
});

test("Yard tokens only move on rolling 6, and rolling non-6 with all tokens in yard auto-skips turn", () => {
  const game = createLudoGame("room-1", "أحمد");
  game.players.push(makePlayer(0, "أحمد"), makePlayer(1, "خالد"));
  assert.equal(startLudoMatch(game, "أحمد"), true);

  assert.equal(game.turnSeat, 0);
  const miss = applyLudoDiceRoll(game, 4, "أحمد");
  assert.equal(miss.valid, true);
  assert.equal(miss.autoSkipped, true);
  assert.equal(miss.legalTokenIds.length, 0);
  assert.equal(game.turnSeat, 1, "Turn should pass to player 1 when no legal moves exist");

  const six = applyLudoDiceRoll(game, 6, "خالد");
  assert.equal(six.valid, true);
  assert.equal(six.autoSkipped, false);
  assert.equal(six.legalTokenIds.length, 4);
  assert.equal(game.phase, "awaiting_move");

  const move = applyLudoTokenMove(game, "yellow-0");
  assert.ok(move);
  assert.equal(move.fromProgress, -1);
  assert.equal(move.toProgress, 0);
  assert.equal(move.retainTurn, true, "Rolling 6 grants an extra roll");
  assert.equal(game.turnSeat, 1);
  assert.equal(game.phase, "awaiting_roll");
});

test("Three consecutive 6s forfeit turn and reset streak", () => {
  const game = createLudoGame("room-2", "سارة");
  game.players.push(makePlayer(0, "سارة"), makePlayer(1, "نورة"));
  startLudoMatch(game);

  // Move one red token out so 6 has legal moves on first two rolls
  let r1 = applyLudoDiceRoll(game, 6, "سارة");
  assert.equal(r1.forfeitedByThreeSixes, false);
  assert.ok(applyLudoTokenMove(game, "red-0"));

  let r2 = applyLudoDiceRoll(game, 6, "سارة");
  assert.equal(r2.forfeitedByThreeSixes, false);
  assert.equal(game.consecutiveSixes, 2);
  assert.ok(applyLudoTokenMove(game, "red-0"));

  let r3 = applyLudoDiceRoll(game, 6, "سارة");
  assert.equal(r3.valid, true);
  assert.equal(r3.forfeitedByThreeSixes, true);
  assert.equal(r3.autoSkipped, true);
  assert.equal(game.consecutiveSixes, 0);
  assert.equal(game.turnSeat, 1, "Turn must advance to seat 1 after 3 consecutive 6s");
});

test("Capturing opponent token works on unsafe squares and is blocked on safe star/start squares", () => {
  const game = createLudoGame("room-3");
  game.players.push(makePlayer(0, "أحمر"), makePlayer(1, "أصفر"));
  startLudoMatch(game);

  const redToken = game.tokens.find((t) => t.id === "red-0")!;
  const yellowToken = game.tokens.find((t) => t.id === "yellow-0")!;

  // Put yellow at track index 10 (progress 36 => (26+36)%52 = 10, unsafe)
  // Put red at track index 7 (progress 7), roll 3 => track index 10 -> CAPTURE
  yellowToken.progress = 36;
  redToken.progress = 7;
  assert.equal(getLudoTrackIndex("yellow", 36), 10);
  assert.equal(LUDO_SAFE_TRACK_INDICES.has(10), false);

  const rollCapture = applyLudoDiceRoll(game, 3, "أحمر");
  assert.equal(rollCapture.autoSkipped, false);
  const outcome = applyLudoTokenMove(game, "red-0");
  assert.ok(outcome);
  assert.deepEqual(outcome.capturedTokenIds, ["yellow-0"]);
  assert.equal(yellowToken.progress, -1, "Captured token returns to yard (-1)");
  assert.equal(outcome.retainTurn, true, "Capture grants bonus turn");
  assert.equal(game.turnSeat, 0);

  // Now test safe star square index 8: both red and yellow share track index 8
  // Yellow at progress 34 => (26+34)%52 = 8; Red at progress 5, rolls 3 => track 8
  yellowToken.progress = 34;
  redToken.progress = 5;
  assert.equal(LUDO_SAFE_TRACK_INDICES.has(8), true);

  applyLudoDiceRoll(game, 3, "أحمر");
  const safeOutcome = applyLudoTokenMove(game, "red-0");
  assert.ok(safeOutcome);
  assert.deepEqual(safeOutcome.capturedTokenIds, [], "No capture allowed on safe star square");
  assert.equal(yellowToken.progress, 34);
  assert.equal(safeOutcome.retainTurn, false);
  assert.equal(game.turnSeat, 1);
});

test("Exact roll required to reach finish (56) and 4 finished tokens crown winner", () => {
  const game = createLudoGame("room-4");
  game.players.push(makePlayer(0, "علي"), makePlayer(1, "عمر"));
  startLudoMatch(game);

  const reds = game.tokens.filter((t) => t.color === "red");
  reds[0]!.progress = LUDO_MAX_PROGRESS;
  reds[1]!.progress = LUDO_MAX_PROGRESS;
  reds[2]!.progress = LUDO_MAX_PROGRESS;
  reds[3]!.progress = 54; // Needs exact 2 to win

  // Rolling 3 cannot move progress 54 -> 57
  assert.deepEqual(getLegalLudoTokenIds(game.tokens, "red", 3), []);

  // Rolling 2 wins immediately
  const winRoll = applyLudoDiceRoll(game, 2, "علي");
  assert.deepEqual(winRoll.legalTokenIds, ["red-3"]);
  const winOutcome = applyLudoTokenMove(game, "red-3");
  assert.ok(winOutcome);
  assert.equal(winOutcome.reachedHome, true);
  assert.equal(winOutcome.finished, true);
  assert.equal(game.status, "finished");
  assert.equal(game.winnerSeat, 0);
  assert.equal(game.winnerColor, "red");
  assert.equal(game.winnerTopic, "علي");

  const coords = getLudoTokenCoords(reds[3]!);
  assert.deepEqual(coords, LUDO_HOME_COLUMNS.red[5]);
});

test("AI heuristic pickBestLudoBotMove prefers winning finish or capturing enemy over plain advance", () => {
  const game = createLudoGame("room-bot");
  game.players.push(makePlayer(0, "بوت ذكي", true), makePlayer(1, "خصم"));
  startLudoMatch(game);

  const red0 = game.tokens.find((t) => t.id === "red-0")!;
  const red1 = game.tokens.find((t) => t.id === "red-1")!;
  const yellow0 = game.tokens.find((t) => t.id === "yellow-0")!;

  red0.progress = 2; // plain move +3 => 5
  red1.progress = 53; // exact +3 => 56 (HOME FINISH!)
  yellow0.progress = 36;

  applyLudoDiceRoll(game, 3, "بوت ذكي");
  const pick = pickBestLudoBotMove(game);
  assert.equal(pick, "red-1", "Bot should prioritize finishing a token at progress 56");
});
