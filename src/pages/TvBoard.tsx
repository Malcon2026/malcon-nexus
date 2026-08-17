import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Employee, ImplantCase, Priority, WorkflowStage } from '../types';
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

const PAGE_SIZE = 5;
const ROTATE_MS = 60000;
const REFRESH_MS = 30000;

/** Auto-scrolls an overflowing list up and down, pausing at each end — no user input needed on a TV. */
function useAutoScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const SPEED_PX_PER_SEC = 26;
    const PAUSE_MS = 2200;
    let raf = 0;
    let last = performance.now();
    let phase: 'down' | 'pause-bottom' | 'pause-top' = 'down';
    let pauseUntil = 0;

    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const maxScroll = el.scrollHeight - el.clientHeight;

      if (maxScroll <= 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'down') {
        el.scrollTop = Math.min(maxScroll, el.scrollTop + SPEED_PX_PER_SEC * dt);
        if (el.scrollTop >= maxScroll - 0.5) {
          phase = 'pause-bottom';
          pauseUntil = t + PAUSE_MS;
        }
      } else if (phase === 'pause-bottom' && t >= pauseUntil) {
        el.scrollTop = 0;
        phase = 'pause-top';
        pauseUntil = t + PAUSE_MS;
      } else if (phase === 'pause-top' && t >= pauseUntil) {
        phase = 'down';
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return ref;
}

function Detail({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: INK_DIM }}>{label}</p>
      <p className="text-base font-semibold truncate" style={{ color: muted ? INK_MUTED : INK }}>{value}</p>
    </div>
  );
}

