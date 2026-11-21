import assert from "node:assert/strict";
import test from "node:test";
import { filterActiveStorySlides, STORY_LIFETIME_MS } from "../packages/shared/src/storyExpiry.ts";

test("expires a slide at 24 hours while keeping younger slides and their original indices", () => {
  const now = 1_800_000_000_000;
  const active = filterActiveStorySlides(
    [
      { id: "expired", time: now - STORY_LIFETIME_MS },
      { id: "active", time: now - STORY_LIFETIME_MS + 1 },
    ],
    null,
    now,
  );

  assert.deepEqual(active.map(({ id, itemIndex }) => ({ id, itemIndex })), [
    { id: "active", itemIndex: 1 },
  ]);
});

test("supports legacy second-based timestamps and the group's timestamp fallback", () => {
  const now = 1_800_000_000_000;
  const active = filterActiveStorySlides(
    [{ id: "legacy", time: (now - 1000) / 1000 }, { id: "fallback" }],
    now - 2000,
    now,
  );

  assert.deepEqual(active.map(({ id, time }) => ({ id, time })), [
    { id: "legacy", time: now - 1000 },
    { id: "fallback", time: now - 2000 },
  ]);
});

test("does not keep a slide with no valid timestamp alive indefinitely", () => {
  assert.deepEqual(filterActiveStorySlides([{ id: "unknown", time: "invalid" }], "", 1_800_000_000_000), []);
});
