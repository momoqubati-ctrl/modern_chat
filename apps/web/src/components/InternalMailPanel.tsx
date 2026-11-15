import { useEffect, useState, type FormEvent } from "react";
import { Check, CheckCheck, Inbox, Mail, RefreshCw, Search, Send, SendHorizontal } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { formatDateTimeArabic } from "../lib/mediaUrl.js";
import { MemberAvatar } from "./MemberAvatar.js";
import { VerifiedBadge, isUserVerified } from "./VerifiedBadge.js";

export interface MailRecipientDraft {
  uid: string;
  username?: string;
  topic: string;
  pic?: string;
}

interface InternalMailPanelProps {
  dark: boolean;
  initialRecipient?: MailRecipientDraft | null;
  onClearInitialRecipient?: () => void;
}

export function InternalMailPanel({
  dark,
  initialRecipient,
  onClearInitialRecipient,
}: InternalMailPanelProps) {
  const me = useChatStore((s) => s.me);
  const unreadMailCount = useChatStore((s) => s.unreadMailCount);
  const mailInbox = useChatStore((s) => s.mailInbox);
  const mailSent = useChatStore((s) => s.mailSent);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const mailSearchResults = useChatStore((s) => s.mailSearchResults);
  const loadMailBoxes = useChatStore((s) => s.loadMailBoxes);
  const searchMailUsers = useChatStore((s) => s.searchMailUsers);
  const sendMail = useChatStore((s) => s.sendMail);
  const markMailRead = useChatStore((s) => s.markMailRead);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [tab, setTab] = useState<"inbox" | "sent" | "compose">("inbox");
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState<MailRecipientDraft | null>(null);
  const [body, setBody] = useState("");

  const isRegistered = Boolean(me && me.islogin === "عضو");

  useEffect(() => {
    if (isRegistered) {
      loadMailBoxes();
    }
  }, [isRegistered, loadMailBoxes]);

  useEffect(() => {
    if (initialRecipient?.uid) {
      setRecipient(initialRecipient);
      setTab("compose");
      onClearInitialRecipient?.();
    }
  }, [initialRecipient, onClearInitialRecipient]);

  useEffect(() => {
    if (!isRegistered || tab !== "compose") return;
    const clean = query.trim();
    if (clean.length < 1) return;
    const timer = window.setTimeout(() => {
      searchMailUsers(clean);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query, tab, isRegistered, searchMailUsers]);

  const handleSendMail = (e: FormEvent) => {
    e.preventDefault();
    if (!recipient?.uid) {
      pushNotice("اختر العضو المستلم أولاً", { topic: "البريد", force: 1 });
      return;
    }
    const cleanBody = body.trim();
    if (!cleanBody) {
      pushNotice("اكتب نص الرسالة أولاً", { topic: "البريد", force: 1 });
      return;
    }
    sendMail(recipient.uid, cleanBody);
    setBody("");
    setQuery("");
    setTab("sent");
    window.setTimeout(() => loadMailBoxes(), 350);
  };

  if (!isRegistered) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Mail className="w-6 h-6" />
        </div>
        <div className="text-sm font-extrabold">البريد الداخلي للأعضاء المسجلين</div>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          ميزة البريد الداخلي وإرسال الرسائل غير المتصلة متاحة للحسابات المسجلة فقط. سجّل الدخول بحساب عضو لاستخدام البريد.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header Tabs */}
      <div className="px-3 pt-2.5 pb-2 border-b border-slate-800/30 flex items-center justify-between gap-2 shrink-0">
        <div
          className={`grid grid-cols-3 gap-1 p-1 rounded-xl flex-1 ${
            dark ? "bg-slate-950" : "bg-slate-100"
          }`}
        >
          <button
            type="button"
            onClick={() => setTab("inbox")}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
              tab === "inbox"
                ? "bg-sky-600 text-white"
                : dark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Inbox className="w-3 h-3" />
            <span>الوارد</span>
            {unreadMailCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                {unreadMailCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab("sent")}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
              tab === "sent"
                ? "bg-sky-600 text-white"
                : dark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <SendHorizontal className="w-3 h-3" />
            <span>الصادر</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("compose")}
            className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold transition ${
              tab === "compose"
                ? "bg-emerald-600 text-white"
                : dark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send className="w-3 h-3" />
            <span>جديد</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => loadMailBoxes()}
          title="تحديث البريد"
          className={`p-2 rounded-xl border transition shrink-0 ${
            dark ? "border-slate-800 hover:bg-slate-800 text-slate-400" : "border-slate-200 hover:bg-slate-100 text-slate-600"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 chat-scroll">
        {tab === "inbox" && (
          <>
            {mailInbox.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-10">
                صندوق الوارد فارغ حالياً
              </div>
            ) : (
              mailInbox.map((item) => (
                <div
                  key={item.id}
                  dir="ltr"
                  onClick={() => {
                    if (!item.is_read) markMailRead(item.id);
                  }}
                  className={`rounded-2xl p-3 border transition cursor-pointer text-left ${
                    !item.is_read
                      ? dark
                        ? "bg-sky-500/10 border-sky-500/40"
                        : "bg-sky-50 border-sky-200"
                      : dark
                        ? "bg-slate-950/60 border-slate-800/80"
                        : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MemberAvatar
                        pic={item.from_pic}
                        topic={item.from_topic}
                        size="md"
                        showStatus={false}
                      />
                      <div className="min-w-0">
                        <div dir="auto" className="text-xs font-extrabold truncate flex items-center gap-1">
                          <span>{item.from_topic || item.from_username}</span>
                          {isUserVerified({ uid: item.from_uid, ...item, verified: (item as any).from_verified }, onlineMap) && (
                            <VerifiedBadge size="xs" />
                          )}
                        </div>
                        <div dir="auto" className="text-[10px] text-slate-400">
                          {formatDateTimeArabic(item.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!item.is_read ? (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            markMailRead(item.id);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-400 text-[10px] font-bold hover:bg-sky-500/30"
                        >
                          جديد • قراءة
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400">
                          <CheckCheck className="w-3 h-3" />
                          <span>مقروء</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (!item.is_read) markMailRead(item.id);
                          setRecipient({
                            uid: item.from_uid,
                            username: item.from_username,
                            topic: item.from_topic || item.from_username,
                            pic: item.from_pic,
                          });
                          setTab("compose");
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          dark ? "bg-slate-800 hover:bg-slate-700 text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        رد
                      </button>
                    </div>
                  </div>
                  <p dir="auto" className="mt-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {item.body}
                  </p>
                </div>
              ))
            )}
          </>
        )}

        {tab === "sent" && (
          <>
            {mailSent.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-10">
                لا توجد رسائل صادرة بعد
              </div>
            ) : (
              mailSent.map((item) => (
                <div
                  key={item.id}
                  dir="ltr"
                  className={`rounded-2xl p-3 border text-left ${
                    dark ? "bg-slate-950/60 border-slate-800/80" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MemberAvatar
                        pic={item.to_pic}
                        topic={item.to_topic}
                        size="md"
                        showStatus={false}
                      />
                      <div className="min-w-0">
                        <div dir="auto" className="text-xs font-extrabold truncate flex items-center gap-1">
                          <span>إلى: {item.to_topic || item.to_username}</span>
                          {isUserVerified({ uid: item.to_uid, ...item, verified: (item as any).to_verified }, onlineMap) && (
                            <VerifiedBadge size="xs" />
                          )}
                        </div>
                        <div dir="auto" className="text-[10px] text-slate-400">
                          {formatDateTimeArabic(item.created_at)}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold shrink-0 ${
                        item.is_read ? "text-emerald-400" : "text-slate-400"
                      }`}
                    >
                      {item.is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      <span>{item.is_read ? "تمت القراءة" : "مرسلة"}</span>
                    </span>
                  </div>
                  <p dir="auto" className="mt-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {item.body}
                  </p>
                </div>
              ))
            )}
          </>
        )}

        {tab === "compose" && (
          <form onSubmit={handleSendMail} className="space-y-3">
            {recipient ? (
              <div
                dir="ltr"
                className={`flex items-center justify-between gap-2 p-2.5 rounded-2xl border text-left ${
                  dark ? "bg-slate-950 border-sky-500/40" : "bg-sky-50 border-sky-200"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MemberAvatar
                    pic={recipient.pic}
                    topic={recipient.topic}
                    size="md"
                    showStatus={false}
                  />
                  <div className="min-w-0">
                    <div dir="auto" className="text-xs font-extrabold truncate flex items-center gap-1">
                      <span>{recipient.topic}</span>
                      {isUserVerified(recipient, onlineMap) && <VerifiedBadge size="xs" />}
                    </div>
                    {recipient.username && (
                      <div className="text-[10px] text-slate-400 truncate">@{recipient.username}</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRecipient(null)}
                  className="text-[11px] font-bold text-rose-400 hover:underline px-2 shrink-0"
                >
                  تغيير
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث عن عضو بالاسم أو اسم المستخدم..."
                    className={`w-full pr-9 pl-3 py-2 rounded-xl border text-xs outline-none ${
                      dark
                        ? "bg-slate-950 border-slate-800 focus:border-sky-500"
                        : "bg-slate-50 border-slate-200 focus:border-sky-500"
                    }`}
                  />
                </div>

                {mailSearchResults.length > 0 && (
                  <div
                    className={`max-h-44 overflow-y-auto rounded-xl border divide-y ${
                      dark ? "bg-slate-950 border-slate-800 divide-slate-800/60" : "bg-white border-slate-200 divide-slate-100"
                    }`}
                  >
                    {mailSearchResults.map((u) => (
                      <button
                        key={u.uid}
                        type="button"
                        dir="ltr"
                        onClick={() => {
                          setRecipient({
                            uid: u.uid,
                            username: u.username,
                            topic: u.topic || u.username,
                            pic: u.pic,
                          });
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 text-left transition ${
                          dark ? "hover:bg-slate-800/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <MemberAvatar pic={u.pic} topic={u.topic} size="sm" showStatus={false} />
                        <div className="min-w-0 flex-1">
                          <div dir="auto" className="text-xs font-bold truncate flex items-center gap-1">
                            <span>{u.topic || u.username}</span>
                            {isUserVerified(u, onlineMap) && <VerifiedBadge size="xs" />}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">@{u.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب رسالتك هنا (تصل العضو حتى لو كان غير متصل)..."
              maxLength={1000}
              className={`w-full rounded-2xl p-3 text-xs border outline-none resize-none ${
                dark
                  ? "bg-slate-950 border-slate-800 focus:border-sky-500"
                  : "bg-slate-50 border-slate-200 focus:border-sky-500"
              }`}
            />

            <button
              type="submit"
              disabled={!recipient || !body.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white text-xs font-extrabold transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال الرسالة البريدية</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
