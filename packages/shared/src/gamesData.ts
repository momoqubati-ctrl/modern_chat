import {
  CARROM_BASELINE_OFFSET,
  CARROM_BOARD_SIZE,
  CARROM_MAX_SCORE,
  CARROM_OUTER_MARGIN,
  CARROM_PLAY_MAX,
  CARROM_PLAY_MIN,
  CARROM_POCKET_CAPTURE_RADIUS,
  CARROM_POCKET_FUNNEL_RADIUS,
  CARROM_POCKET_RADIUS,
} from "./constants.js";
import { normalizeCapitalsText, normalizeOddNumberAnswer } from "./textFilter.js";
import type {
  CarromGameState,
  CarromPiece,
  CarromShotInput,
} from "./types.js";

export interface QuestionBankItem {
  question?: string;
  country?: string;
  capital?: string;
  word?: string;
  prompt?: string;
  answer: string;
  aliases?: readonly string[];
}

export const LUCKY_WHEEL_RESULTS: readonly { title: string; text: string }[] = [
  { title: "جائزة خفيفة", text: "يحصل على تصفيق من الجميع ورسالة تهنئة في الغرفة." },
  { title: "تحدي سريع", text: "يرسل جملة لطيفة لأول عضو يرد بعده." },
  { title: "طلب بسيط", text: "يختار عضوا ويقول له كلمة جميلة." },
  { title: "سؤال مرح", text: "يجيب: ما أكثر شيء ضحكك اليوم؟" },
  { title: "دور التحدي", text: "يكتب بيت شعر أو مثل شعبي خلال دقيقة." },
  { title: "هدية معنوية", text: "له لقب نجم الجولة حتى الجولة القادمة." },
  { title: "مهمة تفاعل", text: "يسأل سؤالا عاما ويختار أول من يجاوب." },
  { title: "راحة", text: "نجا من التحدي هذه الجولة، والحظ معه." },
  { title: "اختيار صديق", text: "يختار عضوا آخر ليشاركه التحدي." },
  { title: "رسالة طيبة", text: "يرسل دعوة جميلة أو أمنية طيبة للغرفة." },
];

export const MISSING_LETTERS_WORDS: readonly string[] = [
  "السلام", "مرحبا", "صديق", "محبة", "كرامة", "سعادة", "مدينة", "مدرسة",
  "مكتبة", "حديقة", "نجاح", "تعاون", "احترام", "أمانة", "شجاعة", "قهوة",
  "كتاب", "قلم", "هاتف", "سيارة", "نافذة", "غرفة", "رسالة", "عائلة",
  "وطن", "صباح", "مساء", "جميل", "كبير", "صغير", "قريب", "بعيد",
];

export const ENGLISH_WORD_QUESTIONS: readonly QuestionBankItem[] = [
  { word: "brave", answer: "شجاع", aliases: ["شجاعه", "جريء", "جريئ"] },
  { word: "happy", answer: "سعيد", aliases: ["فرحان", "مسرور", "سعيدة"] },
  { word: "friend", answer: "صديق", aliases: ["صديقه", "رفيق"] },
  { word: "family", answer: "عائلة", aliases: ["اسرة", "أسرة", "اهل"] },
  { word: "school", answer: "مدرسة", aliases: ["المدرسة"] },
  { word: "book", answer: "كتاب", aliases: ["الكتاب"] },
  { word: "water", answer: "ماء", aliases: ["الماء", "مويه"] },
  { word: "food", answer: "طعام", aliases: ["اكل", "أكل"] },
  { word: "city", answer: "مدينة", aliases: ["المدينة"] },
  { word: "home", answer: "منزل", aliases: ["بيت", "البيت"] },
  { word: "morning", answer: "صباح", aliases: ["الصباح"] },
  { word: "night", answer: "ليل", aliases: ["الليل", "مساء"] },
  { word: "beautiful", answer: "جميل", aliases: ["جميله", "رائع", "رائعة"] },
  { word: "small", answer: "صغير", aliases: ["صغيرة"] },
  { word: "large", answer: "كبير", aliases: ["كبيرة", "ضخم"] },
  { word: "fast", answer: "سريع", aliases: ["سريعة"] },
  { word: "slow", answer: "بطيء", aliases: ["بطيئ", "بطيئة"] },
  { word: "clean", answer: "نظيف", aliases: ["نظيفة"] },
  { word: "strong", answer: "قوي", aliases: ["قوية"] },
  { word: "easy", answer: "سهل", aliases: ["سهلة"] },
  { word: "difficult", answer: "صعب", aliases: ["صعبة", "صعيب"] },
  { word: "important", answer: "مهم", aliases: ["مهمة", "هام"] },
  { word: "question", answer: "سؤال", aliases: ["السؤال"] },
  { word: "answer", answer: "إجابة", aliases: ["اجابة", "جواب"] },
  { word: "love", answer: "حب", aliases: ["محبة", "يحب"] },
  { word: "peace", answer: "سلام", aliases: ["السلام"] },
  { word: "time", answer: "وقت", aliases: ["الوقت", "زمن"] },
  { word: "work", answer: "عمل", aliases: ["شغل"] },
  { word: "dream", answer: "حلم", aliases: ["الحلم"] },
  { word: "hope", answer: "أمل", aliases: ["امل", "رجاء"] },
];

