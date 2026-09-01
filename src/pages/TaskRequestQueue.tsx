import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, User, Building2, CheckCircle, Eye } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store/useStore';
import { groupPendingRequestsByCase, isFcfsPoolCase } from '../lib/caseTaskRequests';
import { priorityColors, stageColors, formatDate, timeAgo } from '../utils/helpers';

export const TaskRequestQueue: React.FC = () => {
  const {
    cases,
    caseTaskRequests,
    setSelectedCase,
    setActiveTab,
    reloadFromDatabase,
    approveTaskRequest,
  } = useStore();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { bootstrapSupabaseData } = await import('../lib/database/bootstrap');
        await bootstrapSupabaseData('admin', undefined, { force: true });
        if (!cancelled) reloadFromDatabase();
      } catch (err) {
        console.error('[TaskRequestQueue] refresh failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadFromDatabase]);

  const grouped = useMemo(() => groupPendingRequestsByCase(caseTaskRequests), [caseTaskRequests]);
  const entries = useMemo(() => {
    return [...grouped.entries()]
      .map(([caseId, requests]) => {
        const c = cases.find((x) => x.id === caseId);
        return { caseId, c, requests };
      })
      .filter((e) => e.requests.length > 0 && e.c && isFcfsPoolCase(e.c))
      .sort((a, b) => {
        const ta = new Date(a.requests[0]?.requestedAt ?? 0).getTime();
        const tb = new Date(b.requests[0]?.requestedAt ?? 0).getTime();
        return ta - tb;
      });
  }, [grouped, cases]);

  const totalPending = entries.reduce((n, e) => n + e.requests.length, 0);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Task Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Employees request pool-stage cases — you choose who gets assigned
          </p>
        </div>
        {totalPending > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">{totalPending} pending</span>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No pending requests</h3>
          <p className="text-sm text-gray-500 mt-1">When staff request RTD, billing, or bill submission tasks, they appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(({ caseId, c, requests }, idx) => {
            const sc = c ? stageColors[c.currentStage] : stageColors['Pickup from Hospital'];
            const pc = c ? priorityColors[c.priority] : priorityColors.Medium;
            return (
              <motion.div
                key={caseId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                <Card>
                  <CardBody>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-indigo-600">{c?.caseNumber ?? requests[0]?.caseNumber}</span>
                          {c && (
                            <>
                              <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>{c.currentStage}</Badge>
                              <Badge className={`${pc} text-xs`}>{c.priority}</Badge>
                            </>
                          )}
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            {requests.length} request{requests.length === 1 ? '' : 's'}
                          </Badge>
                        </div>
                        {c && (
                          <p className="text-sm text-gray-700 flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            {c.hospital.name} · Surgery {formatDate(c.surgeryDate)}
                          </p>
                        )}
                      </div>
                      {c && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Eye className="h-3.5 w-3.5" />}
                          onClick={() => {
                            setSelectedCase(c.id);
                            setActiveTab('cases');
                          }}
                        >
                          View case
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {requests.map((r) => (
                        <div
                          key={r.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/80"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={r.employeeName} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{r.employeeName}</p>
                              <p className="text-xs text-gray-500">
                                {r.employeeDepartment} · requested {timeAgo(r.requestedAt)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={approvingId === r.id}
                            icon={<User className="h-3.5 w-3.5" />}
                            onClick={async () => {
                              setApprovingId(r.id);
                              const { error } = await approveTaskRequest(r.id);
                              setApprovingId(null);
                              if (error) alert(error);
                            }}
                          >
                            {approvingId === r.id ? 'Assigning…' : 'Assign'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
