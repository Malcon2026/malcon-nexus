import React, { useEffect, useRef } from 'react';
import {
  DEFAULT_TV_NOTICE_COLOR,
  DEFAULT_TV_NOTICE_SEP_COLOR,
} from '../lib/tvNotice';

/** Visual scroll speed — px per second in CSS pixels (stable across browser zoom). */
const PX_PER_SEC = 90;

interface TvNoticeTickerProps {
  text: string;
  color?: string;
  sepColor?: string;
  /** Use in settings preview — stays inside a fixed-width bar (no page overflow). */
  contained?: boolean;
}

/** Horizontal news-style ticker — rAF-driven so zoom / small viewports stay smooth. */
export const TvNoticeTicker: React.FC<TvNoticeTickerProps> = ({
  text,
  color = DEFAULT_TV_NOTICE_COLOR,
  sepColor = DEFAULT_TV_NOTICE_SEP_COLOR,
  contained = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf = 0;
    let last = performance.now();

    const measureLoop = () => {
      // Duplicated content — one loop is exactly half the track width.
      const w = track.scrollWidth / 2;
      loopWidthRef.current = w > 0 ? w : 0;
      if (loopWidthRef.current > 0) {
        offsetRef.current = offsetRef.current % loopWidthRef.current;
      }
    };

    const applyTransform = () => {
      const x = offsetRef.current;
      track.style.transform = contained
        ? `translate3d(${-x}px, -50%, 0)`
        : `translate3d(${-x}px, 0, 0)`;
    };

    measureLoop();
    applyTransform();

    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const loop = loopWidthRef.current;

      if (loop > 1) {
        offsetRef.current += PX_PER_SEC * dt;
        if (offsetRef.current >= loop) {
          offsetRef.current -= loop;
        }
        applyTransform();
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    let resizeDebounce: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeDebounce) clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(() => {
        resizeDebounce = null;
        measureLoop();
        applyTransform();
      }, 120);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(track);
    window.addEventListener('resize', onResize);

    // Fonts / layout can settle after first paint — remeasure without resetting offset.
    const kick1 = window.setTimeout(onResize, 150);
    const kick2 = window.setTimeout(onResize, 600);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      if (resizeDebounce) clearTimeout(resizeDebounce);
      window.clearTimeout(kick1);
      window.clearTimeout(kick2);
    };
  }, [text, color, sepColor, contained]);

  return (
    <div
      className={
        contained
          ? 'tv-notice-ticker tv-notice-ticker--contained w-full min-w-0 max-w-full'
          : 'tv-notice-ticker flex-1 min-w-0 mx-4'
      }
      aria-live="polite"
    >
      <div
        ref={trackRef}
        className={`tv-notice-ticker-track${contained ? ' tv-notice-ticker-track--contained' : ''}`}
      >
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