export const CAPITALS_QUESTIONS: readonly { country: string; capital: string; aliases?: readonly string[] }[] = [
  { country: "السعودية", capital: "الرياض" },
  { country: "اليمن", capital: "صنعاء", aliases: ["صنعا"] },
  { country: "مصر", capital: "القاهرة" },
  { country: "سوريا", capital: "دمشق" },
  { country: "العراق", capital: "بغداد" },
  { country: "الأردن", capital: "عمان" },
  { country: "لبنان", capital: "بيروت" },
  { country: "فلسطين", capital: "القدس" },
  { country: "الإمارات", capital: "أبوظبي", aliases: ["ابوظبي", "أبو ظبي", "ابو ظبي"] },
  { country: "قطر", capital: "الدوحة" },
  { country: "الكويت", capital: "الكويت" },
  { country: "البحرين", capital: "المنامة" },
  { country: "عمان", capital: "مسقط" },
  { country: "الجزائر", capital: "الجزائر" },
  { country: "المغرب", capital: "الرباط" },
  { country: "تونس", capital: "تونس" },
  { country: "ليبيا", capital: "طرابلس" },
  { country: "السودان", capital: "الخرطوم" },
  { country: "موريتانيا", capital: "نواكشوط" },
  { country: "تركيا", capital: "أنقرة", aliases: ["انقرة"] },
  { country: "فرنسا", capital: "باريس" },
  { country: "ألمانيا", capital: "برلين", aliases: ["المانيا"] },
  { country: "إيطاليا", capital: "روما", aliases: ["ايطاليا"] },
  { country: "إسبانيا", capital: "مدريد", aliases: ["اسبانيا"] },
  { country: "بريطانيا", capital: "لندن" },
  { country: "روسيا", capital: "موسكو" },
  { country: "الصين", capital: "بكين" },
  { country: "اليابان", capital: "طوكيو" },
  { country: "الهند", capital: "نيودلهي", aliases: ["نيودلهى", "نيو دلهي"] },
  { country: "أمريكا", capital: "واشنطن", aliases: ["واشنطن دي سي", "واشنطن العاصمة"] },
];

