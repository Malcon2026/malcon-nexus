import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertCircle, Send, FileText, Bell,
  CalendarDays, ClipboardList, ChevronLeft, ChevronRight, Briefcase, Fuel, LogIn, MapPin,
  HandMetal,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import type { ImplantCase } from '../types';
import { formatDate, timeAgo, getStageStyle, getPriorityStyle } from '../utils/helpers';
import {
  canEmployeeSubmitCase,
  getEmployeeSubmitStage,
  getStageSubmitWaitMessage,
  isCaseVisibleToEmployee,
  isCaseAssistantOnCurrentStage,
  isCaseAssignedToEmployee,
} from '../lib/caseWorkflow';
import { canEmployeeRequestTask, getPendingTaskRequestsForCase } from '../lib/caseTaskRequests';
import { CaseDetail } from './CaseDetail';
import { SubmitStageModal } from '../components/SubmitStageModal';
import { EmployeeAttendanceHero } from '../components/EmployeeAttendanceHero';
import { LocationPunchSection } from '../components/LocationPunchSection';
import { LeaveApplySection } from '../components/LeaveApplySection';
import { EmployeePetrolSection } from '../components/EmployeePetrolSection';
import { EmployeeFoodSection } from '../components/EmployeeFoodSection';
import { getFoodSelectionForDay, isFoodSelectionSubmitted } from '../lib/food';
import { getFoodTileBlinkLevel, isFoodTileAttentionPeriod } from '../lib/foodPreferences';
import { getISTDateKey } from '../lib/attendance';
import { isStoreManager } from '../lib/roles';
import { AttendanceRegisterPanel } from '../components/AttendanceRegisterPanel';
import { Te } from '../components/BilingualText';
import { formatTimeIST, summarizeLiveAttendance } from '../lib/attendance';
import { countPendingLeaveSubmissions } from '../lib/leave';
import { openLocationTrip } from '../lib/locationTrip';
import { useEmployeeLocationPrompt } from '../hooks/useEmployeeLocationPrompt';
import { EmployeeLocationBanner } from '../components/EmployeeLocationBanner';
import { NexusPage } from '../components/layout/NexusPageHeader';

type EmployeePage = 'home' | 'attendance' | 'cases' | 'leaves' | 'register' | 'alerts' | 'petrol' | 'food' | 'location';

const SubmitModal: React.FC<{ isOpen: boolean; onClose: () => void; case: ImplantCase }> = ({ isOpen, onClose, case: c }) => (
  <SubmitStageModal isOpen={isOpen} onClose={onClose} implantCase={c} />
);

function useMyCases(employee: Pick<import('../types').Employee, 'id' | 'email'>) {
  const cases = useStore((s) => s.cases);
  return cases.filter((c) => isCaseVisibleToEmployee(c, employee));
}

const PageHeader: React.FC<{ title: string; titleTe?: string; onBack: () => void }> = ({
  title,
  titleTe,
  onBack,
}) => (
  <div className="flex items-center gap-2 mb-5">
    <button type="button" onClick={onBack} className="nexus-back-btn" aria-label="Back">
      <ChevronLeft className="h-5 w-5" />
    </button>
    <div className="min-w-0">
      <h2 className="nexus-page-header__title text-xl leading-tight">{title}</h2>
      {titleTe && <Te className="text-gray-500 mb-0">{titleTe}</Te>}
    </div>
  </div>
);

