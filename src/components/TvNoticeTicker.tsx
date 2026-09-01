import React, { useEffect, useRef } from 'react';
import {
  DEFAULT_TV_NOTICE_COLOR,
  DEFAULT_TV_NOTICE_SEP_COLOR,
} from '../lib/tvNotice';

const PX_PER_SEC = 90;

interface TvNoticeTickerProps {
  text: string;
  color?: string;
  sepColor?: string;
  /** Use in settings preview — stays inside a fixed-width bar (no page overflow). */
  contained?: boolean;
}

/** Horizontal news-style ticker for the TV board header — no title, big scrolling text. */
export const TvNoticeTicker: React.FC<TvNoticeTickerProps> = ({
  text,
  color = DEFAULT_TV_NOTICE_COLOR,
  sepColor = DEFAULT_TV_NOTICE_SEP_COLOR,
  contained = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const halfWidth = track.scrollWidth / 2;
    const seconds = Math.max(12, halfWidth / PX_PER_SEC);
    track.style.animationDuration = `${seconds}s`;
  }, [text, color, sepColor]);

  return (
    <div
      className={
        contained
          ? 'tv-notice-ticker tv-notice-ticker--contained w-full min-w-0 max-w-full'
          : 'tv-notice-ticker flex-1 min-w-0 mx-4'
      }
      aria-live="polite"
    >
      <div ref={trackRef} className="tv-notice-ticker-track">
        <span className="tv-notice-ticker-text" style={{ color }}>
          {text}
        </span>
        <span className="tv-notice-ticker-sep" style={{ color: sepColor }} aria-hidden>
          ◆
        </span>
        <span className="tv-notice-ticker-text" style={{ color }} aria-hidden>
          {text}
        </span>
        <span className="tv-notice-ticker-sep" style={{ color: sepColor }} aria-hidden>
          ◆
        </span>
      </div>
    </div>
  );
};
