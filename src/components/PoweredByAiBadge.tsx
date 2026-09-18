import React from 'react';
import { cn } from '../utils/cn';
import geminiWordmark from '../assets/gemini-wordmark.jpg';

type Variant = 'pill' | 'sidebar' | 'sidebarCollapsed' | 'login';

type Props = {
  variant?: Variant;
  className?: string;
};

const GeminiWordmark: React.FC<{
  className?: string;
  iconOnly?: boolean;
}> = ({ className, iconOnly }) => {
  if (iconOnly) {
    return (
      <span
        className={cn(
          'inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white',
          className,
        )}
        title="Powered by Google Gemini"
      >
        <img
          src={geminiWordmark}
          alt="Google Gemini"
          className="h-full w-[7.5rem] max-w-none object-cover object-left"
        />
      </span>
    );
  }

  return (
    <img
      src={geminiWordmark}
      alt="Google Gemini"
      className={cn('h-6 w-auto max-w-full object-contain object-left', className)}
    />
  );
};

/** “Powered by Google Gemini” branding — login, sidebar, boot. */
export const PoweredByAiBadge: React.FC<Props> = ({ variant = 'pill', className }) => {
  if (variant === 'sidebarCollapsed') {
    return (
      <div className={cn('flex justify-center py-2', className)}>
        <GeminiWordmark iconOnly />
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={cn(
          'rounded-lg border border-gray-700/80 bg-white/95 px-2.5 py-2 shadow-sm',
          className,
        )}
      >
        <p className="text-[9px] font-medium uppercase tracking-wide text-gray-500 mb-1.5">
          Powered by
        </p>
        <GeminiWordmark className="h-5" />
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className={cn('mt-8 space-y-2', className)}>
        <div className="inline-flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-gray-500">Powered by</p>
          <GeminiWordmark className="h-7 sm:h-8" />
        </div>
        <p className="text-sm text-gray-500 max-w-sm">
          AI-assisted dashboards and daily summaries for your team.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex flex-col gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm',
        className,
      )}
    >
      <p className="text-[9px] font-medium text-gray-500 leading-none">Powered by</p>
      <GeminiWordmark className="h-4" />
    </div>
  );
};
