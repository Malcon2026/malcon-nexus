import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'workspace' | 'screen';
  footer?: React.ReactNode;
  /** Actions shown in the header row (e.g. Cancel / Save). */
  headerActions?: React.ReactNode;
  bodyClassName?: string;
  /** Fixed workspace height for wide panel layouts. */
  fixedHeight?: boolean;
  /** When false, clicking the backdrop does not close (use for full-screen forms). */
  dismissOnBackdrop?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  footer,
  headerActions,
  bodyClassName,
  fixedHeight = false,
  dismissOnBackdrop = true,
}) => {
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement;
    previousFocusRef.current =
      previouslyFocused instanceof HTMLElement ? previouslyFocused : null;

    const focusDialog = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (titleRef.current) {
        titleRef.current.focus({ preventScroll: true });
        return;
      }
      const focusables = getFocusableElements(dialog);
      focusables[0]?.focus({ preventScroll: true });
    };

    const raf = requestAnimationFrame(focusDialog);

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = getFocusableElements(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTabTrap, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleTabTrap, true);
      const prev = previousFocusRef.current;
      if (prev && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-5xl',
    workspace: 'max-w-[min(96vw,1280px)]',
    screen: 'max-w-none h-full max-h-none rounded-none border-0 shadow-none mx-0',
  };

  const isScreen = size === 'screen';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex p-0',
            isScreen ? 'items-stretch justify-stretch' : 'items-end sm:items-center justify-center sm:p-4',
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute inset-0 bg-[var(--overlay-scrim)]',
              isScreen ? '' : 'backdrop-blur-sm',
            )}
            onClick={dismissOnBackdrop ? onClose : undefined}
            aria-hidden
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={subtitle ? subtitleId : undefined}
            initial={{ opacity: 0, y: isScreen ? 12 : 8, scale: isScreen ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isScreen ? 12 : 8, scale: isScreen ? 1 : 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative w-full bg-white flex flex-col min-w-0 min-h-0',
              isScreen
                ? 'h-full'
                : cn(
                    'mx-2 sm:mx-auto rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-[var(--shadow-modal)] border border-[var(--color-separator)]',
                    fixedHeight ? 'h-[min(88vh,720px)] max-h-[88vh]' : 'max-h-[92vh] sm:max-h-[90vh]',
                    sizeClasses[size],
                  ),
            )}
          >
            {title && (
              <div
                className={cn(
                  'flex items-center justify-between gap-3 shrink-0 border-b border-gray-200 bg-white',
                  isScreen ? 'px-4 sm:px-6 py-4 safe-area-top' : 'px-4 sm:px-5 py-3.5 bg-gray-50/80',
                )}
              >
                <div className="min-w-0 flex-1">
                  <h2
                    id={titleId}
                    ref={titleRef}
                    tabIndex={-1}
                    className={cn(
                      'font-semibold text-gray-900 truncate focus:outline-none',
                      isScreen ? 'text-lg' : 'text-base',
                    )}
                  >
                    {title}
                  </h2>
                  {subtitle && (
                    <p
                      id={subtitleId}
                      className={cn('text-gray-500 mt-0.5', isScreen ? 'text-sm' : 'text-xs sm:text-sm')}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {headerActions}
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      'rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
                      isScreen ? 'p-2.5 -mr-1' : 'p-1.5',
                    )}
                    aria-label="Close"
                  >
                    <X className={isScreen ? 'h-6 w-6' : 'h-4 w-4'} />
                  </button>
                </div>
              </div>
            )}
            <div className={cn('flex-1 min-h-0 overflow-y-auto', bodyClassName)}>{children}</div>
            {footer && (
              <div
                className={cn(
                  'px-4 sm:px-6 py-4 border-t border-gray-200 bg-white shrink-0 safe-area-bottom',
                  !isScreen && 'bg-gray-50/80 rounded-b-2xl py-3',
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
