import React, { useEffect, useMemo, useState } from 'react';
import { Building2, User2, Stethoscope, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { ImplantCase, Priority, WorkflowStage } from '../types';
import { formatTimeIST, formatDateIST } from '../lib/attendance';

const STAGE_STYLE: Record<WorkflowStage, { bg: string; text: string; ring: string }> = {
  'Kit Preparation': { bg: 'bg-violet-500/15', text: 'text-violet-300', ring: 'ring-violet-400/40' },
  'Delivery': { bg: 'bg-rose-500/15', text: 'text-rose-300', ring: 'ring-rose-400/40' },
  'Surgery': { bg: 'bg-blue-500/15', text: 'text-blue-300', ring: 'ring-blue-400/40' },
  'Pickup from Hospital': { bg: 'bg-pink-500/15', text: 'text-pink-300', ring: 'ring-pink-400/40' },
  'Cleaning & Audit': { bg: 'bg-cyan-500/15', text: 'text-cyan-300', ring: 'ring-cyan-400/40' },
  'Restock': { bg: 'bg-lime-500/15', text: 'text-lime-300', ring: 'ring-lime-400/40' },
  'Billing': { bg: 'bg-emerald-500/15', text: 'text-emerald-300', ring: 'ring-emerald-400/40' },
  'Bill Submission': { bg: 'bg-orange-500/15', text: 'text-orange-300', ring: 'ring-orange-400/40' },
  'Completed': { bg: 'bg-green-500/15', text: 'text-green-300', ring: 'ring-green-400/40' },
};

const PRIORITY_DOT: Record<Priority, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-400',
  Medium: 'bg-yellow-400',
  Low: 'bg-sky-400',
};

const PAGE_SIZE = 6;
const ROTATE_MS = 9000;
const REFRESH_MS = 30000;

function CaseRow({ c }: { c: ImplantCase }) {
  const stage = STAGE_STYLE[c.currentStage] ?? STAGE_STYLE['Kit Preparation'];
  const isOverdue = new Date(c.surgeryDate) < new Date();

  return (
    <div className="flex items-center gap-6 px-8 py-5 rounded-2xl bg-white/5 border border-white/10">
      <div className={`h-4 w-4 rounded-full shrink-0 ${PRIORITY_DOT[c.priority]}`} />

      <div className="w-44 shrink-0">
        <p className="text-3xl font-bold text-white tracking-tight">{c.caseNumber}</p>
        <p className={`text-lg font-medium mt-0.5 ${isOverdue ? 'text-red-400' : 'text-white/40'}`}>
          {formatDateIST(c.surgeryDate)}
        </p>
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Building2 className="h-7 w-7 text-white/30 shrink-0" />
          <span className="text-2xl font-semibold text-white truncate">{c.hospital.name}</span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <Stethoscope className="h-7 w-7 text-white/30 shrink-0" />
          <span className="text-2xl font-semibold text-white/80 truncate">Dr. {c.doctor.name}</span>
        </div>
      </div>

      <div className="w-64 shrink-0 flex items-center gap-3 justify-end">
        <User2 className="h-6 w-6 text-white/30 shrink-0" />
        <span className="text-xl font-medium text-white/70 truncate">
          {c.assignedEmployee?.name.split(' ')[0] ?? 'Unassigned'}
        </span>
      </div>

      <div
        className={`shrink-0 px-5 py-2.5 rounded-full ring-1 ${stage.bg} ${stage.text} ${stage.ring} text-xl font-bold whitespace-nowrap`}
      >
        {c.currentStage}
      </div>
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
    <div className="fixed inset-0 z-50 bg-[#05070c] text-white flex flex-col overflow-hidden select-none">
      <button
        onClick={() => setActiveTab('dashboard')}
        className="absolute top-6 right-6 z-10 p-3 rounded-full bg-white/5 hover:bg-white/15 text-white/40 hover:text-white transition-colors"
        aria-label="Exit TV board"
      >
        <X className="h-7 w-7" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-12 pt-10 pb-6 shrink-0">
        <div>
          <p className="text-2xl font-semibold text-white/40 tracking-widest uppercase">Malcon Nexus</p>
          <h1 className="text-5xl font-extrabold tracking-tight mt-1">Live Case Board</h1>
        </div>
        <div className="text-right">
          <p className="text-7xl font-black tabular-nums tracking-tight leading-none">{formatTimeIST(now)}</p>
          <p className="text-2xl font-medium text-white/40 mt-2">{formatDateIST(now)}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex gap-6 px-12 pb-6 shrink-0">
        <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-8 py-5">
          <p className="text-lg font-medium text-white/40 uppercase tracking-wide">Live Cases</p>
          <p className="text-5xl font-extrabold mt-1">{liveCases.length}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-8 py-5">
          <p className="text-lg font-medium text-white/40 uppercase tracking-wide">Surgeries Today</p>
          <p className="text-5xl font-extrabold mt-1">{surgeryToday}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-red-500/10 border border-red-400/20 px-8 py-5">
          <p className="text-lg font-medium text-red-300/70 uppercase tracking-wide">Critical</p>
          <p className="text-5xl font-extrabold mt-1 text-red-300">{critical}</p>
        </div>
      </div>

      {/* Cases list */}
      <div className="flex-1 px-12 pb-8 flex flex-col gap-4 overflow-hidden">
        {visibleCases.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-4xl font-bold text-white/20">No live cases right now</p>
          </div>
        )}
        {visibleCases.map((c) => <CaseRow key={c.id} c={c} />)}
      </div>

      {/* Pagination dots */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 pb-8 shrink-0">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 rounded-full transition-all ${i === page ? 'w-10 bg-indigo-400' : 'w-2.5 bg-white/20'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
