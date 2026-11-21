import { useMemo, useState } from "react";
import { Globe, Home, RefreshCw } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { type OnlineUserSnapshot, sortOnlineSnapshots } from "@newchat/shared";
import { VirtualizedMembersList } from "./VirtualizedMembersList.js";
import { StoriesStripRow } from "./stories/StoriesStripRow.js";

interface MembersPanelProps {
  dark: boolean;
  onSelectUser: (user: OnlineUserSnapshot) => void;
  onSelectPrivateChat: (user: OnlineUserSnapshot) => void;
  onSelectGift: (user: OnlineUserSnapshot) => void;
  onOpenStoryCreator: () => void;
  onOpenStoryViewer: (storyIdx: number, slideIdx?: number) => void;
}

export function MembersPanel({
  dark,
  onSelectUser,
  onSelectPrivateChat,
  onSelectGift,
  onOpenStoryCreator,
  onOpenStoryViewer,
}: MembersPanelProps) {
  const [scope, setScope] = useState<"room" | "all">("all");
  const me = useChatStore((s) => s.me);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const onlineIds = useChatStore((s) => s.onlineIds);
  const powers = useChatStore((s) => s.powers);
  const requestPresenceSync = useChatStore((s) => s.requestPresenceSync);

  const scopedIds = useMemo(() => {
    const list =
      scope === "all" || !currentRoomId
        ? onlineIds
        : onlineIds.filter(
            (id) =>
              onlineMap[id]?.roomid === currentRoomId &&
              !onlineMap[id]?.offline &&
              Number(onlineMap[id]?.stat || 0) !== 3,
          );

    const usersList = list
      .map((id) => onlineMap[id])
      .filter((u): u is OnlineUserSnapshot => Boolean(u?.id));

    const myPowerDef = powers.find((p) => p.name === me?.power || p.name === me?.rank);
    const myRank = Number(myPowerDef?.rank || 0);
    const myHasStealth = Boolean(myPowerDef && (Number(myPowerDef.stealth || 0) === 1 || Number(myPowerDef.owner || 0) === 1));

    const visibleUsersList = usersList.filter((u) => {
      if (!u.s && !(u as any).stealth) return true;
      if (u.id === me?.id) return true;
      const targetPowerDef = powers.find((p) => p.name === u.power || p.name === u.rank);
      const targetRank = Number(targetPowerDef?.rank || 0);
      return myHasStealth && myRank >= targetRank;
    });

    const sorted = sortOnlineSnapshots(
      visibleUsersList,
      powers,
      currentRoomId,
    );

    return sorted.map((u) => u.id);
  }, [scope, currentRoomId, onlineIds, onlineMap, powers, me]);

  const roomCount = useMemo(
    () =>
      onlineIds.filter(
        (id) =>
          onlineMap[id]?.roomid === currentRoomId &&
          !onlineMap[id]?.offline &&
          Number(onlineMap[id]?.stat || 0) !== 3,
      ).length,
    [onlineIds, onlineMap, currentRoomId],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <StoriesStripRow
        dark={dark}
        onOpenCreator={onOpenStoryCreator}
        onOpenViewer={onOpenStoryViewer}
      />
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between gap-2 border-b border-slate-800/30 shrink-0">
        <div
          className={`grid grid-cols-2 gap-1 p-1 rounded-xl flex-1 ${
            dark ? "bg-slate-950" : "bg-slate-100"
          }`}
        >
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
              scope === "all"
                ? "bg-sky-600 text-white shadow-xs"
                : dark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>الكل ({onlineIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setScope("room")}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
              scope === "room"
                ? "bg-sky-600 text-white shadow-xs"
                : dark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Home className="w-3 h-3" />
            <span>الغرفة ({roomCount})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => requestPresenceSync(scope === "all")}
          title="تحديث قائمة المتواجدين"
          className={`p-2 rounded-xl border transition shrink-0 ${
            dark ? "border-slate-800 hover:bg-slate-800 text-slate-400" : "border-slate-200 hover:bg-slate-100 text-slate-600"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <VirtualizedMembersList
          dark={dark}
          usersMap={onlineMap}
          userIds={scopedIds}
          myId={me?.id}
          onSelectUser={onSelectUser}
          onSelectPrivateChat={onSelectPrivateChat}
          onSelectGift={onSelectGift}
        />
      </div>
    </div>
  );
}