function CaseRow({ c, zebra }: { c: ImplantCase; zebra: boolean }) {
  const stageClass = STAGE_STYLE[c.currentStage] ?? STAGE_STYLE['Kit Preparation'];
  const isOverdue = new Date(c.surgeryDate) < new Date();

  return (
    <div
      className="rounded-xl px-5 py-3.5"
      style={{ background: zebra ? 'rgba(255,255,255,0.05)' : 'transparent' }}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 tv-dot-pulse ${PRIORITY_DOT[c.priority]}`} />
          <span className="text-xl font-bold truncate" style={{ color: INK }}>{c.hospital.name}</span>
          <span className="text-xs font-medium shrink-0" style={{ color: INK_DIM }}>{c.caseNumber}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold" style={{ color: isOverdue ? '#f87171' : INK_MUTED }}>
            {formatDateIST(c.surgeryDate).replace(/^\w+,\s/, '')}
          </span>
          <span
            className={`px-3 py-1.5 rounded-md ${stageClass} text-xs font-bold uppercase tracking-wide whitespace-nowrap`}
            style={{ color: '#ffffff' }}
          >
            {c.currentStage}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        <Detail label="Surgery" value={c.implantRequired || '—'} />
        <Detail label="Product" value={c.implantType || '—'} muted />
        <Detail label="Company" value={c.implantCompany || '—'} muted />
        <Detail label="Doctor" value={`Dr. ${c.doctor.name}`} muted />
        <Detail label="Assigned" value={c.assignedEmployee?.name.split(' ')[0] ?? 'Unassigned'} />
      </div>
    </div>
  );
}

function CasesSlide({ cases, page }: { cases: ImplantCase[]; page: number }) {
  const visible = cases.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex-1 px-6 flex flex-col gap-2 overflow-hidden">
      {visible.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl font-semibold" style={{ color: INK_DIM }}>No live cases right now</p>
        </div>
      )}
      {visible.map((c, i) => <CaseRow key={c.id} c={c} zebra={i % 2 === 1} />)}
    </div>
  );
}

function EmployeeCard({ name, department, sub, busy }: { name: string; department: string; sub: string; busy: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.05)' }}
    >
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: busy ? '#fb923c' : '#34d399' }} />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold truncate" style={{ color: INK }}>{name}</p>
        <p className="text-sm truncate" style={{ color: INK_MUTED }}>{department}</p>
      </div>
      <p className="text-sm font-semibold text-right shrink-0 max-w-[45%] truncate" style={{ color: busy ? '#fdba74' : '#6ee7b7' }}>
        {sub}
      </p>
    </div>
  );
}

function EmployeeStatusSlide({ cases, employees }: { cases: ImplantCase[]; employees: Employee[] }) {
  const busyScrollRef = useAutoScroll<HTMLDivElement>();
  const idleScrollRef = useAutoScroll<HTMLDivElement>();

  const { busy, idle } = useMemo(() => {
    const busyByEmployee = new Map<string, ImplantCase>();
    for (const c of cases) {
      if (c.assignedEmployee) busyByEmployee.set(c.assignedEmployee.id, c);
    }
    const active = employees.filter((e) => e.status === 'Active');
    const busyList = active
      .filter((e) => busyByEmployee.has(e.id))
      .map((e) => ({ employee: e, case: busyByEmployee.get(e.id)! }))
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name));
    const idleList = active
      .filter((e) => !busyByEmployee.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { busy: busyList, idle: idleList };
  }, [cases, employees]);

  return (
    <div className="flex-1 grid grid-cols-2 gap-6 px-8 pb-4 overflow-hidden">
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 pb-3 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#fb923c' }} />
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: INK }}>On A Case</p>
          <span className="text-sm font-semibold" style={{ color: INK_DIM }}>({busy.length})</span>
        </div>
        <div ref={busyScrollRef} className="flex-1 flex flex-col gap-2 overflow-hidden">
          {busy.length === 0 && (
            <p className="text-lg font-medium mt-4" style={{ color: INK_DIM }}>Nobody is on a case right now.</p>
          )}
          {busy.map(({ employee, case: c }) => (
            <EmployeeCard
              key={employee.id}
              name={employee.name}
              department={employee.department}
              sub={`${c.caseNumber} · ${c.currentStage}`}
              busy
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 pb-3 shrink-0">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#34d399' }} />
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: INK }}>Idle / Available</p>
          <span className="text-sm font-semibold" style={{ color: INK_DIM }}>({idle.length})</span>
        </div>
        <div ref={idleScrollRef} className="flex-1 flex flex-col gap-2 overflow-hidden">
          {idle.length === 0 && (
            <p className="text-lg font-medium mt-4" style={{ color: INK_DIM }}>Everyone is currently on a case.</p>
          )}
          {idle.map((employee) => (
            <EmployeeCard
              key={employee.id}
              name={employee.name}
              department={employee.department}
              sub="Available"
              busy={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const TvBoard: React.FC = () => {
  const { cases, employees, setActiveTab, reloadFromDatabase, viewMode, currentUser } = useStore();
  const [now, setNow] = useState(new Date());
  const [slide, setSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const caseTagCount = Math.max(1, Math.ceil(liveCases.length / PAGE_SIZE));
  // Slides = one per case page, plus one final slide for employee status.
  const totalSlides = caseTagCount + 1;

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSlide((s) => (s + 1) % totalSlides);
    }, ROTATE_MS);
  }, [totalSlides]);

  useEffect(() => {
    restartTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [restartTimer]);

  useEffect(() => {
    if (slide >= totalSlides) setSlide(0);
  }, [totalSlides, slide]);

  const goToSlide = useCallback((next: number) => {
    setSlide(((next % totalSlides) + totalSlides) % totalSlides);
    restartTimer();
  }, [totalSlides, restartTimer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToSlide(slide + 1);
      if (e.key === 'ArrowLeft') goToSlide(slide - 1);
      if (e.key === 'Escape') setActiveTab('dashboard');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slide, goToSlide, setActiveTab]);

  const surgeryToday = liveCases.filter((c) => {
    const d = new Date(c.surgeryDate);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length;

  const critical = liveCases.filter((c) => c.priority === 'Critical').length;
  const isEmployeeSlide = slide === totalSlides - 1;
  const activeEmployeeCount = employees.filter((e) => e.status === 'Active').length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none" style={{ background: '#0a0d14', color: INK }}>
      <button
        onClick={() => setActiveTab('dashboard')}
        className="absolute top-4 right-4 z-20 p-2 rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.1)', color: INK_MUTED }}
        aria-label="Exit TV board"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Manual nav arrows */}
      <button
        onClick={() => goToSlide(slide - 1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.08)', color: INK_MUTED }}
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={() => goToSlide(slide + 1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full transition-colors"
        style={{ background: 'rgba(255,255,255,0.08)', color: INK_MUTED }}
        aria-label="Next slide"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8cff' }}>Malcon Nexus</p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5" style={{ color: INK }}>
            {isEmployeeSlide ? 'Team Status' : 'Live Case Board'}
          </h1>
        </div>

        <div className="flex items-center gap-8">
          {isEmployeeSlide ? (
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: INK_MUTED }}>On Duty</p>
              <p className="text-2xl font-extrabold mt-0.5" style={{ color: INK }}>{activeEmployeeCount}</p>
            </div>
          ) : (
            <>
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
            </>
          )}

          <div className="text-right pl-6" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-3xl font-black tabular-nums tracking-tight leading-none" style={{ color: INK }}>{formatTimeIST(now)}</p>
            <p className="text-sm font-medium mt-1" style={{ color: INK_MUTED }}>{formatDateIST(now)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden pt-4">
        {isEmployeeSlide ? (
          <EmployeeStatusSlide cases={liveCases} employees={employees} />
        ) : (
          <CasesSlide cases={liveCases} page={Math.min(slide, caseTagCount - 1)} />
        )}
      </div>

      {/* Slide dots */}
      {totalSlides > 1 && (
        <div className="flex items-center justify-center gap-2 pb-4 shrink-0">
          {Array.from({ length: totalSlides }).map((_, i) => {
            const isLast = i === totalSlides - 1;
            const isCurrent = i === slide;
            return (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                aria-label={isLast ? 'Team status slide' : `Cases page ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: isCurrent ? '1.5rem' : '0.375rem',
                  background: isCurrent ? (isLast ? '#fb923c' : '#9a8cff') : 'rgba(255,255,255,0.2)',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
