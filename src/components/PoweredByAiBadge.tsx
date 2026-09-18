import React from 'react';
import { cn } from '../utils/cn';
import geminiLogo from '../assets/gemini-logo.svg';
import geminiIcon from '../assets/gemini-icon.svg';

type Variant = 'pill' | 'sidebar' | 'sidebarCollapsed' | 'login';

type Props = {
  variant?: Variant;
  className?: string;
};

/** White surface so Gemini mark stays readable on the dark sidebar. */
const whiteBadgeSurface =
  'rounded-xl border border-gray-200 bg-white shadow-sm [background-color:#ffffff]';

const GeminiFullLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src={geminiLogo}
    alt="Google Gemini"
    className={cn('h-6 w-auto max-w-[9.5rem] object-contain object-left', className)}
  />
);

const GeminiIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src={geminiIcon}
    alt=""
    aria-hidden
    className={cn('h-7 w-7 object-contain shrink-0', className)}
  />
);

const GeminiWordmarkRow: React.FC<{ logoClassName?: string; textClassName?: string }> = ({
  logoClassName,
  textClassName,
}) => (
  <div className="flex items-center gap-2 min-w-0">
    <GeminiIcon className={cn('h-5 w-5', logoClassName)} />
    <span className={cn('text-[15px] font-semibold text-gray-900 tracking-tight', textClassName)}>
      Gemini
    </span>
  </div>
);

/** Official-style Gemini branding — login, sidebar, boot. */
export const PoweredByAiBadge: React.FC<Props> = ({ variant = 'pill', className }) => {
  if (variant === 'sidebarCollapsed') {
    return (
      <div className={cn('flex justify-center py-2', className)} title="Powered by Google Gemini">
        <div className={cn(whiteBadgeSurface, 'p-2')}>
          <GeminiIcon className="h-6 w-6" />
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={cn(whiteBadgeSurface, 'px-3 py-2.5', className)}>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          Powered by
        </p>
        <GeminiWordmarkRow />
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className={cn('mt-8 space-y-2.5', className)}>
        <div className={cn(whiteBadgeSurface, 'inline-flex flex-col gap-2 px-5 py-3.5')}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
    <div className={cn(whiteBadgeSurface, 'inline-flex flex-col gap-1 px-3 py-2', className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 leading-none">
        Powered by
      </p>
      <GeminiWordmarkRow textClassName="text-sm" />
    </div>
  );
};

export { GeminiFullLogo, GeminiIcon };
