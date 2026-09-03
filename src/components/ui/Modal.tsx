import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'workspace';
  footer?: React.ReactNode;
  /** Actions shown in the header row (e.g. Cancel / Save). */
  headerActions?: React.ReactNode;
  bodyClassName?: string;
  /** Fixed workspace height for wide panel layouts. */
  fixedHeight?: boolean;
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
}) => {
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

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-5xl',
    workspace: 'max-w-[min(96vw,1280px)]',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative w-full mx-2 sm:mx-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-xl shadow-black/40 border border-gray-200 flex flex-col min-w-0',
              fixedHeight ? 'h-[min(88vh,720px)] max-h-[88vh]' : 'max-h-[92vh] sm:max-h-[90vh]',
              sizeClasses[size],
            )}
          >
            {title && (
              <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-200 shrink-0 bg-gray-50/80">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
                  {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {headerActions}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            <div className={cn('flex-1 min-h-0 overflow-y-auto', bodyClassName)}>{children}</div>
            {footer && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50/80 rounded-b-2xl shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
