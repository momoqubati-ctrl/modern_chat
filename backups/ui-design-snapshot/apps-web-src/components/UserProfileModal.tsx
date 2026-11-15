import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  AtSign,
  Award,
  Ban,
  Coins,
  Crown,
  DoorOpen,
  Eraser,
  Eye,
  Gift,
  Heart,
  History,
  Mail,
  MessageSquare,
  MicOff,
  Phone,
  Shield,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Video,
  X,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { canActOnRank, getPowerDefinitionByName, type OnlineUserSnapshot, type SiteBadge } from "@newchat/shared";
import { formatTimeArabic, normalizeHexColor, resolveAssetUrl } from "../lib/mediaUrl.js";
import {
  explainMediaAccessError,
  isMediaCaptureSupported,
  requestUserMediaWithFallback,
  stashCallMediaStream,
  unlockBrowserAudioContext,
} from "../lib/mediaPermissions.js";
import { canModerateUser, hasRoleFlag, resolveMemberRole } from "../lib/permissions.js";
import { MemberAvatar, MemberBadgesInline, getStatusLabel } from "./MemberAvatar.js";
import type { MailRecipientDraft } from "./InternalMailPanel.js";

interface UserProfileModalProps {
  dark: boolean;
  user: OnlineUserSnapshot | null;
  onClose: () => void;
  onStartPm: (user: OnlineUserSnapshot) => void;
  onOpenGift: (user: OnlineUserSnapshot) => void;
  onOpenMail: (draft: MailRecipientDraft) => void;
  onMention: (mentionText: string) => void;
}

