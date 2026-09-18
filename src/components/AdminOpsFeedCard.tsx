import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { GeminiIcon } from './PoweredByAiBadge';
import {
  ADMIN_DASHBOARD_AI_ENABLED,
  buildHumanAdminBrief,
  fetchAdminDashboardInsight,
  normalizeAdminSummaryTwoLines,
  type AdminDashboardMetrics,
  type DashboardInsightResult,
} from '../lib/dashboardInsights';
import { cn } from '../utils/cn';

type Props = {
  metrics: AdminDashboardMetrics;
  className?: string;
};

function parseBriefFromSummary(summary: string): { en: string; te: string } {
  const lines = normalizeAdminSummaryTwoLines(summary)
    .split('\n')
    .map((line) => line.replace(/^•\s*/, '').trim())
    .filter(Boolean);
  return {
    en: lines[0] ?? '',
    te: lines[1] ?? lines[0] ?? '',
  };
}

const ChatBubble: React.FC<{
  text: string;
  variant: 'en' | 'te';
  showAvatar?: boolean;
}> = ({ text, variant, showAvatar = true }) => (
  <div className="flex gap-2 items-end max-w-full">
    {showAvatar ? (
      <div className="h-8 w-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 mb-0.5">
        <GeminiIcon className="h-5 w-5" />
      </div>
    ) : (
      <div className="w-8 shrink-0" aria-hidden />
    )}
    <div
      className={cn(
        'min-w-0 max-w-[calc(100%-2.5rem)] rounded-2xl px-3.5 py-2.5 ops-feed-font shadow-sm border',
        variant === 'en'
          ? 'rounded-bl-md bg-gray-100/90 border-gray-200/80 text-gray-900'
          : 'rounded-bl-md bg-indigo-500/10 border-indigo-500/15 text-gray-800',
      )}
    >
      <p className="text-[11px] font-medium text-gray-500 mb-1">
        {variant === 'en' ? 'Nexus' : 'Nexus · Telugu'}
      </p>
      <p className="text-[14px] leading-[1.5] tracking-[-0.01em]">{text}</p>
    </div>
  </div>
);

export const AdminOpsFeedCard: React.FC<Props> = ({ metrics, className }) => {
  const [result, setResult] = useState<DashboardInsightResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadLocal = useCallback(() => {
    const { en, te } = buildHumanAdminBrief(metrics, 'all');
    setResult({
      summary: `• ${en}\n• ${te}`,
      source: 'demo',
      generatedAt: new Date().toISOString(),
    });
  }, [metrics]);

  const load = useCallback(
    async (refresh = false) => {
      if (!ADMIN_DASHBOARD_AI_ENABLED) {
        loadLocal();
        return;
      }
      setLoading(true);
      try {
        const next = await fetchAdminDashboardInsight(metrics, { refresh });
        setResult({
          ...next,
          summary: normalizeAdminSummaryTwoLines(next.summary),
        });
      } finally {
        setLoading(false);
      }
    },
    [metrics, loadLocal],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const brief = useMemo(() => {
    if (result?.summary && result.source !== 'demo') {
      return parseBriefFromSummary(result.summary);
    }
    return buildHumanAdminBrief(metrics, 'all');
  }, [result?.summary, result?.source, metrics]);

  const timeLabel = new Date().toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-gray-200 bg-gray-50/40 shadow-sm overflow-hidden flex flex-col min-h-0',
        className,
      )}
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 shrink-0 border-b border-gray-100/80">
        <div className="min-w-0 ops-feed-font">
          <h3 className="text-sm font-semibold text-gray-900">Today&apos;s brief</h3>
          <p className="text-[11px] text-gray-500">{timeLabel} · live from your cases</p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="h-9 w-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50"
          aria-label="Refresh brief"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-end min-h-0 p-4 gap-3 overflow-y-auto">
        {loading && !result ? (
          <div className="space-y-3" aria-hidden>
            <div className="flex gap-2 items-end">
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
              <div className="h-16 flex-1 max-w-[85%] rounded-2xl rounded-bl-md bg-gray-200/80 animate-pulse" />
            </div>
            <div className="flex gap-2 items-end">
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse shrink-0" />
              <div className="h-14 flex-1 max-w-[78%] rounded-2xl rounded-bl-md bg-gray-200/60 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            <ChatBubble text={brief.en} variant="en" />
            <ChatBubble text={brief.te} variant="te" showAvatar={false} />
          </>
        )}
      </div>
    </motion.article>
  );
};
