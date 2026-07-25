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
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="notice-board-dashes" aria-hidden />

      <div className="relative flex gap-3 items-start px-3.5 py-3">
        <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-800">
          <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500 mb-1">
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
