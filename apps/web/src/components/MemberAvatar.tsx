import { memo } from "react";
import type { OnlineUserSnapshot } from "@newchat/shared";
import { useChatStore } from "@newchat/core-client";
import { getCountryNameArabic, resolveAssetUrl, resolveCountryFlagUrl } from "../lib/mediaUrl.js";
import { getBadgeStyle } from "../lib/badgeStyle.js";
import { getUserGiftIco, getUserIco, resolvePowerIco } from "../lib/userCosmetics.js";
import { VerifiedBadge, isUserVerified } from "./VerifiedBadge.js";

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

export const MemberAvatar = memo(function MemberAvatar({
  pic,
  cover,
  topic,
  stat,
  offline,
  speaking = false,
  size = "md",
  showStatus = true,
  statusPosition = "left",
}: {
  pic?: string;
  cover?: string;
  topic?: string;
  stat?: number;
  offline?: boolean;
  speaking?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  statusPosition?: "left" | "right";
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
          className={`absolute bottom-0 ${statusPosition === "right" ? "right-0" : "left-0"} ${
            size === "lg" || size === "xl" ? "w-3.5 h-3.5" : "w-3 h-3"
          } rounded-full border-2 border-slate-900 z-[3] ${getStatusDotClass(
            stat,
            offline,
          )}`}
        />
      )}
    </div>
  );
});

export function MemberPrefixIcons({
  user,
  powers,
  size = "md",
}: {
  user: Partial<OnlineUserSnapshot>;
  powers?: any[];
  size?: "sm" | "md" | "lg";
}) {
  const storePowers = useChatStore((s) => s.powers);
  const activePowers = powers || storePowers;
  const icoSrc = getUserIco(user, activePowers);
  const giftIcoSrc = getUserGiftIco(user);

  const userRoleName = user.rank || user.power;
  const userRole = userRoleName && activePowers ? activePowers.find((p) => p.name === userRoleName) : null;
  const roleIcoSrc = userRole?.ico ? resolvePowerIco(userRole.ico) : "";

  if (!giftIcoSrc && !roleIcoSrc && !icoSrc) return null;

  const giftSizeClass =
    size === "sm"
      ? "w-3.5 h-3.5 min-w-[14px] max-h-[14px]"
      : size === "lg"
        ? "w-5 h-5 min-w-[20px] max-h-[20px]"
        : "w-[18px] h-[18px] min-w-[18px] max-h-[18px]";

  const roleSizeClass = giftSizeClass;

  const icoSizeClass =
    size === "sm"
      ? "h-3.5 max-h-[16px] w-auto max-w-[90px]"
      : size === "lg"
        ? "h-5 max-h-[22px] w-auto max-w-[160px]"
        : "h-[18px] max-h-[20px] w-auto max-w-[140px]";

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {/* 1. ايقونه الاسم */}
      {giftIcoSrc && (
        <img
          src={giftIcoSrc}
          alt=""
          title="شارة هدية"
          className={`${giftSizeClass} object-contain shrink-0`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      {/* 2. ايقونه الترقية (الرتب) */}
      {roleIcoSrc && (
        <img
          src={roleIcoSrc}
          alt=""
          title={userRole?.name || "رتبة"}
          className={`${roleSizeClass} object-contain shrink-0`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      {/* 3. بنر الاسم */}
      {icoSrc && (
        <img
          src={icoSrc}
          alt=""
          title={user.power || "بنر / وسام"}
          className={`${icoSizeClass} object-contain shrink-0`}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}

export function MemberBadgesInline({
  user,
  showFlag = true,
  showSiteBadge = true,
  showIco = true,
  showGift = true,
  showRank = false,
}: {
  user: Partial<OnlineUserSnapshot> & { documentationc?: boolean; documents?: boolean; co?: string };
  showFlag?: boolean;
  showSiteBadge?: boolean;
  showIco?: boolean;
  showGift?: boolean;
  showRank?: boolean;
}) {
  const powers = useChatStore((s) => s.powers);
  const flagSrc = showFlag ? resolveCountryFlagUrl(user.co) : "";
  const countryName = getCountryNameArabic(user.co);
  const icoSrc = showIco ? getUserIco(user, powers) : "";
  const giftIcoSrc = showGift ? getUserGiftIco(user) : "";
  const isVerified = isUserVerified(user);
  const userRole = showRank ? powers.find((p) => p.name === (user.rank || user.power)) : null;

  const siteBadgeObj = (() => {
    if (!showSiteBadge || !user.site_badge) return null;
    if (typeof user.site_badge === "object") {
      const b = user.site_badge as { name?: string; bg?: string; icon?: string; bg_type?: string };
      return b.name ? b : null;
    }
    if (typeof user.site_badge === "string" && user.site_badge.startsWith("{")) {
      try {
        const parsed = JSON.parse(user.site_badge);
        return parsed && parsed.name ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  })();

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {giftIcoSrc && (
        <img
          src={giftIcoSrc}
          alt=""
          title="شارة هدية"
          className="w-[18px] h-[18px] min-w-[18px] max-h-[18px] object-contain shrink-0"
        />
      )}
      {icoSrc && (
        <img
          src={icoSrc}
          alt=""
          title={user.power || "بنر / وسام"}
          className="h-[18px] max-h-[20px] w-auto max-w-[140px] object-contain shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      {isVerified && <VerifiedBadge size="sm" />}
      {showRank && userRole && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold border border-amber-500/30 shrink-0">
          {userRole.ico ? (
            <img
              src={resolvePowerIco(userRole.ico)}
              alt=""
              className="w-3 h-3 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span>👑</span>
          )}
          <span className="truncate max-w-[65px]">{userRole.name}</span>
        </span>
      )}
      {siteBadgeObj && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0 shadow-xs ${
            siteBadgeObj.bg_type === "animated" ? "badge-animated-gradient" : ""
          }`}
          style={getBadgeStyle(siteBadgeObj.bg, siteBadgeObj.bg_type === "animated")}
          title={siteBadgeObj.name}
        >
          {siteBadgeObj.icon && (
            <img
              src={resolveAssetUrl(siteBadgeObj.icon, "dro3", "")}
              alt=""
              className="w-3 h-3 rounded-full object-cover shrink-0 border border-white/40"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <span className="truncate max-w-[70px]">{siteBadgeObj.name}</span>
        </span>
      )}
      {flagSrc && (
        <img
          src={flagSrc}
          alt={countryName}
          title={countryName}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="w-4 h-3 rounded-[2px] object-cover shrink-0 border border-slate-700/40 shadow-xs"
        />
      )}
    </span>
  );
}
