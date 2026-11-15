import type { CSSProperties } from "react";

export function getBadgeStyle(rawBg?: string, isAnimated = false): CSSProperties {
  const cleanBg =
    String(rawBg || "")
      .trim()
      .replace(/^background\s*:\s*/i, "")
      .replace(/;+\s*$/, "")
      .trim() || "#0284c7";

  return {
    background: cleanBg,
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
    ...(isAnimated
      ? {
          backgroundSize: "220% auto",
          animation: "textclip 2s linear infinite",
          WebkitAnimation: "textclip 2s linear infinite",
          willChange: "background-position",
        }
      : {}),
  };
}
