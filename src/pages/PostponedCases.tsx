import React, { useMemo, useState } from 'react';
import { CalendarClock, Eye, Search, ArrowRight } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store/useStore';
import { getCurrentStageTeamDisplay, isPostponedCase } from '../lib/caseWorkflow';
import { formatDate, getStageStyle, getPriorityStyle } from '../utils/helpers';
import { getISTDateKey } from '../lib/attendance';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { AdminAccessGate } from '../components/layout/AdminAccessGate';

export const PostponedCases: React.FC = () => {
  const { cases, viewMode, setSelectedCase, setActiveTab } = useStore();
  const [search, setSearch] = useState('');

  const todayKey = getISTDateKey();

  const postponed = useMemo(() => {
    let list = cases.filter(isPostponedCase);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          c.hospital.name.toLowerCase().includes(q) ||
          c.doctor.name.toLowerCase().includes(q) ||
          (c.postponeReason ?? '').toLowerCase().includes(q),
      );
    }
    return list.sort(
      (a, b) => new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime(),
    );
  }, [cases, search]);

  const dueSoon = postponed.filter((c) => c.surgeryDate >= todayKey).length;
  const overdue = postponed.filter((c) => c.surgeryDate < todayKey).length;

  if (viewMode !== 'admin') {
    return <AdminAccessGate description="Postponed cases are only visible to administrators." />;
  }

  const openCase = (id: string) => {
    setSelectedCase(id);
    setActiveTab('cases');
  };

  return (
    <NexusPage maxWidthClass="max-w-[1400px]">
      <NexusPageHeader
        title="Postponed Cases"
        description="Surgeries rescheduled — workflow stage and kit location are unchanged until staff move the case forward."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-lg">
              <CalendarClock className="h-4 w-4 text-sky-600" />
              <span className="text-sm font-semibold text-sky-800">{postponed.length} postponed</span>
            </div>
            {overdue > 0 && (
              <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                {overdue} past new date — follow up
              </span>
            )}
            {dueSoon > 0 && (
              <span className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg">
                {dueSoon} upcoming
              </span>
            )}
          </div>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Search case, hospital, reason…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="nexus-field-input"
        />
      </div>

      {postponed.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center">
            <CalendarClock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No postponed cases</p>
            <p className="text-xs text-gray-500 mt-1">Use Postpone on a case detail when surgery is delayed.</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Hospital / Doctor</th>
                  <th className="px-4 py-3">Stage (kit here)</th>
                  <th className="px-4 py-3">Was → New date</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {postponed.map((c) => {
                  const sc = getStageStyle(c.currentStage);
                  const pc = getPriorityStyle(c.priority);
                  const pastNewDate = c.surgeryDate < todayKey;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-gray-900">{c.caseNumber}</p>
                        <Badge className={`${pc} text-[10px] mt-1`}>{c.priority}</Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-gray-800">{c.hospital.name}</p>
                        <p className="text-xs text-gray-500">{c.doctor.name}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-[10px]`}>
                          {c.currentStage}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-400 line-through">
                            {c.postponedFrom ? formatDate(c.postponedFrom) : '—'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                          <span className={pastNewDate ? 'text-amber-700 font-semibold' : 'text-gray-900 font-medium'}>
                            {formatDate(c.surgeryDate)}
                          </span>
                        </div>
                        {pastNewDate && (
                          <p className="text-[10px] text-amber-700 mt-0.5">New date passed</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top max-w-[220px]">
                        <p className="text-xs text-gray-700 line-clamp-3">{c.postponeReason}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {c.assignedEmployee ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={c.assignedEmployee.name} size="xs" />
                            <span className="text-xs text-gray-700 truncate max-w-[120px]">
                              {getCurrentStageTeamDisplay(c)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye className="h-3.5 w-3.5" />}
                          onClick={() => openCase(c.id)}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </NexusPage>
  );
};
