import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ImplantCase, Priority, WorkflowStage } from '../types';
import { formatTimeIST, formatDateIST } from '../lib/attendance';

/*
 * NOTE: this page intentionally avoids Tailwind's `white` / `gray-*` / `slate-100/200`
 * tokens. The app's global theme (src/index.css) remaps those to dark navy colors so
 * existing light-mode-styled components render dark — which means `text-white` here
 * would resolve to near-black and vanish against this page's dark background. Explicit
 * hex values below sidestep that remap entirely.
 */
const INK = '#f4f6fb';
const INK_MUTED = '#9aa5b8';
const INK_DIM = '#5b6478';

const STAGE_STYLE: Record<WorkflowStage, string> = {
  'Kit Preparation': 'bg-violet-600',
  'Delivery': 'bg-rose-600',
  'Surgery': 'bg-blue-600',
  'Pickup from Hospital': 'bg-pink-600',
  'Cleaning & Audit': 'bg-cyan-600',
  'Restock': 'bg-lime-600',
  'Billing': 'bg-emerald-600',
  'Bill Submission': 'bg-orange-600',
  'Completed': 'bg-green-600',
};

const PRIORITY_DOT: Record<Priority, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-400',
  Medium: 'bg-yellow-400',
  Low: 'bg-sky-400',
};

const GRID_COLS = 'grid-cols-[100px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_170px_120px]';

const PAGE_SIZE = 9;
const ROTATE_MS = 10000;
const REFRESH_MS = 30000;

function CaseRow({ c, zebra }: { c: ImplantCase; zebra: boolean }) {
  const stageClass = STAGE_STYLE[c.currentStage] ?? STAGE_STYLE['Kit Preparation'];
  const isOverdue = new Date(c.surgeryDate) < new Date();

  return (
    <div
      className={`grid ${GRID_COLS} items-center gap-3 px-5 py-3.5 rounded-lg`}
      style={{ background: zebra ? 'rgba(255,255,255,0.05)' : 'transparent' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_DOT[c.priority]}`} />
        <span className="text-lg font-bold truncate" style={{ color: INK }}>{c.caseNumber}</span>
      </div>
      <span className="text-lg font-semibold truncate" style={{ color: INK }}>{c.hospital.name}</span>
      <span className="text-lg truncate" style={{ color: INK_MUTED }}>Dr. {c.doctor.name}</span>
      <span className="text-base truncate" style={{ color: c.assignedEmployee ? INK_MUTED : INK_DIM }}>
        {c.assignedEmployee?.name.split(' ')[0] ?? 'Unassigned'}
      </span>
      <span className="text-sm font-semibold" style={{ color: isOverdue ? '#f87171' : INK_DIM }}>
        {formatDateIST(c.surgeryDate).replace(/^\w+,\s/, '')}
      </span>
      <span
        className={`justify-self-end px-3 py-1.5 rounded-md ${stageClass} text-xs font-bold uppercase tracking-wide text-center leading-tight`}
        style={{ color: '#ffffff' }}
      >
        {c.currentStage}
      </span>
    </div>
  );
}

export const TvBoard: React.FC = () => {
  const { cases, setActiveTab, reloadFromDatabase, viewMode, currentUser } = useStore();
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const { bootstrapSupabaseData } = await import('../lib/database/bootstrap');
        const role = viewMode === 'admin' ? 'admin' : 'employee';
        await bootstrapSupabaseData(role, role === 'employee' ? { employeeId: currentUser.id } : undefined, { force: true });
        reloadFromDatabase();
      } catch (err) {
        console.error('[TvBoard] refresh failed:', err);
      }
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [viewMode, currentUser.id, reloadFromDatabase]);

  const liveCases = useMemo(() => {
    const priorityOrder: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return cases
      .filter((c) => c.status !== 'Completed' && c.status !== 'Cancelled' && c.currentStage !== 'Completed')
      .sort((a, b) => {
        const p = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (p !== 0) return p;
        return new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime();
      });
  }, [cases]);

  const pageCount = Math.max(1, Math.ceil(liveCases.length / PAGE_SIZE));

  useEffect(() => {
    if (pageCount <= 1) { setPage(0); return; }
    const t = setInterval(() => setPage((p) => (p + 1) % pageCount), ROTATE_MS);
    return () => clearInterval(t);
  }, [pageCount]);

  useEffect(() => {
    if (page >= pageCount) setPage(0);
  }, [pageCount, page]);

  const visibleCases = liveCases.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const surgeryToday = liveCases.filter((c) => {
    const d = new Date(c.surgeryDate);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length;

  const critical = liveCases.filter((c) => c.priority === 'Critical').length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none" style={{ background: '#0a0d14', color: INK }}>
      <button
        onClick={() => setActiveTab('dashboard')}
        className="absolute top-4 right-4 z-10 p-2 rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.1)', color: INK_MUTED }}
        aria-label="Exit TV board"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8cff' }}>Malcon Nexus</p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5" style={{ color: INK }}>Live Case Board</h1>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: INK_MUTED }}>Live</p>
            <p className="text-2xl font-extrabold mt-0.5" style={{ color: INK }}>{liveCases.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: INK_MUTED }}>Today</p>
            <p className="text-2xl font-extrabold mt-0.5" style={{ color: INK }}>{surgeryToday}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#f87171' }}>Critical</p>
            <p className="text-2xl font-extrabold mt-0.5" style={{ color: '#f87171' }}>{critical}</p>
          </div>

          <div className="text-right pl-6" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-3xl font-black tabular-nums tracking-tight leading-none" style={{ color: INK }}>{formatTimeIST(now)}</p>
            <p className="text-sm font-medium mt-1" style={{ color: INK_MUTED }}>{formatDateIST(now)}</p>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className={`grid ${GRID_COLS} gap-3 px-8 mt-4 pb-2 shrink-0`}>
        {['Case', 'Hospital', 'Doctor', 'Assigned', 'Date', ''].map((h, i) => (
          <span
            key={i}
            className={`text-xs font-semibold uppercase tracking-wider ${i === 5 ? 'justify-self-end' : ''}`}
            style={{ color: INK_DIM }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Cases list */}
      <div className="flex-1 px-6 pb-4 flex flex-col overflow-hidden">
        {visibleCases.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-2xl font-semibold" style={{ color: INK_DIM }}>No live cases right now</p>
          </div>
        )}
        {visibleCases.map((c, i) => <CaseRow key={c.id} c={c} zebra={i % 2 === 1} />)}
      </div>

      {/* Pagination dots */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pb-4 shrink-0">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === page ? '1.5rem' : '0.375rem',
                background: i === page ? '#9a8cff' : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
