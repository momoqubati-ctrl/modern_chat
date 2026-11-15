import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Bot,
  ChevronRight,
  Gamepad2,
  HelpCircle,
  Music,
  Palette,
  RefreshCw,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { CarromArenaClient, useChatStore } from "@newchat/core-client";
import { isSoundMuted, playSoundCue, setSoundMuted } from "../../lib/soundFx.js";
import { resolveAssetUrl, resolveGatewayBaseUrl } from "../../lib/mediaUrl.js";
import {
  drawActiveLayer,
  drawBgLayer,
  drawBoardLinesLayer,
  getLoadedBoardAssets,
  preloadBoardAssets,
  type LoadedBoardAssets,
} from "./boardRenderer.js";
import {
  BASELINE_DEFAULT_X,
  BASELINE_MAX_X,
  BASELINE_MIN_X,
  BASELINE_Y,
  BOARD_SIZE,
  COIN_COLORS,
  COIN_RADIUS,
  applySnapshotToState,
  clampBoardNum,
  computeBlueFoulCoinIndices,
  computeShotVelocity,
  createInitialDiscs,
  createInitialPlayers,
  createMatchRuntimeState,
  dist2D,
  findAvailableBaselineX,
  isStrikerOverlapping,
  planAiShot,
  serializeSnapshot,
  stepCarromPhysicsFrame,
  type MatchRuntimeState,
} from "./engine.js";
import { carromSoundPool } from "./soundPool.js";
import type {
  BackdropThemeId,
  BoardSkinId,
  CarromChatMessage,
  CarromPlayerProfile,
  CarromSnapshot,
  CarromWaitingRoom,
  InteractionPhase,
  PlayerScoreState,
  PotBurstEffect,
  RoseSkinId,
} from "./types.js";
import "./carrom.css";

interface CarromGameExperienceProps {
  onExit: () => void;
  exitLabel?: string;
}

const QUICK_CHAT_PHRASES = [
  "حظاً موفقاً 👍",
  "ضربة رائعة! 🔥",
  "قريباً من الجيب 🎯",
  "العب بتركيز ⚡",
] as const;

const BOARD_SKIN_LABELS: Array<{ id: BoardSkinId; label: string; swatch: string }> = [
  { id: "wood1", label: "خشب كلاسيكي", swatch: "#d9b482" },
  { id: "wood2", label: "جوزي داكن", swatch: "#9f6c43" },
  { id: "cream", label: "عاجي هادئ", swatch: "#ebdfc3" },
];

const BACKDROP_THEME_LABELS: Array<{ id: BackdropThemeId; label: string; swatch: string }> = [
  { id: "crimson", label: "ملكي قرمزي", swatch: "#5c1a0e" },
  { id: "midnight", label: "ليلي حديث", swatch: "#0f172a" },
  { id: "emerald", label: "زمردي كلاسيك", swatch: "#064e3b" },
];

function getInitialsAvatar(name: string): string {
  const clean = (name || "P").trim();
  const parts = clean.split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p.charAt(0).toUpperCase()).join("") || "P";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#0f766e"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="36" font-weight="bold" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getSafeAvatarSrc(pic: string | undefined, name: string): string {
  if (!pic || !pic.trim() || pic.trim() === "pic.png") {
    return getInitialsAvatar(name);
  }
  return resolveAssetUrl(pic, "pic", getInitialsAvatar(name));
}

const TURN_DURATION_MS = 20_000;
const TIMER_RING_RADIUS = 19;
const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * TIMER_RING_RADIUS;

interface AvatarWithTurnTimerProps {
  avatarSrc: string;
  name: string;
  isActiveTurn: boolean;
  deadlineAt: number | null;
  durationMs: number;
  secsLeft: number | null;
  serverOffsetMs: number;
  inactiveBorderClass?: string;
}

function AvatarWithTurnTimer({
  avatarSrc,
  name,
  isActiveTurn,
  deadlineAt,
  durationMs,
  secsLeft,
  serverOffsetMs,
  inactiveBorderClass = "border-white/25",
}: AvatarWithTurnTimerProps) {
  const circleRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    const circle = circleRef.current;
    if (!isActiveTurn || deadlineAt === null || !circle) return;

    let raf = 0;
    const total = Math.max(1000, durationMs);

    const drawProgress = () => {
      const serverNow = Date.now() + serverOffsetMs;
      const remaining = Math.max(0, deadlineAt - serverNow);
      const ratio = Math.min(1, remaining / total);
      const offset = TIMER_RING_CIRCUMFERENCE * (1 - ratio);
      circle.style.strokeDashoffset = `${offset}`;
      circle.style.stroke =
        remaining <= 5000 ? "#f43f5e" : remaining <= 10_000 ? "#f59e0b" : "#10b981";
      if (remaining > 0) {
        raf = requestAnimationFrame(drawProgress);
      }
    };

    raf = requestAnimationFrame(drawProgress);
    return () => cancelAnimationFrame(raf);
  }, [isActiveTurn, deadlineAt, durationMs, serverOffsetMs]);

  const urgent = isActiveTurn && secsLeft !== null && secsLeft <= 5;

  return (
    <div className="carrom-avatar-ring-wrap">
      {isActiveTurn && deadlineAt !== null && (
        <svg className="carrom-timer-svg" viewBox="0 0 44 44" aria-hidden="true">
          <circle
            cx="22"
            cy="22"
            r={TIMER_RING_RADIUS}
            fill="none"
            stroke="rgba(255, 255, 255, 0.16)"
            strokeWidth="3.2"
          />
          <circle
            ref={circleRef}
            cx="22"
            cy="22"
            r={TIMER_RING_RADIUS}
            fill="none"
            stroke="#10b981"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray={TIMER_RING_CIRCUMFERENCE}
            strokeDashoffset={0}
          />
        </svg>
      )}
      <img
        src={avatarSrc}
        alt={name}
        className={`w-9 h-9 rounded-full object-cover border ${
          isActiveTurn ? "border-amber-300/90" : inactiveBorderClass
        }`}
      />
      {isActiveTurn && secsLeft !== null && (
        <span className={`carrom-timer-badge ${urgent ? "carrom-timer-badge--urgent" : ""}`}>
          {secsLeft}s
        </span>
      )}
    </div>
  );
}

