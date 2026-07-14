import React, { useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FolderOpen,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import type { CaseStatus, ImplantCase, Priority, WorkflowStage } from '../types';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  priorityColors,
  stageColors,
  statusColors,
} from '../utils/helpers';
import { CaseDetail } from './CaseDetail';
import { CaseCsvExportModal } from '../components/CaseCsvExportModal';

type SortKey = 'caseNumber' | 'hospital' | 'surgeryDate' | 'updatedAt' | 'status' | 'currentStage';
type SortDir = 'asc' | 'desc';
type HistoryTab = 'all' | 'in-progress' | 'past' | CaseStatus;

const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
const STAGES: WorkflowStage[] = [
  'Kit Preparation',
  'Surgery',
  'Cleaning',
  'Audit',
  'Billing',
  'Bill Submission',
  'Completed',
];

const HISTORY_TABS: { id: HistoryTab; label: string }[] = [
  { id: 'all', label: 'All Cases' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'past', label: 'Past / Closed' },
  { id: 'Approved', label: 'Approved' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Waiting For Approval', label: 'Awaiting Approval' },
  { id: 'Rejected', label: 'Rejected' },
  { id: 'Cancelled', label: 'Cancelled' },
  { id: 'Draft', label: 'Draft' },
];

const IN_PROGRESS: CaseStatus[] = ['Active', 'Waiting For Approval', 'Changes Requested', 'Approved'];
const PAST: CaseStatus[] = ['Completed', 'Cancelled', 'Rejected'];

function matchesHistoryTab(status: CaseStatus, tab: HistoryTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'in-progress') return IN_PROGRESS.includes(status);
  if (tab === 'past') return PAST.includes(status);
  return status === tab;
}