export const GENERAL_QUESTIONS: readonly QuestionBankItem[] = [
  { question: "ما الكوكب المعروف باسم الكوكب الأحمر؟", answer: "المريخ", aliases: ["كوكب المريخ"] },
  { question: "كم عدد أيام السنة الكبيسة؟", answer: "366", aliases: ["٣٦٦", "ثلاثمائة وستة وستون"] },
  { question: "ما أكبر محيط في العالم؟", answer: "المحيط الهادئ", aliases: ["الهادئ"] },
  { question: "ما اللغة الرسمية في البرازيل؟", answer: "البرتغالية", aliases: ["اللغة البرتغالية"] },
  { question: "كم عدد ألوان قوس قزح؟", answer: "7", aliases: ["٧", "سبعة"] },
  { question: "ما عاصمة اليابان؟", answer: "طوكيو", aliases: ["توكيوا"] },
  { question: "ما الحيوان الملقب بسفينة الصحراء؟", answer: "الجمل", aliases: ["جمل"] },
  { question: "ما العنصر الكيميائي الذي رمزه O؟", answer: "الأكسجين", aliases: ["اكسجين", "الأوكسجين", "اوكسجين"] },
  { question: "كم عدد قارات العالم؟", answer: "7", aliases: ["٧", "سبع", "سبعة"] },
  { question: "ما أسرع حيوان بري؟", answer: "الفهد", aliases: ["فهد", "الشيتا"] },
  { question: "ما أكبر دولة عربية من حيث المساحة؟", answer: "الجزائر", aliases: ["جزائر"] },
  { question: "في أي قارة تقع مصر؟", answer: "أفريقيا", aliases: ["افريقيا", "إفريقيا"] },
  { question: "كم عدد حروف اللغة العربية؟", answer: "28", aliases: ["٢٨", "ثمانية وعشرون"] },
  { question: "ما الغاز الذي تحتاجه النباتات في عملية البناء الضوئي؟", answer: "ثاني أكسيد الكربون", aliases: ["ثاني اكسيد الكربون", "co2"] },
  { question: "ما أكبر عضو في جسم الإنسان؟", answer: "الجلد", aliases: ["جلد"] },
  { question: "ما اسم أول شهر في السنة الميلادية؟", answer: "يناير", aliases: ["كانون الثاني", "جانفي"] },
  { question: "كم دقيقة في الساعة الواحدة؟", answer: "60", aliases: ["٦٠", "ستون"] },
  { question: "ما عاصمة المملكة العربية السعودية؟", answer: "الرياض", aliases: ["رياض"] },
  { question: "ما البحر الذي يفصل بين السعودية والسودان؟", answer: "البحر الأحمر", aliases: ["الأحمر", "بحر الأحمر"] },
  { question: "ما الجهاز المسؤول عن ضخ الدم في جسم الإنسان؟", answer: "القلب", aliases: ["قلب"] },
];

export const FAST_CHALLENGES: readonly QuestionBankItem[] = [
  { prompt: "اكتب الكلمة المعكوسة: ةبحم", answer: "محبة" },
  { prompt: "اكتب الكلمة المعكوسة: مالس", answer: "سلام" },
  { prompt: "اكتب الكلمة المعكوسة: ةقادص", answer: "صداقة" },
  { prompt: "رتب الحروف لتكوين كلمة: م ل ق", answer: "قلم" },
  { prompt: "رتب الحروف لتكوين كلمة: ب ا ت ك", answer: "كتاب" },
  { prompt: "رتب الحروف لتكوين كلمة: ة ف ر غ", answer: "غرفة" },
  { prompt: "أكمل المثل: الصديق وقت ...", answer: "الضيق" },
  { prompt: "أكمل المثل: في العجلة ...", answer: "الندامة" },
  { prompt: "أكمل المثل: من جد ...", answer: "وجد" },
  { prompt: "سؤال سريع: كم دقيقة في الساعة؟", answer: "60", aliases: ["٦٠", "ستون"] },
  { prompt: "سؤال سريع: كم يوم في الأسبوع؟", answer: "7", aliases: ["٧", "سبعة"] },
  { prompt: "سؤال سريع: ما لون السماء غالبا في النهار؟", answer: "أزرق", aliases: ["ازرق", "الأزرق"] },
  { prompt: "اكتب كلمة تبدأ بحرف م وتنتهي بحرف ة", answer: "مدرسة", aliases: ["محبة", "مدينة", "مكتبة"] },
  { prompt: "اكتب كلمة تبدأ بحرف س وتنتهي بحرف م", answer: "سلام" },
  { prompt: "ما الكلمة الناقصة: ال... عليكم", answer: "سلام", aliases: ["السلام"] },
  { prompt: "ما الكلمة الناقصة: صباح ...", answer: "الخير", aliases: ["خير"] },
  { prompt: "تحدي أرقام: 5 + 7 = ؟", answer: "12", aliases: ["١٢", "اثنا عشر"] },
  { prompt: "تحدي أرقام: 9 - 4 = ؟", answer: "5", aliases: ["٥", "خمسة"] },
  { prompt: "تحدي أرقام: 3 × 3 = ؟", answer: "9", aliases: ["٩", "تسعة"] },
  { prompt: "أسرع واحد يكتب: حاضر", answer: "حاضر" },
];

