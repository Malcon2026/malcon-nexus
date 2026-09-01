import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Employee, ImplantCase, Priority, WorkflowStage } from '../types';
import { formatTimeIST, formatDateIST, getISTDateKey } from '../lib/attendance';
import { TvNoticeTicker } from '../components/TvNoticeTicker';
import { isPostSurgeryStage, UNUSED_IMPLANTS_REMARK } from '../lib/caseWorkflow';

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

const STAGE_COLOR: Record<WorkflowStage, string> = {
  'Kit Preparation': '#7c3aed',
  'Delivery': '#e11d48',
  'Surgery': '#2563eb',
  'Pickup from Hospital': '#db2777',
  'Cleaning & Audit': '#0891b2',
  'Restock': '#65a30d',
  'Billing': '#059669',
  'Bill Submission': '#ea580c',
  'Completed': '#16a34a',
};

const ROTATE_MS = 60000;
const REFRESH_MS = 30000;

/** Set true to restore the rotating Team Status slide on the TV board. */
const SHOW_TEAM_STATUS_SLIDE = false;

/** Auto-scrolls an overflowing list up and down, pausing at each end — no user input needed on a TV. */
function useAutoScroll<T extends HTMLElement>(resetKey?: string | number) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.scrollTop = 0;

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
  }, [resetKey]);

  return ref;
}

function Detail({ label, value, muted, color }: { label: string; value: string; muted?: boolean; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: INK_DIM }}>{label}</p>
      <p className="text-base font-semibold truncate" style={{ color: color ?? (muted ? INK_MUTED : INK) }}>{value}</p>
    </div>
  );
}

function tvBillingStatus(c: ImplantCase): 'Done' | 'Pending' {
  if (c.paymentStatus === 'Collected') return 'Done';
  if (c.status === 'Completed') return 'Done';
  const billed = c.stages.some(
    (s) =>
      (s.stage === 'Billing' || s.stage === 'Bill Submission') && s.status === 'Approved',
  );
  return billed ? 'Done' : 'Pending';
}

function isTodayIST(value: string | undefined): boolean {
  if (!value) return false;
  return getISTDateKey(value) === getISTDateKey();
}

function tvRemark(c: ImplantCase): string {
  const remarks = (c.remarks ?? '').trim();
  if (remarks) return remarks;
  if (c.cancelReason || c.status === 'Cancelled') return UNUSED_IMPLANTS_REMARK;
  if (c.postponeReason) return `Postponed${c.surgeryDate ? ` to ${c.surgeryDate}` : ''}`;
  return '';
}

