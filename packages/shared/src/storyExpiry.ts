export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export type ActiveStorySlide = Record<string, unknown> & {
  itemIndex: number;
  time: number;
};

function toTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric) ? numeric : Date.parse(String(value));
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

export function filterActiveStorySlides(
  items: unknown,
  fallbackTimestamp: unknown,
  now = Date.now(),
): ActiveStorySlide[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((value, itemIndex) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];

    const item = value as Record<string, unknown>;
    const timestamp = toTimestampMs(item.time) ?? toTimestampMs(fallbackTimestamp);
    if (timestamp === null || now - timestamp >= STORY_LIFETIME_MS) return [];

    return [{ ...item, itemIndex, time: timestamp }];
  });
}
