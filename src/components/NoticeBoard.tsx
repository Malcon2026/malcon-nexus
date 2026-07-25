import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone } from 'lucide-react';
import { useStore } from '../store/useStore';

/**
 * Compact notice strip for the employee dashboard.
 * Hidden when admin has not posted a notice.
 */
export const NoticeBoard: React.FC = () => {
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const notice = useStore((s) => s.getEmployeeNotice());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadAppSettings();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAppSettings]);

  if (!ready || !notice) return null;

  return (
    <motion.aside
      className="notice-board mb-5 relative rounded-xl"
      aria-label="Notice board"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Rotating dashed border (SVG so dash pattern stays crisp) */}
      <svg
        className="notice-board-dashes"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <rect
          x="1.5"
          y="1.5"
          width="97"
          height="97"
          rx="10"
          ry="10"
          pathLength="100"
        />
      </svg>

      <div className="notice-board-inner relative m-[3px] rounded-[10px] border border-amber-100 bg-gradient-to-br from-amber-50 via-[#fffaf0] to-stone-50 px-3.5 py-3 flex gap-3 items-start">
        <div className="mt-0.5 shrink-0 h-9 w-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800">
          <Megaphone className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800/85 mb-1">
            Notice Board
          </p>
          <p className="text-sm text-stone-800 leading-snug whitespace-pre-wrap break-words">
            {notice}
          </p>
        </div>
      </div>
    </motion.aside>
  );
};
