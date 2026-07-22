import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, CheckCircle2, AlertCircle, Send, FileText, Bell
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import type { ImplantCase } from '../types';
import { formatDate, timeAgo, getStageStyle, getPriorityStyle } from '../utils/helpers';
import { CaseDetail } from './CaseDetail';
import { SubmitStageModal } from '../components/SubmitStageModal';
import { AttendanceSection } from '../components/AttendanceSection';
import { LeaveApplySection } from '../components/LeaveApplySection';
import { AttendanceRegisterPanel } from '../components/AttendanceRegisterPanel';

const SubmitModal: React.FC<{ isOpen: boolean; onClose: () => void; case: ImplantCase }> = ({ isOpen, onClose, case: c }) => (
  <SubmitStageModal isOpen={isOpen} onClose={onClose} implantCase={c} />
);

function useMyCases(employeeId: string) {
  const cases = useStore((s) => s.cases);
  return cases.filter((c) => c.assignedEmployee?.id === employeeId);
}

const LazyEmployeeRegister: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={containerRef} className="mb-6 min-w-0 w-full max-w-full overflow-hidden">
      {visible ? (
        <AttendanceRegisterPanel
          employeeId={employeeId}
          title="My Attendance Register"
          subtitle="Your salary-cycle attendance — P Present, L Leave, A Absent, WO Sunday off"
        />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-gray-400">Attendance register loads when you scroll here…</p>
        </Card>
      )}
    </div>
  );
};

const EmployeeQuickStats: React.FC<{ employeeId: string }> = ({ employeeId }) => {
  const myCases = useMyCases(employeeId);
  const unreadNotifCount = useStore(
    (s) => s.notifications.filter((n) => !n.read).length,
  );

  const activeCases = myCases.filter((c) => c.status === 'Active').length;
  const submittedCases = myCases.filter((c) => c.status === 'Waiting For Approval').length;
  const completedCases = myCases.filter((c) =>
    c.stages.some((stage) => stage.assignedEmployee?.id === employeeId && stage.status === 'Approved'),
  ).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {[
        { label: 'My Active Cases', value: activeCases, icon: <Clock className="h-5 w-5 text-indigo-600" />, bg: 'bg-indigo-50' },
        { label: 'Awaiting Approval', value: submittedCases, icon: <AlertCircle className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-50' },
        { label: 'Completed', value: completedCases, icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50' },
        { label: 'Notifications', value: unreadNotifCount, icon: <Bell className="h-5 w-5 text-purple-600" />, bg: 'bg-purple-50' },
      ].map(({ label, value, icon, bg }) => (
        <Card key={label} className="p-5">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg} mb-3`}>{icon}</div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        </Card>
      ))}
    </div>
  );
};

const EmployeeCasesPanel: React.FC<{
  employeeId: string;
  onViewCase: (c: ImplantCase) => void;
  onSubmitCase: (c: ImplantCase) => void;
}> = ({ employeeId, onViewCase, onSubmitCase }) => {
  const myCases = useMyCases(employeeId);
  const completedCases = myCases.filter((c) =>
    c.stages.some((stage) => stage.assignedEmployee?.id === employeeId && stage.status === 'Approved'),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-sm font-bold text-gray-900">My Assigned Cases</h2>

        {myCases.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No cases assigned</p>
            <p className="text-xs text-gray-400 mt-1">The admin will assign cases to you shortly</p>
          </Card>
        ) : (
          myCases.map((c, idx) => {
            const sc = getStageStyle(c.currentStage);
            const pc = getPriorityStyle(c.priority);
            const isSubmitted = c.status === 'Waiting For Approval';
            const canSubmit = c.status === 'Active';

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
                              ⏳ Awaiting Admin
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

      <EmployeeSidebar completedCases={completedCases} />
    </div>
  );
};

const EmployeeSidebar: React.FC<{
  completedCases: ImplantCase[];
}> = ({ completedCases }) => {
  const notifications = useStore((s) => s.notifications);
  const myNotifs = useMemo(
    () => notifications.filter((n) => !n.read).slice(0, 5),
    [notifications],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {myNotifs.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{myNotifs.length}</span>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {myNotifs.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {myNotifs.map((n) => (
                <div key={n.id} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${n.type === 'warning' ? 'bg-amber-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-900">Recently Completed</h3></CardHeader>
        <CardBody className="p-0">
          {completedCases.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No completed cases yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {completedCases.slice(0, 4).map((c) => (
                <div key={c.id} className="px-5 py-3">
                  <p className="text-xs font-bold text-indigo-600">{c.caseNumber}</p>
                  <p className="text-xs text-gray-700 truncate">{c.hospital?.name ?? 'Unknown Hospital'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-600">Stage completed</span>
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

export const EmployeeDashboard: React.FC = () => {
  const currentUser = useStore((s) => s.currentUser);
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

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Avatar name={currentUser.name} size="lg" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Welcome, {currentUser.name.split(' ')[0]}</h1>
            <p className="text-sm text-gray-500">{currentUser.department} • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>
      </div>

      <AttendanceSection />
      <LeaveApplySection />
      <LazyEmployeeRegister employeeId={currentUser.id} />
      <EmployeeQuickStats employeeId={currentUser.id} />
      <EmployeeCasesPanel
        employeeId={currentUser.id}
        onViewCase={setViewCase}
        onSubmitCase={setSubmitCase}
      />
    </div>
  );
};
