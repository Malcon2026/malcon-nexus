import React, { useEffect, useRef } from 'react';

const PX_PER_SEC = 90;

/** Horizontal news-style ticker for the TV board header — no title, big scrolling text. */
export const TvNoticeTicker: React.FC<{ text: string }> = ({ text }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const halfWidth = track.scrollWidth / 2;
    const seconds = Math.max(12, halfWidth / PX_PER_SEC);
    track.style.animationDuration = `${seconds}s`;
  }, [text]);

  return (
    <div className="tv-notice-ticker flex-1 min-w-0 mx-4" aria-live="polite">
      <div ref={trackRef} className="tv-notice-ticker-track">
        <span className="tv-notice-ticker-text">{text}</span>
        <span className="tv-notice-ticker-sep" aria-hidden>
          ◆
        </span>
        <span className="tv-notice-ticker-text" aria-hidden>
          {text}
        </span>
        <span className="tv-notice-ticker-sep" aria-hidden>
          ◆
        </span>
      </div>
    </div>
  );
};
