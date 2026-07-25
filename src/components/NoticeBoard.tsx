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
      className="notice-board mb-5"
      aria-label="Notice board"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Rotating - - - - ring (conic dashes — reliable on all sizes) */}
      <div className="notice-board-spin" aria-hidden />

      <div className="notice-board-inner">
        <div className="shrink-0 h-9 w-9 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm">
          <Megaphone className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 mb-1">
            Notice Board
          </p>
          <p className="text-sm text-stone-800 leading-snug whitespace-pre-wrap break-words font-medium">
            {notice}
          </p>
        </div>
      </div>
    </motion.aside>
  );
};
