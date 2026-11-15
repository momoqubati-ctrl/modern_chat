import type { UserNoteRecord, NoteCommentRecord, PublishNotePayload } from "@newchat/shared";

export type { UserNoteRecord, NoteCommentRecord, PublishNotePayload };

export interface UserNote {
  id: string;
  nid: string;
  uid: string;
  authorTopic: string;
  authorPic?: string;
  authorVerified?: boolean;
  authorUcol?: string;
  type: "text" | "audio";
  text?: string;
  caption?: string;
  audioUrl?: string;
  duration?: number;
  time: number;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  viewedByMe?: boolean;
  tag?: string;
}

export const FALLBACK_SAMPLE_NOTES: UserNote[] = [];

const NOTE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours lifetime

export function formatNoteRelativeAge(ts: unknown): string {
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

export function normalizeUserNotes(rawNotes: UserNoteRecord[] | undefined | null): UserNote[] {
  const result: UserNote[] = [];
  const seenNids = new Set<string>();
  const seenUids = new Set<string>();
  const now = Date.now();

  if (Array.isArray(rawNotes)) {
    for (const r of rawNotes) {
      if (!r || !r.nid || !r.uid) continue;
      const createdAt = Number(r.createdAt || 0);

      // Notes expire after 24 hours
      if (createdAt > 0 && now - createdAt > NOTE_TTL_MS) {
        continue;
      }

      // Prevent duplicate members: each member has only 1 active note
      if (seenUids.has(r.uid) || seenNids.has(r.nid)) continue;
      seenUids.add(r.uid);
      seenNids.add(r.nid);

      const isAudio = r.type === "audio";
      result.push({
        id: r.nid,
        nid: r.nid,
        uid: r.uid,
        authorTopic: r.authorTopic.startsWith("@") ? r.authorTopic : `@${r.authorTopic}`,
        authorPic: r.authorPic,
        authorVerified: Boolean(r.authorVerified),
        authorUcol: r.authorUcol,
        type: isAudio ? "audio" : "text",
        text: r.text || "",
        caption: r.caption || r.text || (isAudio ? "ملاحظة صوتية" : ""),
        audioUrl: r.audioUrl,
        duration: r.duration || 15,
        time: createdAt || now,
        likesCount: Number(r.likesCount || 0),
        commentsCount: Number(r.commentsCount || 0),
        likedByMe: Boolean(r.likedByMe),
        tag: r.tag || (isAudio ? "موسيقى" : undefined),
      });
    }
  }

  return result;
}
