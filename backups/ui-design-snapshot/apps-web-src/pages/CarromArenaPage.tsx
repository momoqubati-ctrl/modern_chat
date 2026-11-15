import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowRight,
  Gamepad2,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sun,
  Users,
} from "lucide-react";
import { CarromArenaClient, useChatStore } from "@newchat/core-client";
import {
  CARROM_BOARD_SIZE,
  carromClamp,
  createCarromInitialPieces,
  simulateCarromShot,
  type CarromGameState,
} from "@newchat/shared";
import { resolveGatewayBaseUrl } from "../lib/mediaUrl.js";
import { drawCarromBoardCanvas } from "../components/RoomCarromModal.js";
import { MemberAvatar } from "../components/MemberAvatar.js";

interface CarromArenaPageProps {
  dark: boolean;
  onToggleTheme: () => void;
  onBackToChat: () => void;
}

interface ArenaWaitingRoom {
  roomCode: string;
  title: string;
  hostName: string;
  playerCount: number;
  spectatorCount: number;
  status: string;
}

interface ArenaPlayer {
  socketId: string;
  slot: 0 | 1;
  name: string;
  pic: string;
  userId?: string;
}

interface ArenaChatMsg {
  name?: string;
  msg: string;
  ts: number;
}

function makeFreshGameState(roomCode: string): CarromGameState {
  return {
    roomId: roomCode,
    status: "active",
    players: [],
    scores: [0, 0],
    turnSeat: 0,
    shotInProgress: false,
    winnerSeat: null,
    winnerTopic: "",
    pieces: createCarromInitialPieces(),
    lastActionText: "بدأت الجولة! دور اللاعب الأول",
    queenPocketed: false,
    queenCoveredBy: null,
    strikerFouled: false,
    turnTimerStartedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function CarromArenaPage({
  dark,
  onToggleTheme,
  onBackToChat,
}: CarromArenaPageProps) {
  const me = useChatStore((s) => s.me);

  const clientRef = useRef<CarromArenaClient | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameRef = useRef<CarromGameState | null>(null);
  const lastPreviewAtRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [mySocketId, setMySocketId] = useState("");
  const [playerName, setPlayerName] = useState(() => me?.topic || "لاعب كيرم");
  const [waitingRooms, setWaitingRooms] = useState<ArenaWaitingRoom[]>([]);
  const [roomTitleDraft, setRoomTitleDraft] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [currentRoomCode, setCurrentRoomCode] = useState("");
  const [currentRoomTitle, setCurrentRoomTitle] = useState("");
  const [mySlot, setMySlot] = useState<number>(-1);
  const [players, setPlayers] = useState<ArenaPlayer[]>([]);
  const [gameState, setGameState] = useState<CarromGameState | null>(null);
  const [opponentPreview, setOpponentPreview] = useState<{ offset?: number; angle?: number; power?: number } | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ArenaChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  const [offset, setOffset] = useState(0);
  const [angleDeg, setAngleDeg] = useState(-90);
  const [power, setPower] = useState(65);
  const [pullVec, setPullVec] = useState<{ dx: number; dy: number; power: number } | null>(null);

  useEffect(() => {
    gameRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (me?.topic) setPlayerName(me.topic);
  }, [me?.topic]);

  useEffect(() => {
    const client = new CarromArenaClient();
    clientRef.current = client;
    const raw = client.connect(resolveGatewayBaseUrl(), {
      name: playerName,
      pic: me?.pic || "pic.png",
      userId: me?.uid,
    });

    raw.on("connect", () => {
      setConnected(true);
      setMySocketId(raw.id || "");
      client.requestWaitingRooms();
    });
    raw.on("disconnect", () => {
      setConnected(false);
    });
    raw.on("profile_ready", (d: { id?: string }) => {
      if (d?.id) setMySocketId(d.id);
      client.requestWaitingRooms();
    });
    raw.on("waiting_rooms", (list: ArenaWaitingRoom[]) => {
      if (Array.isArray(list)) setWaitingRooms(list);
    });
    raw.on("join_error", (d: { msg?: string }) => {
      setErrorMsg(String(d?.msg || "تعذر الانضمام للطاولة"));
    });
    raw.on("room_joined", (d: { roomCode: string; title: string; slot: number; players: ArenaPlayer[] }) => {
      setErrorMsg("");
      setCurrentRoomCode(d.roomCode);
      setCurrentRoomTitle(d.title || d.roomCode);
      setMySlot(d.slot);
      setPlayers(Array.isArray(d.players) ? d.players : []);
      setChatMsgs([]);
      setAngleDeg(d.slot === 1 ? 90 : -90);
      if (d.slot === 0) {
        const fresh = makeFreshGameState(d.roomCode);
        setGameState(fresh);
      } else {
        client.requestSync();
      }
    });
    raw.on("room_waiting", (d: { players?: ArenaPlayer[] }) => {
      if (Array.isArray(d?.players)) setPlayers(d.players);
    });
    raw.on("game_ready", (d: { roomCode: string; players: ArenaPlayer[]; snapshot?: CarromGameState | null }) => {
      if (Array.isArray(d.players)) setPlayers(d.players);
      if (d.snapshot) {
        setGameState(d.snapshot);
      } else {
        const fresh = makeFreshGameState(d.roomCode);
        setGameState(fresh);
        if (raw.id && d.players[0]?.socketId === raw.id) {
          client.sendStateSnapshot(fresh);
        }
      }
    });
    raw.on("room_resume_state", (d: { snapshot?: CarromGameState }) => {
      if (d?.snapshot) setGameState(d.snapshot);
    });
    raw.on("request_sync_from_peer", () => {
      if (gameRef.current) client.sendStateSnapshot(gameRef.current);
    });
    raw.on("opponent_striker_place", (d: { offset?: number }) => {
      setOpponentPreview((prev) => ({ ...(prev ?? {}), offset: Number(d?.offset ?? 0) }));
    });
    raw.on("opponent_striker_aim", (d: { offset?: number; angle?: number; power?: number }) => {
      setOpponentPreview(d);
    });
    raw.on("opponent_striker_hit", (shot: { seat?: number; topic?: string; angle?: number; power?: number; offset?: number; pullDx?: number; pullDy?: number; pullPower?: number }) => {
      setOpponentPreview(null);
      if (!gameRef.current) return;
      const cloned: CarromGameState = {
        ...gameRef.current,
        scores: [...gameRef.current.scores] as [number, number],
        pieces: gameRef.current.pieces.map((p) => ({ ...p })),
      };
      simulateCarromShot(cloned, shot.seat ?? cloned.turnSeat, shot, shot.topic || "الخصم");
      setGameState(cloned);
    });
    raw.on("opponent_play_again", () => {
      if (!currentRoomCode && gameRef.current?.roomId) {
        setGameState(makeFreshGameState(gameRef.current.roomId));
      } else if (gameRef.current) {
        setGameState(makeFreshGameState(gameRef.current.roomId));
      }
    });
    raw.on("player_reassigned", (d: { players?: ArenaPlayer[] }) => {
      if (Array.isArray(d?.players)) setPlayers(d.players);
    });
    raw.on("match_paused", () => {
      setErrorMsg("غادر الخصم الطاولة — بانتظار لاعب آخر");
    });
    raw.on("chat_message", (m: ArenaChatMsg) => {
      if (m?.msg) setChatMsgs((prev) => [...prev.slice(-49), m]);
    });

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  const isMyTurn = useMemo(() => {
    if (!gameState || gameState.status !== "active") return false;
    if (mySlot !== 0 && mySlot !== 1) return false;
    return gameState.turnSeat === mySlot && players.length >= 2;
  }, [gameState, mySlot, players.length]);

  useEffect(() => {
    if (!currentRoomCode || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    drawCarromBoardCanvas(ctx, {
      pieces: gameState?.pieces ?? [],
      seatView: gameState?.turnSeat ?? 0,
      offset,
      angleDeg,
      power,
      canShowStriker: Boolean(gameState && gameState.status === "active" && players.length >= 2),
      aimPreview: !isMyTurn ? opponentPreview : null,
      pullVec: isMyTurn ? pullVec : null,
    });
  }, [currentRoomCode, gameState, offset, angleDeg, power, players.length, isMyTurn, opponentPreview, pullVec]);

  const executeShot = useCallback(
    (shotInput: { offset: number; angle: number; power: number; pullDx?: number; pullDy?: number; pullPower?: number }) => {
      if (!isMyTurn || !gameRef.current || !clientRef.current) return;
      const cloned: CarromGameState = {
        ...gameRef.current,
        scores: [...gameRef.current.scores] as [number, number],
        pieces: gameRef.current.pieces.map((p) => ({ ...p })),
      };
      simulateCarromShot(cloned, mySlot, shotInput, playerName);
      setGameState(cloned);
      clientRef.current.strikerHit({ ...shotInput, seat: mySlot, topic: playerName });
      clientRef.current.sendStateSnapshot(cloned);
    },
    [isMyTurn, mySlot, playerName],
  );

  const emitAimPreview = (nextOffset: number, nextAngle: number, nextPower: number) => {
    if (!isMyTurn || !clientRef.current) return;
    const now = Date.now();
    if (now - lastPreviewAtRef.current < 80) return;
    lastPreviewAtRef.current = now;
    clientRef.current.strikerAim({ offset: nextOffset, angle: nextAngle, power: nextPower });
  };

  const toBoardPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CARROM_BOARD_SIZE / rect.width),
      y: (e.clientY - rect.top) * (CARROM_BOARD_SIZE / rect.height),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isMyTurn) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = toBoardPoint(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || !dragStartRef.current) return;
    const pt = toBoardPoint(e);
    const pullDx = dragStartRef.current.x - pt.x;
    const pullDy = dragStartRef.current.y - pt.y;
    const len = Math.hypot(pullDx, pullDy);
    if (len < 8) {
      setPullVec(null);
      return;
    }
    const nextAngle = Math.round((Math.atan2(pullDy, pullDx) * 180) / Math.PI);
    const nextPower = Math.round(carromClamp(len * 0.9, 18, 100));
    setAngleDeg(nextAngle);
    setPower(nextPower);
    setPullVec({ dx: pullDx, dy: pullDy, power: carromClamp(len * 1.4, 20, 230) });
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
      executeShot({
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

  const handleCreateRoom = (e: FormEvent) => {
    e.preventDefault();
    clientRef.current?.registerProfile({ name: playerName.trim() || "لاعب كيرم", pic: me?.pic || "pic.png", userId: me?.uid });
    clientRef.current?.createRoom(roomTitleDraft.trim() || `طاولة ${playerName.trim() || "كيرم"}`);
    setRoomTitleDraft("");
  };

  const handleSendTableChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim() || !clientRef.current) return;
    clientRef.current.raw?.emit("send_chat_message", { msg: chatDraft.trim(), name: playerName });
    setChatMsgs((prev) => [...prev.slice(-49), { name: playerName, msg: chatDraft.trim(), ts: Date.now() }]);
    setChatDraft("");
  };

  const pageCls = dark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div className={`min-h-screen flex flex-col ${pageCls}`}>
      <header
        className={`border-b px-4 py-3 flex items-center justify-between gap-3 ${
          dark ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold">ساحة الكيرم التنافسية</h1>
            <p className="text-[11px] opacity-65">
              {connected ? `متصل بالخادم (${mySocketId.slice(0, 6)})` : "جارٍ الاتصال..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2 rounded-xl border transition ${
              dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-100"
            }`}
            aria-label="تبديل المظهر"
          >
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للدردشة
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-4">
        {errorMsg && (
          <div className="px-4 py-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {!currentRoomCode ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-5 p-4 rounded-3xl border space-y-4 ${cardCls}`}>
              <div>
                <label className="block text-xs font-extrabold mb-1.5">اسم اللاعب</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-2.5 pt-2 border-t border-slate-800/30">
                <label className="block text-xs font-extrabold">إنشاء طاولة جديدة</label>
                <input
                  type="text"
                  value={roomTitleDraft}
                  onChange={(e) => setRoomTitleDraft(e.target.value)}
                  placeholder="عنوان الطاولة (اختياري)"
                  className={inputCls}
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء طاولة والانتظار
                </button>
              </form>

              <div className="space-y-2 pt-2 border-t border-slate-800/30">
                <label className="block text-xs font-extrabold">انضمام برمز طاولة</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCodeDraft}
                    onChange={(e) => setJoinCodeDraft(e.target.value)}
                    placeholder="CR-XXXXX"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => joinCodeDraft.trim() && clientRef.current?.joinWaitingRoom(joinCodeDraft.trim())}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold shrink-0"
                  >
                    انضمام
                  </button>
                </div>
              </div>
            </div>

            <div className={`lg:col-span-7 p-4 rounded-3xl border space-y-3 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  الطاولات النشطة ({waitingRooms.length})
                </h2>
                <button
                  type="button"
                  onClick={() => clientRef.current?.requestWaitingRooms()}
                  className="text-xs text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  تحديث
                </button>
              </div>

              {waitingRooms.length === 0 ? (
                <div className={`p-10 rounded-2xl border text-center text-xs opacity-65 ${subCls}`}>
                  لا توجد طاولات حالياً — أنشئ طاولة جديدة ودعُ أصدقاءك بالرمز!
                </div>
              ) : (
                <div className="space-y-2">
                  {waitingRooms.map((r) => (
                    <div
                      key={r.roomCode}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${subCls}`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate">{r.title}</div>
                        <div className="text-[11px] opacity-65 mt-0.5">
                          المضيف: {r.hostName} | رمز: <code className="font-mono">{r.roomCode}</code> | لاعبين: {r.playerCount}/2
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          clientRef.current?.registerProfile({
                            name: playerName.trim() || "لاعب كيرم",
                            pic: me?.pic || "pic.png",
                            userId: me?.uid,
                          });
                          clientRef.current?.joinWaitingRoom(r.roomCode);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shrink-0"
                      >
                        {r.playerCount < 2 ? "دخول للعب" : "مشاهدة"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className={`lg:col-span-7 p-3 sm:p-4 rounded-3xl border flex flex-col items-center ${cardCls}`}>
              <div className="w-full flex items-center justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-extrabold">{currentRoomTitle}</span>
                  <span className="mr-2 font-mono text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                    {currentRoomCode}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {gameState?.status === "finished" && (
                    <button
                      type="button"
                      onClick={() => {
                        const fresh = makeFreshGameState(currentRoomCode);
                        setGameState(fresh);
                        clientRef.current?.playAgain();
                        clientRef.current?.sendStateSnapshot(fresh);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      جولة جديدة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      clientRef.current?.leaveRoom();
                      setCurrentRoomCode("");
                      setGameState(null);
                      setPlayers([]);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    مغادرة
                  </button>
                </div>
              </div>

              <canvas
                ref={canvasRef}
                width={CARROM_BOARD_SIZE}
                height={CARROM_BOARD_SIZE}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full max-w-[500px] aspect-square rounded-2xl shadow-xl touch-none select-none cursor-crosshair"
              />
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className={`p-3 rounded-3xl border space-y-2 ${cardCls}`}>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((slotIdx) => {
                    const pl = players.find((p) => p.slot === slotIdx) ?? null;
                    const score = gameState?.scores?.[slotIdx] ?? 0;
                    const active = gameState?.turnSeat === slotIdx && players.length >= 2;
                    return (
                      <div
                        key={slotIdx}
                        className={`p-2.5 rounded-2xl border ${
                          active ? "border-amber-500 bg-amber-500/10" : subCls
                        }`}
                      >
                        <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span>لاعب {slotIdx + 1}</span>
                          <span className="text-amber-400">{score} نقطة</span>
                        </div>
                        {pl ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <MemberAvatar pic={pl.pic} topic={pl.name} size="xs" showStatus={false} />
                            <span className="text-xs font-extrabold truncate">{pl.name}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] opacity-60">بانتظار خصم...</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {gameState?.lastActionText && (
                  <p className="text-xs font-bold text-center opacity-80 pt-1">{gameState.lastActionText}</p>
                )}
              </div>

              {isMyTurn && (
                <div className={`p-3 rounded-3xl border space-y-2 ${cardCls}`}>
                  <div className="text-xs font-extrabold text-sky-400">تحكم بالضربة</div>
                  <div className="text-[11px] flex justify-between">
                    <span>الموضع</span>
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
                      clientRef.current?.strikerPlace({ offset: val });
                      emitAimPreview(val, angleDeg, power);
                    }}
                    className="w-full accent-sky-500"
                  />
                  <div className="text-[11px] flex justify-between">
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
                  <div className="text-[11px] flex justify-between">
                    <span>القوة</span>
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
                  <button
                    type="button"
                    onClick={() => executeShot({ offset, angle: angleDeg, power })}
                    className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold"
                  >
                    تسديد
                  </button>
                </div>
              )}

              {/* Table Chat */}
              <div className={`p-3 rounded-3xl border flex flex-col h-56 ${cardCls}`}>
                <div className="text-xs font-extrabold mb-2">دردشة الطاولة</div>
                <div className="flex-1 min-h-0 overflow-y-auto chat-scroll space-y-1.5 text-xs mb-2">
                  {chatMsgs.map((m, idx) => (
                    <div key={`${m.ts}-${idx}`} className={`px-2.5 py-1.5 rounded-xl border ${subCls}`}>
                      <strong className="text-sky-400">{m.name || "لاعب"}: </strong>
                      <span>{m.msg}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendTableChat} className="flex gap-1.5">
                  <input
                    type="text"
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder="رسالة للطاولة..."
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
