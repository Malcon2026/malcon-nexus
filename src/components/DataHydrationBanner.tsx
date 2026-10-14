import React from 'react';
import { Loader2 } from 'lucide-react';

export type DataHydrationPhase = 'stage1' | 'stage2';

const COPY: Record<
  DataHydrationPhase,
  { title: string; subtitle: string; barClass: string; wrapClass: string; titleClass: string; subClass: string }
> = {
  stage1: {
    title: 'Loading team & today\'s data',
    subtitle: 'Employees, today\'s cases, and attendance — please wait a moment.',
    wrapClass: 'border-blue-200/80 bg-gradient-to-r from-blue-50 via-sky-50 to-blue-50 py-3 shadow-sm',
    titleClass: 'text-sm font-semibold text-blue-950',
    subClass: 'text-xs text-blue-800/90 mt-0.5',
    barClass: 'bg-[#0071e3]',
  },
  stage2: {
    title: 'Syncing full history',
    subtitle: 'All cases and records are loading in the background. Today\'s data is already available.',
    wrapClass: 'border-amber-200/90 bg-amber-50/95 py-2.5',
    titleClass: 'text-xs font-semibold text-amber-950',
    subClass: 'text-[11px] text-amber-900/85 mt-0.5',
    barClass: 'bg-amber-600',
  },
};

function HydrationProgressBar({ barClass }: { barClass: string }) {
  return (
    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]" aria-hidden>
      <div className={`nexus-hydration-bar h-full w-[38%] rounded-full ${barClass}`} />
    </div>
  );
}

/** Sticky banner under the top bar while data loads. */
export function DataHydrationBanner({ phase }: { phase: DataHydrationPhase | null }) {
  if (!phase) return null;
  const c = COPY[phase];
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`shrink-0 z-30 border-b px-4 ${c.wrapClass}`}>
      <div className="flex items-start gap-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#0071e3] mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className={c.titleClass}>{c.title}</p>
          <p className={c.subClass}>{c.subtitle}</p>
          <HydrationProgressBar barClass={c.barClass} />
        </div>
      </div>
    </div>
  );
}

/** Covers main content on first load so an empty dashboard is not mistaken for a broken app. */
export function DataHydrationMainOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  const c = COPY.stage1;
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--color-bg)]/92 backdrop-blur-[3px] px-6 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-10 w-10 animate-spin text-[#0071e3] mb-4" aria-hidden />
      <p className="text-base font-semibold text-gray-900">{c.title}</p>
      <p className="text-sm text-gray-600 mt-1 max-w-sm">{c.subtitle}</p>
      <div className="mt-6 w-full max-w-xs">
        <HydrationProgressBar barClass="bg-[#0071e3]" />
      </div>
    </div>
  );
}
