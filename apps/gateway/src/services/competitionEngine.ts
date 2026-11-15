import {
  BOT_PICS,
  CAPITALS_QUESTIONS,
  CONFESSION_CHAIR_QUESTIONS,
  ENGLISH_WORD_QUESTIONS,
  FAST_CHALLENGES,
  GENERAL_QUESTIONS,
  LUCKY_WHEEL_RESULTS,
  isMissingLettersAnswerCorrect,
  isOddNumberAnswerCorrect,
  isQuestionAnswerCorrect,
  makeMissingLettersQuestion,
  makeOddNumberQuestion,
  normalizeBrbText,
  normalizeCapitalsText,
  pickUnseenQuestion,
  sanitizeHtmlText,
  stringGen,
  type CompetitionBotKind,
  type RoomCompetitionState,
} from "@newchat/shared";
import type { Server, Socket } from "socket.io";
import { emitNotice } from "../lib/socketUtils.js";
import type { CatalogStore } from "./catalogStore.js";
import type { EvaluationEngine } from "./evaluationEngine.js";
import type { PresenceDirectory } from "./presenceDirectory.js";
import type { GatewaySession } from "../types/gateway.js";

interface ActiveCompetitionGame {
  key: string;
  targetType: "room" | "wall";
  targetId: string;
  kind: CompetitionBotKind;
  enabled: boolean;
  roundOpen: boolean;
  roundNumber: number;
  targetPoints: number;
  maxQuestions: number;
  currentPrompt: string;
  acceptedAnswers: string[];
  questionObj?: Record<string, unknown>;
  usedQuestionIndexes: number[];
  recentQuestionIndexes: number[];
  scores: Record<string, { topic: string; uid: string; points: number }>;
  startTimer: NodeJS.Timeout | null;
  roundTimer: NodeJS.Timeout | null;
}

const ROUND_DELAY_MS = 3500;
const ROUND_TIMEOUT_MS = 28_000;

export class CompetitionEngine {
  private readonly io: Server;
  private readonly catalogStore: CatalogStore;
  private readonly presenceDirectory: PresenceDirectory;
  private readonly evaluationEngine: EvaluationEngine;
  private readonly games = new Map<string, ActiveCompetitionGame>();

  constructor(
    io: Server,
    catalogStore: CatalogStore,
    presenceDirectory: PresenceDirectory,
    evaluationEngine: EvaluationEngine,
  ) {
    this.io = io;
    this.catalogStore = catalogStore;
    this.presenceDirectory = presenceDirectory;
    this.evaluationEngine = evaluationEngine;
  }

  private getKey(targetType: "room" | "wall", targetId: string): string {
    return targetType === "wall" ? "wall" : `room:${targetId}`;
  }

  getRoomState(roomId: string | null | undefined): RoomCompetitionState {
    const safeRoom = String(roomId || "").trim();
    if (!safeRoom) return { roomId: null, active: false, kind: "", roundOpen: false };
    const game = this.games.get(`room:${safeRoom}`);
    if (!game || !game.enabled) {
      return { roomId: safeRoom, active: false, kind: "", roundOpen: false, roundNumber: 0 };
    }
    return {
      roomId: safeRoom,
      active: true,
      kind: game.kind,
      roundOpen: game.roundOpen,
      roundNumber: game.roundNumber,
      targetPoints: game.targetPoints,
      maxQuestions: game.maxQuestions,
    };
  }

  emitRoomState(roomId: string): void {
    const state = this.getRoomState(roomId);
    this.io.to(roomId).emit("msg", { cmd: "room_competition_state", data: state });
  }

  private clearTimers(game: ActiveCompetitionGame): void {
    if (game.startTimer) {
      clearTimeout(game.startTimer);
      game.startTimer = null;
    }
    if (game.roundTimer) {
      clearTimeout(game.roundTimer);
      game.roundTimer = null;
    }
  }

