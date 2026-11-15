import { DoorOpen, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";

export function RoomInviteModal() {
  const roomInvite = useChatStore((s) => s.roomInvite);
  const joinRoom = useChatStore((s) => s.joinRoom);
  const clearRoomInvite = useChatStore((s) => s.clearRoomInvite);

  if (!roomInvite) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 text-slate-100 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">دعوة للانضمام إلى غرفة</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">من: {roomInvite.byTopic}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearRoomInvite}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-3 text-xs leading-relaxed">
          يدعوك <span className="font-extrabold text-sky-300">{roomInvite.byTopic}</span> للدخول إلى غرفة{" "}
          <span className="font-extrabold text-emerald-300">{roomInvite.roomTopic}</span>.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              joinRoom(roomInvite.roomid, roomInvite.pass || "");
              clearRoomInvite();
            }}
            className="py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold transition"
          >
            قبول والدخول
          </button>
          <button
            type="button"
            onClick={clearRoomInvite}
            className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            تجاهل
          </button>
        </div>
      </div>
    </div>
  );
}
