import type { OnlineUserSnapshot, PowerRole } from "@newchat/shared";
import { resolveAssetUrl } from "./mediaUrl.js";

/**
 * Resolves the member's theme (خلفية / ثيم العضو) according to the reference project (chetos216-08-2024):
 * - If user has custom them (and not "them/undefined" or "none"), use user.them
 * - Else if user's role has power.them, fallback to role's theme
 * - Returns resolved asset URL or empty string
 */
export function getUserTheme(
  user: Partial<OnlineUserSnapshot> | null | undefined,
  powers?: PowerRole[],
): string {
  if (!user) return "";
  const directThem = String(user.them || "").trim();
  if (directThem && directThem !== "them/undefined" && directThem !== "none" && directThem !== "undefined") {
    return resolveAssetUrl(directThem, "them", "");
  }

  const roleName = user.rank || user.power;
  if (roleName && powers && powers.length > 0) {
    const role = powers.find((r) => r.name === roleName);
    const roleThem = String(role?.them || "").trim();
    if (roleThem && roleThem !== "undefined" && roleThem !== "none") {
      return resolveAssetUrl(roleThem, "them", "");
    }
  }

  return "";
}

/**
 * Resolves the member's banner (بنر العضو) according to the reference project (chetos216-08-2024):
 * - If user has custom ico (personal banner in sico/), use user.ico
 * - Else if user's role has power.ico, fallback to role's ico
 * - Returns resolved asset URL or empty string
 */
export function getUserIco(
  user: Partial<OnlineUserSnapshot> | null | undefined,
  powers?: PowerRole[],
): string {
  if (!user) return "";
  const directIco = String(user.ico || "").trim();
  if (directIco && directIco !== "undefined" && directIco !== "none") {
    // dro3 belongs to gift_ico / shields, not the name banner
    if (!directIco.includes("dro3")) {
      return resolveAssetUrl(directIco, "sico", "");
    }
  }

  const roleName = user.rank || user.power;
  if (roleName && powers && powers.length > 0) {
    const role = powers.find((r) => r.name === roleName);
    const roleIco = String(role?.ico || "").trim();
    if (roleIco && roleIco !== "undefined" && roleIco !== "none" && !roleIco.includes("dro3")) {
      return resolveAssetUrl(roleIco, "sico", "");
    }
  }

  return "";
}

/**
 * Resolves the member's shield / gift icon (أيقونة / درع الاسم) according to the reference project (chetos216-08-2024):
 * - If user has custom gift_ico (in dro3/ or gifts_git/), use user.gift_ico
 * - Else fallback to user.ico if it previously stored a dro3 icon
 * - Returns resolved asset URL or empty string
 */
export function getUserGiftIco(
  user: Partial<OnlineUserSnapshot> | null | undefined,
): string {
  if (!user) return "";
  let raw = String(user.gift_ico || "").trim();
  if ((!raw || raw === "undefined" || raw === "none") && user.ico && String(user.ico).includes("dro3")) {
    raw = String(user.ico).trim();
  }
  if (!raw || raw === "undefined" || raw === "none") return "";
  if (raw.includes("gifts_git")) {
    return resolveAssetUrl(raw, "gifts_git", "");
  }
  return resolveAssetUrl(raw, "dro3", "");
}

/**
 * Resolves the role/power (ترقية / رتبة) icon:
 * - Icons for powers usually come from dro3/ or sico/
 * - If path has sico/, resolves in sico
 * - Otherwise defaults to dro3
 */
export function resolvePowerIco(ico?: string | null): string {
  if (!ico) return "";
  const clean = String(ico).trim();
  if (!clean || clean === "none" || clean === "undefined") return "";
  if (clean.startsWith("sico/")) {
    return resolveAssetUrl(clean, "sico", "");
  }
  return resolveAssetUrl(clean, "dro3", "");
}

/**
 * Resolves the member's avatar frame / cover (إطار الصورة الشخصية) according to the reference project (chetos216-08-2024):
 * - If user has custom cover (and not "cover/undefined"), use user.cover
 * - Else if user's role has power.cover, fallback to role's cover
 * - Returns resolved asset URL or empty string
 */
export function getUserCover(
  user: Partial<OnlineUserSnapshot> | null | undefined,
  powers?: PowerRole[],
): string {
  if (!user) return "";
  const directCover = String(user.cover || "").trim();
  if (directCover && directCover !== "cover/undefined" && directCover !== "undefined") {
    return resolveAssetUrl(directCover, "cover", "");
  }

  const roleName = user.rank || user.power;
  if (roleName && powers && powers.length > 0) {
    const role = powers.find((r) => r.name === roleName);
    const roleCover = String(role?.cover || "").trim();
    if (roleCover && roleCover !== "undefined") {
      return resolveAssetUrl(roleCover, "cover", "");
    }
  }

  return "";
}
