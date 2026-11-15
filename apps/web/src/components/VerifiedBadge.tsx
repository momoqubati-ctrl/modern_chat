import { BadgeCheck } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { OnlineUserSnapshot } from "@newchat/shared";

export interface VerifiedBadgeProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  title?: string;
}

/**
 * Reusable blue verification badge using Lucide's BadgeCheck icon.
 * Matches the exact shape shown in Stories comments and colors it blue.
 */
export function VerifiedBadge({
  className = "",
  size = "sm",
  title = "حساب موثق",
}: VerifiedBadgeProps) {
  const sizeClass =
    size === "xs"
      ? "w-3 h-3"
      : size === "sm"
        ? "w-3.5 h-3.5"
        : size === "md"
          ? "w-4 h-4"
          : "w-5 h-5";

  return (
    <span title={title} className="inline-flex items-center">
      <BadgeCheck
        className={`${sizeClass} text-sky-500 dark:text-sky-400 shrink-0 inline-block align-middle select-none transition-transform hover:scale-110 ${className}`}
        aria-label={title}
      />
    </span>
  );
}

/**
 * Robust helper to verify if a user/message/post/comment/mail is from a verified account.
 * Supports OnlineUserSnapshot, RoomMessagePayload, BroadcastWallPost, MailItem, and custom objects.
 */
export function isUserVerified(
  user?: unknown | null,
  onlineMap?: Record<string, OnlineUserSnapshot | Partial<OnlineUserSnapshot>>
): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as Record<string, unknown>;

  // Direct boolean/numeric flags on the record
  if (
    Boolean(
      u.documents ||
      Number(u.documentationc || 0) > 0 ||
      u.documentationc === true ||
      u.verified === true ||
      Number(u.verified || 0) > 0 ||
      u.is_verified === true ||
      u.isVerified === true ||
      u.author_verified === true ||
      u.from_verified === true ||
      u.to_verified === true
    )
  ) {
    return true;
  }

  // Lookup in onlineMap if available, or fallback to core-client store
  const map = onlineMap || useChatStore.getState().onlineMap;
  if (map) {
    const candidateKeys = [
      u.uid,
      u.id,
      u.lid,
      u.from_uid,
      u.to_uid,
      u.story_sid,
      u.sid,
    ].filter(Boolean) as string[];

    for (const key of candidateKeys) {
      const match = map[key];
      if (match && (match.documents || Number(match.documentationc || 0) > 0 || match.documentationc === true)) {
        return true;
      }
    }

    if (u.uid) {
      const found = Object.values(map).find((m) => m && m.uid === u.uid);
      if (found && (found.documents || Number(found.documentationc || 0) > 0 || found.documentationc === true)) {
        return true;
      }
    }
  }

  return false;
}
