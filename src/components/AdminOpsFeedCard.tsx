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
  type AdminDashboardMetrics,
  type DashboardInsightResult,
} from '../lib/dashboardInsights';
import { cn } from '../utils/cn';

type Props = {
  metrics: AdminDashboardMetrics;
};

type FocusChip = 'all' | 'approvals' | 'surgery' | 'cleaning' | 'restock' | 'pool';

const CHIPS: { id: FocusChip; label: string; count: (m: AdminDashboardMetrics) => number }[] = [
  { id: 'all', label: 'Overview', count: (m) => m.activeCases },
  { id: 'approvals', label: 'Approvals', count: (m) => m.pendingApprovals },
  { id: 'surgery', label: 'Surgery', count: (m) => m.inSurgery },
  { id: 'cleaning', label: 'Cleaning', count: (m) => m.cleaningAudit },
  { id: 'restock', label: 'Restock', count: (m) => m.restockPending },
  { id: 'pool', label: 'FCFS pool', count: (m) => m.fcfsPool },
];

function filterSummaryByFocus(full: string, focus: FocusChip): string {
  if (focus === 'all') return full;
  const lines = full.split('\n').filter(Boolean);
  const matchers: Record<Exclude<FocusChip, 'all'>, RegExp> = {
    approvals: /approval|waiting/i,
    surgery: /surgery/i,
    cleaning: /cleaning|audit/i,
    restock: /restock/i,
    pool: /fcfs|pool/i,
  };
  const re = matchers[focus];
  const picked = lines.filter((line) => re.test(line));
  if (picked.length === 0) {
    return lines.slice(0, 2).join('\n');
  }
  return picked.join('\n');
}

export const AdminOpsFeedCard: React.FC<Props> = ({ metrics }) => {
  const [result, setResult] = useState<DashboardInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<FocusChip>('all');
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const loadLocal = useCallback(() => {
    const summary = formatDemoAdminSummary(metrics);
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
        setResult(next);
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

  const displayText = useMemo(() => {
    const raw = result?.summary ?? formatDemoAdminSummary(metrics);
    return filterSummaryByFocus(raw, focus);
  }, [result?.summary, metrics, focus]);

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
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <div className="h-11 w-11 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
            <GeminiIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0 ops-feed-font">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[15px] text-gray-900 leading-tight">Malcon Ops</span>
              {!ADMIN_DASHBOARD_AI_ENABLED ? (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">AI paused</Badge>
              ) : result?.source === 'gemini' || result?.source === 'cached' ? (
                <Badge className="bg-sky-50 text-sky-800 border-sky-100 text-[10px]">AI</Badge>
              ) : null}
            </div>
            <p className="text-[13px] text-gray-500 leading-snug">
              <span className="text-gray-800">@nexus</span>
              <span className="mx-1">·</span>
              {metrics.dateLabel}
              <span className="mx-1">·</span>
              {timeLabel}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />}
          onClick={() => void load(true)}
          disabled={loading}
        >
          {ADMIN_DASHBOARD_AI_ENABLED ? 'Refresh' : 'Update'}
        </Button>
      </div>

      <div className="px-4 sm:px-5 py-3 ops-feed-font">
        <div className="flex flex-wrap gap-2 mb-3">
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
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all',
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
            key={`${focus}-${displayText.slice(0, 24)}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-[15px] leading-[1.45] text-gray-900 whitespace-pre-line tracking-[-0.01em]"
          >
            {loading && !result ? (
              <div className="space-y-2.5 py-1" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-3.5 rounded-full bg-gray-100 animate-pulse"
                    style={{ width: `${88 - i * 14}%` }}
                  />
                ))}
              </div>
            ) : (
              displayText
            )}
          </motion.div>
        </AnimatePresence>

        {errorHint && !loading && (
          <p className="text-[13px] text-gray-500 mt-3 flex items-start gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
            {errorHint}
          </p>
        )}
      </div>

      <div className="px-4 sm:px-5 py-2.5 border-t border-gray-100 flex items-center justify-between text-[13px] text-gray-500 ops-feed-font">
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Tap a pill to focus the brief
        </span>
        <span className="tabular-nums">{metrics.activeCases} active cases</span>
      </div>
    </motion.article>
  );
};
