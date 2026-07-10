import React from 'react';
import { cn } from '../../utils/cn';
import { getAvatarColor } from '../../utils/helpers';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 'md', className }) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-7 w-7 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-sm',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold shrink-0',
        sizes[size],
        getAvatarColor(name),
        className
      )}
    >
      {initials}
    </div>
  );
};
