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
      className="notice-board mb-5 relative overflow-hidden rounded-xl border border-amber-300/90 bg-gradient-to-br from-amber-50 via-[#fffaf0] to-orange-50/50"
      aria-label="Notice board"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
    >
      {/* Soft amber glow pulse behind the card */}
      <div className="notice-board-glow" aria-hidden />

      {/* Sliding highlight across the border */}
      <div className="notice-board-shimmer" aria-hidden />

      <div
        className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-500 via-orange-400 to-amber-600 notice-board-accent"
        aria-hidden
      />

      <div className="relative pl-4 pr-3.5 py-3 flex gap-3 items-start">
        <motion.div
          className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-800 shadow-sm"
          animate={{
            scale: [1, 1.08, 1],
            rotate: [0, -6, 6, 0],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            repeatDelay: 1.6,
            ease: 'easeInOut',
          }}
        >
          <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800/90">
              Notice Board
            </p>
            <span className="notice-board-dot" aria-hidden />
            <span className="text-[10px] font-medium text-amber-700/70">New</span>
          </div>
          <p className="text-sm text-stone-800 leading-snug whitespace-pre-wrap break-words">
            {notice}
          </p>
        </div>
      </div>
    </motion.aside>
  );
};
