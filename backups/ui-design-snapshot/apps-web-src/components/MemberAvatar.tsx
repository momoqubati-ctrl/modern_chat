import type { OnlineUserSnapshot } from "@newchat/shared";
import { resolveAssetUrl, resolveCountryFlagUrl } from "../lib/mediaUrl.js";

export function getStatusDotClass(stat?: number, offline?: boolean): string {
  if (offline) return "bg-slate-500";
  switch (Number(stat || 0)) {
    case 1:
      return "bg-amber-400";
    case 2:
      return "bg-rose-500";
    case 3:
      return "bg-violet-500";
    default:
      return "bg-emerald-500";
  }
}

export function getStatusLabel(stat?: number, offline?: boolean): string {
  if (offline) return "غير متصل";
  switch (Number(stat || 0)) {
    case 1:
      return "خارج الدردشة";
    case 2:
      return "مشغول";
    case 3:
      return "وضع خاص";
    default:
      return "متواجد";
  }
}

export function MemberAvatar({
  pic,
  cover,
  topic,
  stat,
  offline,
  speaking = false,
  size = "md",
  showStatus = true,
}: {
  pic?: string;
  cover?: string;
  topic?: string;
  stat?: number;
  offline?: boolean;
  speaking?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
}) {
  const sizeClass =
    size === "xs"
      ? "w-7 h-7"
      : size === "sm"
        ? "w-9 h-9"
        : size === "lg"
          ? "w-14 h-14"
          : size === "xl"
            ? "w-20 h-20"
            : "w-11 h-11";

  const avatarSrc = resolveAssetUrl(pic, "pic", "/pic.png");
  const coverSrc = cover ? resolveAssetUrl(cover, "cover", "") : "";

  return (
    <div
      className={`relative inline-flex shrink-0 ${sizeClass} ${
        speaking ? "member-avatar-speaking" : ""
      }`}
    >
      <img
        src={avatarSrc}
        alt={topic || "عضو"}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.dataset.fallbackApplied) {
            img.dataset.fallbackApplied = "1";
            img.src = "/pic.png";
          }
        }}
        className="w-full h-full rounded-full object-cover border border-slate-700/50 bg-slate-800"
      />
      {coverSrc && (
        <img
          src={coverSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full scale-115 object-contain pointer-events-none select-none z-[2]"
        />
      )}
      {showStatus && (
        <span
          title={getStatusLabel(stat, offline)}
          className={`absolute bottom-0 left-0 w-3 h-3 rounded-full border-2 border-slate-900 z-[3] ${getStatusDotClass(
            stat,
            offline,
          )}`}
        />
      )}
    </div>
  );
}

export function MemberBadgesInline({
  user,
}: {
  user: Partial<OnlineUserSnapshot> & { documentationc?: boolean; documents?: boolean; co?: string };
}) {
  const flagSrc = resolveCountryFlagUrl(user.co);
  const icoSrc = user.ico ? resolveAssetUrl(user.ico, "dro3", "") : "";
  const giftIcoSrc = user.gift_ico ? resolveAssetUrl(user.gift_ico, "gifts_git", "") : "";
  const isVerified = Boolean(user.documentationc || user.documents);

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {isVerified && (
        <img
          src="/tick.png"
          alt="موثق"
          title="عضو موثق"
          className="w-3.5 h-3.5 object-contain shrink-0"
        />
      )}
      {icoSrc && (
        <img
          src={icoSrc}
          alt=""
          title={user.power || "وسام"}
          className="w-4 h-4 object-contain shrink-0"
        />
      )}
      {giftIcoSrc && (
        <img
          src={giftIcoSrc}
          alt=""
          title="شارة هدية"
          className="w-4 h-4 object-contain shrink-0"
        />
      )}
      {flagSrc && (
        <img
          src={flagSrc}
          alt={user.co || ""}
          title={user.co || ""}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="w-4 h-3 rounded-[2px] object-cover shrink-0 border border-slate-700/40"
        />
      )}
    </span>
  );
}
