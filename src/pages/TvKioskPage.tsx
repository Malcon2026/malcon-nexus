import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { TvBoard } from './TvBoard';
import { fetchTvBoardFeed } from '../lib/tvBoardFeed';
import { useStore } from '../store/useStore';

const INK = '#f4f6fb';
const INK_MUTED = '#9aa5b8';

export function TvKioskPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const kiosk = searchParams.get('kiosk') !== '0';

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Add ?token=YOUR_SECRET to the URL (same token as TV_BOARD_TOKEN in Supabase).');
      setReady(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchTvBoardFeed(token);
        if (cancelled) return;
        useStore.setState((s) => ({
          cases: data.cases,
          employees: data.employees,
          appSettings: { ...s.appSettings, tv_notice: data.tvNotice },
        }));
        setError(null);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load TV board');
        setReady(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token || error) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: '#0a0d14', color: INK }}
      >
        <p className="text-lg font-semibold">Malcon Nexus — TV Board</p>
        <p className="text-sm max-w-md" style={{ color: INK_MUTED }}>
          {error ?? 'Missing access token.'}
        </p>
        <p className="text-xs max-w-lg" style={{ color: INK_MUTED }}>
          Example:{' '}
          <code className="text-violet-300/90">/tv?token=YOUR_SECRET&amp;kiosk=1</code>
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-3"
        style={{ background: '#0a0d14', color: INK_MUTED }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#9a8cff' }} />
        <p className="text-sm">Loading TV board…</p>
      </div>
    );
  }

  return <TvBoard kioskMode={kiosk} kioskToken={token} />;
}
