import { useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, Image as ImageIcon, Loader2, Type, X } from "lucide-react";
import { useChatStore } from "@newchat/core-client";
import { STORY_GRADIENTS, STORY_TEXT_COLORS } from "./storyTypes.js";

interface CreateStoryModalProps {
  dark: boolean;
  open: boolean;
  onClose: () => void;
}

type StoryCreateMode = "text" | "media";

export function CreateStoryModal({ dark, open, onClose }: CreateStoryModalProps) {
  const me = useChatStore((s) => s.me);
  const publishStory = useChatStore((s) => s.publishStory);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [mode, setMode] = useState<StoryCreateMode>("text");
  const [caption, setCaption] = useState("");
  const [bgColor, setBgColor] = useState<string>(STORY_GRADIENTS[0].value);
  const [textColor, setTextColor] = useState<string>(STORY_TEXT_COLORS[0].value);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const resetForm = () => {
    if (mediaPreview.startsWith("blob:")) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMode("text");
    setCaption("");
    setBgColor(STORY_GRADIENTS[0].value);
    setTextColor(STORY_TEXT_COLORS[0].value);
    setMediaFile(null);
    setMediaPreview("");
    setMediaType(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      pushNotice("حجم الملف يجب أن لا يتجاوز 50 ميجابايت", { force: 1 });
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
    if (!isImage && !isVideo) {
      pushNotice("يرجى اختيار صورة أو فيديو", { force: 1 });
      return;
    }

    if (mediaPreview.startsWith("blob:")) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!me || me.islogin !== "عضو") {
      pushNotice("نشر القصص متاح للأعضاء المسجلين فقط", { force: 1 });
      return;
    }

    const trimmedCaption = caption.trim();
    if (mode === "text") {
      if (!trimmedCaption) {
        pushNotice("يرجى كتابة نص للقصة", { force: 1 });
        return;
      }
      if (/https?:\/\/[^\s]+/i.test(trimmedCaption)) {
        pushNotice("لا يُسمح بإدراج روابط في النص", { force: 1 });
        return;
      }
    } else if (!mediaFile) {
      pushNotice("يرجى اختيار صورة أو فيديو للقصة", { force: 1 });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "text") {
        publishStory({
          type: "text",
          caption: trimmedCaption,
          bgColor,
          textColor,
          length: 6,
        });
        pushNotice("جاري نشر القصة...");
        handleClose();
        return;
      }

      if (!mediaFile) return;
      const uploadedUrl = (await getApiClient().uploadMediaFile(mediaFile, mediaFile.name)).trim();
      if (!uploadedUrl) {
        throw new Error("empty upload url");
      }
      const finalType = mediaType === "video" ? "video" : "image";
      publishStory({
        link: uploadedUrl,
        type: finalType,
        caption: trimmedCaption,
        length: finalType === "video" ? 15 : 6,
      });
      pushNotice("جاري نشر القصة...");
      handleClose();
    } catch {
      pushNotice("تعذر نشر القصة، حاول مجدداً", { force: 1 });
      setSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      onClick={handleClose}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="إنشاء قصة جديدة"
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden ${
          dark
            ? "bg-slate-950 border-slate-800 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            dark ? "border-slate-800" : "border-slate-100"
          }`}
        >
          <h2 className="text-sm font-black">إنشاء قصة جديدة</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق"
            className={`rounded-full p-1.5 transition ${
              dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto p-5 max-h-[82dvh] chat-scroll">
          {/* Mode Toggle Tabs */}
          <div
            className={`grid grid-cols-2 gap-1.5 rounded-2xl p-1 ${
              dark ? "bg-slate-900" : "bg-slate-100"
            }`}
          >
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                mode === "text"
                  ? dark
                    ? "bg-slate-700 text-white shadow-sm"
                    : "bg-white text-slate-900 shadow-sm"
                  : dark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Type className="h-4 w-4" />
              <span>نص</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("media")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                mode === "media"
                  ? dark
                    ? "bg-slate-700 text-white shadow-sm"
                    : "bg-white text-slate-900 shadow-sm"
                  : dark
                    ? "text-slate-400 hover:text-slate-200"
                    : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>صورة / فيديو</span>
            </button>
          </div>

          {mode === "text" ? (
            <>
              {/* 10 Gradients (2 rows × 5) */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-400">الخلفية</span>
                <div className="grid grid-cols-5 gap-2">
                  {STORY_GRADIENTS.map((g) => {
                    const active = bgColor === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setBgColor(g.value)}
                        title={g.name}
                        className={`relative h-9 w-full rounded-xl border-2 transition ${
                          active ? "border-sky-400 scale-105 shadow-md" : "border-transparent"
                        }`}
                        style={{ background: g.value }}
                      >
                        {active && (
                          <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5 Text Colors */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-400">لون النص</span>
                <div className="flex items-center gap-3">
                  {STORY_TEXT_COLORS.map((c) => {
                    const active = textColor === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setTextColor(c.value)}
                        title={c.name}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                          active
                            ? "border-sky-400 scale-110 shadow-md"
                            : dark
                              ? "border-slate-700"
                              : "border-slate-200"
                        }`}
                        style={{ backgroundColor: c.value }}
                      >
                        {active && (
                          <Check
                            className={`h-4 w-4 ${c.value === "#ffffff" ? "text-slate-900" : "text-white"}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Box */}
              <div
                className="flex h-44 items-center justify-center rounded-2xl p-6 text-center shadow-inner"
                style={{ background: bgColor }}
              >
                {caption ? (
                  <p
                    dir="auto"
                    className="text-lg font-extrabold leading-relaxed break-words max-w-full"
                    style={{ color: textColor }}
                  >
                    {caption}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-white/75">سيظهر النص هنا...</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {mediaPreview ? (
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  {mediaType === "video" ? (
                    <video
                      src={mediaPreview}
                      controls
                      className="h-56 w-full object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="معاينة القصة"
                      className="h-56 w-full object-contain bg-black"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (mediaPreview.startsWith("blob:")) {
                        URL.revokeObjectURL(mediaPreview);
                      }
                      setMediaFile(null);
                      setMediaPreview("");
                      setMediaType(null);
                    }}
                    aria-label="إزالة الملف"
                    className="absolute left-2.5 top-2.5 rounded-full bg-black/65 p-1.5 text-white hover:bg-black/85"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex h-44 w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed transition ${
                    dark
                      ? "border-slate-700 bg-slate-900/70 text-slate-400 hover:border-sky-500 hover:text-slate-200"
                      : "border-slate-300 bg-slate-50 text-slate-500 hover:border-sky-500"
                  }`}
                >
                  <Camera className="h-9 w-9" />
                  <span className="text-xs font-extrabold">اختر صورة أو فيديو</span>
                  <span className="text-[11px] font-semibold opacity-75">
                    دعم تشغيل فوري وسلس للفيديوهات
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* Caption Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400">النص / التعليق</label>
            <input
              type="search"
              name="story_caption_input"
              id="story_caption_input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              dir="auto"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              placeholder={mode === "text" ? "اكتب قصتك..." : "أضف تعليقاً..."}
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none transition ${
                dark
                  ? "bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:border-sky-500"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-sky-500"
              }`}
            />
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 py-3 text-sm font-black text-white shadow-lg shadow-sky-500/20 transition"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري النشر...</span>
              </>
            ) : (
              <span>نشر القصة</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