export const CONFESSION_CHAIR_QUESTIONS: readonly string[] = [
  "ما أكثر شيء يضحكك بسرعة؟",
  "من أكثر عضو تحب سوالفه في الغرفة؟",
  "لو ربحت جائزة اليوم، ماذا ستفعل بها؟",
  "ما أفضل بلد تحب تزوره؟",
  "اختر عضوًا ووجه له كلمة لطيفة.",
  "ما أكثر موقف جميل صار لك في الدردشة؟",
  "ما الشيء الذي تحب أن يتغير في يومك؟",
  "ما أغنية أو مقطع يغير مزاجك؟",
  "لو تقدر تختار لقب جديد لنفسك، ماذا تختار؟",
  "من العضو الذي تتوقع أنه أسرع شخص يرد؟",
  "ما أكثر أكلة تحبها؟",
  "ما أجمل صفة تحبها في أصدقائك؟",
  "لو عندك رسالة واحدة للجميع الآن، ماذا تقول؟",
  "ما أكثر شيء يحمسك للدخول إلى الغرفة؟",
  "اختر عضوًا واسأله سؤالًا لطيفًا.",
  "ما الشيء الذي تتمنى تتعلمه قريبًا؟",
  "هل تفضل السهر أم الصباح؟",
  "ما أكثر كلمة تستخدمها في الدردشة؟",
  "لو كانت عندك دقيقة شهرة داخل الشات، ماذا ستقول؟",
  "ما نوع التحديات التي تحبها أكثر؟",
];

export function pickUnseenQuestion<T>(
  bank: readonly T[],
  state: { usedQuestionIndexes?: number[]; recentQuestionIndexes?: number[] },
): { index: number; item: T } {
  if (!Array.isArray(state.usedQuestionIndexes)) {
    state.usedQuestionIndexes = [];
  }
  if (!Array.isArray(state.recentQuestionIndexes)) {
    state.recentQuestionIndexes = [];
  }
  const used = state.usedQuestionIndexes;
  const recent = state.recentQuestionIndexes;
  const recentLimit = Math.max(4, Math.min(8, Math.floor(bank.length / 4) || 4));
  let available: number[] = [];
  for (let i = 0; i < bank.length; i += 1) {
    if (!used.includes(i) && !recent.includes(i)) {
      available.push(i);
    }
  }
  if (!available.length) {
    for (let i = 0; i < bank.length; i += 1) {
      if (!recent.includes(i)) {
        available.push(i);
      }
    }
  }
  if (!available.length) {
    state.usedQuestionIndexes = [];
    state.recentQuestionIndexes = [];
    available = bank.map((_, idx) => idx);
  }
  const pickedIndex = available[Math.floor(Math.random() * available.length)] ?? 0;
  state.usedQuestionIndexes.push(pickedIndex);
  state.recentQuestionIndexes.push(pickedIndex);
  if (state.recentQuestionIndexes.length > recentLimit) {
    state.recentQuestionIndexes = state.recentQuestionIndexes.slice(
      state.recentQuestionIndexes.length - recentLimit,
    );
  }
  return { index: pickedIndex, item: bank[pickedIndex]! };
}

export function isQuestionAnswerCorrect(
  acceptedAnswers: readonly (string | undefined)[],
  answerText: string,
): boolean {
  const answer = normalizeCapitalsText(answerText);
  if (!answer) return false;
  for (const candidate of acceptedAnswers) {
    if (candidate && normalizeCapitalsText(candidate) === answer) {
      return true;
    }
  }
  return false;
}

export function makeMissingLettersQuestion(): { masked: string; answer: string } {
  const word =
    MISSING_LETTERS_WORDS[Math.floor(Math.random() * MISSING_LETTERS_WORDS.length)] ||
    "السلام";
  const letters = Array.from(word);
  const candidates: number[] = [];
  for (let i = 0; i < letters.length; i += 1) {
    if (/\s/.test(letters[i]!)) continue;
    if (letters.length > 4 && (i === 0 || i === letters.length - 1)) continue;
    candidates.push(i);
  }
  const hideCount = Math.max(1, Math.min(3, Math.floor(letters.length / 3)));
  const hidden: number[] = [];
  while (hidden.length < hideCount && candidates.length) {
    const pickIndex = Math.floor(Math.random() * candidates.length);
    hidden.push(candidates.splice(pickIndex, 1)[0]!);
  }
  for (const index of hidden) {
    letters[index] = "_";
  }
  return { masked: letters.join(""), answer: word };
}

export function isMissingLettersAnswerCorrect(
  question: { answer?: string } | null | undefined,
  answerText: string,
): boolean {
  if (!question?.answer) return false;
  return normalizeCapitalsText(answerText) === normalizeCapitalsText(question.answer);
}

