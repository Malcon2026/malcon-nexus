import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, BarChart3, Sparkles } from 'lucide-react';
import { GeminiIcon } from './PoweredByAiBadge';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  ADMIN_DASHBOARD_AI_ENABLED,
  fetchAdminDashboardInsight,
  formatDemoAdminSummary,
  normalizeAdminSummaryTwoLines,
  type AdminBriefFocus,
  type AdminDashboardMetrics,
  type DashboardInsightResult,
} from '../lib/dashboardInsights';
import { cn } from '../utils/cn';

type Props = {
  metrics: AdminDashboardMetrics;
  className?: string;
};

type FocusChip = AdminBriefFocus;

const CHIPS: { id: FocusChip; label: string; count: (m: AdminDashboardMetrics) => number }[] = [
  { id: 'all', label: 'Overview', count: (m) => m.activeCases },
  { id: 'approvals', label: 'Approvals', count: (m) => m.pendingApprovals },
  { id: 'surgery', label: 'Surgery', count: (m) => m.inSurgery },
  { id: 'cleaning', label: 'Cleaning', count: (m) => m.cleaningAudit },
  { id: 'restock', label: 'Restock', count: (m) => m.restockPending },
  { id: 'pool', label: 'FCFS pool', count: (m) => m.fcfsPool },
];

export const AdminOpsFeedCard: React.FC<Props> = ({ metrics, className }) => {
  const [result, setResult] = useState<DashboardInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<FocusChip>('all');
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const loadLocal = useCallback(() => {
    const summary = formatDemoAdminSummary(metrics, 'all');
    setResult({
      summary,
      source: 'demo',
      generatedAt: new Date().toISOString(),
    });
    setErrorHint(
      ADMIN_DASHBOARD_AI_ENABLED
        ? null
        : 'AI summaries are paused — showing live numbers from your dashboard.',
    );
  }, [metrics]);

  const load = useCallback(
    async (refresh = false) => {
      if (!ADMIN_DASHBOARD_AI_ENABLED) {
        loadLocal();
        return;
      }
      setLoading(true);
      setErrorHint(null);
      try {
        const next = await fetchAdminDashboardInsight(metrics, { refresh });
        setResult({
          ...next,
          summary: normalizeAdminSummaryTwoLines(next.summary),
        });
        if (next.notice) {
          setErrorHint(next.notice);
        } else if (next.source === 'demo' && next.errorDetail) {
          setErrorHint(`On-device preview. ${next.errorDetail}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [metrics, loadLocal],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const briefLines = useMemo(() => {
    if (focus !== 'all' || !result?.summary || result.source === 'demo') {
      return formatDemoAdminSummary(metrics, focus)
        .split('\n')
        .filter((line) => line.trim());
    }
    return normalizeAdminSummaryTwoLines(result.summary)
      .split('\n')
      .filter((line) => line.trim());
  }, [result?.summary, result?.source, metrics, focus]);

  const timeLabel = useMemo(
    () =>
      new Date().toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }),
    [result?.generatedAt],
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-0',
        className,
      )}
    >
      <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-gray-100 flex items-start justify-between gap-2 shrink-0">
        <div className="flex gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
            <GeminiIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 ops-feed-font">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[14px] text-gray-900 leading-tight">Malcon Ops</span>
              {!ADMIN_DASHBOARD_AI_ENABLED ? (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[9px] px-1.5">AI paused</Badge>
              ) : result?.source === 'gemini' || result?.source === 'cached' ? (
                <Badge className="bg-sky-50 text-sky-800 border-sky-100 text-[9px] px-1.5">AI</Badge>
              ) : null}
            </div>
            <p className="text-[12px] text-gray-500 leading-snug truncate">
              <span className="text-gray-800">@nexus</span>
              <span className="mx-1">·</span>
              {timeLabel}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 px-2"
          icon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />}
          onClick={() => void load(true)}
          disabled={loading}
          aria-label={ADMIN_DASHBOARD_AI_ENABLED ? 'Refresh summary' : 'Update summary'}
        >
          <span className="sr-only">{ADMIN_DASHBOARD_AI_ENABLED ? 'Refresh' : 'Update'}</span>
        </Button>
      </div>

      <div className="px-3 sm:px-4 py-2.5 ops-feed-font flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-wrap gap-1.5 mb-2 shrink-0">
          {CHIPS.map(({ id, label, count }) => {
            const n = count(metrics);
            const active = focus === id;
            const muted = id !== 'all' && n === 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFocus(id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-all',
                  active
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : muted
                      ? 'bg-gray-50 text-gray-400 border-gray-100'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                {label}
                {id !== 'all' && (
                  <span
                    className={cn(
                      'tabular-nums text-[11px] font-bold rounded-full min-w-[1.25rem] px-1',
                      active ? 'bg-white/20' : 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${focus}-${briefLines.join('|').slice(0, 40)}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto min-h-0 pr-0.5 space-y-3"
          >
            {loading && !result ? (
              <div className="space-y-2.5 py-1" aria-hidden>
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-4 rounded-full bg-gray-100 animate-pulse"
                    style={{ width: `${92 - i * 10}%` }}
                  />
                ))}
              </div>
            ) : (
              briefLines.map((line, index) => {
                const text = line.replace(/^•\s*/, '');
                const isTelugu = index === 1;
                return (
                  <p
                    key={`${index}-${text.slice(0, 12)}`}
                    className={cn(
                      'text-[14px] leading-[1.45] tracking-[-0.01em]',
                      isTelugu ? 'text-gray-500' : 'text-gray-900 font-medium',
                    )}
                  >
                    <span className="text-gray-400 mr-1.5" aria-hidden>
                      •
                    </span>
                    {text}
                  </p>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>

        {errorHint && !loading && (
          <p className="text-[11px] text-gray-500 mt-2 flex items-start gap-1.5 shrink-0 line-clamp-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-gray-400 mt-0.5" />
            {errorHint}
          </p>
        )}
      </div>

      <div className="px-3 sm:px-4 py-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 ops-feed-font shrink-0">
        <span className="inline-flex items-center gap-1 truncate">
          <BarChart3 className="h-3.5 w-3.5 shrink-0" />
          Tap pills to focus
        </span>
        <span className="tabular-nums shrink-0 ml-2">{metrics.activeCases} active</span>
      </div>
    </motion.article>
  );
};
