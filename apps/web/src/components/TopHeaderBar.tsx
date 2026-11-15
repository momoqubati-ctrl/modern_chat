import {
  Coins,
  Dices,
  DoorOpen,
  Gamepad2,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sun,
  Trophy,
  Users,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { resolveAssetUrl } from "../lib/mediaUrl.js";
import { canAccessControlPanel, canUseCompetitionBots } from "../lib/permissions.js";

interface TopHeaderBarProps {
  dark: boolean;
  onToggleTheme: () => void;
  onOpenMobileSidebar: () => void;
  onOpenPmDock: () => void;
  onOpenMailTab: () => void;
  onOpenWalletModal: () => void;
  onOpenCarromModal: () => void;
  onOpenLudoModal: () => void;
  onOpenCompetitionModal: () => void;
  onNavigate?: (path: string) => void;
}

export function TopHeaderBar({
  dark,
  onToggleTheme,
  onOpenMobileSidebar,
  onOpenPmDock,
  onOpenMailTab,
  onOpenWalletModal,
  onOpenCarromModal,
  onOpenLudoModal,
  onOpenCompetitionModal,
  onNavigate,
}: TopHeaderBarProps) {
  const connected = useChatStore((s) => s.connected);
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const roomsCounts = useChatStore((s) => s.roomsCounts);
  const onlineCount = useChatStore((s) => s.onlineCount);
  const pmThreads = useChatStore((s) => s.pmThreads);
  const unreadMailCount = useChatStore((s) => s.unreadMailCount);
  const competitionState = useChatStore((s) => s.competitionState);
  const site = useChatStore((s) => s.site);

  const leaveRoom = useChatStore((s) => s.leaveRoom);
  const logout = useChatStore((s) => s.logout);

  const activeRoom = rooms.find((r) => r.id === currentRoomId) ?? null;
  const activeRoomUsersCount = activeRoom
    ? Number(roomsCounts[activeRoom.id] ?? activeRoom.onlineCount ?? 0)
    : 0;
  const pmThreadCount = Object.keys(pmThreads).length;

  const canCp = canAccessControlPanel(me, powers);
  const canBots = canUseCompetitionBots(me, powers, myPowerRole);

  return (
    <header
      className={`h-14 px-2.5 sm:px-4 flex items-center justify-between gap-2 border-b shrink-0 ${
        dark ? "bg-slate-900/95 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      {/* Start: Mobile Drawer + Room / Brand Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          title="القائمة الجانبية"
          className={`lg:hidden p-2 rounded-xl border transition shrink-0 ${
            dark ? "border-slate-800 hover:bg-slate-800 text-slate-200" : "border-slate-200 hover:bg-slate-100 text-slate-700"
          }`}
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800 shrink-0">
          <img
            src={resolveAssetUrl(activeRoom?.pic || site?.logo || "/room.png", "picroom", "/room.png")}
            alt={activeRoom?.topic || site?.name || "غرفة"}
            className="w-full h-full object-cover"
          />
          <span
            title={connected ? "متصل بالخادم" : "إعادة الاتصال..."}
            className={`absolute bottom-0.5 left-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
              connected ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
            }`}
          />
        </div>

        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-extrabold truncate flex items-center gap-1.5">
            <span className="truncate">{activeRoom?.topic || site?.name || "البهو العام"}</span>
            {activeRoom && (
              <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 text-[10px] font-bold">
                <Users className="w-3 h-3" />
                <span>{activeRoomUsersCount}</span>
              </span>
            )}
          </div>
          <div className={`text-[11px] font-medium truncate ${dark ? "text-slate-400" : "text-slate-600"}`}>
            {activeRoom?.about
              ? activeRoom.about
              : `${me?.topic || "ضيف"} • ${onlineCount} متصل`}
          </div>
        </div>
      </div>

      {/* End Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Coins -> Wallet Modal */}
        <button
          type="button"
          onClick={onOpenWalletModal}
          title="المحفظة وشحن الكوينز"
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-extrabold transition ${
            dark
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>{me?.coins ?? 0}</span>
        </button>

        {/* PM Dock Pill */}
        <button
          type="button"
          onClick={onOpenPmDock}
          title="الرسائل والمكالمات الخاصة"
          className={`relative p-2 rounded-xl border transition ${
            dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
          }`}
        >
          <MessageSquare className="w-4 h-4 text-sky-400" />
          {pmThreadCount > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
              {pmThreadCount}
            </span>
          )}
        </button>

        {/* Internal Mail Pill */}
        <button
          type="button"
          onClick={onOpenMailTab}
          title="البريد الداخلي"
          className={`relative hidden sm:inline-flex p-2 rounded-xl border transition ${
            dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
          }`}
        >
          <Mail className="w-4 h-4 text-emerald-400" />
          {unreadMailCount > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadMailCount}
            </span>
          )}
        </button>

        {/* Carrom Button */}
        {currentRoomId && (
          <button
            type="button"
            onClick={onOpenCarromModal}
            title="طاولة الكيرم"
            className={`p-2 rounded-xl border transition ${
              dark ? "border-slate-800 hover:bg-slate-800 text-amber-400" : "border-slate-200 hover:bg-slate-100 text-amber-600"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
        )}

        {/* Ludo Button */}
        {currentRoomId && (
          <button
            type="button"
            onClick={onOpenLudoModal}
            title="طاولة اللودو"
            className={`p-2 rounded-xl border transition ${
              dark ? "border-slate-800 hover:bg-slate-800 text-emerald-400" : "border-slate-200 hover:bg-slate-100 text-emerald-600"
            }`}
          >
            <Dices className="w-4 h-4" />
          </button>
        )}

        {/* Competition Bots */}
        {(canBots || competitionState?.active) && currentRoomId && (
          <button
            type="button"
            onClick={onOpenCompetitionModal}
            title={
              competitionState?.active
                ? `بوت المسابقات يعمل الآن (${competitionState.kind}) - انقر للإدارة أو الإيقاف`
                : "بوت المسابقات"
            }
            className={`relative p-2 rounded-xl border transition active:scale-90 ${
              competitionState?.active
                ? "border-amber-500 bg-amber-500/20 text-amber-300 ring-2 ring-amber-400/40 animate-pulse shadow-md shadow-amber-500/20"
                : dark
                  ? "border-slate-800 hover:bg-slate-800 text-slate-300"
                  : "border-slate-200 hover:bg-slate-100 text-slate-700"
            }`}
          >
            <Trophy className="w-4 h-4" />
            {competitionState?.active && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            )}
          </button>
        )}

        {/* Control Panel Shortcut */}
        {canCp && (
          <button
            type="button"
            onClick={() => onNavigate?.("/cp")}
            title="لوحة التحكم"
            className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              dark
                ? "border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
                : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>الإدارة</span>
          </button>
        )}

        {/* Theme Switch */}
        <button
          type="button"
          onClick={onToggleTheme}
          title="تبديل المظهر"
          className={`p-2 rounded-xl border transition ${
            dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
          }`}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Leave Current Room */}
        {currentRoomId && (
          <button
            type="button"
            onClick={leaveRoom}
            title="مغادرة الغرفة"
            className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">مغادرة</span>
          </button>
        )}

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          title="تسجيل الخروج"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-bold transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>
    </header>
  );
}
