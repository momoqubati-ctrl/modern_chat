import { StoriesStripRow } from "../stories/StoriesStripRow.js";

interface FeedStoriesBarProps {
  dark: boolean;
  onOpenCreator: () => void;
  onOpenViewer: (storyIdx: number, slideIdx?: number) => void;
}

export function FeedStoriesBar({ dark, onOpenCreator, onOpenViewer }: FeedStoriesBarProps) {
  return (
    <div
      className={`border-b shrink-0 py-2 ${
        dark ? "border-slate-800/80 bg-slate-950/40" : "border-slate-200/80 bg-white"
      }`}
    >
      <StoriesStripRow
        dark={dark}
        onOpenCreator={onOpenCreator}
        onOpenViewer={onOpenViewer}
      />
    </div>
  );
}
