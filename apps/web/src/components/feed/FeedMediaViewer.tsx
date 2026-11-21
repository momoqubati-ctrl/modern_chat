import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, Volume2, VolumeX, Play } from "lucide-react";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import type { FeedMediaItem } from "./feedTypes.js";

// ---------------------------------------------------------------------------
// Shared "feed has settled" gate
// ---------------------------------------------------------------------------
// Starting a decoder in the same frame that a post slides under the sticky
// header is what makes the scroll hitch on phones. A single passive listener
// tracks scrolling for the whole feed, and each video starts only after the
// gesture has been still for a moment.
let feedScrolling = false;
let feedScrollTimer: number | null = null;
const scrollIdleCallbacks = new Set<() => void>();

function markFeedScrolling() {
  feedScrolling = true;
  if (feedScrollTimer !== null) window.clearTimeout(feedScrollTimer);
  feedScrollTimer = window.setTimeout(() => {
    feedScrollTimer = null;
    feedScrolling = false;
    const callbacks = [...scrollIdleCallbacks];
    scrollIdleCallbacks.clear();
    for (const cb of callbacks) cb();
  }, 140);
}

function runWhenScrollIdle(cb: () => void): () => void {
  if (!feedScrolling) {
    cb();
    return () => {};
  }
  scrollIdleCallbacks.add(cb);
  return () => {
    scrollIdleCallbacks.delete(cb);
  };
}

let feedScrollTrackerAttached = false;
function ensureFeedScrollTracker() {
  if (feedScrollTrackerAttached || typeof window === "undefined") return;
  feedScrollTrackerAttached = true;
  window.addEventListener("scroll", markFeedScrolling, { capture: true, passive: true });
}

interface FeedMediaViewerProps {
  mediaItems: FeedMediaItem[];
  mediaType: "image" | "carousel" | "video";
  dark: boolean;
}

export function FeedMediaViewer({ mediaItems, mediaType, dark }: FeedMediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  // The <video> element gets a src only when the post is near the viewport,
  // so a long feed never opens a media session for every video at once.
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const isCarousel = mediaItems.length > 1;
  const currentItem = mediaItems[currentIndex] || mediaItems[0];
  // A carousel can contain a video item even when the post type is "carousel".
  const isCurrentVideo = currentItem?.mediaType === "video" || mediaType === "video";

  // Auto-play / pause video when in viewport
  useEffect(() => {
    if (!isCurrentVideo || !containerRef.current || !shouldLoadVideo) return;
    ensureFeedScrollTracker();

    let cancelled = false;
    let cancelIdle = () => {};

    const startPlayback = () => {
      cancelIdle = runWhenScrollIdle(() => {
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current;
        if (!video) return;
        if (entry.isIntersecting) {
          startPlayback();
        } else {
          cancelIdle();
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(containerRef.current);
    return () => {
      cancelled = true;
      cancelIdle();
      observer.disconnect();
    };
  }, [isCurrentVideo, shouldLoadVideo, currentItem?.url]);

  // Defer attaching the source until the card is close to the viewport.
  useEffect(() => {
    if (!isCurrentVideo) return;
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoadVideo(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isCurrentVideo, currentItem?.url]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : prev));
    },
    [mediaItems.length]
  );

  // Touch Swipe for Carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isSwipeLeft = distance > 50;
    const isSwipeRight = distance < -50;

    if (isSwipeLeft) handleNext();
    if (isSwipeRight) handlePrev();

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  if (!currentItem) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none bg-black flex items-center justify-center aspect-[4/3.5] sm:aspect-[4/4.5] max-h-[42vh] sm:max-h-[460px]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Media item rendering */}
      {isCurrentVideo ? (
        <div
          className="relative w-full h-full flex items-center justify-center cursor-pointer"
          onClick={toggleVideoPlayback}
        >
          <video
            ref={videoRef}
            src={shouldLoadVideo ? resolveAssetUrl(currentItem.url) : undefined}
            className="h-full w-full object-contain"
            loop
            playsInline
            muted={isMuted}
            preload="none"
          />

          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center shadow-lg">
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              </div>
            </div>
          )}

          {/* Sound Mute/Unmute button */}
          <button
            type="button"
            onClick={toggleMute}
            className="absolute bottom-3 end-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors shadow-md z-10"
            aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <img
          src={resolveAssetUrl(currentItem.url)}
          alt="Post content"
          width={currentItem.width || undefined}
          height={currentItem.height || undefined}
          className="h-full w-full object-cover transition-opacity duration-300"
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Carousel Navigation Buttons */}
      {isCarousel && (
        <>
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute start-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all z-10"
              aria-label="السابق"
            >
              <ChevronRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
            </button>
          )}

          {currentIndex < mediaItems.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all z-10"
              aria-label="التالي"
            >
              <ChevronLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
            </button>
          )}

          {/* Top-Right Index Badge */}
          <div className="absolute top-3 end-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold z-10">
            {currentIndex + 1}/{mediaItems.length}
          </div>

          {/* Bottom Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            {mediaItems.map((_, idx) => (
              <span
                key={idx}
                className={`transition-all rounded-full ${
                  idx === currentIndex
                    ? "w-2 h-2 bg-sky-400 scale-110"
                    : "w-1.5 h-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
