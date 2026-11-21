import { useState, useRef } from "react";
import { X, Image, Video, Music, Loader2, Plus, Trash2, Hash } from "lucide-react";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import { HashtagText } from "./HashtagText.js";

interface MediaPreview {
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
}

interface FeedCreatePostModalProps {
  dark: boolean;
  onClose: () => void;
  onSubmit: (params: {
    caption?: string;
    mediaItems: Array<{ url: string; mediaType?: "image" | "video"; width?: number; height?: number }>;
    musicTitle?: string;
  }) => Promise<boolean>;
  onUploadFile: (file: File) => Promise<{ url: string; mediaType: "image" | "video"; width?: number; height?: number } | null>;
}

export function FeedCreatePostModal({
  dark,
  onClose,
  onSubmit,
  onUploadFile,
}: FeedCreatePostModalProps) {
  const [caption, setCaption] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [previews, setPreviews] = useState<MediaPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setError(null);

    const selectedFiles = Array.from(e.target.files);
    const newPreviews: MediaPreview[] = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      mediaType: file.type.startsWith("video/") ? "video" : "image",
    }));

    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemovePreview = (index: number) => {
    setPreviews((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previews.length === 0) {
      setError("يرجى اختيار صورة أو فيديو واحد على الأقل للمنشور");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload all files
      const uploadedMedia: Array<{ url: string; mediaType?: "image" | "video"; width?: number; height?: number }> = [];

      for (const item of previews) {
        const res = await onUploadFile(item.file);
        if (!res) {
          throw new Error("فشل رفع أحد الملفات، يرجى المحاولة مرة أخرى");
        }
        uploadedMedia.push({
          url: res.url,
          mediaType: res.mediaType,
          width: res.width,
          height: res.height,
        });
      }

      // 2. Submit post
      const ok = await onSubmit({
        caption: caption.trim(),
        mediaItems: uploadedMedia,
        musicTitle: musicTitle.trim() || undefined,
      });

      if (ok) {
        onClose();
      } else {
        setError("تعذر إنشاء المنشور، يرجى المحاولة مجدداً");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء رفع المنشور";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Dialog */}
      <div
        dir="rtl"
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden z-10 transition-colors ${
          dark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-800/60">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-sm font-bold">إنشاء منشور جديد</h3>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || previews.length === 0}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
              previews.length > 0 && !isSubmitting
                ? "bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white shadow-md hover:opacity-95"
                : "bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جارٍ النشر...</span>
              </span>
            ) : (
              "نشر"
            )}
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll">
          {error && (
            <div className="p-3 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
              {error}
            </div>
          )}

          {/* Media Previews Row */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">
              الصور والفيديوهات ({previews.length})
            </label>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 chat-scroll">
              {previews.map((item, idx) => (
                <div
                  key={idx}
                  className="relative w-24 h-28 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 bg-black group"
                >
                  {item.mediaType === "video" ? (
                    <video src={item.previewUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemovePreview(idx)}
                    className="absolute top-1 end-1 p-1 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add Media Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-24 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 shrink-0 transition-colors hover:border-rose-500 hover:text-rose-500 ${
                  dark ? "border-slate-800 text-slate-400" : "border-slate-300 text-slate-500"
                }`}
              >
                <Plus className="w-6 h-6" />
                <span className="text-[11px] font-bold">إضافة</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Caption Textarea & Hashtags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-400">
                وصف المنشور (Caption)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                {caption.length}/2000
              </span>
            </div>
            <textarea
              name="feed_post_caption"
              id="feed_post_caption"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="اكتب وصفاً للمنشور مع هاشتاجات... #اكسبلور #يوميات #تصويري"
              rows={3}
              maxLength={2000}
              className={`w-full p-3 rounded-xl text-xs outline-none border transition-colors resize-none placeholder:text-slate-400 ${
                dark
                  ? "bg-slate-950 border-slate-800 focus:border-rose-500"
                  : "bg-slate-50 border-slate-200 focus:border-rose-500"
              }`}
            />

            {/* Quick Hashtag Suggestions */}
            <div className="mt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 mb-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>هاشتاجات مقترحة:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {["#اكسبلور", "#ترند", "#يوميات", "#شات", "#موسيقى", "#تصويري", "#لايف", "#جديد"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const trimmed = caption.trim();
                      if (!trimmed.includes(tag)) {
                        setCaption(trimmed ? `${trimmed} ${tag}` : tag);
                      }
                    }}
                    className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/25 transition-all active:scale-95"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Hashtag Preview */}
            {caption.includes("#") && (
              <div className="mt-2.5 p-2.5 rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">معاينة النص مع الهاشتاجات:</span>
                <HashtagText text={caption} />
              </div>
            )}
          </div>

          {/* Audio Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-rose-500" />
              <span>اسم المقطع الصوتي (اختياري)</span>
            </label>
            <input
              type="search"
              name="feed_music_title"
              id="feed_music_title"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              value={musicTitle}
              onChange={(e) => setMusicTitle(e.target.value)}
              placeholder="اسم المقطع الصوتي أو الأغنية المصاحبة..."
              className={`w-full px-3 py-2 rounded-xl text-xs outline-none border transition-colors placeholder:text-slate-400 ${
                dark
                  ? "bg-slate-950 border-slate-800 focus:border-rose-500"
                  : "bg-slate-50 border-slate-200 focus:border-rose-500"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
