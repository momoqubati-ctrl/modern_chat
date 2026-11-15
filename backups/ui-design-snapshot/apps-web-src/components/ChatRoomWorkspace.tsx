import { useCallback, useEffect, useState } from "react";
import {
  DoorOpen,
  Film,
  Flame,
  Mail,
  Settings,
  ShieldAlert,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot, RoomMessagePayload } from "@newchat/shared";
import { buildHttpsCompanionUrl } from "../lib/mediaPermissions.js";
import { ChatComposer } from "./ChatComposer.js";
import { ChatFeed } from "./ChatFeed.js";
import { CompetitionBotModal } from "./CompetitionBotModal.js";
import { GiftPickerModal } from "./GiftPickerModal.js";
import { GiftRoomOverlay } from "./GiftRoomOverlay.js";
import { InternalMailPanel, type MailRecipientDraft } from "./InternalMailPanel.js";
import { LeaderboardPanel } from "./LeaderboardPanel.js";
import { MembersPanel } from "./MembersPanel.js";
import { PrivateChatDock } from "./PrivateChatDock.js";
import { RoomCarromModal } from "./RoomCarromModal.js";
import { RoomsPanel } from "./RoomsPanel.js";
import { SettingsProfilePanel } from "./SettingsProfilePanel.js";
import { StageMicStrip } from "./StageMicStrip.js";
import { StoriesPanel } from "./StoriesPanel.js";
import { TopHeaderBar } from "./TopHeaderBar.js";
import { UserProfileModal } from "./UserProfileModal.js";
import { WallPanel } from "./WallPanel.js";
import { WalletTopupModal } from "./WalletTopupModal.js";

export type SidePanelTab =
  | "members"
  | "rooms"
  | "wall"
  | "stories"
  | "mail"
  | "leaderboard"
  | "settings";

interface ChatRoomWorkspaceProps {
  dark: boolean;
  onToggleTheme: () => void;
  onNavigate: (path: string) => void;
}