export function makeOddNumberQuestion(): { sequence: string; answer: string } {
  const repeatedDigit = String(Math.floor(Math.random() * 10));
  let answer = String(Math.floor(Math.random() * 10));
  while (answer === repeatedDigit) {
    answer = String(Math.floor(Math.random() * 10));
  }
  const leftCount = Math.floor(Math.random() * 8) + 7;
  const rightCount = Math.floor(Math.random() * 8) + 7;
  const sequence =
    repeatedDigit.repeat(leftCount) + answer + repeatedDigit.repeat(rightCount);
  return { sequence, answer };
}

export function isOddNumberAnswerCorrect(
  question: { answer?: string } | null | undefined,
  answerText: string,
): boolean {
  if (!question?.answer) return false;
  return String(normalizeOddNumberAnswer(answerText)) === String(question.answer);
}

// ---------- Carrom 620x620 Simulation ----------

export function createCarromInitialPieces(): CarromPiece[] {
  const center = CARROM_BOARD_SIZE / 2;
  const pieces: CarromPiece[] = [];
  let darkIdx = 1;
  let lightIdx = 1;
  const discRadius = 14;
  const stepX = 31;
  const stepY = 27;
  const rows: Array<{
    y: number;
    cells: Array<{ x: number; kind: "dark" | "light" | "queen" }>;
  }> = [
    {
      y: -2 * stepY,
      cells: [
        { x: -stepX, kind: "dark" },
        { x: 0, kind: "light" },
        { x: stepX, kind: "dark" },
      ],
    },
    {
      y: -stepY,
      cells: [
        { x: -1.5 * stepX, kind: "light" },
        { x: -0.5 * stepX, kind: "dark" },
        { x: 0.5 * stepX, kind: "light" },
        { x: 1.5 * stepX, kind: "light" },
      ],
    },
    {
      y: 0,
      cells: [
        { x: -2 * stepX, kind: "dark" },
        { x: -stepX, kind: "light" },
        { x: 0, kind: "queen" },
        { x: stepX, kind: "dark" },
        { x: 2 * stepX, kind: "dark" },
      ],
    },
    {
      y: stepY,
      cells: [
        { x: -1.5 * stepX, kind: "light" },
        { x: -0.5 * stepX, kind: "dark" },
        { x: 0.5 * stepX, kind: "light" },
        { x: 1.5 * stepX, kind: "light" },
      ],
    },
    {
      y: 2 * stepY,
      cells: [
        { x: -stepX, kind: "dark" },
        { x: 0, kind: "light" },
        { x: stepX, kind: "dark" },
      ],
    },
  ];
  for (const row of rows) {
    for (const cell of row.cells) {
      const kind = cell.kind;
      const id =
        kind === "queen"
          ? "queen"
          : `${kind}-${kind === "dark" ? darkIdx++ : lightIdx++}`;
      pieces.push({
        id,
        kind,
        x: center + cell.x,
        y: center + row.y,
        r: kind === "queen" ? 15 : discRadius,
        alive: true,
      });
    }
  }
  return pieces;
}

export function createCarromGame(roomId: string, starterTopic = ""): CarromGameState {
  return {
    key: "room:" + String(roomId || ""),
    roomId: String(roomId || ""),
    status: "waiting",
    players: [],
    scores: [0, 0],
    turnSeat: 0,
    shotInProgress: false,
    winnerSeat: null,
    winnerTopic: "",
    pieces: createCarromInitialPieces(),
    lastActionText: "تم تجهيز طاولة الكيرم بواسطة " + String(starterTopic || ""),
    queenPocketed: false,
    queenCoveredBy: null,
    strikerFouled: false,
    turnTimerStartedAt: 0,
    updatedAt: Date.now(),
  };
}

export function resetCarromRoundState(game: CarromGameState, message?: string): void {
  game.pieces = createCarromInitialPieces();
  game.scores = [0, 0];
  game.turnSeat = 0;
  game.shotInProgress = false;
  game.winnerSeat = null;
  game.winnerTopic = "";
  game.queenPocketed = false;
  game.queenCoveredBy = null;
  game.strikerFouled = false;
  game.turnTimerStartedAt = game.players && game.players.length >= 2 ? Date.now() : 0;
  game.status = game.players && game.players.length >= 2 ? "active" : "waiting";
  game.lastActionText = String(
    message || "تمت إعادة ترتيب أقراص الكيرم لبداية جولة جديدة.",
  );
  game.updatedAt = Date.now();
}

