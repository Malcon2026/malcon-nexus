import React, { useEffect, useState } from 'react';
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
    <aside
      className="mb-5 relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-[#fffaf0] to-orange-50/40 shadow-[0_1px_2px_rgba(120,80,20,0.06)]"
      aria-label="Notice board"
    >
      <div
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-orange-400"
        aria-hidden
      />
      <div className="pl-4 pr-3.5 py-3 flex gap-3 items-start">
        <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-amber-100/90 border border-amber-200/70 flex items-center justify-center text-amber-800">
          <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800/80">
              Notice Board
            </p>
          </div>
          <p className="text-sm text-stone-800 leading-snug whitespace-pre-wrap break-words">
            {notice}
          </p>
        </div>
      </div>
    </aside>
  );
};
