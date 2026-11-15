import { useEffect, useState } from "react";
import { Award, Crown, Eye, Flame, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { EvaluationAwardActionKey, OnlineUserSnapshot } from "@newchat/shared";
import { formatDateTimeArabic, resolveAssetUrl } from "../lib/mediaUrl.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface LeaderboardPanelProps {
  dark: boolean;
  onSelectUser: (user: OnlineUserSnapshot) => void;
}

type LeaderTab = "top10" | "wall" | "stories" | "awards";

const AWARD_ACTION_LABELS: Record<EvaluationAwardActionKey, string> = {
  room_message: "رسائل الغرف",
  wall_post: "منشورات الحائط",
  private_message: "الرسائل الخاصة",
  online_duration: "مدة التواجد المتصل",
  daily_login: "الدخول اليومي",
  game_win: "الفوز في المسابقات والألعاب",
};

export function LeaderboardPanel({ dark, onSelectUser }: LeaderboardPanelProps) {
  const me = useChatStore((s) => s.me);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const site = useChatStore((s) => s.site);
  const getApiClient = useChatStore((s) => s.getApiClient);

  const [tab, setTab] = useState<LeaderTab>("top10");
  const [loading, setLoading] = useState(false);
  const [topUsers, setTopUsers] = useState<Array<Record<string, unknown>>>([]);
  const [topWallRows, setTopWallRows] = useState<Array<Record<string, unknown>>>([]);
  const [selectedWallLid, setSelectedWallLid] = useState<string>("");
  const [selectedWallHistory, setSelectedWallHistory] = useState<Array<Record<string, unknown>>>([]);
  const [storyViews, setStoryViews] = useState<Array<Record<string, unknown>>>([]);

  const loadTab = async (targetTab: LeaderTab) => {
    setLoading(true);
    try {
      const api = getApiClient();
      if (targetTab === "top10") {
        const res = await api.getTop10();
        setTopUsers(Array.isArray(res) ? res : []);
      } else if (targetTab === "wall") {
        const res = await api.getTop10Wall();
        setTopWallRows(Array.isArray(res) ? res : []);
      } else if (targetTab === "stories") {
        const res = await api.getStoriesLeaderboard();
        setStoryViews(Array.isArray(res) ? res : []);
      }
    } catch {
      // non-fatal fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "awards") {
      void loadTab(tab);
    }
  }, [tab]);

  const handleInspectWallLid = async (lid: string) => {
    if (!lid) return;
    if (selectedWallLid === lid) {
      setSelectedWallLid("");
      setSelectedWallHistory([]);
      return;
    }
    setSelectedWallLid(lid);
    try {
      const rows = await getApiClient().getTop10WallByLid(lid);
      setSelectedWallHistory(Array.isArray(rows) ? rows : []);
    } catch {
      setSelectedWallHistory([]);
    }
  };

  const openMemberProfile = (row: Record<string, unknown>) => {
    const uid = String(row.uid || "");
    const lid = String(row.lid || "");
    const onlineMatch = Object.values(onlineMap).find(
      (u) => (uid && u.uid === uid) || (lid && u.lid === lid),
    );
    if (onlineMatch) {
      onSelectUser(onlineMatch);
      return;
    }
    onSelectUser({
      id: uid || String(row.idreg || row.id || "offline"),
      idreg: row.idreg ? Number(row.idreg) : undefined,
      uid,
      lid,
      topic: String(row.topic || "عضو"),
      pic: String(row.pic || "pic.png"),
      msg: "",
      power: String(row.power || ""),
      bg: String(row.bg || "#FFFFFF"),
      gcol: "#FFFFFF",
      ucol: String(row.ucol || "#000000"),
      mcol: "#000000",
      stat: 0,
      offline: true,
      rep: Number(row.rep || 0),
      evaluation: Number(row.evaluation || 0),
      ico: String(row.ico || ""),
    });
  };

  // Deduplicate top10wall by uid with activity counts
  const wallAggregated = Object.values(
    topWallRows.reduce<Record<string, { uid: string; topic: string; pic: string; count: number }>>(
      (acc, r) => {
        const key = String(r.uid || r.topic || r.id || "");
        if (!key) return acc;
        if (!acc[key]) {
          acc[key] = {
            uid: String(r.uid || ""),
            topic: String(r.topic || "عضو"),
            pic: String(r.pic || "pic.png"),
            count: 0,
          };
        }
        acc[key]!.count += 1;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.count - a.count);

  const awardsCfg = (site?.evaluationAwards ?? {}) as {
    enabled?: boolean;
    actions?: Partial<Record<EvaluationAwardActionKey, Record<string, unknown>>>;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub Tabs */}
      <div className="px-3 pt-2.5 pb-2 border-b border-slate-800/30 flex items-center gap-1.5 shrink-0">
        <div
          className={`grid grid-cols-4 gap-1 p-1 rounded-xl flex-1 ${
            dark ? "bg-slate-950" : "bg-slate-100"
          }`}
        >
          {[
            { id: "top10", label: "الأعضاء" },
            { id: "wall", label: "الحائط" },
            { id: "stories", label: "القصص" },
            { id: "awards", label: "النقاط" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as LeaderTab)}
              className={`py-1.5 rounded-lg text-[11px] font-bold transition ${
                tab === item.id
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : dark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab !== "awards" && (
          <button
            type="button"
            onClick={() => void loadTab(tab)}
            title="تحديث القائمة"
            className={`p-2 rounded-xl border ${
              dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto chat-scroll p-3 space-y-2">
        {tab === "top10" && (
          <>
            {topUsers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {loading ? "جارٍ التحميل..." : "لا توجد بيانات متصدرين حالياً"}
              </div>
            ) : (
              topUsers.map((u, idx) => (
                <button
                  key={String(u.idreg || u.uid || idx)}
                  type="button"
                  onClick={() => openMemberProfile(u)}
                  className={`w-full text-right rounded-2xl p-2.5 border flex items-center justify-between gap-2.5 transition ${
                    dark
                      ? "bg-slate-950/60 border-slate-800 hover:border-amber-500/40"
                      : "bg-white border-slate-200 hover:border-amber-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        idx === 0
                          ? "bg-amber-400 text-slate-950"
                          : idx === 1
                            ? "bg-slate-300 text-slate-900"
                            : idx === 2
                              ? "bg-amber-700 text-white"
                              : dark
                                ? "bg-slate-800 text-slate-400"
                                : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {idx === 0 ? <Crown className="w-3.5 h-3.5" /> : idx + 1}
                    </span>

                    <MemberAvatar pic={String(u.pic || "pic.png")} topic={String(u.topic || "")} size="sm" showStatus={false} />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        {Boolean(u.ico) && (
                          <img
                            src={resolveAssetUrl(String(u.ico), "sico", "")}
                            alt=""
                            className="w-4 h-4 object-contain"
                          />
                        )}
                        <span className="text-xs font-extrabold truncate">{String(u.topic || "عضو")}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {u.idreg ? `#${String(u.idreg)}` : ""} {u.power ? `• ${String(u.power)}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0 space-y-0.5">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                      <Trophy className="w-3 h-3" />
                      <span>{Number(u.evaluation || 0).toLocaleString("en-US")}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">❤️ {Number(u.rep || 0).toLocaleString("en-US")}</div>
                  </div>
                </button>
              ))
            )}
          </>
        )}

        {tab === "wall" && (
          <>
            {wallAggregated.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {loading ? "جارٍ التحميل..." : "لا يوجد نشاط مسجل على الحائط بعد"}
              </div>
            ) : (
              wallAggregated.map((w, idx) => (
                <div
                  key={`${w.uid}-${idx}`}
                  className={`rounded-2xl p-2.5 border space-y-2 ${
                    dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleInspectWallLid(w.uid)}
                    className="w-full flex items-center justify-between gap-2 text-right"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-extrabold text-amber-400 w-5 text-center">#{idx + 1}</span>
                      <MemberAvatar pic={w.pic} topic={w.topic} size="xs" showStatus={false} />
                      <span className="text-xs font-bold truncate">{w.topic}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-bold">
                      <Flame className="w-3 h-3" />
                      <span>{w.count} تفاعل</span>
                    </span>
                  </button>

                  {selectedWallLid === w.uid && selectedWallHistory.length > 0 && (
                    <div
                      className={`rounded-xl p-2 text-[11px] space-y-1 border ${
                        dark ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div className="font-bold text-[10px] text-slate-400">سجل تفاعلات الحائط ({selectedWallHistory.length}):</div>
                      {selectedWallHistory.slice(0, 8).map((item, i) => (
                        <div key={String(item.id || i)} className="flex items-center justify-between text-[10px]">
                          <span>نوع: {String(item.otype || "منشور")}</span>
                          <span className="text-slate-400">#{String(item.id || i + 1)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {tab === "stories" && (
          <>
            {storyViews.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {loading ? "جارٍ التحميل..." : "لا توجد مشاهدات قصص مسجلة حالياً"}
              </div>
            ) : (
              storyViews.map((sv, idx) => (
                <div
                  key={String(sv.id || idx)}
                  className={`rounded-2xl p-2.5 border flex items-center justify-between gap-2 ${
                    dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MemberAvatar pic={String(sv.photo || "pic.png")} topic={String(sv.topic || "")} size="xs" showStatus={false} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{String(sv.topic || "مشاهد")}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        شاهد قصة ({Number(sv.item || 0) + 1}) {sv.time ? `• ${formatDateTimeArabic(Number(sv.time))}` : ""}
                      </div>
                    </div>
                  </div>
                  <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                </div>
              ))
            )}
          </>
        )}

        {tab === "awards" && (
          <div className="space-y-2.5">
            <div
              className={`rounded-2xl p-3 border space-y-1 ${
                dark ? "bg-indigo-500/10 border-indigo-500/25" : "bg-indigo-50 border-indigo-200"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                  نقاط التقييم الخاصة بك
                </span>
                <span className="text-amber-400">{Number(me?.evaluation || 0).toLocaleString("en-US")}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                حالة النظام: {awardsCfg.enabled !== false ? "مفعل ✅" : "متوقف مؤقتاً"}
              </div>
            </div>

            {(Object.keys(AWARD_ACTION_LABELS) as EvaluationAwardActionKey[]).map((key) => {
              const rule = awardsCfg.actions?.[key];
              const pts = Number(rule?.points ?? 0);
              const daily = Number(rule?.dailyLimit ?? 0);
              const cooldownMin = Math.round(Number(rule?.cooldownMs ?? 0) / 60000);
              return (
                <div
                  key={key}
                  className={`rounded-2xl p-3 border flex items-center justify-between gap-2 text-xs ${
                    dark ? "bg-slate-950/60 border-slate-800" : "bg-white border-slate-200"
                  }`}
                >
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>{AWARD_ACTION_LABELS[key]}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {daily > 0 ? `الحد اليومي: ${daily}` : "مفتوح"}
                      {cooldownMin > 0 ? ` • فاصل زمني: ${cooldownMin} د` : ""}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-extrabold text-[11px]">
                    +{pts}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