export function UserProfileModal({
  dark,
  user,
  onClose,
  onStartPm,
  onOpenGift,
  onOpenMail,
  onMention,
}: UserProfileModalProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const sessionToken = useChatStore((s) => s.sessionToken);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const speakingUsers = useChatStore((s) => s.speakingUsers);
  const stageState = useChatStore((s) => s.stageState);
  const followInfoMap = useChatStore((s) => s.followInfoMap);
  const siteBadges = useChatStore((s) => s.siteBadges);
  const dro3 = useChatStore((s) => s.dro3);

  const recordProfileVisit = useChatStore((s) => s.recordProfileVisit);
  const getFollowInfo = useChatStore((s) => s.getFollowInfo);
  const followUser = useChatStore((s) => s.followUser);
  const unfollowUser = useChatStore((s) => s.unfollowUser);
  const sendModerationAction = useChatStore((s) => s.sendModerationAction);
  const unick = useChatStore((s) => s.unick);
  const setLikes = useChatStore((s) => s.setLikes);
  const setStatusMessage = useChatStore((s) => s.setStatusMessage);
  const setSiteBadge = useChatStore((s) => s.setSiteBadge);
  const requestCall = useChatStore((s) => s.requestCall);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const liveUser = user ? onlineMap[user.id] ?? user : null;
  const stageMutedUsers =
    stageState.mutedUsers && typeof stageState.mutedUsers === "object"
      ? (stageState.mutedUsers as Record<string, boolean>)
      : {};
  const isLiveUserSpeaking = Boolean(
    liveUser && speakingUsers[liveUser.id] && !stageMutedUsers[liveUser.id] && !liveUser.muted,
  );
  const isSelf = Boolean(me && liveUser && (me.id === liveUser.id || (me.uid && me.uid === liveUser.uid)));
  const followKey = liveUser ? String(liveUser.uid || liveUser.id) : "";
  const followInfo = followKey ? followInfoMap[followKey] : undefined;

  const [tab, setTab] = useState<"info" | "mod" | "history">("info");
  const [alertText, setAlertText] = useState("");
  const [banReason, setBanReason] = useState("مخالفة قوانين الدردشة");
  const [nickDraft, setNickDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [likesDraft, setLikesDraft] = useState("");
  const [selectedPower, setSelectedPower] = useState("");
  const [powerDays, setPowerDays] = useState("30");
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [selectedGiftIco, setSelectedGiftIco] = useState("");
  const [aliases, setAliases] = useState<Array<Record<string, unknown>>>([]);
  const [loadingAliases, setLoadingAliases] = useState(false);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (!liveUser) return;
    setTab("info");
    setNickDraft(liveUser.topic || "");
    setStatusDraft(liveUser.msg || "");
    setLikesDraft(String(liveUser.rep ?? 0));
    setSelectedPower(liveUser.power || "");
    setSelectedBadgeId(String(liveUser.site_badge_id || ""));
    setSelectedGiftIco(String(liveUser.gift_ico || ""));
    setAliases([]);

    if (!isSelf && liveUser.uid) {
      recordProfileVisit(liveUser.uid);
    }
    if (liveUser.uid || liveUser.id) {
      getFollowInfo(liveUser.uid || liveUser.id, !liveUser.uid);
    }
  }, [liveUser?.id, liveUser?.uid, isSelf, recordProfileVisit, getFollowInfo]);

  if (!liveUser) return null;

  const targetRole = resolveMemberRole(liveUser, powers);
  const myActorRole = resolveMemberRole(me, powers, myPowerRole);
  const canModerate = !isSelf && canModerateUser(me, liveUser, powers);

  const canAlert = canModerate && hasRoleFlag(me, powers, "alert", myPowerRole);
  const canMute = canModerate && hasRoleFlag(me, powers, "meiut", myPowerRole);
  const canKickSite = canModerate && hasRoleFlag(me, powers, "kick", myPowerRole);
  const canKickRoom =
    !isSelf &&
    (canModerate ||
      hasRoleFlag(me, powers, "roomowner", myPowerRole) ||
      hasRoleFlag(me, powers, "kick", myPowerRole));
  const canBan = canModerate && hasRoleFlag(me, powers, "ban", myPowerRole);
  const canDelPic = canModerate && hasRoleFlag(me, powers, "delpic", myPowerRole);
  const canUnick =
    (isSelf && hasRoleFlag(me, powers, "mynick", myPowerRole)) ||
    (canModerate && hasRoleFlag(me, powers, "unick", myPowerRole));
  const canEditLikes = canModerate && hasRoleFlag(me, powers, "ulike", myPowerRole);
  const canEditMsg = isSelf || (canModerate && hasRoleFlag(me, powers, "edituser", myPowerRole));
  const canSetPower =
    !isSelf &&
    Boolean(sessionToken) &&
    hasRoleFlag(me, powers, "setpower", myPowerRole) &&
    canActOnRank(powers, me?.rank || me?.power || "", liveUser.rank || liveUser.power || "");
  const canAssignSiteBadge =
    !isSelf &&
    (hasRoleFlag(me, powers, "edituser", myPowerRole) ||
      hasRoleFlag(me, powers, "setpower", myPowerRole) ||
      hasRoleFlag(me, powers, "owner", myPowerRole));
  const canGiftIcon = canModerate && hasRoleFlag(me, powers, "gifticon", myPowerRole);
  const canViewHistory = !isSelf && Boolean(sessionToken) && hasRoleFlag(me, powers, "history", myPowerRole);
  const showModTab = canModerate || canUnick || canKickRoom || canSetPower || canAssignSiteBadge;

  const themeBannerUrl = liveUser.them ? resolveAssetUrl(liveUser.them, "them", "") : "";
  const pichUrl = liveUser.pich ? resolveAssetUrl(liveUser.pich, "pic", "") : "";
  const badgeObj: SiteBadge | null = (() => {
    if (liveUser.site_badge && typeof liveUser.site_badge === "object") {
      return liveUser.site_badge as SiteBadge;
    }
    if (liveUser.site_badge_id) {
      return (siteBadges as unknown as SiteBadge[]).find((b) => String(b.id) === String(liveUser.site_badge_id)) ?? null;
    }
    return null;
  })();

  const handleLoadAliases = async () => {
    if (!sessionToken) return;
    setLoadingAliases(true);
    try {
      const list = await getApiClient().getUserIpAliases(sessionToken, liveUser.id || liveUser.uid || "");
      setAliases(Array.isArray(list) ? list : []);
    } catch (err) {
      pushNotice(err instanceof Error ? err.message : "تعذر جلب كشف الأسماء", { topic: "كشف الأسماء" });
    } finally {
      setLoadingAliases(false);
    }
  };

  const handleApplyPower = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !canSetPower) return;
    setPromoting(true);
    try {
      const targetKey = liveUser.idreg || liveUser.uid || liveUser.id;
      const res = await getApiClient().setPowerCpRoot(sessionToken, {
        id: targetKey,
        power: selectedPower,
        days: Number.parseInt(powerDays || "0", 10) || 0,
      });
      pushNotice(res.msg || (res.err ? "تعذر تنفيذ الترقية" : "تم تحديث الرتبة بنجاح"), {
        topic: "الترقيات",
        force: 1,
      });
    } catch (err) {
      pushNotice(err instanceof Error ? err.message : "فشلت عملية الترقية", { topic: "الترقيات" });
    } finally {
      setPromoting(false);
    }
  };

  const availableRoles = powers.filter((r) => {
    if (!myActorRole) return false;
    return Number(r.rank || 0) <= Number(myActorRole.rank || 0);
  });

  const panelBg = dark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900";
  const subCardBg = dark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200";
  const inputCls = `w-full rounded-xl px-3 py-2 text-xs border outline-none ${
    dark
      ? "bg-slate-950 border-slate-700 text-slate-100 focus:border-sky-500"
      : "bg-white border-slate-300 text-slate-900 focus:border-sky-600"
  }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${panelBg}`}
      >
        {/* Banner & Header */}
        <div
          className="relative h-28 shrink-0 overflow-hidden"
          style={{
            backgroundColor: normalizeHexColor(liveUser.bg, "#0f172a"),
            backgroundImage: themeBannerUrl ? `url("${themeBannerUrl}")` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 left-3 p-1.5 rounded-full bg-black/45 hover:bg-black/70 text-white transition"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-2.5 right-4 left-12 flex items-center justify-between gap-2 text-white">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-xs text-[11px] font-bold">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              {targetRole?.name || liveUser.power || (liveUser.islogin === "ضيف" ? "زائر" : "عضو")}
            </span>
            {liveUser.idreg && (
              <span className="px-2 py-0.5 rounded-full bg-black/45 text-[11px] font-mono">
                #{liveUser.idreg}
              </span>
            )}
          </div>
        </div>

        {/* Avatar + Name Summary */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-800/25 shrink-0">
          <div className="flex items-start gap-3">
            <div className="-mt-11 shrink-0">
              <MemberAvatar
                pic={liveUser.pic}
                cover={liveUser.cover}
                topic={liveUser.topic}
                stat={liveUser.stat}
                offline={liveUser.offline}
                speaking={isLiveUserSpeaking}
                size="xl"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3
                  className="text-base font-extrabold truncate"
                  style={{
                    color:
                      liveUser.ucol && liveUser.ucol !== "#000000" && liveUser.ucol !== "#ffffff"
                        ? normalizeHexColor(liveUser.ucol)
                        : undefined,
                  }}
                >
                  {liveUser.topic}
                </h3>
                <MemberBadgesInline user={liveUser} />
                {badgeObj && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                    style={{
                      backgroundColor: normalizeHexColor(badgeObj.bg, "#0284c7"),
                    }}
                  >
                    {badgeObj.icon && (
                      <img
                        src={resolveAssetUrl(badgeObj.icon, "dro3", "")}
                        alt=""
                        className="w-3 h-3 object-contain"
                      />
                    )}
                    {badgeObj.name}
                  </span>
                )}
              </div>
              <p className="text-xs opacity-75 mt-0.5 line-clamp-2">{liveUser.msg || "لا توجد حالة حالياً"}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] opacity-65">
                <span>{getStatusLabel(liveUser.stat, liveUser.offline)}</span>
                {liveUser.muted && (
                  <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                    <MicOff className="w-3 h-3" />
                    مكتوم
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary Action Strip */}
          {!isSelf && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (followInfo?.isFollowing) {
                    unfollowUser(liveUser.uid || liveUser.id, !liveUser.uid);
                  } else {
                    followUser(liveUser.uid || liveUser.id, !liveUser.uid);
                  }
                }}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  followInfo?.isFollowing
                    ? "bg-slate-700 hover:bg-slate-600 text-white"
                    : "bg-sky-600 hover:bg-sky-500 text-white"
                }`}
              >
                {followInfo?.isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {followInfo?.isFollowing ? "متابع" : "متابعة"}
              </button>

              <button
                type="button"
                onClick={() => {
                  onStartPm(liveUser);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                خاص
              </button>

              {!liveUser.nopmcall && (
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      unlockBrowserAudioContext();
                      if (!isMediaCaptureSupported()) {
                        pushNotice(explainMediaAccessError(null, "mic"), { force: 1 });
                        return;
                      }
                      try {
                        const stream = await requestUserMediaWithFallback({ audio: true, video: false });
                        stashCallMediaStream("audio", stream);
                        requestCall(liveUser.id, "audio");
                        onStartPm(liveUser);
                        onClose();
                      } catch (err) {
                        pushNotice(explainMediaAccessError(err, "mic"), { force: 1 });
                      }
                    })();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                  title="مكالمة صوتية"
                >
                  <Phone className="w-3.5 h-3.5" />
                  صوت
                </button>
              )}

              {!liveUser.nopmvideocall && (
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      unlockBrowserAudioContext();
                      if (!isMediaCaptureSupported()) {
                        pushNotice(explainMediaAccessError(null, "both"), { force: 1 });
                        return;
                      }
                      try {
                        const stream = await requestUserMediaWithFallback({ audio: true, video: true });
                        stashCallMediaStream("video", stream);
                        requestCall(liveUser.id, "video");
                        onStartPm(liveUser);
                        onClose();
                      } catch (err) {
                        pushNotice(explainMediaAccessError(err, "both"), { force: 1 });
                      }
                    })();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition"
                  title="مكالمة فيديو"
                >
                  <Video className="w-3.5 h-3.5" />
                  فيديو
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onOpenGift(liveUser);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition"
              >
                <Gift className="w-3.5 h-3.5" />
                هدية
              </button>

              <button
                type="button"
                onClick={() => {
                  sendModerationAction("like", { id: liveUser.id });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
              >
                <Heart className="w-3.5 h-3.5" />
                إعجاب
              </button>

              {liveUser.uid && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenMail({
                      uid: liveUser.uid!,
                      username: liveUser.username,
                      topic: liveUser.topic,
                      pic: liveUser.pic,
                    });
                    onClose();
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  بريد
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onMention(`@${liveUser.idreg || liveUser.topic}`);
                  onClose();
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                  dark ? "border-slate-700 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-100"
                }`}
              >
                <AtSign className="w-3.5 h-3.5" />
                منشن
              </button>
            </div>
          )}

          {/* Modal Tabs */}
          {(showModTab || canViewHistory) && (
            <div className="mt-3 flex gap-1.5 border-t border-slate-800/30 pt-2">
              <button
                type="button"
                onClick={() => setTab("info")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                  tab === "info" ? "bg-sky-600 text-white" : "opacity-75 hover:opacity-100"
                }`}
              >
                البيانات
              </button>
              {showModTab && (
                <button
                  type="button"
                  onClick={() => setTab("mod")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    tab === "mod" ? "bg-rose-600 text-white" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  الإدارة والإشراف
                </button>
              )}
              {canViewHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setTab("history");
                    if (aliases.length === 0) void handleLoadAliases();
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 ${
                    tab === "history" ? "bg-amber-600 text-white" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  كشف الأسماء
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto chat-scroll p-4 space-y-3">
          {tab === "info" && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`p-2.5 rounded-2xl border ${subCardBg}`}>
                  <div className="text-base font-extrabold text-rose-500">{Number(liveUser.rep || 0)}</div>
                  <div className="text-[11px] opacity-65">اللايكات</div>
                </div>
                <div className={`p-2.5 rounded-2xl border ${subCardBg}`}>
                  <div className="text-base font-extrabold text-amber-500">{Number(liveUser.evaluation || 0)}</div>
                  <div className="text-[11px] opacity-65">نقاط التقييم</div>
                </div>
                <div className={`p-2.5 rounded-2xl border ${subCardBg}`}>
                  <div className="text-base font-extrabold text-sky-500">{Number(liveUser.gifts_received_count || 0)}</div>
                  <div className="text-[11px] opacity-65">الهدايا</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`p-2.5 rounded-2xl border ${subCardBg}`}>
                  <div className="text-sm font-extrabold">{followInfo?.followersCount ?? 0}</div>
                  <div className="text-[11px] opacity-65">المتابعون</div>
                </div>
                <div className={`p-2.5 rounded-2xl border ${subCardBg}`}>
                  <div className="text-sm font-extrabold">{followInfo?.followingCount ?? 0}</div>
                  <div className="text-[11px] opacity-65">يتابع</div>
                </div>
                <div className={`p-2.5 rounded-2xl border ${subCardBg}`}>
                  <div className="text-sm font-extrabold flex items-center justify-center gap-1 text-amber-400">
                    <Coins className="w-3.5 h-3.5" />
                    {Number(liveUser.coins ?? liveUser.coin ?? 0)}
                  </div>
                  <div className="text-[11px] opacity-65">الكوينز</div>
                </div>
              </div>

              {pichUrl && (
                <div className={`rounded-2xl border p-2.5 ${subCardBg}`}>
                  <div className="text-[11px] font-bold opacity-70 mb-1.5">الصورة الثانوية</div>
                  <img
                    src={pichUrl}
                    alt="صورة الغلاف"
                    className="w-full max-h-48 object-cover rounded-xl"
                  />
                </div>
              )}

              {(liveUser.yp || (liveUser as { youtub?: string }).youtub) && (
                <div className={`rounded-2xl border p-3 ${subCardBg}`}>
                  <div className="text-[11px] font-bold opacity-70 mb-1">مقطع الملف الشخصي</div>
                  <div className="text-xs font-mono truncate opacity-85">
                    {liveUser.yp || (liveUser as { youtub?: string }).youtub}
                  </div>
                </div>
              )}

              <div className={`rounded-2xl border p-3 text-xs space-y-1.5 ${subCardBg}`}>
                <div className="flex justify-between">
                  <span className="opacity-65">النوع</span>
                  <span className="font-bold">{liveUser.islogin || "عضو"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-65">إعجابات الحائط</span>
                  <span className="font-bold">{Number(liveUser.wall_post_likes || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-65">الدولة</span>
                  <span className="font-bold uppercase">{liveUser.co || "-"}</span>
                </div>
                {liveUser.meta_ts && (
                  <div className="flex justify-between">
                    <span className="opacity-65">آخر تحديث</span>
                    <span className="font-bold">{formatTimeArabic(liveUser.meta_ts)}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "mod" && showModTab && (
            <div className="space-y-3">
              {/* Quick Actions */}
              {!isSelf && (
                <div className={`p-3 rounded-2xl border space-y-2 ${subCardBg}`}>
                  <div className="text-xs font-extrabold">إجراءات فورية</div>
                  <div className="flex flex-wrap gap-1.5">
                    {canMute && (
                      <button
                        type="button"
                        onClick={() => sendModerationAction("meiut", { id: liveUser.id })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                      >
                        <MicOff className="w-3.5 h-3.5" />
                        {liveUser.muted ? "فك الكتم" : "كتم العضو"}
                      </button>
                    )}
                    {canKickRoom && (
                      <button
                        type="button"
                        onClick={() => sendModerationAction("roomkick", { id: liveUser.id })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                      >
                        <DoorOpen className="w-3.5 h-3.5" />
                        طرد من الغرفة
                      </button>
                    )}
                    {canKickSite && (
                      <button
                        type="button"
                        onClick={() => sendModerationAction("kick", { id: liveUser.id })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        طرد من الشات
                      </button>
                    )}
                    {canDelPic && (
                      <button
                        type="button"
                        onClick={() => sendModerationAction("delpic", { id: liveUser.id })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold"
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        مسح الصورة
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => sendModerationAction("rinvite", { id: liveUser.id })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                    >
                      <DoorOpen className="w-3.5 h-3.5" />
                      دعوة للغرفة
                    </button>
                  </div>
                </div>
              )}

              {/* Alert & Ban */}
              {canAlert && (
                <div className={`p-3 rounded-2xl border space-y-2 ${subCardBg}`}>
                  <label className="block text-xs font-extrabold">إرسال تنبيه مباشر</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={alertText}
                      onChange={(e) => setAlertText(e.target.value)}
                      placeholder="نص التنبيه..."
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!alertText.trim()) return;
                        sendModerationAction("not", { id: liveUser.id, msg: alertText.trim() });
                        setAlertText("");
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      تنبيه
                    </button>
                  </div>
                </div>
              )}

              {canBan && (
                <div className={`p-3 rounded-2xl border space-y-2 ${subCardBg}`}>
                  <label className="block text-xs font-extrabold text-rose-500">حظر دائم</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="سبب الحظر..."
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        sendModerationAction("ban", { id: liveUser.id, reason: banReason.trim() });
                        onClose();
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 inline-flex items-center gap-1"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      حظر
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Nick / Likes / Status */}
              {(canUnick || canEditLikes || canEditMsg) && (
                <div className={`p-3 rounded-2xl border space-y-2.5 ${subCardBg}`}>
                  <div className="text-xs font-extrabold">تعديل بيانات العرض</div>
                  {canUnick && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nickDraft}
                        onChange={(e) => setNickDraft(e.target.value)}
                        placeholder="الاسم المستعار..."
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => unick(liveUser.id, nickDraft.trim())}
                        className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0"
                      >
                        تغيير الاسم
                      </button>
                    </div>
                  )}
                  {canEditMsg && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        placeholder="الحالة..."
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setStatusMessage(statusDraft.trim(), liveUser.id)}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0"
                      >
                        تعديل الحالة
                      </button>
                    </div>
                  )}
                  {canEditLikes && (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={likesDraft}
                        onChange={(e) => setLikesDraft(e.target.value)}
                        placeholder="عدد اللايكات"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setLikes(liveUser.id, Math.max(0, Number(likesDraft) || 0))}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                      >
                        ضبط اللايكات
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Site Badge & Gift Icon */}
              {canAssignSiteBadge && siteBadges.length > 0 && (
                <div className={`p-3 rounded-2xl border space-y-2 ${subCardBg}`}>
                  <label className="text-xs font-extrabold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    شارة الموقع
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedBadgeId}
                      onChange={(e) => setSelectedBadgeId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">بدون شارة</option>
                      {siteBadges.map((b, idx) => (
                        <option key={String(b.id || idx)} value={String(b.id || "")}>
                          {String(b.name || b.id || "شارة")}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setSiteBadge(selectedBadgeId, liveUser.id)}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0"
                    >
                      تطبيق
                    </button>
                  </div>
                </div>
              )}

              {canGiftIcon && dro3.length > 0 && (
                <div className={`p-3 rounded-2xl border space-y-2 ${subCardBg}`}>
                  <label className="text-xs font-extrabold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    إهداء أيقونة للملف
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedGiftIco}
                      onChange={(e) => setSelectedGiftIco(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">إزالة الأيقونة</option>
                      {dro3.map((iconFile) => (
                        <option key={iconFile} value={iconFile}>
                          {iconFile}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => sendModerationAction("gift_icon", { id: liveUser.id, ico: selectedGiftIco })}
                      className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shrink-0"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              )}

              {/* Rank Promotion */}
              {canSetPower && (
                <form onSubmit={handleApplyPower} className={`p-3 rounded-2xl border space-y-2 ${subCardBg}`}>
                  <label className="text-xs font-extrabold flex items-center gap-1 text-amber-400">
                    <Crown className="w-3.5 h-3.5" />
                    ترقية / تعديل الرتبة
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={selectedPower}
                      onChange={(e) => setSelectedPower(e.target.value)}
                      className={`col-span-2 ${inputCls}`}
                    >
                      <option value="">بدون رتبة (تنزيل)</option>
                      {availableRoles.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name} (رتبة {r.rank})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={powerDays}
                      onChange={(e) => setPowerDays(e.target.value)}
                      placeholder="الأيام"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] opacity-60">الرتبة الحالية: {getPowerDefinitionByName(powers, liveUser.power)?.name || "عضو"}</span>
                    <button
                      type="submit"
                      disabled={promoting}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold"
                    >
                      {promoting ? "جارٍ الحفظ..." : "حفظ الترقية"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === "history" && canViewHistory && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold opacity-75">الأسماء المسجلة بنفس عنوان الشبكة</span>
                <button
                  type="button"
                  onClick={() => void handleLoadAliases()}
                  className="text-xs font-bold text-sky-500 hover:underline inline-flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  تحديث
                </button>
              </div>
              {loadingAliases ? (
                <div className="py-8 text-center text-xs opacity-60">جارٍ التحميل...</div>
              ) : aliases.length === 0 ? (
                <div className={`p-4 rounded-2xl border text-center text-xs opacity-65 ${subCardBg}`}>
                  لا توجد أسماء سابقة مسجلة
                </div>
              ) : (
                aliases.map((row, idx) => (
                  <div key={String(row.id || idx)} className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${subCardBg}`}>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{String(row.topic || row.username || "-")}</div>
                      <div className="text-[11px] opacity-65 truncate">
                        حساب: {String(row.username || "زائر")} | IP: {String(row.ip || "-")}
                      </div>
                    </div>
                    {Boolean(row.fp) && (
                      <span className="text-[10px] font-mono opacity-55 shrink-0">{String(row.fp).slice(0, 8)}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