export function ChatRoomWorkspace({
  dark,
  onToggleTheme,
  onNavigate,
}: ChatRoomWorkspaceProps) {
  const onlineIds = useChatStore((s) => s.onlineIds);
  const rooms = useChatStore((s) => s.rooms);
  const unreadMailCount = useChatStore((s) => s.unreadMailCount);
  const callState = useChatStore((s) => s.callState);
  const setActivePmTarget = useChatStore((s) => s.setActivePmTarget);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );
  const [activeSideTab, setActiveSideTab] = useState<SidePanelTab>("members");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [replyTo, setReplyTo] = useState<RoomMessagePayload | null>(null);
  const [pendingMention, setPendingMention] = useState("");
  const [pmDockOpen, setPmDockOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<OnlineUserSnapshot | null>(null);
  const [giftTarget, setGiftTarget] = useState<OnlineUserSnapshot | null>(null);
  const [mailDraftRecipient, setMailDraftRecipient] = useState<MailRecipientDraft | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [carromOpen, setCarromOpen] = useState(false);
  const [competitionOpen, setCompetitionOpen] = useState(false);
  const [httpsBannerDismissed, setHttpsBannerDismissed] = useState(false);

  const httpsUpgradeUrl = !httpsBannerDismissed ? buildHttpsCompanionUrl() : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      if (e.matches) setMobileSidebarOpen(false);
    };
    setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Automatically pop open the Private Chat Dock whenever a call goes live or rings
  useEffect(() => {
    if (
      callState.status === "incoming" ||
      callState.status === "outgoing" ||
      callState.status === "active"
    ) {
      setPmDockOpen(true);
    }
  }, [callState.status]);

  // Escape key closes the topmost open overlay cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (giftTarget) setGiftTarget(null);
      else if (selectedProfileUser) setSelectedProfileUser(null);
      else if (carromOpen) setCarromOpen(false);
      else if (competitionOpen) setCompetitionOpen(false);
      else if (walletOpen) setWalletOpen(false);
      else if (pmDockOpen) setPmDockOpen(false);
      else if (mobileSidebarOpen) setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    giftTarget,
    selectedProfileUser,
    carromOpen,
    competitionOpen,
    walletOpen,
    pmDockOpen,
    mobileSidebarOpen,
  ]);

  const handleStartPm = useCallback(
    (user: OnlineUserSnapshot) => {
      setActivePmTarget(user.id);
      setPmDockOpen(true);
      setMobileSidebarOpen(false);
    },
    [setActivePmTarget],
  );

  const handleOpenGift = useCallback((user: OnlineUserSnapshot) => {
    setGiftTarget(user);
    setMobileSidebarOpen(false);
  }, []);

  const handleOpenMailDraft = useCallback(
    (draft: MailRecipientDraft) => {
      setMailDraftRecipient(draft);
      setActiveSideTab("mail");
      if (!isDesktop) setMobileSidebarOpen(true);
    },
    [isDesktop],
  );

  const handleOpenMailTab = useCallback(() => {
    setActiveSideTab("mail");
    if (!isDesktop) setMobileSidebarOpen(true);
  }, [isDesktop]);

  const handleMentionUser = useCallback((mentionText: string) => {
    setPendingMention(mentionText);
    setMobileSidebarOpen(false);
  }, []);

  const sideTabs: Array<{
    id: SidePanelTab;
    label: string;
    icon: typeof Users;
    badge?: number;
    badgeRose?: boolean;
  }> = [
    { id: "members", label: "المتواجدين", icon: Users, badge: onlineIds.length },
    { id: "rooms", label: "الغرف", icon: DoorOpen, badge: rooms.length },
    { id: "wall", label: "الحائط", icon: Flame },
    { id: "stories", label: "القصص", icon: Film },
    {
      id: "mail",
      label: "البريد",
      icon: Mail,
      badge: unreadMailCount > 0 ? unreadMailCount : undefined,
      badgeRose: unreadMailCount > 0,
    },
    { id: "leaderboard", label: "المتصدرين", icon: Trophy },
    { id: "settings", label: "حسابي", icon: Settings },
  ];

  const renderSideTabsBar = () => (
    <nav
      aria-label="أقسام الشات الجانبية"
      className={`grid grid-cols-7 gap-1 p-1.5 border-b shrink-0 ${
        dark ? "bg-slate-900/95 border-slate-800" : "bg-slate-50 border-slate-200"
      }`}
    >
      {sideTabs.map((t) => {
        const Icon = t.icon;
        const active = activeSideTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveSideTab(t.id)}
            title={t.label}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-bold transition ${
              active
                ? "bg-sky-600 text-white shadow-xs"
                : dark
                  ? "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-full">{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span
                className={`absolute top-0.5 left-0.5 min-w-[14px] h-3.5 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                  t.badgeRose
                    ? "bg-rose-500 text-white"
                    : active
                      ? "bg-white/25 text-white"
                      : "bg-sky-500/20 text-sky-400"
                }`}
              >
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const renderSidePanelContent = () => {
    switch (activeSideTab) {
      case "members":
        return (
          <MembersPanel
            dark={dark}
            onSelectUser={setSelectedProfileUser}
            onSelectPrivateChat={handleStartPm}
            onSelectGift={handleOpenGift}
          />
        );
      case "rooms":
        return <RoomsPanel dark={dark} />;
      case "wall":
        return <WallPanel dark={dark} />;
      case "stories":
        return <StoriesPanel dark={dark} />;
      case "mail":
        return (
          <InternalMailPanel
            dark={dark}
            initialRecipient={mailDraftRecipient}
            onClearInitialRecipient={() => setMailDraftRecipient(null)}
          />
        );
      case "leaderboard":
        return <LeaderboardPanel dark={dark} onSelectUser={setSelectedProfileUser} />;
      case "settings":
        return (
          <SettingsProfilePanel
            dark={dark}
            onOpenWallet={() => {
              setMobileSidebarOpen(false);
              setWalletOpen(true);
            }}
            onNavigate={onNavigate}
          />
        );
    }
  };

  return (
    <div
      className={`h-dvh w-full flex flex-col overflow-hidden ${
        dark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      <TopHeaderBar
        dark={dark}
        onToggleTheme={onToggleTheme}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        onOpenPmDock={() => setPmDockOpen((o) => !o)}
        onOpenMailTab={handleOpenMailTab}
        onOpenWalletModal={() => setWalletOpen(true)}
        onOpenCarromModal={() => setCarromOpen(true)}
        onOpenCompetitionModal={() => setCompetitionOpen(true)}
        onNavigate={onNavigate}
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Main Chat Stage */}
        <section className="lg:col-span-8 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
          {httpsUpgradeUrl && (
            <div
              dir="rtl"
              className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b text-xs shrink-0 ${
                dark
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold">
                  المتصفح على الجوال يحجب صلاحية المايك والكاميرا على رابط HTTP — افتح الرابط الآمن HTTPS لتفعيلها:
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={httpsUpgradeUrl}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold transition"
                >
                  فتح عبر HTTPS
                </a>
                <button
                  type="button"
                  onClick={() => setHttpsBannerDismissed(true)}
                  aria-label="إغلاق التنبيه"
                  className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          <StageMicStrip dark={dark} onSelectUser={setSelectedProfileUser} />
          <ChatFeed
            dark={dark}
            onReply={(msg) => setReplyTo(msg)}
            onSelectUser={setSelectedProfileUser}
          />
          <ChatComposer
            dark={dark}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            onOpenCarrom={() => setCarromOpen(true)}
            onOpenCompetition={() => setCompetitionOpen(true)}
            pendingInsertText={pendingMention}
            onConsumeInsertText={() => setPendingMention("")}
          />
        </section>

        {/* Desktop Side Drawer */}
        {isDesktop && (
          <aside
            className={`lg:col-span-4 flex flex-col min-h-0 h-full border-r overflow-hidden ${
              dark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            {renderSideTabsBar()}
            <div className="flex-1 min-h-0 overflow-hidden">{renderSidePanelContent()}</div>
          </aside>
        )}
      </div>

      {/* Mobile RTL Slide-Over Sidebar Drawer */}
      {!isDesktop && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-start bg-black/60 backdrop-blur-xs"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`w-[92vw] max-w-sm h-full flex flex-col shadow-2xl border-l overflow-hidden ${
              dark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="px-3.5 py-2.5 border-b border-slate-800/30 flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold">القائمة والأعضاء</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800/40"
                aria-label="إغلاق القائمة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderSideTabsBar()}
            <div className="flex-1 min-h-0 overflow-hidden">{renderSidePanelContent()}</div>
          </aside>
        </div>
      )}

      {/* Room Gift Floating Broadcast Banner */}
      <GiftRoomOverlay />

      {/* Private Chat & WebRTC Audio/Video Dock */}
      <PrivateChatDock
        dark={dark}
        open={pmDockOpen}
        onClose={() => setPmDockOpen(false)}
      />

      {/* Interactive Member Profile & Moderation Modal */}
      <UserProfileModal
        dark={dark}
        user={selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        onStartPm={handleStartPm}
        onOpenGift={handleOpenGift}
        onOpenMail={handleOpenMailDraft}
        onMention={handleMentionUser}
      />

      {/* Gift Catalog Picker Modal */}
      {giftTarget && (
        <GiftPickerModal
          dark={dark}
          target={giftTarget}
          onClose={() => setGiftTarget(null)}
          onOpenWallet={() => {
            setGiftTarget(null);
            setWalletOpen(true);
          }}
        />
      )}

      {/* Coin Wallet & Local Top-Up Modal */}
      <WalletTopupModal
        dark={dark}
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
      />

      {/* Room Carrom Table Modal */}
      <RoomCarromModal
        dark={dark}
        open={carromOpen}
        onClose={() => setCarromOpen(false)}
      />

      {/* Room Competitions & Talking Bots Modal */}
      {competitionOpen && (
        <CompetitionBotModal
          dark={dark}
          onClose={() => setCompetitionOpen(false)}
        />
      )}
    </div>
  );
}