export const CaseHistory: React.FC = () => {
  const { cases, selectedCaseId, setSelectedCase, reloadFromDatabase } = useStore();
  const [search, setSearch] = useState('');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [filterStage, setFilterStage] = useState<WorkflowStage | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const PAGE_SIZE = 12;

  const stats = useMemo(() => ({
    total: cases.length,
    active: cases.filter((c) => c.status === 'Active').length,
    waiting: cases.filter((c) => c.status === 'Waiting For Approval').length,
    approved: cases.filter((c) => c.status === 'Approved').length,
    completed: cases.filter((c) => c.status === 'Completed').length,
    past: cases.filter((c) => PAST.includes(c.status)).length,
  }), [cases]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'updatedAt' || key === 'surgeryDate' ? 'desc' : 'asc');
    }
  };

  const filtered = useMemo(() => {
    let result = [...cases];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          c.hospital.name.toLowerCase().includes(q) ||
          c.doctor.name.toLowerCase().includes(q) ||
          c.implantRequired.toLowerCase().includes(q) ||
          (c.assignedEmployee?.name.toLowerCase().includes(q) ?? false),
      );
    }

    result = result.filter((c) => matchesHistoryTab(c.status, historyTab));
    if (filterPriority) result = result.filter((c) => c.priority === filterPriority);
    if (filterStage) result = result.filter((c) => c.currentStage === filterStage);

    result.sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortKey === 'caseNumber') {
        av = a.caseNumber;
        bv = b.caseNumber;
      } else if (sortKey === 'hospital') {
        av = a.hospital.name;
        bv = b.hospital.name;
      } else if (sortKey === 'surgeryDate') {
        av = a.surgeryDate;
        bv = b.surgeryDate;
      } else if (sortKey === 'updatedAt') {
        av = a.updatedAt;
        bv = b.updatedAt;
      } else if (sortKey === 'currentStage') {
        av = a.currentStage;
        bv = b.currentStage;
      } else if (sortKey === 'status') {
        av = a.status;
        bv = b.status;
      }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return result;
  }, [cases, search, historyTab, filterPriority, filterStage, sortKey, sortDir]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { bootstrapSupabaseData } = await import('../lib/database/bootstrap');
      await bootstrapSupabaseData();
      reloadFromDatabase();
    } finally {
      setRefreshing(false);
    }
  };

  if (selectedCaseId) {
    const theCase = cases.find((c) => c.id === selectedCaseId);
    if (theCase) return <CaseDetail case={theCase} onBack={() => setSelectedCase(null)} />;
  }

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1 inline-flex">
      {sortKey === k ? (
        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : null}
    </span>
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full min-w-0">
      <CaseCsvExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        cases={filtered}
        title="Export Case History to CSV"
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Archive className="h-5 w-5 text-indigo-600" />
            Case History
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Full archive — active, approved, completed, and all past cases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={() => setShowExport(true)}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, tone: 'text-gray-900' },
          { label: 'Active', value: stats.active, tone: 'text-indigo-600' },
          { label: 'Awaiting Approval', value: stats.waiting, tone: 'text-amber-600' },
          { label: 'Approved', value: stats.approved, tone: 'text-emerald-600' },
          { label: 'Completed', value: stats.completed, tone: 'text-green-700' },
          { label: 'Past / Closed', value: stats.past, tone: 'text-gray-600' },
        ].map(({ label, value, tone }) => (
          <Card key={label} className="p-4">
            <p className={`text-2xl font-bold ${tone}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-4 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {HISTORY_TABS.map((tab) => {
            const count =
              tab.id === 'all'
                ? cases.length
                : cases.filter((c) => matchesHistoryTab(c.status, tab.id)).length;
            const active = historyTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setHistoryTab(tab.id);
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search case ID, hospital, doctor, employee..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            value={filterStage}
            onChange={(e) => {
              setFilterStage(e.target.value as WorkflowStage | '');
              setPage(0);
            }}
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            value={filterPriority}
            onChange={(e) => {
              setFilterPriority(e.target.value as Priority | '');
              setPage(0);
            }}
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </Card>

      <p className="text-xs text-gray-500 mb-3">
        Showing {filtered.length} case{filtered.length === 1 ? '' : 's'}
        {historyTab !== 'all' ? ` in "${HISTORY_TABS.find((t) => t.id === historyTab)?.label}"` : ''}
      </p>

      <div className="lg:hidden space-y-3 mb-4">
        {paginated.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <button
                onClick={() => setSelectedCase(c.id)}
                className="text-sm font-semibold text-indigo-600"
              >
                {c.caseNumber}
              </button>
              <Badge className={`${statusColors[c.status]} text-xs`}>{c.status}</Badge>
            </div>
            <div className="space-y-1.5 text-sm text-gray-700">
              <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-gray-400" />{c.hospital.name}</p>
              <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-gray-400" />{c.doctor.name}</p>
              <p className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-gray-400" />Surgery: {formatDate(c.surgeryDate)}</p>
              <p className="text-xs text-gray-500">Updated: {formatDateTime(c.updatedAt)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Badge className={`${stageColors[c.currentStage].bg} ${stageColors[c.currentStage].text} text-xs`}>
                {c.currentStage}
              </Badge>
              <Button variant="outline" size="sm" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setSelectedCase(c.id)}>
                View
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {[
                  { key: 'caseNumber' as SortKey, label: 'Case ID' },
                  { key: 'hospital' as SortKey, label: 'Hospital' },
                  { key: null, label: 'Doctor' },
                  { key: 'surgeryDate' as SortKey, label: 'Surgery' },
                  { key: 'currentStage' as SortKey, label: 'Stage' },
                  { key: null, label: 'Assigned' },
                  { key: 'status' as SortKey, label: 'Status' },
                  { key: 'updatedAt' as SortKey, label: 'Last Updated' },
                  { key: null, label: 'Invoice' },
                  { key: null, label: '' },
                ].map(({ key, label }) => (
                  <th key={label || 'actions'} className="px-4 py-3 text-left">
                    {key ? (
                      <button
                        className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
                        onClick={() => handleSort(key)}
                      >
                        {label}
                        <SortIcon k={key} />
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedCase(c.id)}
                      className="text-sm font-semibold text-indigo-600 hover:underline"
                    >
                      {c.caseNumber}
                    </button>
                    <p className="text-[10px] text-gray-400 mt-0.5">Created {formatDate(c.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{c.hospital.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.doctor.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(c.surgeryDate)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`${stageColors[c.currentStage].bg} ${stageColors[c.currentStage].text} text-xs`}>
                      {c.currentStage}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {c.assignedEmployee ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={c.assignedEmployee.name} size="sm" />
                        <span className="text-sm text-gray-700 truncate max-w-[120px]">{c.assignedEmployee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`${statusColors[c.status]} text-xs`}>{c.status}</Badge>
                    <Badge className={`${priorityColors[c.priority]} text-[10px] mt-1`}>{c.priority}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDateTime(c.updatedAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.invoiceAmount ? formatCurrency(c.invoiceAmount) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedCase(c.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                      title="View case"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No cases match your filters</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