export function carromClamp(value: unknown, min: number, max: number): number {
  const num = Number(value || 0);
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

interface SimDisc {
  id: string;
  kind: string;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alive: boolean;
  mass: number;
}

export function resolveCarromDiscCollision(a: SimDisc, b: SimDisc): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  const minDist = a.r + b.r;
  if (dist >= minDist) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;
  a.x -= nx * (overlap / 2);
  a.y -= ny * (overlap / 2);
  b.x += nx * (overlap / 2);
  b.y += ny * (overlap / 2);
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal > 0) return;
  const aMass = Number(a.mass || 1);
  const bMass = Number(b.mass || 1);
  const restitution = 0.985;
  const impulse = (-(1 + restitution) * velAlongNormal) / (1 / aMass + 1 / bMass);
  a.vx -= (impulse * nx) / aMass;
  a.vy -= (impulse * ny) / aMass;
  b.vx += (impulse * nx) / bMass;
  b.vy += (impulse * ny) / bMass;
  const tangentX = rvx - velAlongNormal * nx;
  const tangentY = rvy - velAlongNormal * ny;
  const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
  const tx = tangentX / tangentLen;
  const ty = tangentY / tangentLen;
  const tangentVel = rvx * tx + rvy * ty;
  const friction = 0.015;
  const frictionImpulse = tangentVel * friction;
  a.vx += (frictionImpulse * tx) / aMass;
  a.vy += (frictionImpulse * ty) / aMass;
  b.vx -= (frictionImpulse * tx) / bMass;
  b.vy -= (frictionImpulse * ty) / bMass;
}

export function shouldCaptureCarromDisc(
  disc: Pick<SimDisc, "x" | "y" | "vx" | "vy" | "kind" | "alive">,
  pocket: { x: number; y: number },
): boolean {
  if (!disc || !pocket || disc.alive === false) return false;
  const dx = disc.x - pocket.x;
  const dy = disc.y - pocket.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const r =
    disc.kind === "striker" ? CARROM_POCKET_RADIUS : CARROM_POCKET_CAPTURE_RADIUS;
  if (dist <= r) return true;
  if (disc.kind === "striker") return false;
  if (dist > CARROM_POCKET_FUNNEL_RADIUS) return false;
  const toward =
    (disc.vx || 0) * (pocket.x - disc.x) + (disc.vy || 0) * (pocket.y - disc.y);
  if (toward <= 0) return false;
  const cx = pocket.x < CARROM_BOARD_SIZE / 2 ? CARROM_PLAY_MIN : CARROM_PLAY_MAX;
  const cy = pocket.y < CARROM_BOARD_SIZE / 2 ? CARROM_PLAY_MIN : CARROM_PLAY_MAX;
  const nx = Math.abs(disc.x - cx) <= 22;
  const ny = Math.abs(disc.y - cy) <= 22;
  const diag = Math.abs(Math.abs(dx) - Math.abs(dy)) <= 22;
  const vel = Math.abs(disc.vx || 0) + Math.abs(disc.vy || 0);
  return (nx || ny || diag) && vel > 0.03;
}

export function maybeFinishCarromGame(game: CarromGameState): boolean {
  const remaining = (game.pieces || []).filter(
    (p) => p.alive !== false && p.kind !== "striker",
  );
  const s0 = Number.parseInt(String(game.scores[0] ?? 0), 10) || 0;
  const s1 = Number.parseInt(String(game.scores[1] ?? 0), 10) || 0;
  const maxScore = s0 >= CARROM_MAX_SCORE || s1 >= CARROM_MAX_SCORE;
  if (!remaining.length || maxScore) {
    game.status = "finished";
    game.shotInProgress = false;
    game.turnTimerStartedAt = 0;
    game.winnerSeat =
      s0 === s1 ? Number.parseInt(String(game.turnSeat ?? 0), 10) || 0 : s0 > s1 ? 0 : 1;
    const winner = (game.players || []).find((p) => p.seat === game.winnerSeat);
    game.winnerTopic =
      (winner && winner.topic) || "المقعد " + (game.winnerSeat + 1);
    game.lastActionText = "انتهت المباراة. الفائز: " + game.winnerTopic;
    game.updatedAt = Date.now();
    return true;
  }
  return false;
}