  private getBotTitle(kind: CompetitionBotKind): string {
    switch (kind) {
      case "brb":
        return "بوت المسابقة السريعة (BRB)";
      case "capitals":
        return "بوت عواصم الدول";
      case "odd_number":
        return "بوت الرقم المختلف";
      case "general_questions":
        return "بوت الثقافة العامة";
      case "english_word":
        return "بوت الكلمات الإنجليزية";
      case "fast_challenge":
        return "بوت التحدي السريع";
      case "missing_letters":
        return "بوت الحروف الناقصة";
      case "guess_number":
        return "بوت تخمين الرقم";
      case "confession_chair":
        return "بوت كرسي الاعتراف";
      case "lucky_wheel":
        return "بوت عجلة الحظ";
      default:
        return "بوت المسابقات";
    }
  }

  private emitBotAnnouncement(game: ActiveCompetitionGame, text: string, className = "brb-bot-msg"): void {
    const pic = BOT_PICS[game.kind] || "/imgs/brb-bot.svg";
    const topic = this.getBotTitle(game.kind);
    const mi = stringGen(16);
    if (game.targetType === "room") {
      this.io.to(game.targetId).emit("msg", {
        cmd: "msg",
        data: {
          bg: "#fffdf6",
          class: className,
          mi,
          topic,
          msg: sanitizeHtmlText(text),
          ucol: "#b45309",
          mcol: "#1f2937",
          roomid: game.targetId,
          pic,
          uid: "bot_competition",
          time: Date.now(),
        },
      });
    } else {
      this.io.emit("msg", {
        cmd: "bc",
        data: {
          bid: mi,
          lid: "bot_competition",
          uid: "bot_competition",
          topic,
          pic,
          msg: sanitizeHtmlText(text),
          bg: "#fffdf6",
          ucol: "#b45309",
          mcol: "#1f2937",
          likes: [],
          bcc: [],
        },
      });
    }
  }

  private formatScoreboard(game: ActiveCompetitionGame): string {
    const entries = Object.values(game.scores).sort((a, b) => b.points - a.points);
    if (!entries.length) return "لا توجد نقاط مسجلة بعد";
    return entries.slice(0, 8).map((e) => `${e.topic} (${e.points})`).join(" - ");
  }

  private buildNextQuestion(game: ActiveCompetitionGame): { prompt: string; answers: string[]; obj?: Record<string, unknown> } {
    switch (game.kind) {
      case "capitals": {
        const picked = pickUnseenQuestion(CAPITALS_QUESTIONS, game);
        const item = picked.item;
        return {
          prompt: `الجولة #${game.roundNumber}: ما عاصمة دولة ( ${item.country} )؟`,
          answers: [item.capital, ...(item.aliases || [])],
        };
      }
      case "general_questions": {
        const picked = pickUnseenQuestion(GENERAL_QUESTIONS, game);
        return {
          prompt: `الجولة #${game.roundNumber}: ${picked.item.question}`,
          answers: [picked.item.answer, ...(picked.item.aliases || [])],
        };
      }
      case "english_word": {
        const picked = pickUnseenQuestion(ENGLISH_WORD_QUESTIONS, game);
        return {
          prompt: `الجولة #${game.roundNumber}: ما معنى كلمة "${picked.item.word}" بالعربية؟`,
          answers: [picked.item.answer, ...(picked.item.aliases || [])],
        };
      }
      case "fast_challenge": {
        const picked = pickUnseenQuestion(FAST_CHALLENGES, game);
        return {
          prompt: `الجولة #${game.roundNumber}: ${picked.item.prompt}`,
          answers: [picked.item.answer, ...(picked.item.aliases || [])],
        };
      }
      case "odd_number": {
        const q = makeOddNumberQuestion();
        return {
          prompt: `الجولة #${game.roundNumber}: أخرج الرقم المختلف: ${q.sequence}`,
          answers: [q.answer],
          obj: q,
        };
      }
      case "missing_letters": {
        const q = makeMissingLettersQuestion();
        return {
          prompt: `الجولة #${game.roundNumber}: أكمل الكلمة الناقصة: ${q.masked}`,
          answers: [q.answer],
          obj: q,
        };
      }
      case "guess_number": {
        const num = String(Math.floor(Math.random() * 15) + 1);
        return {
          prompt: `الجولة #${game.roundNumber}: خمّن الرقم السري بين 1 و 15!`,
          answers: [num],
        };
      }
      case "confession_chair": {
        const q = CONFESSION_CHAIR_QUESTIONS[Math.floor(Math.random() * CONFESSION_CHAIR_QUESTIONS.length)]!;
        return {
          prompt: `سؤال كرسي الاعتراف #${game.roundNumber}: ${q}`,
          answers: [],
        };
      }
      case "lucky_wheel": {
        const w = LUCKY_WHEEL_RESULTS[Math.floor(Math.random() * LUCKY_WHEEL_RESULTS.length)]!;
        return {
          prompt: `🎡 عجلة الحظ #${game.roundNumber} (${w.title}): ${w.text}`,
          answers: [],
        };
      }
      case "brb":
      default: {
        const code = String(Math.floor(1000 + Math.random() * 9000));
        return {
          prompt: `الجولة #${game.roundNumber}: أسرع من يكتب الرقم ( ${code} )`,
          answers: [code],
        };
      }
    }
  }