const HomeNavTiles: React.FC<{
  employee: Pick<import('../types').Employee, 'id' | 'email' | 'name' | 'role'>;
  onOpen: (page: EmployeePage) => void;
}> = ({ employee, onOpen }) => {
  const myCases = useMyCases(employee);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const pendingLeaveCount = useStore(
    (s) => countPendingLeaveSubmissions(s.leaveRequests.filter((lr) => lr.employeeId === employee.id)),
  );
  const petrolPending = useStore(
    (s) => s.petrolRequests.filter((r) => r.employeeId === employee.id && r.status === 'pending').length,
  );
  const petrolActiveToken = useStore(
    (s) => s.petrolRequests.some((r) => r.employeeId === employee.id && r.status === 'issued'),
  );
  const locationOpen = useStore((s) => openLocationTrip(s.locationTrips, employee.id));
  const unreadNotifCount = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const todayFood = useStore((s) =>
    getFoodSelectionForDay(s.foodSelections, employee.id, getISTDateKey()),
  );
  const foodSubmittedToday = isFoodSelectionSubmitted(todayFood);
  const foodTileBlink = getFoodTileBlinkLevel(!foodSubmittedToday);

  const summary = summarizeLiveAttendance(attendanceRecords, employee.id);
  const activeCases = myCases.filter((c) => c.status === 'Active').length;
  const waitingCases = myCases.filter((c) => c.status === 'Waiting For Approval').length;

  const punchHint = summary.isPunchedIn && summary.punchIn
    ? `In at ${formatTimeIST(summary.punchIn.punchedAt)}`
    : summary.punchOut
      ? `Out at ${formatTimeIST(summary.punchOut.punchedAt)}`
      : 'Tap to punch in';

  const tiles: {
    id: EmployeePage;
    title: string;
    titleTe: string;
    hint?: string;
    icon: React.ReactNode;
    iconBg: string;
    badge?: number;
    foodRequired?: boolean;
    foodTile?: boolean;
  }[] = [
    {
      id: 'food',
      title: 'FOOD',
      titleTe: '',
      icon: null,
      iconBg: '',
      foodRequired: !foodSubmittedToday,
      foodTile: true,
    },
    {
      id: 'cases',
      title: 'Cases',
      titleTe: 'Cases',
      hint: isStoreManager(employee.role)
        ? `${activeCases + waitingCases} assigned · sets, return, delivery, etc.`
        : waitingCases > 0
          ? `${waitingCases} waiting`
          : `${activeCases} active`,
      icon: <Briefcase className="h-5 w-5 text-[var(--color-accent)]" />,
      iconBg: 'bg-[var(--color-accent-muted)]',
      badge: activeCases + waitingCases || undefined,
    },
    {
      id: 'petrol',
      title: 'Petrol',
      titleTe: 'Petrol',
      hint: petrolPending > 0 ? 'Waiting for token' : petrolActiveToken ? 'Token active' : 'Request token',
      icon: <Fuel className="h-5 w-5 text-orange-600" />,
      iconBg: 'bg-orange-50',
      badge: petrolPending || (petrolActiveToken ? 1 : 0) || undefined,
    },
    {
      id: 'location',
      title: 'Location punchin',
      titleTe: 'Location punch',
      hint: locationOpen ? `Trip ${locationOpen.tripNo} — press Reached` : 'Add trip',
      icon: <MapPin className="h-5 w-5 text-sky-600" />,
      iconBg: 'bg-sky-50',
      badge: locationOpen ? 1 : undefined,
    },
    {
      id: 'leaves',
      title: 'Leave',
      titleTe: 'Leave',
      hint: pendingLeaveCount > 0 ? `${pendingLeaveCount} pending` : 'Apply leave',
      icon: <CalendarDays className="h-5 w-5 text-emerald-600" />,
      iconBg: 'bg-emerald-50',
      badge: pendingLeaveCount || undefined,
    },
    {
      id: 'register',
      title: isStoreManager(employee.role) ? 'Team register' : 'Register',
      titleTe: 'Attendance',
      hint: isStoreManager(employee.role) ? 'Mark team attendance' : undefined,
      icon: <ClipboardList className="h-5 w-5 text-sky-600" />,
      iconBg: 'bg-sky-50',
    },
    {
      id: 'alerts',
      title: 'Alerts',
      titleTe: 'Alerts',
      hint: unreadNotifCount > 0 ? `${unreadNotifCount} new` : 'No new alerts',
      icon: <Bell className="h-5 w-5 text-amber-600" />,
      iconBg: 'bg-amber-50',
      badge: unreadNotifCount || undefined,
    },
  ];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onOpen('attendance')}
        className={`w-full text-left rounded-2xl border p-4 shadow-sm transition-all active:scale-[0.99] ${
          summary.isPunchedIn
            ? 'border-emerald-200 bg-emerald-50/40'
            : 'border-gray-200 bg-white hover:border-[var(--color-accent)]/25'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
            summary.isPunchedIn ? 'bg-emerald-100' : 'bg-[var(--color-accent-muted)]'
          }`}>
            <LogIn className={`h-6 w-6 ${summary.isPunchedIn ? 'text-emerald-700' : 'text-[var(--color-accent)]'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-gray-900">Punch in / out</p>
            <Te className="text-gray-500 mb-0 mt-0">Attendance</Te>
            <p className={`text-sm mt-1 ${summary.isPunchedIn ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
              {punchHint}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-300 shrink-0" />
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const isFood = tile.id === 'food';
          const blinkClass =
            isFood && foodTileBlink === 'urgent'
              ? 'food-tile-blink-urgent'
              : isFood && foodTileBlink === 'new'
                ? 'food-tile-blink-new'
                : '';
          return (
          <button
            key={tile.id}
            type="button"
            onClick={() => onOpen(tile.id)}
            className={`relative text-left rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-card)] transition-all active:scale-[0.98] min-h-[8.5rem] ${blinkClass} ${
              tile.foodRequired
                ? 'border-rose-300 bg-rose-50/30 hover:border-rose-400 ring-1 ring-rose-200'
                : isFood && foodTileBlink === 'new'
                  ? 'border-rose-200 bg-white hover:border-rose-300'
                  : 'border-[var(--color-separator)] bg-white hover:border-[var(--color-accent)]/30 hover:shadow-[var(--shadow-popover)]'
            }`}
          >
            {!isFood && tile.badge != null && tile.badge > 0 && (
              <span className="absolute top-3 right-3 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {tile.badge > 99 ? '99+' : tile.badge}
              </span>
            )}
            {isFood && isFoodTileAttentionPeriod() && (
              <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-bold uppercase tracking-wide food-tile-badge-pulse">
                New
              </span>
            )}
            {isFood ? (
              <div className="flex flex-col justify-center min-h-[5.5rem] text-black">
                <p className="text-base font-black tracking-wide text-black">FOOD</p>
                <p className="text-xs font-medium text-black mt-3 leading-snug">Breakfast - Lunch - Dinner</p>
                <p className="text-xs font-black tracking-wide text-black mt-2">TOKENS</p>
              </div>
            ) : (
              <>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tile.iconBg} mb-3`}>
                  {tile.icon}
                </div>
                <p className="text-sm font-bold text-gray-900">{tile.title}</p>
                {tile.titleTe ? <Te className="text-gray-500 mb-0 mt-0">{tile.titleTe}</Te> : null}
                {tile.hint ? <p className="text-xs text-gray-500 mt-1">{tile.hint}</p> : null}
              </>
            )}
          </button>
          );
        })}
      </div>
    </div>
  );
};

const EmployeeRegisterPage: React.FC<{
  employeeId: string;
  teamRegister?: boolean;
}> = ({ employeeId, teamRegister = false }) => {
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { bootstrapEssential } = await import('../lib/database/bootstrap');
        const role = teamRegister ? 'store_manager' : 'employee';
        await bootstrapEssential(role, { employeeId }, { force: teamRegister });
        if (!cancelled) reloadFromDatabase();
      } catch (err) {
        console.warn('[register] employee attendance refresh failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, teamRegister, reloadFromDatabase]);

  return (
    <AttendanceRegisterPanel
      employeeId={teamRegister ? undefined : employeeId}
      title={teamRegister ? 'Team attendance' : 'My Attendance'}
      subtitle="P = Present · UL = Unpaid · WO = Sunday off"
    />
  );
};

const EmployeeCasesPanel: React.FC<{
  employee: Pick<import('../types').Employee, 'id' | 'email' | 'department'>;
  onViewCase: (c: ImplantCase) => void;
  onSubmitCase: (c: ImplantCase) => void;
}> = ({ employee, onViewCase, onSubmitCase }) => {
  const currentUser = useStore((s) => s.currentUser);
  const requestTask = useStore((s) => s.requestTask);
  const getPoolCasesAvailableForCurrentUser = useStore((s) => s.getPoolCasesAvailableForCurrentUser);
  const getMyPendingTaskRequests = useStore((s) => s.getMyPendingTaskRequests);
  const cases = useStore((s) => s.cases);
  const poolCases = getPoolCasesAvailableForCurrentUser();
  const pendingRequests = getMyPendingTaskRequests();
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const myCases = useMyCases(employee);
  const completedCases = myCases.filter((c) =>
    c.stages.some((stage) => isCaseAssignedToEmployee({ ...c, assignedEmployee: stage.assignedEmployee }, employee) && stage.status === 'Approved'),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-sm font-bold text-gray-900 sm:hidden">My Cases</h2>

        {pendingRequests.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-sky-800">Waiting for admin</h3>
              <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-xs">{pendingRequests.length}</Badge>
            </div>
            {pendingRequests.map((r) => {
              const c = cases.find((x) => x.id === r.caseId);
              if (!c) return null;
              const sc = getStageStyle(c.currentStage);
              return (
                <Card key={r.id} className="border-sky-200 bg-sky-50/30">
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-sm font-bold text-[var(--color-accent)]">{c.caseNumber}</span>
                        <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs ml-2`}>{c.currentStage}</Badge>
                        <p className="text-xs text-gray-500 mt-1">{c.hospital?.name}</p>
                      </div>
                      <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-xs">Pending</Badge>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        {poolCases.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-800">Available — request assignment</h3>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">{poolCases.length}</Badge>
            </div>
            <p className="text-xs text-amber-700/80">Request a case — admin will assign who handles it.</p>
            {poolCases.map((c, idx) => {
              const sc = getStageStyle(c.currentStage);
              const pc = getPriorityStyle(c.priority);
              const requesting = requestingId === c.id;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="border-amber-200 bg-amber-50/30">
                    <CardBody>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-sm font-bold text-[var(--color-accent)]">{c.caseNumber}</span>
                            <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                              <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                              {c.currentStage}
                            </Badge>
                            <Badge className={`${pc} text-xs`}>{c.priority}</Badge>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{c.hospital?.name ?? 'Unknown Hospital'}</p>
                          <p className="text-xs text-gray-500">{c.doctor.name} • Surgery: {formatDate(c.surgeryDate)}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button variant="outline" size="sm" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => onViewCase(c)}>
                            View
                          </Button>
                          {canEmployeeRequestTask(c, useStore.getState().caseTaskRequests, currentUser) && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={requesting}
                              icon={<HandMetal className="h-3.5 w-3.5" />}
                              onClick={async () => {
                                setRequestingId(c.id);
                                const { error } = await requestTask(c.id);
                                setRequestingId(null);
                                if (error) alert(error);
                              }}
                            >
                              {requesting ? 'Sending…' : 'Request'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {myCases.length === 0 && poolCases.length === 0 && pendingRequests.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No cases yet</p>
            <p className="text-xs text-gray-400 mt-1">Admin will assign cases soon</p>
            <Te className="text-gray-400 mt-1 mb-0">Admin meeku cases istaru</Te>
          </Card>
        ) : (
          myCases.map((c, idx) => {
            const sc = getStageStyle(c.currentStage);
            const pc = getPriorityStyle(c.priority);
            const isSubmitted = c.status === 'Waiting For Approval';
            const canSubmit = canEmployeeSubmitCase(c, currentUser);
            const mySubmitStage = getEmployeeSubmitStage(c, currentUser);
            const submitWaitMessage = getStageSubmitWaitMessage(c, currentUser);
            const isExtraPerson = isCaseAssistantOnCurrentStage(c, currentUser) && !canSubmit;

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
              >
                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-bold text-[var(--color-accent)]">{c.caseNumber}</span>
                          <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {c.currentStage}
                          </Badge>
                          {submitWaitMessage && (
                            <Badge className="bg-slate-50 text-slate-700 border-slate-200 text-xs max-w-[220px] whitespace-normal text-left">
                              Waiting on prior stage
                            </Badge>
                          )}
                          {canSubmit && mySubmitStage && (
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                              Ready: {mySubmitStage}
                            </Badge>
                          )}
                          <Badge className={`${pc} text-xs`}>{c.priority}</Badge>
                          {isSubmitted && (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              Waiting for admin
                            </Badge>
                          )}
                          {isExtraPerson && (
                            <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-xs">
                              Extra person
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{c.hospital?.name ?? 'Unknown Hospital'}</p>
                        <p className="text-xs text-gray-500">{c.doctor.name} • Surgery: {formatDate(c.surgeryDate)}</p>
                        <p className="text-xs text-gray-400 mt-1">{c.implantRequired}</p>

                        {c.remarks && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            {c.remarks}
                          </div>
                        )}
                        {submitWaitMessage && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            {submitWaitMessage}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<FileText className="h-3.5 w-3.5" />}
                          onClick={() => onViewCase(c)}
                        >
                          View
                        </Button>
                        {canSubmit && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Send className="h-3.5 w-3.5" />}
                            onClick={() => onSubmitCase(c)}
                          >
                            Submit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      <Card className="hidden lg:block h-fit">
        <CardHeader><h3 className="text-sm font-semibold text-gray-900">Recently Done</h3></CardHeader>
        <CardBody className="p-0">
          {completedCases.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No done cases yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {completedCases.slice(0, 4).map((c) => (
                <div key={c.id} className="px-5 py-3">
                  <p className="text-xs font-bold text-[var(--color-accent)]">{c.caseNumber}</p>
                  <p className="text-xs text-gray-700 truncate">{c.hospital?.name ?? 'Unknown Hospital'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-600">Done</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

const EmployeeAlertsPage: React.FC = () => {
  const notifications = useStore((s) => s.notifications);
  const myNotifs = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 30),
    [notifications],
  );

  return (
    <Card>
      <CardBody className="p-0">
        {myNotifs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No alerts</p>
            <Te className="text-gray-400 mb-0">Alerts levu</Te>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {myNotifs.map((n) => (
              <div key={n.id} className="px-4 py-3.5">
                <div className="flex items-start gap-2">
                  <div
                    className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                      n.type === 'warning' ? 'bg-amber-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                      {!n.read && (
                        <span className="text-[10px] font-medium text-[var(--color-accent)] bg-[var(--color-accent-muted)] px-1.5 py-0.5 rounded">New</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export const EmployeeDashboard: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);
  const locationPrompt = useEmployeeLocationPrompt(true);
  const [page, setPage] = useState<EmployeePage>('home');
  const [submitCase, setSubmitCase] = useState<ImplantCase | null>(null);
  const [viewCase, setViewCase] = useState<ImplantCase | null>(null);

  useEffect(() => {
    if (page !== 'cases') return;
    let cancelled = false;
    void (async () => {
      try {
        const { bootstrapEssential } = await import('../lib/database/bootstrap');
        await bootstrapEssential('employee', { employeeId: currentUser.id }, { force: true });
        if (!cancelled) reloadFromDatabase();
      } catch (err) {
        console.warn('[EmployeeDashboard] cases refresh failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, currentUser.id, reloadFromDatabase]);

  if (viewCase) {
    return <CaseDetail case={viewCase} onBack={() => setViewCase(null)} />;
  }

  return (
    <NexusPage maxWidthClass="max-w-[1200px]">
      <EmployeeLocationBanner
        permission={locationPrompt.permission}
        requesting={locationPrompt.requesting}
        onRetry={locationPrompt.retryLocation}
      />
      {submitCase && (
        <SubmitModal isOpen={true} onClose={() => setSubmitCase(null)} case={submitCase} />
      )}

      {page === 'home' && (
        <>
          <header className="nexus-page-header mb-2">
            <p className="nexus-page-header__desc !mt-0">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
            <h1 className="nexus-page-header__title mt-1">
              Hi, {currentUser.name.split(' ')[0]}
            </h1>
            {isStoreManager(currentUser.role) && (
              <p className="nexus-page-header__desc mt-3 max-w-md">
                Store manager — punch in as usual, add cases and assign staff from{' '}
                <strong className="font-medium text-[var(--color-label)]">Cases</strong>, then upload photos when the set is ready at{' '}
                <strong className="font-medium text-[var(--color-label)]">Set Preparation</strong>.
              </p>
            )}
          </header>
          <HomeNavTiles employee={currentUser} onOpen={setPage} />
        </>
      )}

      {page === 'attendance' && (
        <>
          <PageHeader title="Punch in / out" titleTe="Attendance" onBack={() => setPage('home')} />
          <EmployeeAttendanceHero onPunchInSuccess={() => setPage('food')} />
        </>
      )}

      {page === 'cases' && (
        <>
          <PageHeader title="Cases" titleTe="Naa cases" onBack={() => setPage('home')} />
          <EmployeeCasesPanel
            employee={currentUser}
            onViewCase={setViewCase}
            onSubmitCase={setSubmitCase}
          />
        </>
      )}

      {page === 'leaves' && (
        <>
          <PageHeader title="Leaves" titleTe="Leave apply" onBack={() => setPage('home')} />
          <LeaveApplySection />
        </>
      )}

      {page === 'register' && (
        <>
          <PageHeader
            title={isStoreManager(currentUser.role) ? 'Team register' : 'Register'}
            titleTe="Attendance register"
            onBack={() => setPage('home')}
          />
          <EmployeeRegisterPage
            employeeId={currentUser.id}
            teamRegister={isStoreManager(currentUser.role)}
          />
        </>
      )}

      {page === 'petrol' && (
        <>
          <PageHeader title="Petrol" titleTe="Petrol token" onBack={() => setPage('home')} />
          <EmployeePetrolSection />
        </>
      )}

      {page === 'food' && (
        <>
          <PageHeader title="Food" titleTe="Meals" onBack={() => setPage('home')} />
          <EmployeeFoodSection />
        </>
      )}

      {page === 'location' && (
        <>
          <PageHeader title="Location punchin" titleTe="Location punch" onBack={() => setPage('home')} />
          <LocationPunchSection />
        </>
      )}

      {page === 'alerts' && (
        <>
          <PageHeader title="Alerts" titleTe="Notifications" onBack={() => setPage('home')} />
          <EmployeeAlertsPage />
        </>
      )}
    </NexusPage>
  );
};
