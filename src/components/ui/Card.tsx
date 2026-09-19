import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick, hover = false }) => {
  return (
    <div
      className={cn(
        'bg-white rounded-[var(--radius-lg)] border border-[var(--color-separator)] shadow-[var(--shadow-card)]',
        hover && 'cursor-pointer transition-all duration-150 hover:shadow-[var(--shadow-popover)] hover:border-[var(--color-separator-opaque)]',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('px-4 sm:px-6 py-4 border-b border-[var(--color-separator)]', className)}>{children}</div>
);

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('px-4 sm:px-6 py-4 min-w-0', className)}>{children}</div>;

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('px-4 sm:px-6 py-3 border-t border-[var(--color-separator)] bg-[var(--color-bg)]/50 rounded-b-[var(--radius-lg)]', className)}>
    {children}
  </div>
);