  private finishCompetitionByWinner(
    game: ActiveCompetitionGame,
    winner: GatewaySession,
    finalPoints: number,
  ): void {
    this.clearTimers(game);
    game.enabled = false;
    game.roundOpen = false;

    const winnerAnnouncement = `🎉🎉 ألف مبروك للفائز 👑 ( ${winner.topic} ) 👑 لتحقيقه نقاط الفوز المطلوبة (${finalPoints} / ${game.targetPoints} نقاط) وتتويجه بطلاً لـ ${this.getBotTitle(game.kind)}! 🏆\nالترتيب النهائي: ${this.formatScoreboard(game)}`;

    this.emitBotAnnouncement(game, winnerAnnouncement, "brb-winner-msg");

    if (winner.islogin === "عضو") {
      void this.evaluationEngine.awardPoints(winner.id, "game_win");
    }

    this.games.delete(game.key);
    if (game.targetType === "room") {
      this.emitRoomState(game.targetId);
    }
  }

  private finishCompetitionByMaxQuestions(game: ActiveCompetitionGame): void {
    this.clearTimers(game);
    game.enabled = false;
    game.roundOpen = false;

    const entries = Object.values(game.scores).sort((a, b) => b.points - a.points);
    const topPlayer = entries[0];

    let finishText = "";
    if (topPlayer && topPlayer.points > 0) {
      finishText = `🏁 اكتملت جميع الأسئلة المقررة (${game.roundNumber} سؤال)! الفائز بالمركز الأول هو 👑 ( ${topPlayer.topic} ) 👑 برصيد ${topPlayer.points} نقطة! 🏆\nالترتيب النهائي: ${this.formatScoreboard(game)}`;
      if (topPlayer.uid) {
        const topSess = this.presenceDirectory.getLocalSession(topPlayer.uid);
        if (topSess) void this.evaluationEngine.awardPoints(topSess.id, "game_win");
      }
    } else {
      finishText = `🏁 اكتملت جميع الأسئلة المقررة (${game.roundNumber} سؤال) دون تسجيل فائز. شكراً لمشاركتكم وحظاً أوفر في الجولة القادمة! ✨`;
    }

    this.emitBotAnnouncement(game, finishText, "brb-winner-msg");
    this.games.delete(game.key);
    if (game.targetType === "room") {
      this.emitRoomState(game.targetId);
    }
  }

