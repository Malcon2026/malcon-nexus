import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';

type Variant = 'pill' | 'sidebar' | 'sidebarCollapsed' | 'login';

type Props = {
  variant?: Variant;
  className?: string;
};

/** Lightweight “Powered by AI” branding — reuse across login, sidebar, boot. */
export const PoweredByAiBadge: React.FC<Props> = ({ variant = 'pill', className }) => {
  if (variant === 'sidebarCollapsed') {
    return (
      <div
        className={cn('flex justify-center py-2', className)}
        title="Malcon Nexus — powered by AI"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-400/25">
          <Sparkles className="h-4 w-4 text-violet-300" aria-hidden />
        </span>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-2.5 py-2',
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden />
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200">
            Powered by AI
          </p>
          <p className="text-[10px] text-gray-500 truncate">Insights &amp; smart ops</p>
        </div>
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className={cn('mt-8 space-y-2', className)}>
        <p className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1.5 text-xs font-semibold text-violet-800">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Powered by AI
        </p>
        <p className="text-sm text-gray-500 max-w-sm">
          AI-assisted dashboards and daily summaries for your team.
        </p>
      </div>
    );
  }

  return (
    <p
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700',
        className,
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      Powered by AI
    </p>
  );
};
