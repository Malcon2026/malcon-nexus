import React from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-[var(--color-accent)] text-white shadow-[var(--shadow-popover)] hover:brightness-105 focus-visible:ring-[var(--color-accent)]',
  secondary:
    'bg-white text-gray-900 border border-[var(--color-separator)] shadow-[var(--shadow-card)] hover:bg-gray-50 focus-visible:ring-gray-400',
};

export const FloatingCornerButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: Variant;
  className?: string;
  /** Stack above another FAB (e.g. Edit above Add case). */
  stack?: 'base' | 'above';
}> = ({ label, icon, onClick, variant = 'primary', className, stack = 'base' }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'fixed z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'right-4 sm:right-6',
      stack === 'base' ? 'bottom-4 sm:bottom-6' : 'bottom-[4.75rem] sm:bottom-[5.5rem]',
      variantClass[variant],
      className,
    )}
  >
    <span className="shrink-0" aria-hidden>
      {icon}
    </span>
    <span>{label}</span>
  </button>
);