  private scheduleNextRound(game: ActiveCompetitionGame, delayMs = ROUND_DELAY_MS): void {
    this.clearTimers(game);
    if (!game.enabled) return;

    if (game.maxQuestions > 0 && game.roundNumber >= game.maxQuestions) {
      this.finishCompetitionByMaxQuestions(game);
      return;
    }

    game.startTimer = setTimeout(() => {
      if (!game.enabled) return;
      game.roundNumber += 1;
      const q = this.buildNextQuestion(game);
      game.currentPrompt = q.prompt;
      game.acceptedAnswers = q.answers;
      game.questionObj = q.obj;
      game.roundOpen = q.answers.length > 0;

      const roundMeta = game.maxQuestions > 0
        ? `[سؤال ${game.roundNumber}/${game.maxQuestions} • الفوز عند ${game.targetPoints} نقاط]`
        : `[سؤال #${game.roundNumber} • الفوز عند ${game.targetPoints} نقاط]`;
      const promptWithMeta = `${roundMeta}\n${q.prompt}`;

      this.emitBotAnnouncement(game, promptWithMeta);
      if (game.targetType === "room") {
        this.emitRoomState(game.targetId);
      }

      if (game.roundOpen) {
        game.roundTimer = setTimeout(() => {
          if (!game.enabled || !game.roundOpen) return;
          game.roundOpen = false;
          this.emitBotAnnouncement(
            game,
            `انتهى وقت الجولة! الإجابة الصحيحة: ${game.acceptedAnswers[0] || "---"}`,
          );
          if (game.targetType === "room") this.emitRoomState(game.targetId);

          if (game.maxQuestions > 0 && game.roundNumber >= game.maxQuestions) {
            this.finishCompetitionByMaxQuestions(game);
          } else {
            this.scheduleNextRound(game, ROUND_DELAY_MS);
          }
        }, ROUND_TIMEOUT_MS);
        if (typeof game.roundTimer.unref === "function") game.roundTimer.unref();
      } else {
        if (game.maxQuestions > 0 && game.roundNumber >= game.maxQuestions) {
          this.finishCompetitionByMaxQuestions(game);
        } else {
          this.scheduleNextRound(game, 18_000);
        }
      }
    }, delayMs);
    if (typeof game.startTimer.unref === "function") game.startTimer.unref();
  }

  async handleCommand(socket: Socket, data: Record<string, unknown>): Promise<void> {
    const session = this.presenceDirectory.getLocalSession(socket.id);
    if (!session) return;

    const power = this.catalogStore.getPowerRole(session.rank || session.power);
    if (!power || !Number(power.brbbot || 0)) {
      emitNotice(socket, "لا تملك صلاحية تشغيل بوت المسابقات");
      return;
    }

    const op = String(data.op || data.action || "start").trim().toLowerCase();
    const targetType: "room" | "wall" = String(data.targetType || "room") === "wall" ? "wall" : "room";
    const targetId = targetType === "wall" ? "wall" : String(data.targetId || session.roomid || "").trim();
    if (targetType === "room" && !targetId) return;

    const key = this.getKey(targetType, targetId);
    const kindRaw = String(data.kind || data.game || "brb").trim() as CompetitionBotKind;

    if (op === "stop" || op === "off") {
      const existing = this.games.get(key);
      if (existing) {
        this.clearTimers(existing);
        existing.enabled = false;
        existing.roundOpen = false;
        this.emitBotAnnouncement(
          existing,
          `تم إيقاف المسابقة. النتائج النهائية: ${this.formatScoreboard(existing)}`,
        );
        this.games.delete(key);
        if (targetType === "room") this.emitRoomState(targetId);
        emitNotice(socket, "تم إيقاف بوت المسابقات بنجاح 🛑");
      } else {
        emitNotice(socket, "لا توجد مسابقة نشطة حالياً لإيقافها");
      }
      return;
    }

    if (op === "scores" || op === "score") {
      const existing = this.games.get(key);
      if (existing) {
        this.emitBotAnnouncement(existing, `ترتيب النقاط الحالي: ${this.formatScoreboard(existing)}`);
        emitNotice(socket, `ترتيب النقاط الحالي: ${this.formatScoreboard(existing)} 🏆`);
      } else {
        emitNotice(socket, "لا توجد نقاط مسجلة بعد في هذه المسابقة");
      }
      return;
    }

    const previous = this.games.get(key);
    if (previous) {
      this.clearTimers(previous);
    }

    const rawTargetPoints = Number(data.targetPoints || data.points || 5);
    const targetPoints = Math.max(1, Math.min(50, Number.isFinite(rawTargetPoints) ? rawTargetPoints : 5));

    const rawMaxQuestions = Number(data.maxQuestions || data.questions || data.rounds || 10);
    const maxQuestions = Math.max(0, Math.min(100, Number.isFinite(rawMaxQuestions) ? rawMaxQuestions : 10));

    const next: ActiveCompetitionGame = {
      key,
      targetType,
      targetId,
      kind: kindRaw,
      enabled: true,
      roundOpen: false,
      roundNumber: 0,
      targetPoints,
      maxQuestions,
      currentPrompt: "",
      acceptedAnswers: [],
      usedQuestionIndexes: [],
      recentQuestionIndexes: [],
      scores: {},
      startTimer: null,
      roundTimer: null,
    };
    this.games.set(key, next);

    const rulesDesc = maxQuestions > 0
      ? `هدف الفوز: ${targetPoints} نقاط • إجمالي الأسئلة: ${maxQuestions}`
      : `هدف الفوز: ${targetPoints} نقاط • الأسئلة: مستمرة حتى فوز متسابق`;

    this.emitBotAnnouncement(
      next,
      `تم تشغيل ${this.getBotTitle(kindRaw)} بواسطة ${session.topic} — ${rulesDesc} — استعدوا!`,
    );
    if (targetType === "room") this.emitRoomState(targetId);
    this.scheduleNextRound(next, 1800);
    emitNotice(socket, `تم تشغيل ${this.getBotTitle(kindRaw)} بنجاح (${rulesDesc}) 🚀`);
  }

