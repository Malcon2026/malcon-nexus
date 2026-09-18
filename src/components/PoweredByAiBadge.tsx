import React from 'react';
import { cn } from '../utils/cn';
import geminiLogo from '../assets/gemini-logo.svg';
import geminiIcon from '../assets/gemini-icon.svg';

type Variant = 'pill' | 'sidebar' | 'sidebarCollapsed' | 'login';

type Props = {
  variant?: Variant;
  className?: string;
};

const GeminiFullLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src={geminiLogo}
    alt="Google Gemini"
    className={cn('h-6 w-auto max-w-[9.5rem] object-contain object-left text-gray-900', className)}
  />
);

const GeminiIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src={geminiIcon}
    alt="Google Gemini"
    className={cn('h-7 w-7 object-contain', className)}
  />
);

/** Official-style Gemini wordmark (2025 SVG) — login, sidebar, boot. */
export const PoweredByAiBadge: React.FC<Props> = ({ variant = 'pill', className }) => {
  if (variant === 'sidebarCollapsed') {
    return (
      <div className={cn('flex justify-center py-2', className)} title="Powered by Google Gemini">
        <GeminiIcon />
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={cn(
          'rounded-xl border border-gray-700/60 bg-white px-2.5 py-2.5 shadow-sm text-gray-900',
          className,
        )}
      >
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
          Powered by
        </p>
        <GeminiFullLogo className="h-[18px] max-w-[7.5rem]" />
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className={cn('mt-8 space-y-2.5', className)}>
        <div className="inline-flex flex-col gap-2 rounded-2xl border border-gray-200/90 bg-white px-5 py-3.5 shadow-sm text-gray-900">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Powered by
          </p>
          <GeminiFullLogo className="h-8 sm:h-9 max-w-[11rem]" />
        </div>
        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
          AI-assisted dashboards and daily summaries for your team.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex flex-col gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm text-gray-900',
        className,
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 leading-none">
        Powered by
      </p>
      <GeminiFullLogo className="h-4 max-w-[6.5rem]" />
    </div>
  );
};

export { GeminiFullLogo, GeminiIcon };
