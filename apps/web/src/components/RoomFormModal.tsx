import { useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Lock, Mic, Save, Trash2, Unlock, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { RoomSnapshot } from "@newchat/shared";
import { resolveAssetUrl } from "../lib/mediaUrl.js";

interface RoomFormModalProps {
  dark: boolean;
  editingRoom: RoomSnapshot | null;
  onClose: () => void;
}

export function RoomFormModal({ dark, editingRoom, onClose }: RoomFormModalProps) {
  const roomBadges = useChatStore((s) => s.roomBadges);
  const createRoom = useChatStore((s) => s.createRoom);
  const editRoom = useChatStore((s) => s.editRoom);
  const deleteRoom = useChatStore((s) => s.deleteRoom);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const initialLocks = (editingRoom?.stage_state || {}) as Record<string, 0 | 1>;

  const [topic, setTopic] = useState(editingRoom?.topic || "");
  const [about, setAbout] = useState(editingRoom?.about || "غرفة دردشة وتواصل");
  const [welcome, setWelcome] = useState(editingRoom?.welcome || "أهلاً وسهلاً بالجميع");
  const [max, setMax] = useState(String(editingRoom?.max || 40));
  const [mic, setMic] = useState(String(editingRoom?.stage_count ?? editingRoom?.mic ?? 5));
  const [micLocks, setMicLocks] = useState<Record<string, 0 | 1>>({
    "1": initialLocks["1"] ? 1 : 0,
    "2": initialLocks["2"] ? 1 : 0,
    "3": initialLocks["3"] ? 1 : 0,
    "4": initialLocks["4"] ? 1 : 0,
    "5": initialLocks["5"] ? 1 : 0,
  });
  const [pass, setPass] = useState("");
  const [color, setColor] = useState(editingRoom?.color || "#0A6E8C");
  const [rmli, setRmli] = useState(String(editingRoom?.rmli ?? 0));
  const [broadcast, setBroadcast] = useState(editingRoom ? Boolean(editingRoom.broadcast) : true);
  const [isTemp, setIsTemp] = useState(editingRoom ? Boolean(editingRoom.deleted) : true);
  const [messageMode, setMessageMode] = useState<"real" | "local">(
    editingRoom?.message_mode === "local" ? "local" : "real",
  );
  const [pic, setPic] = useState(editingRoom?.pic || "pic.png");
  const [ownerBadgeId, setOwnerBadgeId] = useState(
    String((editingRoom?.room_owner_meta as Record<string, unknown> | undefined)?.badge_id || ""),
  );
  const [ownerTargetUser, setOwnerTargetUser] = useState("");
  const [uploadingPic, setUploadingPic] = useState(false);

  const handleUploadPic = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPic(true);
    try {
      const api = getApiClient();
      const uploaded = await api.uploadRoomPic(file, file.name);
      if (uploaded) {
        setPic(uploaded.trim());
        pushNotice("تم رفع صورة الغرفة بنجاح");
      }
    } catch {
      pushNotice("فشل رفع صورة الغرفة", { force: 1 });
    } finally {
      setUploadingPic(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !about.trim() || !welcome.trim()) return;

    if (editingRoom) {
      editRoom({
        id: editingRoom.id,
        topic: topic.trim(),
        about: about.trim(),
        welcome: welcome.trim(),
        max: Number.parseInt(max, 10) || 40,
        mic: Number.parseInt(mic, 10) ?? 5,
        micLocks,
        message_mode: messageMode,
        pass: pass.trim(),
        color,
        rmli: Number.parseInt(rmli, 10) || 0,
        broadcast,
        pic,
        ownerBadgeId,
        ...(ownerTargetUser.trim() ? { ownerTargetUser: ownerTargetUser.trim() } : {}),
      });
    } else {
      createRoom({
        topic: topic.trim(),
        about: about.trim(),
        welcome: welcome.trim(),
        max: Number.parseInt(max, 10) || 40,
        mic: Number.parseInt(mic, 10) ?? 5,
        micLocks,
        message_mode: messageMode,
        pass: pass.trim(),
        color,
        rmli: Number.parseInt(rmli, 10) || 0,
        delete: isTemp,
        broadcast,
        pic,
        ownerBadgeId,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingRoom) return;
    deleteRoom(editingRoom.id);
    onClose();
  };

  const micNum = Math.max(0, Math.min(5, Number.parseInt(mic, 10) || 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className={`w-full max-w-xl max-h-[90vh] overflow-y-auto chat-scroll rounded-3xl border p-5 shadow-2xl ${
          dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/30 pb-3 mb-4">
          <h3 className="text-sm font-extrabold">
            {editingRoom ? `تعديل الغرفة: ${editingRoom.topic}` : "إنشاء غرفة جديدة"}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Room Image */}
          <div className="flex items-center gap-3">
            <img
              src={resolveAssetUrl(pic, "picroom", "/room.png")}
              alt="صورة الغرفة"
              onError={(e) => {
                e.currentTarget.src = "/room.png";
              }}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-700/60 shrink-0"
            />
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600/15 text-sky-400 hover:bg-sky-600/25 font-bold cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              <span>{uploadingPic ? "جاري الرفع..." : "تغيير صورة الغرفة"}</span>
              <input type="file" accept="image/*" onChange={handleUploadPic} className="hidden" />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">اسم الغرفة</label>
              <input
                type="text"
                required
                maxLength={80}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">كلمة سر الغرفة (اختياري)</label>
              <input
                type="text"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder={editingRoom?.needpass ? "اتركه فارغاً للإلغاء أو اكتب جديدة" : "بدون كلمة سر"}
                className={`w-full rounded-xl px-3 py-2 border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">الوصف</label>
            <input
              type="text"
              required
              maxLength={200}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 border outline-none ${
                dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">رسالة الترحيب</label>
            <input
              type="text"
              required
              maxLength={250}
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 border outline-none ${
                dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block font-semibold mb-1">أقصى عدد</label>
              <input
                type="number"
                min={2}
                max={500}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">اللايكات المطلوبة</label>
              <input
                type="number"
                min={0}
                value={rmli}
                onChange={(e) => setRmli(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">عدد المايكات</label>
              <select
                value={mic}
                onChange={(e) => setMic(e.target.value)}
                className={`w-full rounded-xl px-3 py-2 border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} مايك
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">لون الغرفة</label>
              <input
                type="color"
                value={color.startsWith("#") ? color : `#${color}`}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-700 bg-transparent p-0.5"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">وضع الرسائل</label>
              <select
                value={messageMode}
                onChange={(e) => setMessageMode(e.target.value === "local" ? "local" : "real")}
                className={`w-full rounded-xl px-3 py-2 border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <option value="real">من السيرفر — بث مباشر (Real)</option>
                <option value="local">محلي سريع — تأكيد فوري (Local)</option>
              </select>
            </div>

            {roomBadges.length > 0 && (
              <div>
                <label className="block font-semibold mb-1">وسام الغرفة</label>
                <select
                  value={ownerBadgeId}
                  onChange={(e) => setOwnerBadgeId(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border outline-none ${
                    dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <option value="">بدون وسام</option>
                  {roomBadges.map((b, idx) => (
                    <option key={String(b.id || idx)} value={String(b.id || "")}>
                      {String(b.name || b.id || "وسام")}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {editingRoom && (
            <div>
              <label className="block font-semibold mb-1">إسناد لمالك/مشرف (اسم مستخدم أو #idreg — اختياري)</label>
              <input
                type="text"
                value={ownerTargetUser}
                onChange={(e) => setOwnerTargetUser(e.target.value)}
                placeholder="مثال: #12 أو username"
                className={`w-full rounded-xl px-3 py-2 border outline-none ${
                  dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              />
            </div>
          )}

          {/* Stage Mic Locks */}
          {micNum > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold">أقفال المايكات:</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: micNum }).map((_, i) => {
                  const slot = String(i + 1);
                  const locked = Boolean(micLocks[slot]);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setMicLocks((prev) => ({
                          ...prev,
                          [slot]: prev[slot] ? 0 : 1,
                        }))
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition ${
                        locked
                          ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                          : "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      }`}
                    >
                      {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>مايك {slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={broadcast}
                onChange={(e) => setBroadcast(e.target.checked)}
                className="rounded"
              />
              <Mic className="w-3.5 h-3.5 text-sky-400" />
              <span>تفعيل البث الصوتي والمايكات</span>
            </label>

            {!editingRoom && (
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={isTemp}
                  onChange={(e) => setIsTemp(e.target.checked)}
                  className="rounded"
                />
                <span>غرفة مؤقتة (تحذف تلقائياً عند الخروج)</span>
              </label>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/30">
            {editingRoom ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 font-bold"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف الغرفة</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl border font-bold ${
                  dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"
                }`}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
              >
                <Save className="w-4 h-4" />
                <span>{editingRoom ? "حفظ التعديلات" : "إنشاء الغرفة"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
