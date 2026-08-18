import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, AlertCircle, Send, FileText, Bell,
  CalendarDays, ClipboardList, ChevronLeft, ChevronRight, Briefcase, Fuel, LogIn,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import type { ImplantCase } from '../types';
import { formatDate, timeAgo, getStageStyle, getPriorityStyle } from '../utils/helpers';
import { canEmployeeSubmitCase, isCaseAssignedToEmployee } from '../lib/caseWorkflow';
import { CaseDetail } from './CaseDetail';
import { SubmitStageModal } from '../components/SubmitStageModal';
import { EmployeeAttendanceHero } from '../components/EmployeeAttendanceHero';
import { HospitalTripPilotCard } from '../components/HospitalTripPilotCard';
import { LeaveApplySection } from '../components/LeaveApplySection';
import { EmployeePetrolSection } from '../components/EmployeePetrolSection';
import { AttendanceRegisterPanel } from '../components/AttendanceRegisterPanel';
import { NoticeBoard } from '../components/NoticeBoard';
import { Te } from '../components/BilingualText';
import { formatTimeIST, summarizeLiveAttendance } from '../lib/attendance';

type EmployeePage = 'home' | 'attendance' | 'cases' | 'leaves' | 'register' | 'alerts' | 'petrol';

const SubmitModal: React.FC<{ isOpen: boolean; onClose: () => void; case: ImplantCase }> = ({ isOpen, onClose, case: c }) => (
  <SubmitStageModal isOpen={isOpen} onClose={onClose} implantCase={c} />
);

function useMyCases(employee: Pick<import('../types').Employee, 'id' | 'email'>) {
  const cases = useStore((s) => s.cases);
  return cases.filter((c) => isCaseAssignedToEmployee(c, employee));
}

const PageHeader: React.FC<{ title: string; titleTe?: string; onBack: () => void }> = ({
  title,
  titleTe,
  onBack,
}) => (
  <div className="flex items-center gap-2 mb-4">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      aria-label="Back"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
    <div className="min-w-0">
      <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
      {titleTe && <Te className="text-gray-500 mb-0">{titleTe}</Te>}
    </div>
  </div>
);

