import type { StorySlideItem } from "@newchat/shared";

export const STORY_GRADIENTS = [
  { name: "بنفسجي", value: "linear-gradient(135deg,#667eea,#764ba2)" },
  { name: "وردي", value: "linear-gradient(135deg,#f093fb,#f5576c)" },
  { name: "أزرق", value: "linear-gradient(135deg,#4facfe,#00f2fe)" },
  { name: "أخضر", value: "linear-gradient(135deg,#43e97b,#38f9d7)" },
  { name: "برتقالي", value: "linear-gradient(135deg,#fa709a,#fee140)" },
  { name: "خزامي", value: "linear-gradient(135deg,#a18cd1,#fbc2eb)" },
  { name: "خوخي", value: "linear-gradient(135deg,#fccb90,#d57eeb)" },
  { name: "أزرق سماوي", value: "linear-gradient(135deg,#e0c3fc,#8ec5fc)" },
  { name: "أحمر", value: "linear-gradient(135deg,#f5576c,#ff6f91)" },
  { name: "كحلي", value: "linear-gradient(135deg,#30cfd0,#330867)" },
] as const;

export const STORY_TEXT_COLORS = [
  { name: "أبيض", value: "#ffffff" },
  { name: "أسود", value: "#000000" },
  { name: "ذهبي", value: "#ffd700" },
  { name: "أحمر", value: "#ff4444" },
  { name: "أزرق", value: "#4488ff" },
] as const;

export interface RawStoryGroup {
  id?: number;
  sid: string;
  photo: string;
  name: string;
  ucol?: string;
  link?: string;
  lastUpdated?: string;
  item?: StorySlideItem[];
  seen?: boolean;
  hasUnviewed?: boolean;
}

export function normalizeStorySlides(group: RawStoryGroup | null | undefined): StorySlideItem[] {
  if (!group) return [];
  const rawList = Array.isArray(group.item) ? group.item : [];
  if (rawList.length > 0) {
    return rawList.map((it, idx) => ({
      ...it,
      id: String(it.id || `slide_${group.id || group.sid}_${idx}`),
      type: (it.type || "image") as StorySlideItem["type"],
      src: String(it.src || ""),
      caption: it.caption ? String(it.caption) : "",
      bgColor: it.bgColor ? String(it.bgColor) : "",
      textColor: it.textColor ? String(it.textColor) : "",
      itemIndex: Number.isInteger(Number(it.itemIndex)) ? Number(it.itemIndex) : idx,
      length: Math.max(3, Number(it.length || 6) || 6),
      time: Number(it.time || group.lastUpdated || Date.now()),
      viewsCount: Math.max(0, Number(it.viewsCount || 0)),
      likesCount: Math.max(0, Number(it.likesCount || 0)),
      commentsCount: Math.max(0, Number(it.commentsCount || 0)),
      viewedByMe: Boolean(it.viewedByMe),
      likedByMe: Boolean(it.likedByMe),
    }));
  }
  if (group.link) {
    return [
      {
        id: `legacy_${group.id || group.sid}`,
        type: /\.(mp4|webm|mov)(\?.*)?$/i.test(group.link) ? "video" : "image",
        src: String(group.link),
        length: 6,
        time: Number(group.lastUpdated || Date.now()),
        viewsCount: 0,
        likesCount: 0,
        commentsCount: 0,
        viewedByMe: Boolean(group.seen),
        likedByMe: false,
      },
    ];
  }
  return [];
}

export function formatStoryClock(ts: unknown): string {
  const n = Number(ts);
  if (!n || Number.isNaN(n)) return "";
  try {
    return new Date(n).toLocaleTimeString("ar-SA", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatStoryRelativeAge(ts: unknown): string {
  const n = Number(ts);
  if (!n || Number.isNaN(n)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - n) / 1000));
  if (diffSec < 60) return "الآن";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} س`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ي`;
  const weeks = Math.floor(days / 7);
  return `${weeks} أ`;
}
