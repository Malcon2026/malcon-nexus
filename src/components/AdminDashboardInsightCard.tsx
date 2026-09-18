import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import geminiWordmark from '../assets/gemini-wordmark.jpg';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import {
  fetchAdminDashboardInsight,
  type AdminDashboardMetrics,
  type DashboardInsightResult,
} from '../lib/dashboardInsights';

type Props = {
  metrics: AdminDashboardMetrics;
};

export const AdminDashboardInsightCard: React.FC<Props> = ({ metrics }) => {
  const [result, setResult] = useState<DashboardInsightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setErrorHint(null);
    try {
      const next = await fetchAdminDashboardInsight(metrics, { refresh });
      setResult(next);
      if (next.notice) {
        setErrorHint(next.notice);
      } else if (next.source === 'demo') {
        setErrorHint(
          next.errorDetail
            ? `Showing on-device summary. ${next.errorDetail}`
            : 'Showing on-device summary. Add GEMINI_API_KEY in Supabase Edge Function secrets.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [metrics]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 px-2 rounded-lg border border-gray-100 bg-white flex items-center justify-center min-w-[4.5rem]">
              <img src={geminiWordmark} alt="Google Gemini" className="h-4 w-auto object-contain" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Today&apos;s summary</h3>
              <p className="text-xs text-gray-500">Powered by Gemini · live dashboard numbers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(result?.source === 'gemini' || result?.source === 'cached') && (
              <Badge className="bg-violet-50 text-violet-700 border-violet-100 text-[10px]">
                {result.source === 'cached' ? 'AI saved' : 'AI'}
              </Badge>
            )}
            <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void load(true)} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {loading && !result ? (
          <p className="text-sm text-gray-400 animate-pulse">Preparing summary…</p>
        ) : (
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{result?.summary}</div>
        )}
        {errorHint && !loading && (
          <p className="text-[11px] text-amber-700 mt-3 border-t border-gray-100 pt-3">{errorHint}</p>
        )}
      </CardBody>
    </Card>
  );
};