export function simulateCarromShot(
  game: CarromGameState,
  seat: number,
  shotData: CarromShotInput,
  playerTopic: string,
): { finished: boolean; strikerPocketed: boolean; pocketed: string[] } {
  const angleDeg = Number.parseFloat(String(shotData?.angle ?? -90)) || -90;
  const powerValue = Number.parseFloat(String(shotData?.power ?? 64)) || 64;
  const offsetValue = Number.parseFloat(String(shotData?.offset ?? 0)) || 0;
  const rawPullDx = Number(shotData?.pullDx);
  const rawPullDy = Number(shotData?.pullDy);
  const rawPullPower = Number(shotData?.pullPower);
  const angle = carromClamp(angleDeg, -359, 359) * (Math.PI / 180);
  const power = carromClamp(powerValue, 18, 100);
  const offset = carromClamp(offsetValue, -220, 220);

  let lDx = Math.cos(angle);
  let lDy = Math.sin(angle);
  let lSpd = power * 0.205;
  if (Number.isFinite(rawPullDx) && Number.isFinite(rawPullDy)) {
    const pullLen = Math.sqrt(rawPullDx * rawPullDx + rawPullDy * rawPullDy);
    if (pullLen > 0.001) {
      lDx = rawPullDx / pullLen;
      lDy = rawPullDy / pullLen;
      lSpd =
        carromClamp(
          Number.isFinite(rawPullPower) ? rawPullPower : pullLen,
          18,
          240,
        ) * 0.105;
    }
  }

  const striker: SimDisc = {
    id: "striker",
    kind: "striker",
    x: carromClamp(
      CARROM_BOARD_SIZE / 2 + offset * 0.92,
      CARROM_PLAY_MIN + 22,
      CARROM_PLAY_MAX - 22,
    ),
    y:
      seat === 0
        ? CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - CARROM_BASELINE_OFFSET
        : CARROM_OUTER_MARGIN + CARROM_BASELINE_OFFSET,
    r: 18,
    vx: lDx * lSpd,
    vy: lDy * lSpd,
    alive: true,
    mass: 1.25,
  };

  const discs: SimDisc[] = (game.pieces || [])
    .filter((p) => p.alive !== false)
    .map((p) => ({
      id: p.id,
      kind: String(p.kind),
      x: Number(p.x || 0),
      y: Number(p.y || 0),
      r: Number(p.r || 14),
      vx: 0,
      vy: 0,
      alive: true,
      mass: p.kind === "queen" ? 0.98 : 1,
    }));
  discs.push(striker);

  const pockets = [
    { x: CARROM_OUTER_MARGIN + 10, y: CARROM_OUTER_MARGIN + 10 },
    { x: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10, y: CARROM_OUTER_MARGIN + 10 },
    { x: CARROM_OUTER_MARGIN + 10, y: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10 },
    {
      x: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10,
      y: CARROM_BOARD_SIZE - CARROM_OUTER_MARGIN - 10,
    },
  ];

  const pocketed: string[] = [];
  let strikerPocketed = false;
  const dt = 0.055;
  const substeps = 3;

  for (let step = 0; step < 2400; step += 1) {
    for (let sub = 0; sub < substeps; sub += 1) {
      for (let i = 0; i < discs.length; i += 1) {
        const d = discs[i]!;
        if (!d.alive) continue;
        for (let p = 0; p < pockets.length; p += 1) {
          const pdx = pockets[p]!.x - d.x;
          const pdy = pockets[p]!.y - d.y;
          const pDist = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
          if (pDist < 108) {
            const pb = d.kind === "striker" ? 0.016 : 0.068;
            const pull = ((108 - pDist) / 108) * pb;
            d.vx += (pdx / pDist) * pull * dt;
            d.vy += (pdy / pDist) * pull * dt;
          }
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        const spd = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
        const damp = spd > 3 ? 0.9989 : 0.9978;
        d.vx *= damp;
        d.vy *= damp;
        if (spd < 0.03) {
          d.vx *= 0.94;
          d.vy *= 0.94;
        }
        if (d.x <= CARROM_PLAY_MIN + d.r || d.x >= CARROM_PLAY_MAX - d.r) {
          const py = d.y < CARROM_PLAY_MIN + 66 || d.y > CARROM_PLAY_MAX - 66;
          if (!py) {
            d.vx *= -0.92;
            d.vy *= 0.997;
            d.x = carromClamp(d.x, CARROM_PLAY_MIN + d.r, CARROM_PLAY_MAX - d.r);
          }
        }
        if (d.y <= CARROM_PLAY_MIN + d.r || d.y >= CARROM_PLAY_MAX - d.r) {
          const px = d.x < CARROM_PLAY_MIN + 66 || d.x > CARROM_PLAY_MAX - 66;
          if (!px) {
            d.vy *= -0.92;
            d.vx *= 0.997;
            d.y = carromClamp(d.y, CARROM_PLAY_MIN + d.r, CARROM_PLAY_MAX - d.r);
          }
        }
      }

      for (let pass = 0; pass < 4; pass += 1) {
        for (let a = 0; a < discs.length; a += 1) {
          if (!discs[a]!.alive) continue;
          for (let b = a + 1; b < discs.length; b += 1) {
            if (!discs[b]!.alive) continue;
            resolveCarromDiscCollision(discs[a]!, discs[b]!);
          }
        }
      }

      for (let i = 0; i < discs.length; i += 1) {
        const d = discs[i]!;
        if (!d.alive) continue;
        for (let p = 0; p < pockets.length; p += 1) {
          if (shouldCaptureCarromDisc(d, pockets[p]!)) {
            d.alive = false;
            d.vx = 0;
            d.vy = 0;
            if (d.kind === "striker") strikerPocketed = true;
            else pocketed.push(d.kind);
            break;
          }
        }
      }
    }

    let moving = false;
    for (let m = 0; m < discs.length; m += 1) {
      if (
        discs[m]!.alive &&
        (Math.abs(discs[m]!.vx) > 0.006 || Math.abs(discs[m]!.vy) > 0.006)
      ) {
        moving = true;
        break;
      }
    }
    if (!moving) break;
  }

  game.pieces = discs
    .filter((d) => d.kind !== "striker" && d.alive)
    .map((d) => ({
      id: d.id,
      kind: d.kind as CarromPiece["kind"],
      x: carromClamp(d.x, CARROM_PLAY_MIN + d.r, CARROM_PLAY_MAX - d.r),
      y: carromClamp(d.y, CARROM_PLAY_MIN + d.r, CARROM_PLAY_MAX - d.r),
      r: d.r,
      alive: true,
    }));

  const qIn = pocketed.includes("queen");
  const nq = pocketed.filter((k) => k !== "queen").length;
  if (qIn && !game.queenPocketed) {
    if (nq > 0 && !strikerPocketed) {
      game.queenPocketed = true;
      game.queenCoveredBy = seat;
    } else {
      game.pieces.push({
        id: "queen",
        kind: "queen",
        x: CARROM_BOARD_SIZE / 2,
        y: CARROM_BOARD_SIZE / 2,
        r: 15,
        alive: true,
      });
      const idx = pocketed.indexOf("queen");
      if (idx !== -1) pocketed.splice(idx, 1);
    }
  } else if (game.queenPocketed && game.queenCoveredBy === null && nq > 0 && !strikerPocketed) {
    game.queenCoveredBy = seat;
  }

  game.strikerFouled = strikerPocketed;
  const scoreV = nq + (qIn && game.queenCoveredBy === seat ? 3 : 0);
  if (scoreV > 0) {
    game.scores[seat] =
      (Number.parseInt(String(game.scores[seat] ?? 0), 10) || 0) + scoreV;
  }
  if (strikerPocketed) {
    game.scores[seat] = Math.max(
      0,
      (Number.parseInt(String(game.scores[seat] ?? 0), 10) || 0) - 1,
    );
  }
  if (!(scoreV > 0 && !strikerPocketed)) {
    game.turnSeat = seat === 0 ? 1 : 0;
  }
  game.shotInProgress = false;
  game.turnTimerStartedAt = game.status === "active" ? Date.now() : 0;

  if (strikerPocketed && scoreV > 0) {
    game.lastActionText = `نجح ${playerTopic} ولكن سقط السترايكر - تبديل الدور.`;
  } else if (strikerPocketed) {
    game.lastActionText = `سقط سترايكر ${playerTopic} - خصم نقطة.`;
  } else if (qIn && game.queenCoveredBy !== seat) {
    game.lastActionText = `${playerTopic} لم يغطِ الملكة - عادت للمنتصف.`;
  } else if (qIn && game.queenCoveredBy === seat) {
    game.lastActionText = `🎯 ${playerTopic} غطى الملكة! +3 نقاط.`;
  } else if (scoreV > 0) {
    game.lastActionText = `✅ ${playerTopic} سجل ${scoreV} ويستمر.`;
  } else {
    game.lastActionText = "❌ لم تسجل. الدور لخصمك.";
  }

  game.updatedAt = Date.now();
  const finished = maybeFinishCarromGame(game);
  return { finished, strikerPocketed, pocketed };
}