const HomeNavTiles: React.FC<{
  employee: Pick<import('../types').Employee, 'id' | 'email' | 'name'>;
  onOpen: (page: EmployeePage) => void;
}> = ({ employee, onOpen }) => {
  const myCases = useMyCases(employee);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const pendingLeaveCount = useStore(
    (s) => s.leaveRequests.filter((lr) => lr.employeeId === employee.id && lr.status === 'pending').length,
  );
  const petrolPending = useStore(
    (s) => s.petrolRequests.filter((r) => r.employeeId === employee.id && r.status === 'pending').length,
  );
  const petrolNeedsPhotos = useStore(
    (s) => s.petrolRequests.some((r) => r.employeeId === employee.id && r.status === 'issued' && !r.receiptUrl),
  );
  const unreadNotifCount = useStore((s) => s.notifications.filter((n) => !n.read).length);

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
    hint: string;
    icon: React.ReactNode;
    iconBg: string;
    badge?: number;
  }[] = [
    {
      id: 'cases',
      title: 'Cases',
      titleTe: 'Cases',
      hint: waitingCases > 0 ? `${waitingCases} waiting` : `${activeCases} active`,
      icon: <Briefcase className="h-5 w-5 text-indigo-600" />,
      iconBg: 'bg-indigo-50',
      badge: activeCases + waitingCases || undefined,
    },
    {
      id: 'petrol',
      title: 'Petrol',
      titleTe: 'Petrol',
      hint: petrolPending > 0 ? 'Waiting for token' : petrolNeedsPhotos ? 'Add last bill photos' : 'Request token',
      icon: <Fuel className="h-5 w-5 text-orange-600" />,
      iconBg: 'bg-orange-50',
      badge: petrolPending || (petrolNeedsPhotos ? 1 : 0) || undefined,
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
      title: 'Register',
      titleTe: 'Attendance',
      hint: 'Month view',
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
            : 'border-gray-200 bg-white hover:border-indigo-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
            summary.isPunchedIn ? 'bg-emerald-100' : 'bg-indigo-50'
          }`}>
            <LogIn className={`h-6 w-6 ${summary.isPunchedIn ? 'text-emerald-700' : 'text-indigo-600'}`} />
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
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => onOpen(tile.id)}
            className="relative text-left rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-200 transition-all active:scale-[0.98] min-h-[8.5rem]"
          >
            {tile.badge != null && tile.badge > 0 && (
              <span className="absolute top-3 right-3 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {tile.badge > 99 ? '99+' : tile.badge}
              </span>
            )}
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tile.iconBg} mb-3`}>
              {tile.icon}
            </div>
            <p className="text-sm font-bold text-gray-900">{tile.title}</p>
            <Te className="text-gray-500 mb-0 mt-0">{tile.titleTe}</Te>
            <p className="text-xs text-gray-500 mt-1">{tile.hint}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const EmployeeRegisterPage: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const reloadFromDatabase = useStore((s) => s.reloadFromDatabase);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { bootstrapDeferred } = await import('../lib/database/bootstrap');
        await bootstrapDeferred('employee', { employeeId });
        if (!cancelled) reloadFromDatabase();
      } catch (err) {
        console.warn('[register] employee attendance refresh failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, reloadFromDatabase]);

  return (
    <AttendanceRegisterPanel
      employeeId={employeeId}
      title="My Attendance"
      subtitle="P = Present · UL = Unpaid · WO = Sunday off"
    />
  );
};

const EmployeeCasesPanel: React.FC<{
  employee: Pick<import('../types').Employee, 'id' | 'email'>;
  onViewCase: (c: ImplantCase) => void;
  onSubmitCase: (c: ImplantCase) => void;
}> = ({ employee, onViewCase, onSubmitCase }) => {
  const currentUser = useStore((s) => s.currentUser);
  const myCases = useMyCases(employee);
  const completedCases = myCases.filter((c) =>
    c.stages.some((stage) => isCaseAssignedToEmployee({ ...c, assignedEmployee: stage.assignedEmployee }, employee) && stage.status === 'Approved'),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-sm font-bold text-gray-900 sm:hidden">My Cases</h2>

        {myCases.length === 0 ? (
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
                          <span className="text-sm font-bold text-indigo-600">{c.caseNumber}</span>
                          <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {c.currentStage}
                          </Badge>
                          <Badge className={`${pc} text-xs`}>{c.priority}</Badge>
                          {isSubmitted && (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              Waiting for admin
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
                  <p className="text-xs font-bold text-indigo-600">{c.caseNumber}</p>
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
                        <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">New</span>
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
  const [page, setPage] = useState<EmployeePage>('home');
  const [submitCase, setSubmitCase] = useState<ImplantCase | null>(null);
  const [viewCase, setViewCase] = useState<ImplantCase | null>(null);

  if (viewCase) {
    return <CaseDetail case={viewCase} onBack={() => setViewCase(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full min-w-0 overflow-x-hidden">
      {submitCase && (
        <SubmitModal isOpen={true} onClose={() => setSubmitCase(null)} case={submitCase} />
      )}

      {page === 'home' && (
        <>
          <div className="mb-4">
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                timeZone: 'Asia/Kolkata',
              })}
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">
              Hi, {currentUser.name.split(' ')[0]}
            </h1>
          </div>
          <NoticeBoard />
          <HomeNavTiles employee={currentUser} onOpen={setPage} />
        </>
      )}

      {page === 'attendance' && (
        <>
          <PageHeader title="Punch in / out" titleTe="Attendance" onBack={() => setPage('home')} />
          <EmployeeAttendanceHero />
          <HospitalTripPilotCard />
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
          <PageHeader title="Register" titleTe="Attendance register" onBack={() => setPage('home')} />
          <EmployeeRegisterPage employeeId={currentUser.id} />
        </>
      )}

      {page === 'petrol' && (
        <>
          <PageHeader title="Petrol" titleTe="Petrol token" onBack={() => setPage('home')} />
          <EmployeePetrolSection />
        </>
      )}

      {page === 'alerts' && (
        <>
          <PageHeader title="Alerts" titleTe="Notifications" onBack={() => setPage('home')} />
          <EmployeeAlertsPage />
        </>
      )}
    </div>
  );
};