  checkAnswer(
    targetType: "room" | "wall",
    targetId: string,
    sender: GatewaySession,
    rawText: string,
  ): boolean {
    const key = this.getKey(targetType, targetId);
    const game = this.games.get(key);
    if (!game || !game.enabled || !game.roundOpen) return false;

    const cleaned = normalizeBrbText(rawText);
    if (!cleaned) return false;

    let matched = false;
    if (game.kind === "brb" || game.kind === "guess_number") {
      matched = game.acceptedAnswers.some((a) => normalizeCapitalsText(cleaned) === normalizeCapitalsText(a));
    } else if (game.kind === "odd_number") {
      matched = isOddNumberAnswerCorrect(game.questionObj as { answer?: string }, cleaned);
    } else if (game.kind === "missing_letters") {
      matched = isMissingLettersAnswerCorrect(game.questionObj as { answer?: string }, cleaned);
    } else {
      matched = isQuestionAnswerCorrect(game.acceptedAnswers, cleaned);
    }

    if (!matched) return false;

    game.roundOpen = false;
    this.clearTimers(game);

    const scoreKey = sender.uid || sender.lid || sender.id;
    const prevScore = game.scores[scoreKey] || {
      topic: sender.topic,
      uid: sender.uid || sender.id,
      points: 0,
    };
    prevScore.topic = sender.topic;
    prevScore.points += 1;
    game.scores[scoreKey] = prevScore;

    if (sender.islogin === "عضو") {
      void this.evaluationEngine.awardPoints(sender.id, "game_win");
    }

    // CHECK IF WINNING TARGET SCORE REACHED:
    if (game.targetPoints > 0 && prevScore.points >= game.targetPoints) {
      this.finishCompetitionByWinner(game, sender, prevScore.points);
      return true;
    }

    // CHECK IF MAX QUESTIONS REACHED:
    if (game.maxQuestions > 0 && game.roundNumber >= game.maxQuestions) {
      this.emitBotAnnouncement(
        game,
        `🏆 إجابة صحيحة من ${sender.topic} (نقاطه: ${prevScore.points}/${game.targetPoints})`,
        "brb-winner-msg",
      );
      this.finishCompetitionByMaxQuestions(game);
      return true;
    }

    this.emitBotAnnouncement(
      game,
      `🏆 مبروك ${sender.topic}! إجابة صحيحة (نقاطك: ${prevScore.points}/${game.targetPoints}) | المتصدرون: ${this.formatScoreboard(game)}`,
      "brb-winner-msg",
    );

    if (targetType === "room") this.emitRoomState(targetId);
    this.scheduleNextRound(game, ROUND_DELAY_MS);
    return true;
  }
}
