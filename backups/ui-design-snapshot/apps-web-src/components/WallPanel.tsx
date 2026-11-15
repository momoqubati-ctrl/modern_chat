import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  Flame,
  Heart,
  Link as LinkIcon,
  MessageCircle,
  Paperclip,
  Reply,
  Send,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import type { BroadcastWallPost } from "@newchat/shared";
import { formatTimeArabic } from "../lib/mediaUrl.js";
import { hasRoleFlag } from "../lib/permissions.js";
import { SafeRichText } from "../lib/richContent.js";
import { MemberAvatar } from "./MemberAvatar.js";

interface WallPanelProps {
  dark: boolean;
}

export function WallPanel({ dark }: WallPanelProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const myPowerRole = useChatStore((s) => s.myPowerRole);
  const wallPosts = useChatStore((s) => s.wallPosts);
  const sendWallPost = useChatStore((s) => s.sendWallPost);
  const deleteWallPost = useChatStore((s) => s.deleteWallPost);
  const commentWallPost = useChatStore((s) => s.commentWallPost);
  const likeWallPost = useChatStore((s) => s.likeWallPost);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [draft, setDraft] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isCardMode, setIsCardMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyTargets, setReplyTargets] = useState<Record<string, { cid: string; topic: string } | null>>({});

  const canModDelete = hasRoleFlag(me, powers, "delbc", myPowerRole);
  const actorKey = me?.uid || me?.lid || me?.id || "";

  const handlePublish = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() && !linkInput.trim()) return;
    sendWallPost(draft, {
      link: linkInput.trim() || undefined,
      card: isCardMode || Boolean(linkInput.trim()),
    });
    setDraft("");
    setLinkInput("");
    setShowLinkInput(false);
  };

  const handleUploadMedia = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploadedUrl = (await getApiClient().uploadMediaFile(file, file.name)).trim();
      if (uploadedUrl) {
        setLinkInput(uploadedUrl);
        setIsCardMode(true);
        setShowLinkInput(true);
        pushNotice("تم إرفاق الملف بالمنشور");
      }
    } catch {
      pushNotice("تعذر رفع الملف المرفق", { force: 1 });
    } finally {
      setUploading(false);
    }
  };

  const handleSendComment = (bid: string) => {
    const text = (commentDrafts[bid] || "").trim();
    if (!text) return;
    const replyTo = replyTargets[bid];
    commentWallPost(bid, text, replyTo?.cid);
    setCommentDrafts((prev) => ({ ...prev, [bid]: "" }));
    setReplyTargets((prev) => ({ ...prev, [bid]: null }));
  };

  const renderLikesInfo = (p: BroadcastWallPost) => {
    const arr = Array.isArray(p.likes) ? p.likes : [];
    let state1 = 0;
    let state2 = 0;
    let myState: 0 | 1 | 2 = 0;
    for (const raw of arr) {
      const val = String(raw);
      if (val.endsWith(":2")) {
        state2 += 1;
        if (actorKey && val === `${actorKey}:2`) myState = 2;
      } else {
        state1 += 1;
        if (actorKey && (val === actorKey || val === `${actorKey}:1`)) myState = 1;
      }
    }
    return { state1, state2, myState };
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Wall Post Composer */}
      <form onSubmit={handlePublish} className="p-3 border-b border-slate-800/30 space-y-2 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="شارك لحظتك على الحائط..."
            className={`flex-1 rounded-xl px-3 py-2 text-xs border outline-none ${
              dark ? "bg-slate-950 border-slate-800 focus:border-sky-500" : "bg-slate-50 border-slate-200 focus:border-sky-500"
            }`}
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>نشر</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 text-slate-300 cursor-pointer">
              <Paperclip className="w-3.5 h-3.5 text-sky-400" />
              <span>{uploading ? "رفع..." : "مرفق"}</span>
              <input
                type="file"
                accept="image/*,audio/*,video/*"
                onChange={handleUploadMedia}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowLinkInput((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 text-slate-300"
            >
              <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>رابط / يوتيوب</span>
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-400">
            <input
              type="checkbox"
              checked={isCardMode}
              onChange={(e) => setIsCardMode(e.target.checked)}
              className="rounded"
            />
            <span>بطاقة غنية</span>
          </label>
        </div>

        {showLinkInput && (
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="الصق رابط صورة / فيديو / يوتيوب..."
            className={`w-full rounded-xl px-3 py-1.5 text-xs border outline-none ${
              dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}
          />
        )}
      </form>

      {/* Wall Posts Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 chat-scroll">
        {wallPosts.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-8">لا توجد منشورات على الحائط حالياً</div>
        ) : (
          wallPosts.map((p) => {
            const canDelete =
              canModDelete ||
              (me?.uid && p.uid === me.uid) ||
              (me?.lid && p.lid === me.lid);
            const { state1, state2, myState } = renderLikesInfo(p);
            const comments = Array.isArray(p.bcc) ? p.bcc : [];
            const commentsVisible = Boolean(openComments[p.bid]);
            const replyTarget = replyTargets[p.bid];

            return (
              <article
                key={p.bid}
                className={`rounded-2xl p-3 border text-xs space-y-2.5 ${
                  dark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MemberAvatar pic={p.pic} topic={p.topic} size="sm" showStatus={false} />
                    <div className="min-w-0">
                      <div className="font-extrabold truncate" style={{ color: p.ucol || undefined }}>
                        {p.topic}
                      </div>
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteWallPost(p.bid)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="حذف المنشور"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="leading-relaxed" style={{ color: p.mcol || undefined }}>
                  <SafeRichText text={p.msg} />
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/30">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => likeWallPost(p.bid, 1)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                        myState === 1
                          ? "bg-sky-500/20 text-sky-400 font-bold"
                          : "hover:bg-slate-800/50 text-slate-400"
                      }`}
                      title="إعجاب"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{state1}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => likeWallPost(p.bid, 2)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition ${
                        myState === 2
                          ? "bg-rose-500/20 text-rose-400 font-bold"
                          : "hover:bg-slate-800/50 text-slate-400"
                      }`}
                      title="حب / تفاعل الحائط"
                    >
                      {myState === 2 ? <Heart className="w-3.5 h-3.5 fill-rose-400" /> : <Flame className="w-3.5 h-3.5" />}
                      <span>{state2}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setOpenComments((prev) => ({ ...prev, [p.bid]: !prev[p.bid] }))
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800/50 text-slate-400"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>تعليقات ({comments.length})</span>
                  </button>
                </div>

                {/* Comments Section */}
                {commentsVisible && (
                  <div className="pt-2 space-y-2 border-t border-slate-800/30">
                    <div className="space-y-1.5 max-h-48 overflow-y-auto chat-scroll">
                      {comments.map((c, idx) => {
                        const cid = String(c.cid || idx);
                        const cTopic = String(c.topic || "عضو");
                        const parentComment = c.replyToCid
                          ? comments.find((parent) => String(parent.cid || "") === String(c.replyToCid))
                          : null;

                        return (
                          <div
                            key={cid}
                            className={`rounded-xl px-2.5 py-1.5 ${
                              c.replyToCid ? "mr-4 border-r-2 border-sky-500/50" : ""
                            } ${dark ? "bg-slate-950/70" : "bg-slate-50"}`}
                          >
                            {parentComment && (
                              <div className="text-[10px] text-sky-400 mb-0.5 truncate">
                                رداً على {String(parentComment.topic || "")}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[11px]" style={{ color: String(c.ucol || "") || undefined }}>
                                {cTopic}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                {c.time ? <span>{formatTimeArabic(c.time)}</span> : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReplyTargets((prev) => ({
                                      ...prev,
                                      [p.bid]: { cid, topic: cTopic },
                                    }))
                                  }
                                  className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  <Reply className="w-2.5 h-2.5" />
                                  <span>رد</span>
                                </button>
                              </div>
                            </div>
                            <div className="mt-0.5 break-words">{String(c.msg || "")}</div>
                          </div>
                        );
                      })}
                    </div>

                    {replyTarget && (
                      <div className="flex items-center justify-between text-[10px] bg-sky-500/10 text-sky-400 px-2.5 py-1 rounded-lg">
                        <span>الرد على: {replyTarget.topic}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setReplyTargets((prev) => ({ ...prev, [p.bid]: null }))
                          }
                          className="font-bold"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={commentDrafts[p.bid] || ""}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({ ...prev, [p.bid]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSendComment(p.bid);
                          }
                        }}
                        placeholder="اكتب تعليقاً..."
                        className={`flex-1 rounded-xl px-2.5 py-1.5 text-xs border outline-none ${
                          dark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendComment(p.bid)}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-600 text-white font-bold"
                      >
                        تعليق
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