export function CarromGameExperience({
  onExit,
  exitLabel = "إغلاق",
}: CarromGameExperienceProps) {
  const me = useChatStore((s) => s.me);

  // Canvas refs (layered rendering architecture: 0 re-renders during 60fps loop)
  const ambientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable simulation & interaction refs
  const clientRef = useRef<CarromArenaClient | null>(null);
  const assetsRef = useRef<LoadedBoardAssets>(getLoadedBoardAssets());
  const runtimeRef = useRef<MatchRuntimeState>(createMatchRuntimeState());
  const potBurstsRef = useRef<PotBurstEffect[]>([]);
  const phaseRef = useRef<InteractionPhase>("idle");
  const overlapRef = useRef(false);
  const aimPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragModeRef = useRef<{
    active: boolean;
    pointerId: number;
    downX: number;
    downY: number;
    moved: boolean;
    nearStriker: boolean;
  } | null>(null);
  const lastPlaceEmitAtRef = useRef(0);
  const lastAimEmitAtRef = useRef(0);
  const physicsRafRef = useRef<number | null>(null);
  const burstRafRef = useRef<number | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs synced with React state for socket callbacks
  const aiModeRef = useRef(false);
  const roomJoinedRef = useRef(false);
  const roomReadyRef = useRef(false);
  const mySlotRef = useRef<number | null>(null);
  const currentRoomIdRef = useRef("");
  const myProfileRef = useRef<{ name: string; pic: string }>({ name: "لاعب", pic: "" });
  const serverOffsetMsRef = useRef(0);
  const turnDeadlineAtRef = useRef<number | null>(null);
  const turnDurationMsRef = useRef(TURN_DURATION_MS);
  const leaveAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLeaveNoticeAtRef = useRef(0);

  // UI React states (updated only on discrete transitions)
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [aiMode, setAiMode] = useState(false);
  const [roomJoined, setRoomJoined] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState("");
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [waitingRooms, setWaitingRooms] = useState<CarromWaitingRoom[]>([]);
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [matchProfiles, setMatchProfiles] = useState<[CarromPlayerProfile, CarromPlayerProfile]>([
    { playerName: "اللاعب 1", playerAvatar: "" },
    { playerName: "اللاعب 2", playerAvatar: "" },
  ]);
  const [scores, setScores] = useState<[PlayerScoreState, PlayerScoreState]>(() => createInitialPlayers());
  const [currPlayer, setCurrPlayer] = useState<0 | 1>(0);
  const [phase, setPhase] = useState<InteractionPhase>("idle");
  const [strikerSliderX, setStrikerSliderX] = useState(BASELINE_DEFAULT_X);
  const [strikerOverlap, setStrikerOverlap] = useState(false);
  const [aimPowerPct, setAimPowerPct] = useState(0);
  const [statusMsg, setStatusMsg] = useState("اختر طريقة اللعب للبدء");
  const [turnDeadlineAt, setTurnDeadlineAt] = useState<number | null>(null);
  const [turnDurationMs, setTurnDurationMs] = useState(TURN_DURATION_MS);
  const [turnSecsLeft, setTurnSecsLeft] = useState<number | null>(null);
  const [leaveAlert, setLeaveAlert] = useState<{
    name: string;
    avatar: string;
    message: string;
  } | null>(null);
  const [lobbyError, setLobbyError] = useState("");
  const [showLobby, setShowLobby] = useState(true);
  const [showVsOverlay, setShowVsOverlay] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [winnerIdx, setWinnerIdx] = useState<0 | 1 | null>(null);

  // Customization & Audio state
  const [boardSkin, setBoardSkin] = useState<BoardSkinId>("wood1");
  const [roseSkin, setRoseSkin] = useState<RoseSkinId>("classic");
  const [backdropTheme, setBackdropTheme] = useState<BackdropThemeId>("crimson");
  const [sfxMuted, setSfxMuted] = useState(() => isSoundMuted());
  const [bgmOn, setBgmOn] = useState(false);

  // Inline chat
  const [chatMsgs, setChatMsgs] = useState<CarromChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const myName = useMemo(() => (me?.topic || "لاعب كيرم").trim(), [me?.topic]);
  const myAvatar = useMemo(() => me?.pic || "pic.png", [me?.pic]);

  useEffect(() => {
    myProfileRef.current = { name: myName, pic: myAvatar };
    if (clientRef.current?.raw?.connected) {
      clientRef.current.registerProfile({
        name: myName,
        pic: myAvatar,
        userId: me?.uid,
      });
    }
  }, [myName, myAvatar, me?.uid]);

  useEffect(() => {
    aiModeRef.current = aiMode;
  }, [aiMode]);

  useEffect(() => {
    roomJoinedRef.current = roomJoined;
  }, [roomJoined]);

  useEffect(() => {
    roomReadyRef.current = roomReady;
  }, [roomReady]);

  useEffect(() => {
    mySlotRef.current = mySlot;
  }, [mySlot]);

  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  const isRotatedView = mySlot === 1 && !aiMode;

  const updatePhase = useCallback((next: InteractionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const syncScoresToUi = useCallback(() => {
    const p = runtimeRef.current.players;
    setScores([
      { score: p[0].score, coins: { ...p[0].coins } },
      { score: p[1].score, coins: { ...p[1].coins } },
    ]);
    setCurrPlayer(runtimeRef.current.currPlayer);
  }, []);

  const renderActiveCanvasNow = useCallback(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const runtime = runtimeRef.current;
    const isInteractive =
      phaseRef.current === "place" ||
      phaseRef.current === "aim_drag" ||
      phaseRef.current === "aim_locked";

    drawActiveLayer(canvas, {
      discs: runtime.discs,
      blueCoins: runtime.blueCoins,
      overlap: overlapRef.current,
      isInteractivePlaceOrAim: isInteractive,
      aimPoint: aimPointRef.current,
      potBursts: potBurstsRef.current,
      now: performance.now(),
    });
  }, []);

  const ensureBurstAnimation = useCallback(() => {
    if (burstRafRef.current !== null || physicsRafRef.current !== null) return;
    const step = () => {
      if (potBurstsRef.current.length === 0 || physicsRafRef.current !== null) {
        burstRafRef.current = null;
        return;
      }
      renderActiveCanvasNow();
      if (potBurstsRef.current.length > 0) {
        burstRafRef.current = requestAnimationFrame(step);
      } else {
        burstRafRef.current = null;
      }
    };
    burstRafRef.current = requestAnimationFrame(step);
  }, [renderActiveCanvasNow]);

  const clearTurnTimer = useCallback(() => {
    turnDeadlineAtRef.current = null;
    setTurnDeadlineAt(null);
    setTurnSecsLeft(null);
  }, []);

  const applyTurnTimer = useCallback(
    (deadlineAt: number | null | undefined, durationMs?: number, serverNow?: number) => {
      if (typeof deadlineAt !== "number" || !Number.isFinite(deadlineAt)) {
        clearTurnTimer();
        return;
      }
      if (typeof serverNow === "number" && Number.isFinite(serverNow)) {
        serverOffsetMsRef.current = serverNow - Date.now();
      }
      const cleanDuration =
        typeof durationMs === "number" && durationMs >= 5000 ? durationMs : TURN_DURATION_MS;
      turnDurationMsRef.current = cleanDuration;
      turnDeadlineAtRef.current = deadlineAt;
      setTurnDurationMs(cleanDuration);
      setTurnDeadlineAt(deadlineAt);
      const rem = Math.max(0, deadlineAt - (Date.now() + serverOffsetMsRef.current));
      setTurnSecsLeft(Math.min(Math.ceil(cleanDuration / 1000), Math.ceil(rem / 1000)));
    },
    [clearTurnTimer],
  );

  const triggerOpponentLeftNotice = useCallback((departedName: string, departedPic = "") => {
    const now = Date.now();
    if (now - lastLeaveNoticeAtRef.current < 600) return;
    lastLeaveNoticeAtRef.current = now;

    const cleanName = departedName.trim() || "الخصم";
    const noticeMsg = `غادر ${cleanName} اللعبة — بانتظار انضمام لاعب آخر`;
    setLeaveAlert({
      name: cleanName,
      avatar: departedPic,
      message: noticeMsg,
    });
    if (leaveAlertTimerRef.current) clearTimeout(leaveAlertTimerRef.current);
    leaveAlertTimerRef.current = setTimeout(() => {
      setLeaveAlert(null);
    }, 7000);

    setChatMsgs((prev) => [
      ...prev.slice(-49),
      {
        id: `sys-leave-${now}`,
        senderName: "إشعار الطاولة",
        senderAvatar: departedPic,
        message: `🚪 غادر ${cleanName} اللعبة`,
        ts: now,
        isOwn: false,
        isSystem: true,
      },
    ]);
    playSoundCue("notice");
  }, []);

  const stopLoops = useCallback(() => {
    if (physicsRafRef.current !== null) {
      cancelAnimationFrame(physicsRafRef.current);
      physicsRafRef.current = null;
    }
    if (burstRafRef.current !== null) {
      cancelAnimationFrame(burstRafRef.current);
      burstRafRef.current = null;
    }
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    if (vsTimerRef.current) {
      clearTimeout(vsTimerRef.current);
      vsTimerRef.current = null;
    }
    if (leaveAlertTimerRef.current) {
      clearTimeout(leaveAlertTimerRef.current);
      leaveAlertTimerRef.current = null;
    }
  }, []);

  // Preload static board images & draw base layers cleanly
  useEffect(() => {
    let active = true;
    void preloadBoardAssets().then((assets) => {
      if (!active) return;
      assetsRef.current = assets;
      if (bgCanvasRef.current) drawBgLayer(bgCanvasRef.current, boardSkin, assets);
      if (boardCanvasRef.current) drawBoardLinesLayer(boardCanvasRef.current, roseSkin, assets);
      renderActiveCanvasNow();
    });
    return () => {
      active = false;
    };
  }, [boardSkin, roseSkin, renderActiveCanvasNow]);

  useEffect(() => {
    if (bgCanvasRef.current) {
      drawBgLayer(bgCanvasRef.current, boardSkin, assetsRef.current);
    }
  }, [boardSkin]);

  useEffect(() => {
    if (boardCanvasRef.current) {
      drawBoardLinesLayer(boardCanvasRef.current, roseSkin, assetsRef.current);
    }
  }, [roseSkin]);

  // Lightweight ambient crimson/gold particles (~24 particles, respects reduced motion)
  useEffect(() => {
    const canvas = ambientCanvasRef.current;
    if (!canvas || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles = Array.from({ length: 24 }, () => ({
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      r: 0.9 + Math.random() * 1.4,
      vy: 0.35 + Math.random() * 0.65,
      vx: (Math.random() - 0.5) * 0.2,
      alpha: 0.14 + Math.random() * 0.28,
    }));

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
      }
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);

    let raf = 0;
    let lastTick = 0;
    const tick = (now: number) => {
      if (now - lastTick >= 33) {
        lastTick = now;
        const w = canvas.width;
        const h = canvas.height;
        if (w > 0 && h > 0) {
          ctx.clearRect(0, 0, w, h);
          for (let i = 0; i < particles.length; i += 1) {
            const p = particles[i]!;
            p.y += p.vy * 1.3;
            p.x += p.vx;
            if (p.y > h) {
              p.y = -4;
              p.x = Math.random() * w;
            }
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            ctx.fillStyle = `rgba(253, 230, 138, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x % w, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const emitSnapshotIfMultiplayer = useCallback(() => {
    if (aiModeRef.current || !roomJoinedRef.current || !clientRef.current) return;
    const snap = serializeSnapshot(runtimeRef.current);
    clientRef.current.sendStateSnapshot({
      roomId: currentRoomIdRef.current,
      snapshot: snap,
    });
  }, []);

  const prepareTurnRef = useRef<() => void>(() => undefined);
  const fireStrikerRef = useRef<(opts?: { isRemote?: boolean; vX?: number; vY?: number }) => void>(() => undefined);

  const prepareTurn = useCallback(() => {
    const runtime = runtimeRef.current;
    runtime.strikerPot = false;
    aimPointRef.current = null;
    setAimPowerPct(0);

    const cp = runtime.currPlayer;
    const baselineY = BASELINE_Y[cp];
    const startX = findAvailableBaselineX(runtime.discs, baselineY, BASELINE_DEFAULT_X);
    if (runtime.discs[0]) {
      runtime.discs[0].x = startX;
      runtime.discs[0].y = baselineY;
      runtime.discs[0].vx = 0;
      runtime.discs[0].vy = 0;
    }

    overlapRef.current = isStrikerOverlapping(runtime.discs, startX, baselineY);
    setStrikerOverlap(overlapRef.current);
    runtime.blueCoins = computeBlueFoulCoinIndices(runtime.discs, cp);
    setStrikerSliderX(Math.round(startX));
    syncScoresToUi();

    const activeAi = aiModeRef.current;
    const activeReady = activeAi || roomReadyRef.current;
    const myTurnNow = activeAi ? cp === 0 : activeReady && mySlotRef.current === cp;

    if (!activeReady) {
      clearTurnTimer();
      updatePhase("idle");
      setStatusMsg("الغرفة جاهزة — بانتظار انضمام الخصم");
      renderActiveCanvasNow();
      return;
    }

    if (activeAi && cp === 1) {
      clearTurnTimer();
      updatePhase("ai_thinking");
      setStatusMsg("البوت يفكر في الضربة...");
      renderActiveCanvasNow();
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      aiTimerRef.current = setTimeout(() => {
        if (!aiModeRef.current) return;
        const plan = planAiShot(runtime.discs);
        if (runtime.discs[0]) {
          runtime.discs[0].x = plan.strikerX;
          runtime.discs[0].y = BASELINE_Y[1];
        }
        overlapRef.current = false;
        fireStrikerRef.current({ isRemote: true, vX: plan.vX, vY: plan.vY });
      }, 950);
      return;
    }

    if (activeAi && cp === 0) {
      serverOffsetMsRef.current = 0;
      applyTurnTimer(Date.now() + TURN_DURATION_MS, TURN_DURATION_MS);
    } else if (!activeAi && turnDeadlineAtRef.current === null) {
      // Optimistic deadline until authoritative `turn_timer` packet arrives (~20ms)
      applyTurnTimer(Date.now() + TURN_DURATION_MS, TURN_DURATION_MS);
    }

    if (!myTurnNow) {
      updatePhase("idle");
      setStatusMsg(mySlotRef.current === -1 ? "وضع المشاهدة المباشرة" : "دور الخصم الآن...");
      renderActiveCanvasNow();
      return;
    }

    updatePhase("place");
    setStatusMsg(
      overlapRef.current
        ? "يوجد قرص هنا — حرّك المضرب لمكان فارغ"
        : "حرّك المضرب واضغط للتثبيت أو اسحب للخلف للتسديد",
    );
    renderActiveCanvasNow();
  }, [applyTurnTimer, clearTurnTimer, renderActiveCanvasNow, syncScoresToUi, updatePhase]);

  useEffect(() => {
    prepareTurnRef.current = prepareTurn;
  }, [prepareTurn]);

  const fireStriker = useCallback(
    (opts?: { isRemote?: boolean; vX?: number; vY?: number }) => {
      if (physicsRafRef.current !== null) {
        cancelAnimationFrame(physicsRafRef.current);
        physicsRafRef.current = null;
      }

      const runtime = runtimeRef.current;
      const striker = runtime.discs[0];
      if (!striker) return;

      carromSoundPool.warmup();
      runtime.blueCoins = computeBlueFoulCoinIndices(runtime.discs, runtime.currPlayer);

      let vX = opts?.vX;
      let vY = opts?.vY;
      if (typeof vX !== "number" || typeof vY !== "number") {
        const aim = aimPointRef.current;
        if (!aim) return;
        const vel = computeShotVelocity(striker.x, striker.y, aim.x, aim.y);
        if (vel.power < 12) return;
        vX = vel.vX;
        vY = vel.vY;
      }

      if (!opts?.isRemote && !aiModeRef.current && roomReadyRef.current && clientRef.current) {
        clientRef.current.strikerHit({
          strikerX: striker.x,
          strikerY: striker.y,
          vX,
          vY,
        });
      }

      striker.vx = vX;
      striker.vy = vY;
      aimPointRef.current = null;
      setAimPowerPct(0);
      clearTurnTimer();
      updatePhase("shooting");
      setStatusMsg("جاري تنفيذ الضربة...");

      const FIXED_STEP_MS = 1000 / 60;
      let lastTime = performance.now();
      let accumulator = 0;

      const stepLoop = (now: number) => {
        const frameDelta = Math.min(50, Math.max(0, now - lastTime));
        lastTime = now;
        accumulator += frameDelta;

        let outcome: "moving" | "turn_end" | "game_over" = "moving";
        let stepsRun = 0;
        while (accumulator >= FIXED_STEP_MS && stepsRun < 4) {
          accumulator -= FIXED_STEP_MS;
          stepsRun += 1;
          outcome = stepCarromPhysicsFrame(runtime, {
            onTickSound: (speed) => carromSoundPool.playTick(speed),
            onCoinPocketed: (coin) => {
              carromSoundPool.playCoinDrop();
              potBurstsRef.current.push({
                x: coin.x,
                y: coin.y,
                color: coin.color,
                startedAt: performance.now(),
              });
            },
            onStrikerPocketed: () => {
              carromSoundPool.playStrikerDrop();
              potBurstsRef.current.push({
                x: striker.x,
                y: striker.y,
                color: "#ffffff",
                startedAt: performance.now(),
              });
            },
            onStatusMessage: (msg) => setStatusMsg(msg),
            onScoreChange: () => syncScoresToUi(),
          });
          if (outcome !== "moving") break;
        }

        renderActiveCanvasNow();

        if (outcome === "game_over") {
          physicsRafRef.current = null;
          clearTurnTimer();
          syncScoresToUi();
          emitSnapshotIfMultiplayer();
          const p0 = runtime.players[0].score;
          const p1 = runtime.players[1].score;
          const win: 0 | 1 = p0 >= p1 ? 0 : 1;
          setWinnerIdx(win);
          updatePhase("idle");
          setStatusMsg("انتهت المباراة!");
          ensureBurstAnimation();
          return;
        }

        if (outcome === "turn_end") {
          physicsRafRef.current = null;
          syncScoresToUi();
          emitSnapshotIfMultiplayer();
          ensureBurstAnimation();
          prepareTurnRef.current();
          return;
        }

        physicsRafRef.current = requestAnimationFrame(stepLoop);
      };

      physicsRafRef.current = requestAnimationFrame(stepLoop);
    },
    [
      clearTurnTimer,
      emitSnapshotIfMultiplayer,
      ensureBurstAnimation,
      renderActiveCanvasNow,
      syncScoresToUi,
      updatePhase,
    ],
  );

  useEffect(() => {
    fireStrikerRef.current = fireStriker;
  }, [fireStriker]);

  // Reset board helper for new online or AI game
  const resetBoardForMatch = useCallback(
    (preserveReady: boolean) => {
      stopLoops();
      clearTurnTimer();
      potBurstsRef.current = [];
      aimPointRef.current = null;
      overlapRef.current = false;
      setStrikerOverlap(false);
      setWinnerIdx(null);
      setAimPowerPct(0);

      runtimeRef.current = {
        ...createMatchRuntimeState(),
        discs: createInitialDiscs(),
        players: createInitialPlayers(),
      };
      syncScoresToUi();
      if (preserveReady) {
        prepareTurnRef.current();
      } else {
        updatePhase("idle");
        renderActiveCanvasNow();
      }
    },
    [clearTurnTimer, renderActiveCanvasNow, stopLoops, syncScoresToUi, updatePhase],
  );

  // Connect `/carrom` MsgPack Socket.IO namespace
  useEffect(() => {
    const client = new CarromArenaClient();
    clientRef.current = client;

    const raw = client.connect(resolveGatewayBaseUrl(), {
      name: myProfileRef.current.name,
      pic: myProfileRef.current.pic,
      userId: me?.uid,
    });

    raw.on("connect", () => {
      setConnected(true);
      setConnecting(false);
      setLobbyError("");
      client.registerProfile({
        name: myProfileRef.current.name,
        pic: myProfileRef.current.pic,
        userId: me?.uid,
      });
      client.requestWaitingRooms();
    });

    raw.on("disconnect", () => {
      setConnected(false);
      if (!aiModeRef.current && roomJoinedRef.current) {
        roomReadyRef.current = false;
        setRoomReady(false);
        setStatusMsg("انقطع الاتصال بالخادم — جاري إعادة المحاولة...");
      }
    });

    raw.on("waiting_rooms", (list: CarromWaitingRoom[]) => {
      if (Array.isArray(list)) setWaitingRooms(list);
    });

    raw.on("join_error", (d: { msg?: string; message?: string }) => {
      setLobbyError(String(d?.msg || d?.message || "تعذر الانضمام إلى الغرفة"));
    });

    raw.on(
      "room_joined",
      (d: {
        roomCode?: string;
        roomId?: string;
        slot?: number;
        playerIndex?: number;
        players?: Array<{ name?: string; playerName?: string; pic?: string; playerAvatar?: string; slot?: number }>;
      }) => {
        const code = String(d.roomCode || d.roomId || "");
        const slot = typeof d.playerIndex === "number" ? d.playerIndex : Number(d.slot ?? 0);
        setAiMode(false);
        aiModeRef.current = false;
        setRoomJoined(true);
        roomJoinedRef.current = true;
        setRoomReady(false);
        roomReadyRef.current = false;
        setCurrentRoomId(code);
        currentRoomIdRef.current = code;
        setMySlot(slot);
        mySlotRef.current = slot;
        setShowLobby(false);
        setLobbyError("");
        setLeaveAlert(null);
        setChatMsgs([]);
        resetBoardForMatch(false);

        if (Array.isArray(d.players) && d.players.length > 0) {
          const p0 = d.players.find((p) => (p.slot ?? 0) === 0) || d.players[0];
          const p1 = d.players.find((p) => p.slot === 1);
          setMatchProfiles([
            {
              playerName: p0?.name || p0?.playerName || "اللاعب 1",
              playerAvatar: p0?.pic || p0?.playerAvatar || "",
            },
            {
              playerName: p1?.name || p1?.playerName || "بانتظار خصم...",
              playerAvatar: p1?.pic || p1?.playerAvatar || "",
            },
          ]);
        } else {
          setMatchProfiles([
            { playerName: myProfileRef.current.name, playerAvatar: myProfileRef.current.pic },
            { playerName: "بانتظار خصم...", playerAvatar: "" },
          ]);
        }

        setStatusMsg(slot === 0 ? "تم إنشاء الغرفة — في انتظار انضمام الخصم" : "تم الانضمام للمباراة");
      },
    );

    raw.on("room_waiting", () => {
      setRoomReady(false);
      roomReadyRef.current = false;
      setStatusMsg("الغرفة جاهزة. يمكن للخصم الانضمام الآن");
      renderActiveCanvasNow();
    });

    raw.on(
      "game_ready",
      (d: {
        playerProfiles?: Array<{ playerName?: string; name?: string; playerAvatar?: string; pic?: string; slot?: number }>;
        players?: Array<{ playerName?: string; name?: string; playerAvatar?: string; pic?: string; slot?: number }>;
        snapshot?: CarromSnapshot | null;
        turnDeadlineAt?: number;
        turnDurationMs?: number;
        serverNow?: number;
      }) => {
        setRoomReady(true);
        roomReadyRef.current = true;
        setShowLobby(false);
        setLeaveAlert(null);

        const rawProfiles = d.playerProfiles || d.players || [];
        const p0 = rawProfiles[0];
        const p1 = rawProfiles[1];
        setMatchProfiles([
          {
            playerName: p0?.playerName || p0?.name || "اللاعب 1",
            playerAvatar: p0?.playerAvatar || p0?.pic || "",
          },
          {
            playerName: p1?.playerName || p1?.name || "اللاعب 2",
            playerAvatar: p1?.playerAvatar || p1?.pic || "",
          },
        ]);

        if (d.snapshot) {
          applySnapshotToState(runtimeRef.current, d.snapshot);
          syncScoresToUi();
          if (typeof d.turnDeadlineAt === "number") {
            applyTurnTimer(d.turnDeadlineAt, d.turnDurationMs, d.serverNow);
          }
          prepareTurnRef.current();
          return;
        }

        resetBoardForMatch(false);
        setShowVsOverlay(true);
        if (vsTimerRef.current) clearTimeout(vsTimerRef.current);
        vsTimerRef.current = setTimeout(() => {
          setShowVsOverlay(false);
          if (typeof d.turnDeadlineAt === "number") {
            applyTurnTimer(d.turnDeadlineAt, d.turnDurationMs, d.serverNow);
          } else {
            applyTurnTimer(Date.now() + TURN_DURATION_MS, TURN_DURATION_MS);
          }
          prepareTurnRef.current();
          if (mySlotRef.current === 0) {
            emitSnapshotIfMultiplayer();
          }
        }, 1400);
      },
    );

    raw.on(
      "room_resume_state",
      (d: {
        snapshot?: CarromSnapshot;
        turnDeadlineAt?: number;
        turnDurationMs?: number;
        serverNow?: number;
      }) => {
        if (!d?.snapshot) return;
        applySnapshotToState(runtimeRef.current, d.snapshot);
        syncScoresToUi();
        if (typeof d.turnDeadlineAt === "number") {
          applyTurnTimer(d.turnDeadlineAt, d.turnDurationMs, d.serverNow);
        }
        prepareTurnRef.current();
        setStatusMsg("تمت مزامنة وتحديث اللوحة");
      },
    );

    raw.on(
      "turn_timer",
      (d: {
        turnSlot?: number;
        turnDeadlineAt?: number;
        turnDurationMs?: number;
        serverNow?: number;
      }) => {
        if (aiModeRef.current || !roomReadyRef.current) return;
        if (typeof d?.turnSlot === "number") {
          const nextSlot: 0 | 1 = d.turnSlot === 1 ? 1 : 0;
          if (runtimeRef.current.currPlayer !== nextSlot) {
            runtimeRef.current.currPlayer = nextSlot;
            prepareTurnRef.current();
          }
        }
        applyTurnTimer(d?.turnDeadlineAt, d?.turnDurationMs, d?.serverNow);
      },
    );

    raw.on(
      "turn_timeout",
      (d: {
        timedOutSlot?: number;
        nextSlot?: number;
        turnDeadlineAt?: number;
        turnDurationMs?: number;
        serverNow?: number;
        message?: string;
      }) => {
        if (aiModeRef.current || !roomReadyRef.current) return;
        dragModeRef.current = null;
        aimPointRef.current = null;
        setAimPowerPct(0);

        const rt = runtimeRef.current;
        if (rt.redPut === 2) {
          rt.redPut = 0;
          if (!rt.discs.some((c) => c.name === "red")) {
            rt.discs.push({
              x: 260,
              y: 260,
              vx: 0,
              vy: 0,
              name: "red",
              color: COIN_COLORS.red,
              radius: COIN_RADIUS,
            });
          }
        } else if (rt.redPut === 1) {
          rt.redPut = 2;
        }
        rt.currPlayer = d?.nextSlot === 1 ? 1 : 0;
        rt.firstHit = false;
        rt.hitBlueCoin = false;
        rt.strikerPot = false;
        rt.coinPoted = false;

        applyTurnTimer(d?.turnDeadlineAt, d?.turnDurationMs, d?.serverNow);
        syncScoresToUi();
        prepareTurnRef.current();
        playSoundCue("notice");
        setStatusMsg(String(d?.message || "انتهى وقت الدور — انتقل الدور للخصم"));
      },
    );

    raw.on("request_sync_from_peer", () => {
      if (!aiModeRef.current && roomJoinedRef.current) {
        emitSnapshotIfMultiplayer();
      }
    });

    raw.on(
      "player_reassigned",
      (d: {
        playerIndex?: number;
        players?: Array<{ name?: string; playerName?: string; pic?: string; playerAvatar?: string }>;
      }) => {
        const nextIdx = typeof d?.playerIndex === "number" ? d.playerIndex : 0;
        const prevIdx = mySlotRef.current;
        mySlotRef.current = nextIdx;
        setMySlot(nextIdx);
        if (Array.isArray(d?.players) && d.players.length >= 1) {
          const remaining = d.players[0];
          setMatchProfiles([
            {
              playerName: remaining?.name || remaining?.playerName || myProfileRef.current.name,
              playerAvatar: remaining?.pic || remaining?.playerAvatar || myProfileRef.current.pic,
            },
            { playerName: "بانتظار خصم...", playerAvatar: "" },
          ]);
        }
        if (prevIdx !== null && prevIdx !== nextIdx) {
          const rt = runtimeRef.current;
          const tmp = rt.players[0];
          rt.players[0] = rt.players[1];
          rt.players[1] = tmp;
          rt.currPlayer = rt.currPlayer === 0 ? 1 : 0;
          syncScoresToUi();
        }
      },
    );

    raw.on(
      "player_left",
      (d: {
        socketId?: string;
        departedName?: string;
        name?: string;
        departedPic?: string;
        pic?: string;
        message?: string;
      }) => {
        if (d?.socketId && raw.id && d.socketId === raw.id) return;
        const departedName = String(d?.departedName || d?.name || "الخصم");
        const departedPic = String(d?.departedPic || d?.pic || "");
        dragModeRef.current = null;
        aimPointRef.current = null;
        setAimPowerPct(0);
        clearTurnTimer();
        setRoomReady(false);
        roomReadyRef.current = false;
        setShowVsOverlay(false);
        updatePhase("idle");
        setStatusMsg(String(d?.message || `غادر ${departedName} اللعبة`));
        triggerOpponentLeftNotice(departedName, departedPic);
      },
    );

    raw.on(
      "match_paused",
      (d: { departedName?: string; departedPic?: string; message?: string }) => {
        dragModeRef.current = null;
        aimPointRef.current = null;
        setAimPowerPct(0);
        clearTurnTimer();
        setRoomReady(false);
        roomReadyRef.current = false;
        updatePhase("idle");
        setStatusMsg(String(d?.message || "غادر الخصم — بانتظار انضمام لاعب آخر"));
        if (d?.departedName) {
          triggerOpponentLeftNotice(String(d.departedName), String(d.departedPic || ""));
        }
        renderActiveCanvasNow();
      },
    );

    raw.on("opponent_striker_place", (d: { playerIndex?: number; x?: number; y?: number }) => {
      if (aiModeRef.current || !roomReadyRef.current) return;
      const rt = runtimeRef.current;
      if (typeof d?.playerIndex === "number" && d.playerIndex !== rt.currPlayer) return;
      if (mySlotRef.current === rt.currPlayer) return;
      if (typeof d?.x !== "number" || typeof d?.y !== "number") return;
      if (rt.discs[0]) {
        rt.discs[0].x = d.x;
        rt.discs[0].y = d.y;
      }
      aimPointRef.current = null;
      rt.blueCoins = computeBlueFoulCoinIndices(rt.discs, rt.currPlayer);
      renderActiveCanvasNow();
    });

    raw.on("opponent_striker_aim", (d: { playerIndex?: number; aimX?: number; aimY?: number }) => {
      if (aiModeRef.current || !roomReadyRef.current) return;
      const rt = runtimeRef.current;
      if (typeof d?.playerIndex === "number" && d.playerIndex !== rt.currPlayer) return;
      if (mySlotRef.current === rt.currPlayer) return;
      if (typeof d?.aimX !== "number" || typeof d?.aimY !== "number") return;
      aimPointRef.current = { x: d.aimX, y: d.aimY };
      renderActiveCanvasNow();
    });

    raw.on(
      "opponent_striker_hit",
      (d: { playerIndex?: number; strikerX?: number; strikerY?: number; vX?: number; vY?: number }) => {
        if (aiModeRef.current || !roomReadyRef.current) return;
        const rt = runtimeRef.current;
        if (typeof d?.playerIndex === "number" && d.playerIndex !== rt.currPlayer) return;
        if (mySlotRef.current === rt.currPlayer) return;
        if (typeof d?.vX !== "number" || typeof d?.vY !== "number") return;
        if (rt.discs[0] && typeof d.strikerX === "number" && typeof d.strikerY === "number") {
          rt.discs[0].x = d.strikerX;
          rt.discs[0].y = d.strikerY;
        }
        fireStrikerRef.current({ isRemote: true, vX: d.vX, vY: d.vY });
      },
    );

    raw.on("opponent_play_again", () => {
      resetBoardForMatch(true);
    });

    raw.on(
      "chat_message",
      (d: { from?: string; senderName?: string; name?: string; senderAvatar?: string; pic?: string; message?: string; msg?: string; ts?: number }) => {
        const msg = String(d?.message || d?.msg || "").trim();
        if (!msg) return;
        const senderName = String(d?.senderName || d?.name || "لاعب");
        const senderAvatar = String(d?.senderAvatar || d?.pic || "");
        const isOwn = Boolean(d?.from && raw.id && d.from === raw.id);
        setChatMsgs((prev) => [
          ...prev.slice(-49),
          {
            id: `${d?.ts || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            senderName,
            senderAvatar,
            message: msg,
            ts: Number(d?.ts || Date.now()),
            isOwn,
          },
        ]);
      },
    );

    return () => {
      stopLoops();
      clearTurnTimer();
      carromSoundPool.dispose();
      client.disconnect();
      clientRef.current = null;
    };
  }, [
    applyTurnTimer,
    clearTurnTimer,
    emitSnapshotIfMultiplayer,
    me?.uid,
    renderActiveCanvasNow,
    resetBoardForMatch,
    stopLoops,
    syncScoresToUi,
    triggerOpponentLeftNotice,
    updatePhase,
  ]);

  // Countdown tick (updates integer seconds 1/sec + auto-switches turn on timeout in AI mode)
  useEffect(() => {
    if (turnDeadlineAt === null) {
      setTurnSecsLeft(null);
      return;
    }

    const tick = () => {
      const serverNow = Date.now() + serverOffsetMsRef.current;
      const remaining = Math.max(0, turnDeadlineAt - serverNow);
      const nextSecs = Math.min(
        Math.ceil(turnDurationMsRef.current / 1000),
        Math.ceil(remaining / 1000),
      );
      setTurnSecsLeft((prev) => (prev === nextSecs ? prev : nextSecs));

      if (remaining <= 0 && aiModeRef.current && runtimeRef.current.currPlayer === 0 && roomReadyRef.current) {
        clearTurnTimer();
        dragModeRef.current = null;
        aimPointRef.current = null;
        setAimPowerPct(0);

        const rt = runtimeRef.current;
        if (rt.redPut === 2) {
          rt.redPut = 0;
          if (!rt.discs.some((c) => c.name === "red")) {
            rt.discs.push({
              x: 260,
              y: 260,
              vx: 0,
              vy: 0,
              name: "red",
              color: COIN_COLORS.red,
              radius: COIN_RADIUS,
            });
          }
        } else if (rt.redPut === 1) {
          rt.redPut = 2;
        }
        rt.currPlayer = 1;
        rt.firstHit = false;
        rt.hitBlueCoin = false;
        rt.strikerPot = false;
        rt.coinPoted = false;
        playSoundCue("notice");
        setStatusMsg("انتهى وقتك — انتقل الدور إلى البوت");
        prepareTurnRef.current();
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [turnDeadlineAt, clearTurnTimer]);

  // Escape key closes inner modals or returns from aiming back to striker positioning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showHelpModal) {
        e.preventDefault();
        e.stopPropagation();
        setShowHelpModal(false);
        return;
      }
      if (showCustomizeModal) {
        e.preventDefault();
        e.stopPropagation();
        setShowCustomizeModal(false);
        return;
      }
      if (phaseRef.current === "aim_locked" || phaseRef.current === "aim_drag") {
        e.preventDefault();
        e.stopPropagation();
        aimPointRef.current = null;
        setAimPowerPct(0);
        updatePhase("place");
        setStatusMsg("حرّك المضرب لاختيار موقع جديد");
        renderActiveCanvasNow();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [renderActiveCanvasNow, showCustomizeModal, showHelpModal, updatePhase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  // Helpers for throttled multiplayer place/aim emissions
  const emitPlaceThrottled = useCallback((x: number, y: number, force = false) => {
    if (aiModeRef.current || !roomReadyRef.current || !clientRef.current) return;
    const now = performance.now();
    if (!force && now - lastPlaceEmitAtRef.current < 32) return;
    lastPlaceEmitAtRef.current = now;
    clientRef.current.strikerPlace({ x, y });
  }, []);

  const emitAimThrottled = useCallback((aimX: number, aimY: number) => {
    if (aiModeRef.current || !roomReadyRef.current || !clientRef.current) return;
    const now = performance.now();
    if (now - lastAimEmitAtRef.current < 45) return;
    lastAimEmitAtRef.current = now;
    clientRef.current.strikerAim({ aimX, aimY });
  }, []);

  // Coordinate mapper accounting for CSS `rotate(180deg)` when Player 2 plays
  const toBoardCoords = useCallback(
    (clientX: number, clientY: number, el: HTMLCanvasElement) => {
      const rect = el.getBoundingClientRect();
      let x = ((clientX - rect.left) / (rect.width || 1)) * BOARD_SIZE;
      let y = ((clientY - rect.top) / (rect.height || 1)) * BOARD_SIZE;
      if (isRotatedView) {
        x = BOARD_SIZE - x;
        y = BOARD_SIZE - y;
      }
      return { x, y };
    },
    [isRotatedView],
  );

  const canInteractTurn = useMemo(() => {
    if (winnerIdx !== null) return false;
    if (aiMode) return currPlayer === 0;
    return roomReady && mySlot === currPlayer;
  }, [aiMode, currPlayer, mySlot, roomReady, winnerIdx]);

  const moveStrikerToX = useCallback(
    (targetX: number, forceEmit = false) => {
      const runtime = runtimeRef.current;
      const striker = runtime.discs[0];
      if (!striker) return;
      const clampedX = clampBoardNum(targetX, BASELINE_MIN_X, BASELINE_MAX_X);
      striker.x = clampedX;
      striker.y = BASELINE_Y[runtime.currPlayer];
      overlapRef.current = isStrikerOverlapping(runtime.discs, striker.x, striker.y);
      setStrikerOverlap(overlapRef.current);
      setStrikerSliderX(Math.round(clampedX));
      setStatusMsg(overlapRef.current ? "يوجد قرص هنا!" : "يمكنك وضع المضرب هنا — اضغط للتثبيت");
      emitPlaceThrottled(striker.x, striker.y, forceEmit);
      renderActiveCanvasNow();
    },
    [emitPlaceThrottled, renderActiveCanvasNow],
  );

  // Unified desktop + mobile pointer state machine
  const handleCanvasPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canInteractTurn) return;
    const curPhase = phaseRef.current;
    if (curPhase === "shooting" || curPhase === "ai_thinking" || curPhase === "idle") return;

    carromSoundPool.warmup();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toBoardCoords(e.clientX, e.clientY, e.currentTarget);
    const striker = runtimeRef.current.discs[0];
    if (!striker) return;

    if (curPhase === "place") {
      const nearStriker = dist2D(pt.x, pt.y, striker.x, striker.y) < 42;
      dragModeRef.current = {
        active: true,
        pointerId: e.pointerId,
        downX: pt.x,
        downY: pt.y,
        moved: false,
        nearStriker,
      };
      if (!nearStriker) {
        moveStrikerToX(pt.x);
      }
      return;
    }

    if (curPhase === "aim_locked") {
      lastMouseRef.current = pt;
      dragModeRef.current = {
        active: true,
        pointerId: e.pointerId,
        downX: pt.x,
        downY: pt.y,
        moved: false,
        nearStriker: false,
      };
    }
  };

  const handleCanvasPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canInteractTurn) return;
    const pt = toBoardCoords(e.clientX, e.clientY, e.currentTarget);
    const runtime = runtimeRef.current;
    const striker = runtime.discs[0];
    if (!striker) return;

    const curPhase = phaseRef.current;
    const drag = dragModeRef.current;

    if (curPhase === "place") {
      if (!drag) {
        // Desktop hover preview along baseline
        if (e.pointerType === "mouse") {
          moveStrikerToX(pt.x);
        }
        return;
      }

      const dMoved = dist2D(pt.x, pt.y, drag.downX, drag.downY);
      if (dMoved > 6) drag.moved = true;

      const pulledIntoRearZone =
        (runtime.currPlayer === 0 && pt.y > striker.y + 10) ||
        (runtime.currPlayer === 1 && pt.y < striker.y - 10);

      if (drag.nearStriker && !overlapRef.current && pulledIntoRearZone && dMoved > 12) {
        updatePhase("aim_drag");
        setStatusMsg("اسحب للخلف وحدد القوة ثم اترك للتسديد");
      } else {
        moveStrikerToX(pt.x);
      }
      return;
    }

    if (curPhase === "aim_drag") {
      // Intuitive direct slingshot pull-back relative to striker
      const pullDx = pt.x - striker.x;
      const pullDy = pt.y - striker.y;
      const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy);
      const validDir =
        (runtime.currPlayer === 0 && pullDy > 6) ||
        (runtime.currPlayer === 1 && pullDy < -6);

      if (!validDir || pullDist < 12) {
        aimPointRef.current = null;
        setAimPowerPct(0);
        setStatusMsg("اسحب للخلف للتسديد أو عد للمضرب للإلغاء");
      } else {
        const clampedPower = Math.min(pullDist, 100);
        const ax = striker.x + (pullDx / pullDist) * clampedPower;
        const ay = striker.y + (pullDy / pullDist) * clampedPower;
        aimPointRef.current = { x: ax, y: ay };
        setAimPowerPct(Math.round(Math.min(100, (clampedPower / 85) * 100)));
        emitAimThrottled(ax, ay);
      }
      renderActiveCanvasNow();
      return;
    }

    if (curPhase === "aim_locked") {
      const validDir =
        (runtime.currPlayer === 0 && pt.y > striker.y) ||
        (runtime.currPlayer === 1 && pt.y < striker.y);
      if (!validDir) {
        renderActiveCanvasNow();
        return;
      }

      if (lastMouseRef.current.x === 0 && lastMouseRef.current.y === 0) {
        lastMouseRef.current = pt;
      }
      const dxMove = pt.x - lastMouseRef.current.x;
      const dyMove = pt.y - lastMouseRef.current.y;
      lastMouseRef.current = pt;

      if (!aimPointRef.current) {
        aimPointRef.current = {
          x: striker.x,
          y: runtime.currPlayer === 1 ? striker.y - 50 : striker.y + 50,
        };
      }
      // Precision 0.3 scaling matching original chetos216 main.js
      const nextX = clampBoardNum(aimPointRef.current.x + dxMove * 0.3, -200, BOARD_SIZE + 200);
      const nextY = clampBoardNum(aimPointRef.current.y + dyMove * 0.3, -200, BOARD_SIZE + 200);
      aimPointRef.current = { x: nextX, y: nextY };
      const distAim = dist2D(striker.x, striker.y, nextX, nextY);
      setAimPowerPct(Math.round(Math.min(100, (distAim / 85) * 100)));
      emitAimThrottled(nextX, nextY);
      renderActiveCanvasNow();
    }
  };

  const handleCanvasPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const drag = dragModeRef.current;
    dragModeRef.current = null;
    if (!canInteractTurn) return;

    const runtime = runtimeRef.current;
    const striker = runtime.discs[0];
    if (!striker) return;
    const curPhase = phaseRef.current;

    if (curPhase === "aim_drag") {
      const aim = aimPointRef.current;
      if (aim && dist2D(striker.x, striker.y, aim.x, aim.y) >= 14) {
        fireStriker({ isRemote: false });
      } else {
        aimPointRef.current = null;
        setAimPowerPct(0);
        updatePhase("place");
        setStatusMsg("تم إلغاء الضربة — حرّك المضرب أو ثبته");
        renderActiveCanvasNow();
      }
      return;
    }

    if (curPhase === "place") {
      const pt = toBoardCoords(e.clientX, e.clientY, e.currentTarget);
      const isTap = !drag || dist2D(pt.x, pt.y, drag.downX, drag.downY) < 12;
      if (isTap && !overlapRef.current) {
        emitPlaceThrottled(striker.x, striker.y, true);
        aimPointRef.current = {
          x: striker.x,
          y: runtime.currPlayer === 1 ? striker.y - 45 : striker.y + 45,
        };
        lastMouseRef.current = { x: 0, y: 0 };
        setAimPowerPct(Math.round((45 / 85) * 100));
        updatePhase("aim_locked");
        setStatusMsg("تم التثبيت — اسحب/وجّه السهم ثم اضغط للتسديد (Esc للإلغاء)");
        renderActiveCanvasNow();
      }
      return;
    }

    if (curPhase === "aim_locked") {
      const aim = aimPointRef.current;
      if (aim && dist2D(striker.x, striker.y, aim.x, aim.y) >= 14) {
        fireStriker({ isRemote: false });
      }
    }
  };

  // Actions from Lobby & Header
  const handleStartAiMatch = () => {
    carromSoundPool.warmup();
    if (roomJoined && clientRef.current) {
      clientRef.current.leaveRoom();
    }
    setAiMode(true);
    aiModeRef.current = true;
    setRoomJoined(true);
    roomJoinedRef.current = true;
    setRoomReady(true);
    roomReadyRef.current = true;
    setCurrentRoomId("AI-BOT");
    currentRoomIdRef.current = "AI-BOT";
    setMySlot(0);
    mySlotRef.current = 0;
    setShowLobby(false);
    setLobbyError("");
    setLeaveAlert(null);
    setChatMsgs([]);
    setMatchProfiles([
      { playerName: myName, playerAvatar: myAvatar },
      { playerName: "بوت الكيرم الذكي", playerAvatar: "/carrom-game/assets/images/game-icon.png" },
    ]);
    resetBoardForMatch(true);
    setStatusMsg("مباراة ضد البوت — دورك الآن!");
  };

  const handleCreateOnlineRoom = () => {
    carromSoundPool.warmup();
    if (!clientRef.current?.raw?.connected) {
      setLobbyError("الاتصال بالخادم غير جاهز بعد، انتظر لحظة...");
      return;
    }
    clientRef.current.registerProfile({ name: myName, pic: myAvatar, userId: me?.uid });
    clientRef.current.createRoom(`طاولة ${myName}`);
  };

  const handleJoinRoomByCode = (code: string) => {
    carromSoundPool.warmup();
    const clean = code.trim();
    if (!clean) return;
    if (!clientRef.current?.raw?.connected) {
      setLobbyError("الاتصال بالخادم غير جاهز بعد");
      return;
    }
    clientRef.current.registerProfile({ name: myName, pic: myAvatar, userId: me?.uid });
    clientRef.current.joinWaitingRoom(clean);
  };

  const handlePlayAgain = () => {
    if (!aiMode && clientRef.current && roomJoined) {
      clientRef.current.playAgain();
    }
    resetBoardForMatch(true);
    if (!aiMode) {
      emitSnapshotIfMultiplayer();
    }
  };

  const handleExitToLobby = () => {
    stopLoops();
    clearTurnTimer();
    setLeaveAlert(null);
    if (!aiMode && clientRef.current && roomJoined) {
      clientRef.current.leaveRoom();
    }
    setAiMode(false);
    aiModeRef.current = false;
    setRoomJoined(false);
    roomJoinedRef.current = false;
    setRoomReady(false);
    roomReadyRef.current = false;
    setCurrentRoomId("");
    currentRoomIdRef.current = "";
    setMySlot(null);
    mySlotRef.current = null;
    setWinnerIdx(null);
    setShowVsOverlay(false);
    setShowLobby(true);
    resetBoardForMatch(false);
    setStatusMsg("اختر طريقة اللعب للبدء");
    clientRef.current?.requestWaitingRooms();
  };

  const handleWindowExit = () => {
    stopLoops();
    clearTurnTimer();
    if (!aiMode && clientRef.current && roomJoined) {
      clientRef.current.leaveRoom();
    }
    onExit();
  };

  const handleToggleSfx = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    setSoundMuted(next);
    carromSoundPool.setSfxMuted(next);
    if (!next) carromSoundPool.warmup();
  };

  const handleToggleBgm = async () => {
    const active = await carromSoundPool.toggleBgm();
    setBgmOn(active);
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    const msg = chatDraft.trim();
    if (!msg) return;
    if (aiMode) {
      setChatMsgs((prev) => [
        ...prev.slice(-49),
        { id: `${Date.now()}`, senderName: myName, senderAvatar: myAvatar, message: msg, ts: Date.now(), isOwn: true },
      ]);
      setChatDraft("");
      return;
    }
    if (clientRef.current && roomJoined) {
      clientRef.current.sendChatMessage(msg);
      setChatDraft("");
    }
  };

  // Bottom vs Top perspective indices
  const bottomIdx: 0 | 1 = isRotatedView ? 1 : 0;
  const topIdx: 0 | 1 = isRotatedView ? 0 : 1;
  const bottomProfile = matchProfiles[bottomIdx];
  const topProfile = matchProfiles[topIdx];
  const bottomScore = scores[bottomIdx];
  const topScore = scores[topIdx];

  const turnBadgeText = !roomJoined
    ? "في الانتظار"
    : !roomReady
      ? "بانتظار الخصم"
      : aiMode
        ? currPlayer === 0
          ? "دورك الآن"
          : "دور البوت"
        : mySlot === -1
          ? `دور اللاعب ${currPlayer + 1}`
          : currPlayer === mySlot
            ? "دورك الآن"
            : "دور الخصم";

  return (
    <div dir="rtl" className={`carrom-shell carrom-shell--${backdropTheme}`}>
      <canvas ref={ambientCanvasRef} className="carrom-ambient-canvas" aria-hidden="true" />

      <div className="carrom-inner">
        {/* Top Navigation Bar */}
        <header className="flex items-center justify-between gap-2 px-1 shrink-0">
          <button
            type="button"
            onClick={roomJoined ? handleExitToLobby : onExit}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition"
            title={roomJoined ? "العودة لقائمة الغرف" : exitLabel}
          >
            <ChevronRight className="w-4 h-4" />
            <span>{roomJoined ? "الغرف" : exitLabel}</span>
          </button>

          <div className="text-center min-w-0">
            <div className="text-sm font-extrabold tracking-tight text-white truncate">
              غرفة لعبة الكيرم
            </div>
            <div className="text-[11px] text-amber-200/80 font-mono truncate">
              {currentRoomId ? `الغرفة: ${currentRoomId}` : connected ? "متصل بالخادم" : "جاري الاتصال..."}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <img
              src={getSafeAvatarSrc(myAvatar, myName)}
              alt={myName}
              className="w-9 h-9 rounded-full object-cover border-2 border-amber-300 shadow-md"
            />
            {roomJoined && (
              <button
                type="button"
                onClick={handleWindowExit}
                className="p-1.5 rounded-full bg-rose-500/80 hover:bg-rose-500 text-white transition"
                title={exitLabel}
                aria-label={exitLabel}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Opponent Left Notification Banner */}
        {leaveAlert && (
          <div className="carrom-leave-banner" role="alert" aria-live="assertive">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={getSafeAvatarSrc(leaveAlert.avatar, leaveAlert.name)}
                alt={leaveAlert.name}
                className="w-7 h-7 rounded-full object-cover border border-white/60 shrink-0"
              />
              <span className="text-xs font-extrabold truncate">{leaveAlert.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setLeaveAlert(null)}
              className="p-1 rounded-full hover:bg-white/20 text-white shrink-0 transition"
              aria-label="إخفاء الإشعار"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Controls Header Row */}
        <div className="flex items-center justify-between gap-2 px-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleSfx}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition ${
                sfxMuted
                  ? "bg-white/10 border-white/15 text-slate-300"
                  : "bg-gradient-to-br from-emerald-400 to-sky-500 border-white/25 text-white shadow-md"
              }`}
              title={sfxMuted ? "تفعيل المؤثرات الصوتية" : "كتم المؤثرات الصوتية"}
            >
              {sfxMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => void handleToggleBgm()}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition ${
                bgmOn
                  ? "bg-amber-500 border-amber-300 text-slate-950 shadow-md"
                  : "bg-white/10 border-white/15 text-slate-200 hover:bg-white/20"
              }`}
              title={bgmOn ? "إيقاف الموسيقى" : "تشغيل موسيقى هادئة"}
            >
              <Music className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center select-none">
            <span className="text-lg sm:text-xl font-black tracking-[0.22em] text-amber-300 drop-shadow">
              CARROM
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {roomJoined && !aiMode && (
              <button
                type="button"
                onClick={() => {
                  clientRef.current?.requestSync();
                  setStatusMsg("جاري تحديث وتزامن اللوحة...");
                }}
                className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-md transition"
                title="مزامنة اللوحة"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCustomizeModal(true)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-amber-200 flex items-center justify-center transition"
              title="تخصيص اللوحة والخلفية"
            >
              <Palette className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-white flex items-center justify-center shadow-md transition"
              title="دليل وقوانين اللعبة"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Score Bar (Perspective-Aware P1 vs P2 with Turn Timer Ring) */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-0.5 shrink-0">
          {/* Bottom player perspective card */}
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded-2xl border backdrop-blur-sm transition ${
              roomReady && currPlayer === bottomIdx
                ? "bg-amber-500/20 border-amber-400 shadow-md"
                : "bg-black/30 border-white/10"
            }`}
          >
            <AvatarWithTurnTimer
              avatarSrc={getSafeAvatarSrc(bottomProfile.playerAvatar, bottomProfile.playerName)}
              name={bottomProfile.playerName}
              isActiveTurn={Boolean(
                roomReady && currPlayer === bottomIdx && phase !== "shooting" && winnerIdx === null,
              )}
              deadlineAt={turnDeadlineAt}
              durationMs={turnDurationMs}
              secsLeft={turnSecsLeft}
              serverOffsetMs={serverOffsetMsRef.current}
              inactiveBorderClass="border-amber-300/70"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold truncate flex items-center gap-1">
                <span>{bottomProfile.playerName}</span>
                {mySlot === bottomIdx && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-200">
                    أنت
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-amber-200/90">
                <strong className="text-xs text-amber-300">{bottomScore.score}</strong>
                <span>⚫{bottomScore.coins.black}</span>
                <span>⚪{bottomScore.coins.white}</span>
              </div>
            </div>
          </div>

          {/* Center Turn Pill */}
          <div className="px-2.5 py-1 rounded-full bg-black/55 border border-amber-400/35 text-[11px] font-extrabold text-amber-300 whitespace-nowrap shadow">
            {turnBadgeText}
            {roomReady && phase !== "shooting" && turnSecsLeft !== null && (
              <span className="mr-1 font-mono text-white/90">({turnSecsLeft}s)</span>
            )}
          </div>

          {/* Top player perspective card */}
          <div
            className={`flex items-center justify-end gap-2 px-2 py-1.5 rounded-2xl border backdrop-blur-sm transition ${
              roomReady && currPlayer === topIdx
                ? "bg-amber-500/20 border-amber-400 shadow-md"
                : "bg-black/30 border-white/10"
            }`}
          >
            <div className="min-w-0 flex-1 text-left">
              <div className="text-[11px] font-extrabold truncate flex items-center justify-end gap-1">
                {mySlot === topIdx && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-200">
                    أنت
                  </span>
                )}
                <span>{topProfile.playerName}</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-[10px] text-amber-200/90">
                <span>⚪{topScore.coins.white}</span>
                <span>⚫{topScore.coins.black}</span>
                <strong className="text-xs text-amber-300">{topScore.score}</strong>
              </div>
            </div>
            <AvatarWithTurnTimer
              avatarSrc={getSafeAvatarSrc(topProfile.playerAvatar, topProfile.playerName)}
              name={topProfile.playerName}
              isActiveTurn={Boolean(
                roomReady && currPlayer === topIdx && phase !== "shooting" && winnerIdx === null,
              )}
              deadlineAt={turnDeadlineAt}
              durationMs={turnDurationMs}
              secsLeft={turnSecsLeft}
              serverOffsetMs={serverOffsetMsRef.current}
              inactiveBorderClass="border-white/25"
            />
          </div>
        </div>

        {/* 520x520 Layered Carrom Board */}
        <div className="carrom-board-stage">
          <div className="carrom-board-frame">
            <div className="carrom-toast-pill">{statusMsg}</div>

            <div className={`carrom-canvas-stack ${isRotatedView ? "carrom-canvas-stack--rotated" : ""}`}>
              <canvas ref={bgCanvasRef} className="carrom-layer-canvas carrom-layer-bg" />
              <canvas ref={boardCanvasRef} className="carrom-layer-canvas carrom-layer-board" />
              <canvas
                ref={activeCanvasRef}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                className="carrom-layer-canvas carrom-layer-active"
              />
            </div>
          </div>

          {/* TopTop Striker Control Slider & Quick Aim Actions */}
          <div className="w-full max-w-[470px] mt-1.5 flex items-center gap-2 px-2 py-1.5 rounded-2xl bg-black/35 border border-white/10 shrink-0">
            {canInteractTurn && (phase === "place" || phase === "aim_locked" || phase === "aim_drag") ? (
              <>
                <SlidersHorizontal className="w-4 h-4 text-amber-300 shrink-0" />
                <input
                  type="range"
                  dir="ltr"
                  min={BASELINE_MIN_X}
                  max={BASELINE_MAX_X}
                  value={isRotatedView ? BASELINE_MAX_X + BASELINE_MIN_X - strikerSliderX : strikerSliderX}
                  disabled={phase !== "place"}
                  onChange={(e) => {
                    const rawVal = Number(e.target.value);
                    const canonicalX = isRotatedView
                      ? BASELINE_MAX_X + BASELINE_MIN_X - rawVal
                      : rawVal;
                    carromSoundPool.warmup();
                    moveStrikerToX(canonicalX);
                  }}
                  aria-label="تحريك موضع المضرب"
                  className="carrom-slider-track flex-1 disabled:opacity-45"
                />

                {phase === "place" ? (
                  <button
                    type="button"
                    disabled={strikerOverlap}
                    onClick={() => {
                      if (overlapRef.current) return;
                      const rt = runtimeRef.current;
                      const striker = rt.discs[0];
                      if (!striker) return;
                      emitPlaceThrottled(striker.x, striker.y, true);
                      aimPointRef.current = {
                        x: striker.x,
                        y: rt.currPlayer === 1 ? striker.y - 45 : striker.y + 45,
                      };
                      lastMouseRef.current = { x: 0, y: 0 };
                      setAimPowerPct(Math.round((45 / 85) * 100));
                      updatePhase("aim_locked");
                      setStatusMsg("تم التثبيت — اسحب السهم ثم اضغط للتسديد");
                      renderActiveCanvasNow();
                    }}
                    className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-extrabold shrink-0 transition"
                  >
                    تثبيت للتسديد
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono text-amber-300 font-bold">
                      {aimPowerPct}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        aimPointRef.current = null;
                        setAimPowerPct(0);
                        updatePhase("place");
                        setStatusMsg("حرّك المضرب لاختيار موقع جديد");
                        renderActiveCanvasNow();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      تموضع
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full text-center text-[11px] text-amber-100/75 font-semibold">
                {phase === "shooting"
                  ? "انتظر توقف الأقراص..."
                  : phase === "ai_thinking"
                    ? "البوت يستعد للتسديد..."
                    : roomJoined
                      ? roomReady
                        ? "بانتظار الخصم لتنفيذ التسديدة..."
                        : "بانتظار انضمام خصم للغرفة..."
                      : "أنشئ غرفة أو العب ضد البوت من القائمة"}
              </div>
            )}
          </div>
        </div>

        {/* Inline Room Chat + Quick Emojis */}
        <div className="flex-1 min-h-0 flex flex-col bg-black/30 border border-white/10 rounded-2xl p-2 gap-1.5 overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto chat-scroll shrink-0 pb-0.5">
            {QUICK_CHAT_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                disabled={!roomJoined}
                onClick={() => {
                  if (aiMode) {
                    setChatMsgs((prev) => [
                      ...prev.slice(-49),
                      { id: `${Date.now()}`, senderName: myName, senderAvatar: myAvatar, message: phrase, ts: Date.now(), isOwn: true },
                    ]);
                  } else if (clientRef.current && roomJoined) {
                    clientRef.current.sendChatMessage(phrase);
                  }
                }}
                className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-[10px] font-bold text-amber-100 whitespace-nowrap transition shrink-0"
              >
                {phrase}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto chat-scroll space-y-1 px-1">
            {chatMsgs.length === 0 ? (
              <div className="text-center text-[11px] text-white/45 py-2">
                {roomJoined ? "رحّب بخصمك في دردشة الطاولة..." : "الدردشة متاحة فور دخول الغرفة"}
              </div>
            ) : (
              chatMsgs.map((m) =>
                m.isSystem ? (
                  <div
                    key={m.id}
                    className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-400/35 text-[11px] font-bold text-rose-100 text-center"
                  >
                    {m.message}
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className={`flex items-start gap-1.5 text-xs ${
                      m.isOwn ? "justify-start" : "justify-start"
                    }`}
                  >
                    <img
                      src={getSafeAvatarSrc(m.senderAvatar, m.senderName)}
                      alt={m.senderName}
                      className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5"
                    />
                    <div className="min-w-0 bg-white/8 border border-white/10 rounded-xl px-2 py-1">
                      <span className="font-extrabold text-amber-300 ml-1">{m.senderName}:</span>
                      <span className="text-white/95 break-words">{m.message}</span>
                    </div>
                  </div>
                ),
              )
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              maxLength={200}
              disabled={!roomJoined}
              placeholder={roomJoined ? "اكتب رسالة..." : "ادخل غرفة لتفعيل الدردشة"}
              className="flex-1 min-w-0 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs text-white placeholder:text-white/45 outline-none focus:border-amber-400/60"
            />
            <button
              type="submit"
              disabled={!roomJoined || !chatDraft.trim()}
              className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition"
              aria-label="إرسال"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Lobby Popup Overlay (TopTop Style) */}
      {showLobby && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3">
          <div className="carrom-lobby-card w-full max-w-[430px] max-h-[88dvh] flex flex-col rounded-3xl shadow-2xl border border-white/60 p-4 gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-emerald-700" />
                <h2 className="text-base font-black text-emerald-950">طاولات الكيرم</h2>
              </div>
              <button
                type="button"
                onClick={onExit}
                className="p-1.5 rounded-full hover:bg-emerald-900/10 text-emerald-950 transition"
                aria-label={exitLabel}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {lobbyError && (
              <div className="px-3 py-2 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-900 text-xs font-bold">
                {lobbyError}
              </div>
            )}

            {/* Top Action Cards (Online Create vs Solo AI Bot) */}
            <div className="grid grid-cols-2 gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCreateOnlineRoom}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 hover:brightness-105 text-white shadow-lg transition active:scale-95"
              >
                <img
                  src="/carrom-game/assets/images/game-icon.png"
                  alt="كيرم"
                  className="w-11 h-11 rounded-xl shadow object-cover"
                />
                <span className="text-sm font-black">كيرم أونلاين</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full">
                  <Users className="w-3 h-3" />
                  إنشاء غرفة (1 ضد 1)
                </span>
              </button>

              <button
                type="button"
                onClick={handleStartAiMatch}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:brightness-105 text-white shadow-lg transition active:scale-95"
              >
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shadow">
                  <Bot className="w-7 h-7" />
                </div>
                <span className="text-sm font-black">العب ضد البوت</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full">
                  تحدي فوري
                </span>
              </button>
            </div>

            {/* Join by Room Code */}
            <div className="flex gap-1.5 shrink-0">
              <input
                type="text"
                value={joinCodeDraft}
                onChange={(e) => setJoinCodeDraft(e.target.value)}
                placeholder="لديك رمز غرفة؟ مثال: CR-AB12C"
                className="flex-1 min-w-0 rounded-xl bg-white/80 border border-emerald-900/15 px-3 py-1.5 text-xs text-emerald-950 placeholder:text-emerald-900/45 outline-none"
              />
              <button
                type="button"
                onClick={() => handleJoinRoomByCode(joinCodeDraft)}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold shrink-0 transition"
              >
                انضمام
              </button>
            </div>

            {/* Waiting Rooms List */}
            <div className="flex items-center justify-between pt-1 shrink-0">
              <span className="text-xs font-black text-emerald-950">غرف الألعاب ({waitingRooms.length})</span>
              <button
                type="button"
                onClick={() => clientRef.current?.requestWaitingRooms()}
                className="p-1.5 rounded-full bg-emerald-900/10 hover:bg-emerald-900/20 text-emerald-900 transition"
                title="تحديث الغرف"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto chat-scroll space-y-2">
              {waitingRooms.length === 0 ? (
                <div className="py-6 px-3 rounded-2xl bg-white/45 border border-emerald-900/10 text-center space-y-1.5">
                  <Gamepad2 className="w-7 h-7 mx-auto text-emerald-800/70" />
                  <p className="text-xs font-bold text-emerald-950/75">
                    لا يوجد لاعبون بانتظار الخصم حالياً. قم بإنشاء غرفة أو العب ضد البوت!
                  </p>
                </div>
              ) : (
                waitingRooms.map((room) => {
                  const full = room.playerCount >= 2;
                  return (
                    <div
                      key={room.roomCode}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/80 border border-emerald-900/10 shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getSafeAvatarSrc(room.hostAvatar, room.hostName)}
                          alt={room.hostName}
                          className="w-9 h-9 rounded-full object-cover border border-amber-400 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-emerald-950 truncate">
                            {room.hostName}
                          </div>
                          <div className="text-[10px] text-emerald-800/75 truncate font-mono">
                            {room.roomCode} • {room.playerCount}/2 لاعبين
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleJoinRoomByCode(room.roomCode)}
                        className={`px-3 py-1.5 rounded-xl text-white text-xs font-extrabold shrink-0 transition ${
                          full
                            ? "bg-slate-600 hover:bg-slate-500"
                            : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        {full ? "مشاهدة" : "انضمام"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="text-center text-[11px] font-bold text-emerald-900/75 shrink-0">
              {connecting
                ? "جاري الاتصال بخادم الألعاب..."
                : connected
                  ? "متصل — اختر غرفة أو ابدأ التحدي الآن"
                  : "تعذر الاتصال بالخادم — يمكنك اللعب ضد البوت"}
            </div>
          </div>
        </div>
      )}

      {/* VS Match Intro Overlay */}
      {showVsOverlay && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 gap-5">
          <div className="text-2xl font-black tracking-[0.25em] text-amber-300">CARROM</div>
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            <div className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/10 border border-amber-400/50 w-32 sm:w-40">
              <img
                src={getSafeAvatarSrc(matchProfiles[0].playerAvatar, matchProfiles[0].playerName)}
                alt={matchProfiles[0].playerName}
                className="w-16 h-16 rounded-full object-cover border-2 border-amber-300"
              />
              <span className="text-xs font-extrabold text-white truncate max-w-full">
                {matchProfiles[0].playerName}
              </span>
            </div>

            <span className="text-3xl font-black text-amber-400 drop-shadow">VS</span>

            <div className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-white/10 border border-sky-400/50 w-32 sm:w-40">
              <img
                src={getSafeAvatarSrc(matchProfiles[1].playerAvatar, matchProfiles[1].playerName)}
                alt={matchProfiles[1].playerName}
                className="w-16 h-16 rounded-full object-cover border-2 border-sky-300"
              />
              <span className="text-xs font-extrabold text-white truncate max-w-full">
                {matchProfiles[1].playerName}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Win Trophy Popup */}
      {winnerIdx !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-amber-950/95 to-stone-950 border border-amber-400/50 p-5 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-400/20 border border-amber-300 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-black text-amber-300">انتهت اللعبة!</h2>
              <p className="text-xs text-white/75 mt-0.5">فاز في المباراة</p>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <img
                src={getSafeAvatarSrc(matchProfiles[winnerIdx].playerAvatar, matchProfiles[winnerIdx].playerName)}
                alt={matchProfiles[winnerIdx].playerName}
                className="w-16 h-16 rounded-full object-cover border-2 border-amber-300 shadow-lg"
              />
              <div className="text-base font-black text-white">{matchProfiles[winnerIdx].playerName}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-2xl bg-white/8 border border-white/10">
                <div className="truncate font-bold text-white/80">{matchProfiles[0].playerName}</div>
                <div className="text-base font-black text-amber-300 mt-0.5">{scores[0].score}</div>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/8 border border-white/10">
                <div className="truncate font-bold text-white/80">{matchProfiles[1].playerName}</div>
                <div className="text-base font-black text-amber-300 mt-0.5">{scores[1].score}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handlePlayAgain}
                className="py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition"
              >
                🔄 العب مجدداً
              </button>
              <button
                type="button"
                onClick={handleExitToLobby}
                className="py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition"
              >
                🚪 خروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Board & Theme Modal */}
      {showCustomizeModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setShowCustomizeModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-4 space-y-4 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">تخصيص الطاولة والمظهر</h3>
              <button
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">خشب اللوحة</div>
              <div className="grid grid-cols-3 gap-2">
                {BOARD_SKIN_LABELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBoardSkin(item.id)}
                    className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1.5 transition ${
                      boardSkin === item.id
                        ? "border-amber-400 bg-amber-400/15 text-amber-200"
                        : "border-slate-700 bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-white/30"
                      style={{ backgroundColor: item.swatch }}
                    />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">شعار المنتصف</div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "classic", label: "النجمة الكلاسيكية", src: "/carrom-game/assets/images/windRose.svg" },
                    { id: "modern", label: "الوردة العصرية", src: "/carrom-game/assets/images/windRose1.svg" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRoseSkin(item.id)}
                    className={`p-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-2 transition ${
                      roseSkin === item.id
                        ? "border-amber-400 bg-amber-400/15 text-amber-200"
                        : "border-slate-700 bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <img src={item.src} alt={item.label} className="w-6 h-6 bg-[#ebdfc3] rounded-full p-0.5" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300">خلفية الساحة</div>
              <div className="grid grid-cols-3 gap-2">
                {BACKDROP_THEME_LABELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBackdropTheme(item.id)}
                    className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1.5 transition ${
                      backdropTheme === item.id
                        ? "border-amber-400 bg-amber-400/15 text-amber-200"
                        : "border-slate-700 bg-slate-800/60 text-slate-300"
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-white/30"
                      style={{ backgroundColor: item.swatch }}
                    />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help / Game Rules Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-4 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-amber-300">دليل وقوانين الكيرم</h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-around p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs font-extrabold">
              <div className="flex items-center gap-1.5">
                <img src="/carrom-game/assets/images/black.png" alt="أسود" className="w-6 h-6" />
                <span>10 نقاط</span>
              </div>
              <div className="flex items-center gap-1.5">
                <img src="/carrom-game/assets/images/white.png" alt="أبيض" className="w-6 h-6" />
                <span>20 نقطة</span>
              </div>
              <div className="flex items-center gap-1.5">
                <img src="/carrom-game/assets/images/red.png" alt="أحمر" className="w-6 h-6" />
                <span className="text-rose-400">50 نقطة</span>
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-200 leading-relaxed list-disc pr-4">
              <li>حرّك المضرب باللمس أو الفأرة أو شريط التحكم أسفل اللوحة.</li>
              <li>اضغط لتثبيت المضرب، أو اسحب مباشرة من المضرب للخلف لتحديد الاتجاه والقوة ثم اترك للتسديد.</li>
              <li>عند التثبيت يمكنك الضغط على <strong>Escape</strong> أو زر <strong>تموضع</strong> لتعديل مكان المضرب.</li>
              <li>بعد إدخال <strong>الملكة الحمراء (+50)</strong> يجب إدخال قرص آخر فوراً لتأكيدها وإلا تعود للمنتصف.</li>
              <li>الأقراص المحددة باللون <strong className="text-sky-400">الأزرق</strong> داخل منطقة البداية تسبب جزاءً عند إصابتها كأول لمسة.</li>
            </ul>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition"
            >
              فهمت، لنلعب!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
