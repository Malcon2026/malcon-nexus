import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface PickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** `sm` for confirmations, `md` for searchable lists. */
  size?: 'sm' | 'md';
  /** Hide the close (X) button — used by confirmations that have explicit actions. */
  hideClose?: boolean;
}

/**
 * Bottom sheet on phones, centered dialog on larger screens.
 * Follows the same scrim / radius / shadow tokens as `ui/Modal`.
 */
export const PickerSheet: React.FC<PickerSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  hideClose = false,
}) => {
  // Escape closes only this sheet, not the case-entry screen underneath.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative flex w-full min-h-0 flex-col bg-white border border-[var(--color-separator)] shadow-[var(--shadow-modal)]',
              'rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)]',
              size === 'sm' ? 'sm:max-w-sm' : 'max-h-[88vh] sm:max-h-[80vh] sm:max-w-md',
            )}
          >
            <div className="sm:hidden flex justify-center pt-2" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-3 pb-3 shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                {subtitle ? <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p> : null}
              </div>
              {hideClose ? null : (
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-1 rounded-xl p-2.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
            {footer ? (
              <div className="shrink-0 border-t border-gray-100 px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            ) : (
              <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