function CaseRow({ c, zebra }: { c: ImplantCase; zebra: boolean }) {
  const closedCancelled = c.status === 'Cancelled';
  const returning = Boolean(c.cancelReason) && !closedCancelled;
  const stageColor = closedCancelled ? '#d97706' : (STAGE_COLOR[c.currentStage] ?? STAGE_COLOR['Kit Preparation']);
  const stageLabel = closedCancelled ? 'Cancelled' : c.currentStage;
  const isOverdue = !closedCancelled && new Date(c.surgeryDate) < new Date();
  const remark = tvRemark(c);
  const billing = tvBillingStatus(c);
  const isLiveActive = c.status === 'Active';
  const isPostSurgery = isLiveActive && isPostSurgeryStage(c.currentStage);
  const isPreSurgeryActive = isLiveActive && !isPostSurgery;

  return (
    <div
      className="rounded-xl px-5 py-3.5"
      style={{ background: zebra ? 'rgba(255,255,255,0.05)' : 'transparent' }}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 overflow-hidden ${
              isPreSurgeryActive ? 'tv-dot-pulse' : isPostSurgery ? 'tv-dot-pulse-yellow' : ''
            }`}
            style={isLiveActive ? undefined : { background: INK_DIM }}
          />
          <span className="text-xl font-bold truncate" style={{ color: INK }}>{c.hospital.name}</span>
          {c.hospital.branch ? (
            <span className="text-sm font-medium truncate shrink-0" style={{ color: INK_MUTED }}>{c.hospital.branch}</span>
          ) : null}
          <span className="text-xs font-medium shrink-0" style={{ color: INK_DIM }}>{c.caseNumber}</span>
          {returning ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded shrink-0" style={{ background: '#f59e0b', color: '#111' }}>
              Return kit
            </span>
          ) : null}
          {closedCancelled ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded shrink-0" style={{ background: '#f59e0b', color: '#111' }}>
              Implants unused
            </span>
          ) : null}
          {c.postponeReason && !closedCancelled && !returning ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded shrink-0" style={{ background: '#38bdf8', color: '#0f172a' }}>
              Postponed
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold" style={{ color: isOverdue ? '#f87171' : INK_MUTED }}>
            {formatDateIST(c.surgeryDate).replace(/^\w+,\s/, '')}
          </span>
          <span
            className={`${
              isPreSurgeryActive
                ? 'tv-stage-blink'
                : isPostSurgery
                  ? 'tv-stage-blink-yellow'
                  : ''
            } px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide whitespace-nowrap`}
            style={
              isPreSurgeryActive
                ? { ['--tv-stage' as string]: stageColor }
                : isPostSurgery
                  ? undefined
                  : { backgroundColor: stageColor, color: '#ffffff' }
            }
          >
            {stageLabel}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-4">
        <Detail label="Surgery" value={c.implantRequired || '—'} />
        <Detail label="Product" value={c.implantType || '—'} muted />
        <Detail label="Company" value={c.implantCompany || '—'} muted />
        <Detail label="Doctor" value={`Dr. ${c.doctor.name}`} muted />
        <Detail label="Assigned" value={c.assignedEmployee?.name.split(' ')[0] ?? 'Unassigned'} />
        <Detail
          label="Billing"
          value={billing}
          color={billing === 'Done' ? '#34d399' : '#fbbf24'}
        />
      </div>
      {remark ? (
        <p className="text-sm font-semibold mt-2 truncate" style={{ color: '#fbbf24' }}>
          Remark: {remark}
        </p>
      ) : null}
    </div>
  );
}

function CasesSlide({ cases }: { cases: ImplantCase[] }) {
  const scrollRef = useAutoScroll<HTMLDivElement>(cases.length);

  return (
    <div className="flex-1 px-6 flex flex-col overflow-hidden min-h-0">
      {cases.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl font-semibold" style={{ color: INK_DIM }}>No live cases right now</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
          {cases.map((c, i) => <CaseRow key={c.id} c={c} zebra={i % 2 === 1} />)}
        </div>
      )}
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
  const { cases, employees, setActiveTab, reloadFromDatabase, viewMode, currentUser, loadAppSettings, getTvNoticeConfig } = useStore();
  const [now, setNow] = useState(new Date());
  const [slide, setSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tvNotice = getTvNoticeConfig();

  useEffect(() => {
    void loadAppSettings();
  }, [loadAppSettings]);

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
        await loadAppSettings();
      } catch (err) {
        console.error('[TvBoard] refresh failed:', err);
      }
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [viewMode, currentUser.id, reloadFromDatabase, loadAppSettings]);

  const { openCases, boardCases } = useMemo(() => {
    const priorityOrder: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const sortFn = (a: ImplantCase, b: ImplantCase) => {
      const closed = Number(a.status === 'Cancelled') - Number(b.status === 'Cancelled');
      if (closed !== 0) return closed;
      const p = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (p !== 0) return p;
      return new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime();
    };
    const open = cases.filter(
      (c) => c.status !== 'Completed' && c.status !== 'Cancelled' && c.currentStage !== 'Completed',
    );
    const cancelledToday = cases.filter(
      (c) => c.status === 'Cancelled' && (isTodayIST(c.surgeryDate) || isTodayIST(c.updatedAt)),
    );
    return {
      openCases: [...open].sort(sortFn),
      boardCases: [...open, ...cancelledToday].sort(sortFn),
    };
  }, [cases]);
  const liveCases = openCases;

  const caseTagCount = 1;
  const totalSlides = caseTagCount + (SHOW_TEAM_STATUS_SLIDE ? 1 : 0);

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

  const surgeryToday = boardCases.filter((c) => {
    const d = new Date(c.surgeryDate);
    const t = new Date();
    return d.toDateString() === t.toDateString();
  }).length;

  const critical = liveCases.filter((c) => c.priority === 'Critical').length;
  const isEmployeeSlide = SHOW_TEAM_STATUS_SLIDE && slide === totalSlides - 1;
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
      <div className="flex items-center gap-4 px-8 pt-6 pb-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="shrink-0">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#9a8cff' }}>Malcon Nexus</p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5" style={{ color: INK }}>
            {isEmployeeSlide ? 'Team Status' : 'Live Case Board'}
          </h1>
        </div>

        {tvNotice.text ? (
          <TvNoticeTicker text={tvNotice.text} color={tvNotice.color} sepColor={tvNotice.sepColor} />
        ) : null}

        <div className="flex items-center gap-8 shrink-0 ml-auto">
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
          <CasesSlide cases={boardCases} />
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
