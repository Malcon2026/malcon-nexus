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
      className="notice-board mb-5 relative overflow-hidden rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-[#fffaf0] to-stone-50"
      aria-label="Notice board"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* Animated border ring */}
      <div className="notice-board-ring" aria-hidden />

      <div className="relative px-3.5 py-3 flex gap-3 items-start">
        <motion.div
          className="mt-0.5 shrink-0 h-9 w-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800"
          animate={{ y: [0, -2, 0] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Megaphone className="h-4 w-4" strokeWidth={2.25} />
        </motion.div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800/85">
              Notice Board
            </p>
            <span className="notice-board-dot" aria-hidden />
          </div>
          <p className="text-sm text-stone-800 leading-snug whitespace-pre-wrap break-words">
            {notice}
          </p>
        </div>
      </div>
    </motion.aside>
  );
};
