import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, Volume2, VolumeX, Play } from "lucide-react";
import { resolveAssetUrl } from "../../lib/mediaUrl.js";
import type { FeedMediaItem } from "./feedTypes.js";

interface FeedMediaViewerProps {
  mediaItems: FeedMediaItem[];
  mediaType: "image" | "carousel" | "video";
  dark: boolean;
}

export function FeedMediaViewer({ mediaItems, mediaType, dark }: FeedMediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const isCarousel = mediaItems.length > 1;
  const currentItem = mediaItems[currentIndex] || mediaItems[0];

  // Auto-play / pause video when in viewport
  useEffect(() => {
    if (mediaType !== "video" || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return;
        if (entry.isIntersecting) {
          videoRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mediaType]);

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

  const isCurrentVideo = currentItem.mediaType === "video" || mediaType === "video";

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none bg-black flex items-center justify-center max-h-[580px] min-h-[320px]"
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
            src={resolveAssetUrl(currentItem.url)}
            className="w-full max-h-[580px] object-contain"
            loop
            playsInline
            muted={isMuted}
            preload="metadata"
          />

          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm shadow-lg">
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              </div>
            </div>
          )}

          {/* Sound Mute/Unmute button */}
          <button
            type="button"
            onClick={toggleMute}
            className="absolute bottom-3 end-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-md shadow-md z-10"
            aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <img
          src={resolveAssetUrl(currentItem.url)}
          alt="Post content"
          className="w-full max-h-[580px] object-cover transition-opacity duration-300"
          loading="lazy"
        />
      )}

      {/* Carousel Navigation Buttons */}
      {isCarousel && (
        <>
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute start-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all z-10"
              aria-label="السابق"
            >
              <ChevronRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
            </button>
          )}

          {currentIndex < mediaItems.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all z-10"
              aria-label="التالي"
            >
              <ChevronLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
            </button>
          )}

          {/* Top-Right Index Badge */}
          <div className="absolute top-3 end-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold backdrop-blur-md z-10">
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
