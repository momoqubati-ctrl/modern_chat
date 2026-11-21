import { memo, useMemo, type ReactNode } from "react";

interface HashtagTextProps {
  text: string;
  className?: string;
  onHashtagClick?: (tag: string) => void;
}

// Unicode regex matching hashtags in Arabic, English, and other scripts
const HASHTAG_REGEX = /(#[\p{L}\p{N}_\-]+)/gu;

export const HashtagText = memo(function HashtagText({
  text,
  className = "",
  onHashtagClick,
}: HashtagTextProps) {
  const elements = useMemo(() => {
    if (!text) return null;

    const parts = text.split(HASHTAG_REGEX);
    return parts.map((part, index) => {
      if (part.startsWith("#") && part.length > 1) {
        return (
          <span
            key={index}
            onClick={(e) => {
              if (onHashtagClick) {
                e.stopPropagation();
                onHashtagClick(part);
              }
            }}
            className="text-rose-500 font-bold hover:text-rose-600 transition-colors cursor-pointer inline-block"
            title={`هاشتاج ${part}`}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  }, [text, onHashtagClick]);

  return <span className={className}>{elements}</span>;
});
