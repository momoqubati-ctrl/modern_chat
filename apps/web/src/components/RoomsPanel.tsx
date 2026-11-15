import { useMemo, useState, type FormEvent } from "react";
import { DoorOpen, Lock, Mic, Plus, Radio, Search, Settings2, Users } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { RoomSnapshot } from "@newchat/shared";
import { normalizeHexColor, resolveAssetUrl } from "../lib/mediaUrl.js";
import { canCreateVoiceRoomUser, canManageRooms } from "../lib/permissions.js";
import { RoomFormModal } from "./RoomFormModal.js";
import { CreateVoiceRoomModal } from "../features/live-audio/CreateVoiceRoomModal.js";

interface RoomsPanelProps {
  dark: boolean;
}

export function RoomsPanel({ dark }: RoomsPanelProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const rooms = useChatStore((s) => s.rooms);
  const roomsCounts = useChatStore((s) => s.roomsCounts);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const joinRoom = useChatStore((s) => s.joinRoom);

  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [voiceFormOpen, setVoiceFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomSnapshot | null>(null);
  const [passPromptRoom, setPassPromptRoom] = useState<RoomSnapshot | null>(null);
  const [roomPassword, setRoomPassword] = useState("");

  const canCreate = canManageRooms(me, powers, myPowerRole);
  const canCreateVoice = canCreateVoiceRoomUser(me, powers, myPowerRole);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rooms.filter(
          (r) =>
            r.topic?.toLowerCase().includes(q) ||
            r.about?.toLowerCase().includes(q) ||
            r.owner?.toLowerCase().includes(q),
        )
      : rooms;
    return [...list].sort((a, b) => (roomsCounts[b.id] || 0) - (roomsCounts[a.id] || 0));
  }, [rooms, query, roomsCounts]);

  const canEditSpecificRoom = (r: RoomSnapshot): boolean => {
    if (canCreate) return true;
    if (!me) return false;
    const myReg = me.idreg ? String(me.idreg).replace(/^#/, "") : "";
    const rOwner = String(r.owner || "").replace(/^#/, "");
    return Boolean((me.username && r.owner === me.username) || (myReg && myReg === rOwner));
  };

  const handleRoomClick = (r: RoomSnapshot) => {
    if (r.needpass && r.id !== currentRoomId) {
      setPassPromptRoom(r);
      setRoomPassword("");
      return;
    }
    joinRoom(r.id);
  };

  const handlePasswordJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!passPromptRoom) return;
    joinRoom(passPromptRoom.id, roomPassword);
    setPassPromptRoom(null);
    setRoomPassword("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-slate-800/30 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 border flex-1 ${
              dark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
            }`}
          >
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`بحث في ${rooms.length} غرفة...`}
              className="w-full bg-transparent text-xs outline-none"
            />
          </div>

          {canCreateVoice && (
            <button
              type="button"
              onClick={() => setVoiceFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#FE2C55] to-rose-500 hover:brightness-110 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 shrink-0 transition"
              title="إنشاء قناة صوتية مباشرة (TikTok Live)"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>قناة صوتية</span>
            </button>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingRoom(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0"
              title="إنشاء غرفة جديدة"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>غرفة</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 chat-scroll">
        {filteredRooms.map((r) => {
          const count = roomsCounts[r.id] || 0;
          const isCurrent = r.id === currentRoomId;
          const metaBadge = (r.room_owner_meta as Record<string, unknown> | undefined)?.badge as
            | { name?: string; icon?: string; bg?: string }
            | undefined;
          const badgeIcon = metaBadge?.icon ? resolveAssetUrl(metaBadge.icon, "room_badges", "") : "";
          const badgeBg = metaBadge?.bg ? resolveAssetUrl(metaBadge.bg, "room_badges", "") : "";

          return (
            <div
              key={r.id}
              dir="ltr"
              onClick={() => handleRoomClick(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleRoomClick(r);
              }}
              style={{
                backgroundImage: badgeBg ? `url("${badgeBg}")` : undefined,
                backgroundSize: badgeBg ? "cover" : undefined,
              }}
              className={`relative rounded-2xl p-2.5 border transition cursor-pointer flex items-center justify-between gap-3 ${
                isCurrent
                  ? "bg-sky-500/15 border-sky-500/60"
                  : dark
                    ? "bg-slate-900/70 border-slate-800/80 hover:border-sky-500/40"
                    : "bg-white border-slate-200 hover:border-sky-300"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={resolveAssetUrl(r.pic, "picroom", "/room.png")}
                  alt={r.topic}
                  onError={(e) => {
                    e.currentTarget.src = "/room.png";
                  }}
                  className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-slate-700/50 bg-slate-800"
                  style={{ borderColor: normalizeHexColor(r.color, "#334155") }}
                />

                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {badgeIcon && (
                      <img
                        src={badgeIcon}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-4 h-4 object-contain shrink-0"
                      />
                    )}
                    <span dir="auto" className="text-xs font-extrabold truncate">
                      {r.topic}
                    </span>
                    {r.needpass && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                    {r.is_live_audio || (r.room_owner_meta as any)?.live_config?.is_live_audio || r.stage_count >= 12 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#FE2C55]/20 text-[#FE2C55] text-[9px] font-black border border-[#FE2C55]/40 animate-pulse">
                        <Radio className="w-2.5 h-2.5" />
                        <span>بث مباشر (12 مقعداً)</span>
                      </span>
                    ) : r.broadcast ? (
                      <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : null}
                  </div>
                  <div dir="auto" className="text-[11px] text-slate-400 truncate mt-0.5">
                    {r.about || "غرفة دردشة عامة"}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    {r.deleted && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">مؤقتة</span>
                    )}
                    {r.rmli > 0 && <span dir="auto">مطلوب {r.rmli} لايك</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400">
                  <Users className="w-3 h-3" />
                  <span>
                    {count}/{r.max || 40}
                  </span>
                </span>

                {canEditSpecificRoom(r) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoom(r);
                      setFormOpen(true);
                    }}
                    className={`p-1.5 rounded-xl border transition ${
                      dark ? "border-slate-800 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
                    }`}
                    title="إعدادات الغرفة"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Password Prompt Modal */}
      {passPromptRoom && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handlePasswordJoin}
            className={`w-full max-w-sm rounded-3xl border p-5 shadow-2xl space-y-4 ${
              dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <DoorOpen className="w-4 h-4 text-amber-400" />
              <span>دخول {passPromptRoom.topic}</span>
            </div>
            <input
              type="password"
              required
              autoFocus
              value={roomPassword}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="أدخل كلمة مرور الغرفة..."
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none ${
                dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPassPromptRoom(null)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold ${
                  dark ? "border-slate-700" : "border-slate-200"
                }`}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                دخول
              </button>
            </div>
          </form>
        </div>
      )}

      {formOpen && (
        <RoomFormModal
          dark={dark}
          editingRoom={editingRoom}
          onClose={() => {
            setFormOpen(false);
            setEditingRoom(null);
          }}
        />
      )}

      {voiceFormOpen && (
        <CreateVoiceRoomModal
          dark={dark}
          isOpen={voiceFormOpen}
          onClose={() => setVoiceFormOpen(false)}
        />
      )}
    </div>
  );
}
