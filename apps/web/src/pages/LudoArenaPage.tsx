import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bot,
  Dices,
  Moon,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sun,
  Trophy,
  Users,
} from "lucide-react";
import { LudoArenaClient, useChatStore } from "@newchat/core-client";
import {
  LUDO_COLOR_LABELS_AR,
  LUDO_SEAT_COLORS,
  type LudoArenaRoomSummary,
  type LudoColor,
  type LudoPublicState,
} from "@newchat/shared";
import { LudoBoard } from "../components/LudoBoard.js";
import { MemberAvatar } from "../components/MemberAvatar.js";
import { resolveGatewayBaseUrl } from "../lib/mediaUrl.js";
import { playSoundCue } from "../lib/soundFx.js";

interface LudoArenaPageProps {
  dark: boolean;
  onToggleTheme: () => void;
  onBackToChat: () => void;
}

interface ArenaChatMsg {
  name?: string;
  msg: string;
  ts: number;
}

const SEAT_BADGE_MAP: Record<LudoColor, string> = {
  red: "bg-rose-500/20 text-rose-400 border-rose-500/40",
  green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  yellow: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  blue: "bg-sky-500/20 text-sky-400 border-sky-500/40",
};

export default function LudoArenaPage({
  dark,
  onToggleTheme,
  onBackToChat,
}: LudoArenaPageProps) {
  const me = useChatStore((s) => s.me);

  const clientRef = useRef<LudoArenaClient | null>(null);
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [connected, setConnected] = useState(false);
  const [mySocketId, setMySocketId] = useState("");
  const [playerName, setPlayerName] = useState(() => me?.topic || "لاعب لودو");
  const [waitingRooms, setWaitingRooms] = useState<LudoArenaRoomSummary[]>([]);
  const [roomTitleDraft, setRoomTitleDraft] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [currentRoomCode, setCurrentRoomCode] = useState("");
  const [currentRoomTitle, setCurrentRoomTitle] = useState("");
  const [mySlot, setMySlot] = useState<number>(-1);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<LudoPublicState | null>(null);
  const [rollingVisual, setRollingVisual] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [chatMsgs, setChatMsgs] = useState<ArenaChatMsg[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  useEffect(() => {
    if (me?.topic) setPlayerName(me.topic);
  }, [me?.topic]);

  useEffect(() => {
    const client = new LudoArenaClient();
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
    raw.on("waiting_rooms", (list: LudoArenaRoomSummary[]) => {
      if (Array.isArray(list)) setWaitingRooms(list);
    });
    raw.on("join_error", (d: { msg?: string }) => {
      setErrorMsg(String(d?.msg || "تعذر الانضمام لطاولة اللودو"));
    });
    raw.on(
      "room_joined",
      (d: {
        roomCode: string;
        title: string;
        slot: number;
        isHost?: boolean;
        state?: LudoPublicState;
      }) => {
        setErrorMsg("");
        setCurrentRoomCode(d.roomCode);
        setCurrentRoomTitle(d.title || d.roomCode);
        setMySlot(d.slot);
        setIsHost(Boolean(d.isHost));
        setChatMsgs([]);
        if (d.state) setGameState(d.state);
        else client.requestSync();
      },
    );
    raw.on("ludo_state", (state: LudoPublicState) => {
      if (state && typeof state === "object") setGameState(state);
    });
    raw.on("ludo_event", (ev: { kind?: string; finished?: boolean; capturedTokenIds?: string[] }) => {
      if (ev?.kind === "move") {
        if (ev.finished) playSoundCue("win");
        else if (Array.isArray(ev.capturedTokenIds) && ev.capturedTokenIds.length > 0) playSoundCue("gift");
        else playSoundCue("notice");
      }
    });
    raw.on("chat_message", (m: ArenaChatMsg) => {
      if (m?.msg) setChatMsgs((prev) => [...prev.slice(-49), m]);
    });

    return () => {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!currentRoomCode || gameState?.status !== "active") return;
    const id = setInterval(() => setNowTs(Date.now()), 500);
    return () => clearInterval(id);
  }, [currentRoomCode, gameState?.status]);

  const myPlayer = useMemo(() => {
    if (!gameState) return null;
    return (
      gameState.players.find(
        (p) => !p.isBot && (p.socketId === mySocketId || p.seat === mySlot),
      ) ?? null
    );
  }, [gameState, mySocketId, mySlot]);

  const isMyTurn = Boolean(
    gameState?.status === "active" && myPlayer && myPlayer.seat === gameState.turnSeat,
  );

  const handleRollDice = useCallback(() => {
    if (!isMyTurn || gameState?.phase !== "awaiting_roll") return;
    setRollingVisual(true);
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    rollTimeoutRef.current = setTimeout(() => setRollingVisual(false), 420);
    clientRef.current?.rollDie();
  }, [isMyTurn, gameState?.phase]);

  const handleMoveToken = useCallback(
    (tokenId: string) => {
      if (!isMyTurn || gameState?.phase !== "awaiting_move") return;
      clientRef.current?.makeMove(tokenId);
    },
    [isMyTurn, gameState?.phase],
  );

  const handleCreateRoom = (e: FormEvent) => {
    e.preventDefault();
    const safeName = playerName.trim() || "لاعب لودو";
    clientRef.current?.registerProfile({
      name: safeName,
      pic: me?.pic || "pic.png",
      userId: me?.uid,
    });
    clientRef.current?.createRoom(roomTitleDraft.trim() || `طاولة ${safeName}`);
    setRoomTitleDraft("");
  };

  const handleJoinByCode = () => {
    const code = joinCodeDraft.trim().toUpperCase();
    if (!code) return;
    clientRef.current?.registerProfile({
      name: playerName.trim() || "لاعب لودو",
      pic: me?.pic || "pic.png",
      userId: me?.uid,
    });
    clientRef.current?.joinWaitingRoom(code);
  };

  const handleSendTableChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim() || !clientRef.current) return;
    clientRef.current.sendChatMessage(chatDraft.trim());
    setChatDraft("");
  };

  const hasBots = Boolean(gameState?.players.some((p) => p.isBot));
  const remainingSec =
    gameState?.status === "active" && gameState.turnStartedAt > 0
      ? Math.max(0, Math.ceil(((gameState.turnTimeoutMs || 28_000) - (nowTs - gameState.turnStartedAt)) / 1000))
      : 0;

  const pageCls = dark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const cardCls = dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const subCls = dark ? "bg-slate-950/75 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
  }`;

  return (
    <div dir="rtl" className={`min-h-screen flex flex-col ${pageCls}`}>
      <header
        className={`border-b px-4 py-3 flex items-center justify-between gap-3 ${
          dark ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Dices className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold">ساحة اللودو التنافسية</h1>
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
                <label className="block text-xs font-extrabold">إنشاء طاولة لودو جديدة (2–4 لاعبين)</label>
                <input
                  type="text"
                  value={roomTitleDraft}
                  onChange={(e) => setRoomTitleDraft(e.target.value)}
                  placeholder="عنوان الطاولة (اختياري)"
                  className={inputCls}
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
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
                    placeholder="LD-XXXXX"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={handleJoinByCode}
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
                  طاولات اللودو النشطة ({waitingRooms.length})
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
                  لا توجد طاولات حالياً — أنشئ طاولة جديدة ودعُ أصدقاءك بالرمز أو أضف بوتات!
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
                          المضيف: {r.hostName} | رمز: <code className="font-mono">{r.roomCode}</code> | لاعبين: {r.playerCount}/4
                          {r.botCount > 0 ? ` (${r.botCount} بوت)` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          clientRef.current?.registerProfile({
                            name: playerName.trim() || "لاعب لودو",
                            pic: me?.pic || "pic.png",
                            userId: me?.uid,
                          });
                          clientRef.current?.joinWaitingRoom(r.roomCode);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shrink-0"
                      >
                        {r.status === "waiting" && r.playerCount < 4 ? "دخول للعب" : "مشاهدة"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className={`lg:col-span-7 p-3 sm:p-4 rounded-3xl border ${cardCls}`}>
              <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold">{currentRoomTitle}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                    {currentRoomCode}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gameState?.status === "waiting" && isHost && gameState.players.length < 4 && (
                    <button
                      type="button"
                      onClick={() => clientRef.current?.addBot()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      إضافة بوت
                    </button>
                  )}
                  {gameState?.status === "waiting" && isHost && hasBots && (
                    <button
                      type="button"
                      onClick={() => clientRef.current?.removeBot()}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold"
                    >
                      إزالة بوت
                    </button>
                  )}
                  {gameState?.status === "waiting" && myPlayer && (
                    <button
                      type="button"
                      onClick={() => clientRef.current?.startGame()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      <Play className="w-3.5 h-3.5" />
                      بدء المباراة
                    </button>
                  )}
                  {gameState?.status === "finished" && myPlayer && (
                    <button
                      type="button"
                      onClick={() => clientRef.current?.playAgain()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
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
                      setMySlot(-1);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                  >
                    مغادرة
                  </button>
                </div>
              </div>

              <LudoBoard
                game={gameState}
                myColor={myPlayer?.color ?? null}
                isMyTurn={isMyTurn}
                rollingVisual={rollingVisual}
                onRollDice={handleRollDice}
                onMoveToken={handleMoveToken}
                dark={dark}
              />
            </div>

            <div className="lg:col-span-5 space-y-3">
              {/* Players Cards */}
              <div className={`p-3 rounded-3xl border space-y-2.5 ${cardCls}`}>
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span>اللاعبون ({gameState?.players.length ?? 0}/4)</span>
                  {gameState?.status === "active" && (
                    <span className="text-amber-400">الوقت المتبقي: {remainingSec}ث</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {([0, 1, 2, 3] as const).map((seat) => {
                    const color = LUDO_SEAT_COLORS[seat];
                    const pl = gameState?.players.find((p) => p.seat === seat) ?? null;
                    const active = gameState?.status === "active" && gameState.turnSeat === seat;
                    return (
                      <div
                        key={seat}
                        className={`p-2.5 rounded-2xl border ${
                          active ? "border-amber-500 bg-amber-500/10" : subCls
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold mb-1.5">
                          <span className={`px-2 py-0.5 rounded-full border ${SEAT_BADGE_MAP[color]}`}>
                            {LUDO_COLOR_LABELS_AR[color]}
                          </span>
                          <span>{pl ? `${pl.finishedCount ?? 0}/4 👑` : "فارغ"}</span>
                        </div>
                        {pl ? (
                          <div className="flex items-center gap-2 min-w-0">
                            {pl.isBot ? (
                              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                <Bot className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <MemberAvatar pic={pl.pic} topic={pl.topic} size="xs" showStatus={false} />
                            )}
                            <span className="text-xs font-extrabold truncate">{pl.topic}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] opacity-55">بانتظار لاعب...</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {gameState?.winnerTopic && gameState.status === "finished" && (
                  <div className="flex items-center justify-center gap-1.5 py-2 rounded-2xl bg-emerald-500/15 text-emerald-400 text-xs font-extrabold">
                    <Trophy className="w-4 h-4" />
                    الفائز: {gameState.winnerTopic}
                  </div>
                )}
              </div>

              {/* Table Chat */}
              <div className={`p-3 rounded-3xl border flex flex-col h-64 ${cardCls}`}>
                <div className="text-xs font-extrabold mb-2">دردشة طاولة اللودو</div>
                <div className="flex-1 min-h-0 overflow-y-auto chat-scroll space-y-1.5 text-xs mb-2">
                  {chatMsgs.map((m, idx) => (
                    <div key={`${m.ts}-${idx}`} className={`px-2.5 py-1.5 rounded-xl border ${subCls}`}>
                      <strong className="text-emerald-400">{m.name || "لاعب"}: </strong>
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
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
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
