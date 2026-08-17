import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ImplantCase, Priority, WorkflowStage } from '../types';
import { formatTimeIST, formatDateIST } from '../lib/attendance';

const STAGE_STYLE: Record<WorkflowStage, { bg: string; text: string }> = {
  'Kit Preparation': { bg: 'bg-violet-600', text: 'text-white' },
  'Delivery': { bg: 'bg-rose-600', text: 'text-white' },
  'Surgery': { bg: 'bg-blue-600', text: 'text-white' },
  'Pickup from Hospital': { bg: 'bg-pink-600', text: 'text-white' },
  'Cleaning & Audit': { bg: 'bg-cyan-600', text: 'text-white' },
  'Restock': { bg: 'bg-lime-600', text: 'text-white' },
  'Billing': { bg: 'bg-emerald-600', text: 'text-white' },
  'Bill Submission': { bg: 'bg-orange-600', text: 'text-white' },
  'Completed': { bg: 'bg-green-600', text: 'text-white' },
};

const PRIORITY_STYLE: Record<Priority, { dot: string; label: string }> = {
  Critical: { dot: 'bg-red-500', label: 'text-red-400' },
  High: { dot: 'bg-orange-400', label: 'text-orange-300' },
  Medium: { dot: 'bg-yellow-400', label: 'text-yellow-300' },
  Low: { dot: 'bg-sky-400', label: 'text-sky-300' },
};

const GRID_COLS = 'grid-cols-[100px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_170px_120px]';

const PAGE_SIZE = 9;
const ROTATE_MS = 10000;
const REFRESH_MS = 30000;

function CaseRow({ c, zebra }: { c: ImplantCase; zebra: boolean }) {
  const stage = STAGE_STYLE[c.currentStage] ?? STAGE_STYLE['Kit Preparation'];
  const priority = PRIORITY_STYLE[c.priority];
  const isOverdue = new Date(c.surgeryDate) < new Date();

  return (
    <div
      className={`grid ${GRID_COLS} items-center gap-3 px-5 py-3.5 rounded-lg ${zebra ? 'bg-white/[0.04]' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${priority.dot}`} />
        <span className="text-lg font-bold text-white truncate">{c.caseNumber}</span>
      </div>
      <span className="text-lg font-semibold text-slate-100 truncate">{c.hospital.name}</span>
      <span className="text-lg text-slate-300 truncate">Dr. {c.doctor.name}</span>
      <span className="text-base text-slate-300 truncate">
        {c.assignedEmployee?.name.split(' ')[0] ?? <span className="text-slate-500">Unassigned</span>}
      </span>
      <span className={`text-sm font-semibold ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
        {formatDateIST(c.surgeryDate).replace(/^\w+,\s/, '')}
      </span>
      <span
        className={`justify-self-end px-3 py-1.5 rounded-md ${stage.bg} ${stage.text} text-xs font-bold uppercase tracking-wide text-center leading-tight`}
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
    <div className="fixed inset-0 z-50 bg-[#0a0d14] text-white flex flex-col overflow-hidden select-none">
      <button
        onClick={() => setActiveTab('dashboard')}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
        aria-label="Exit TV board"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0 border-b border-white/10">
        <div>
          <p className="text-xs font-semibold text-indigo-400 tracking-widest uppercase">Malcon Nexus</p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Live Case Board</h1>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Live</p>
            <p className="text-2xl font-extrabold mt-0.5">{liveCases.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Today</p>
            <p className="text-2xl font-extrabold mt-0.5">{surgeryToday}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wide">Critical</p>
            <p className="text-2xl font-extrabold mt-0.5 text-red-400">{critical}</p>
          </div>

          <div className="text-right pl-6 border-l border-white/10">
            <p className="text-3xl font-black tabular-nums tracking-tight leading-none">{formatTimeIST(now)}</p>
            <p className="text-sm font-medium text-slate-400 mt-1">{formatDateIST(now)}</p>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className={`grid ${GRID_COLS} gap-3 px-8 mt-4 pb-2 shrink-0`}>
        {['Case', 'Hospital', 'Doctor', 'Assigned', 'Date', ''].map((h, i) => (
          <span key={i} className={`text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 5 ? 'justify-self-end' : ''}`}>
            {h}
          </span>
        ))}
      </div>

      {/* Cases list */}
      <div className="flex-1 px-6 pb-4 flex flex-col overflow-hidden">
        {visibleCases.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-2xl font-semibold text-slate-500">No live cases right now</p>
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
              className={`h-1.5 rounded-full transition-all ${i === page ? 'w-6 bg-indigo-400' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
