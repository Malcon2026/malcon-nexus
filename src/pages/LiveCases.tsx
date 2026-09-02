import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RefreshCw, Building2, User, Calendar, Eye, Edit3,
  AlertTriangle, IndianRupee, X, Trash2, Stethoscope, Package,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { EditCaseModal } from '../components/EditCaseModal';
import { useStore } from '../store/useStore';
import { isCaseAssignedToEmployee, isFcfsPoolCase } from '../lib/caseWorkflow';
import type { ImplantCase, Priority, WorkflowStage } from '../types';
import { priorityColors, stageColors, formatDate, formatCurrency } from '../utils/helpers';

const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
const STAGES: WorkflowStage[] = [
  'Kit Preparation', 'Delivery', 'Surgery', 'Pickup from Hospital', 'Cleaning & Audit', 'Restock', 'Billing', 'Bill Submission',
];

const paymentBadge: Record<NonNullable<ImplantCase['paymentStatus']>, string> = {
  Pending: 'bg-gray-100 text-gray-600 border-gray-200',
  Partial: 'bg-amber-50 text-amber-700 border-amber-200',
  Collected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STAGE_TILE_LABELS: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Kit Prep',
  'Delivery': 'Delivery',
  'Surgery': 'Surgery',
  'Pickup from Hospital': 'Pickup',
  'Cleaning & Audit': 'Cleaning',
  'Restock': 'Restock',
  'Billing': 'Billing',
  'Bill Submission': 'Bill Submit',
  'Completed': 'Completed',
};

export const LiveCases: React.FC = () => {
  const { cases, viewMode, currentUser, setSelectedCase, setActiveTab, reloadFromDatabase, deleteCase } = useStore();
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<WorkflowStage | ''>('');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [filterPoolOnly, setFilterPoolOnly] = useState(false);
  const [editCaseId, setEditCaseId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const canEdit = (c: ImplantCase) => viewMode === 'admin' || isCaseAssignedToEmployee(c, currentUser);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { bootstrapSupabaseData } = await import('../lib/database/bootstrap');
      const role = viewMode === 'admin' ? 'admin' : 'employee';
      await bootstrapSupabaseData(role, role === 'employee' ? { employeeId: currentUser.id } : undefined, { force: true });
      reloadFromDatabase();
    } catch (err) {
      console.error('[LiveCases] refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const baseLiveCases = useMemo(() => {
    let result = cases.filter((c) => c.status !== 'Completed' && c.status !== 'Cancelled' && c.currentStage !== 'Completed');

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.caseNumber.toLowerCase().includes(q) ||
        c.hospital.name.toLowerCase().includes(q) ||
        c.doctor.name.toLowerCase().includes(q) ||
        c.implantRequired.toLowerCase().includes(q) ||
        (c.implantType?.toLowerCase().includes(q) ?? false) ||
        (c.implantCompany?.toLowerCase().includes(q) ?? false) ||
        (c.assignedEmployee?.name.toLowerCase().includes(q) ?? false)
      );
    }
    if (filterPriority) result = result.filter((c) => c.priority === filterPriority);
    if (filterPoolOnly) result = result.filter(isFcfsPoolCase);

    return result;
  }, [cases, search, filterPriority, filterPoolOnly]);

  const stageCounts = useMemo(() => {
    const counts = { all: baseLiveCases.length } as Record<'all' | WorkflowStage, number>;
    for (const stage of STAGES) {
      counts[stage] = baseLiveCases.filter((c) => c.currentStage === stage).length;
    }
    return counts;
  }, [baseLiveCases]);

  const liveCases = useMemo(() => {
    let result = filterStage
      ? baseLiveCases.filter((c) => c.currentStage === filterStage)
      : baseLiveCases;

    const priorityOrder: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return [...result].sort((a, b) => {
      const p = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (p !== 0) return p;
      return new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime();
    });
  }, [baseLiveCases, filterStage]);

  return (
    <div className="p-4 sm:p-6 max-w-[1800px] mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Live Cases</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All active cases at a glance — {liveCases.length} in progress
          </p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search case, hospital, surgery, doctor, product..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Stage filter chips — compact; tap to filter */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => setFilterStage('')}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-full border transition-colors truncate ${
              !filterStage
                ? 'border-gray-900 bg-gray-900 text-white ring-2 ring-gray-900 ring-offset-1'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All {stageCounts.all}
          </button>

          {STAGES.map((stage) => {
            const sc = stageColors[stage];
            const active = filterStage === stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setFilterStage(active ? '' : stage)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-full border transition-colors truncate ${
                  active
                    ? `${sc.bg} ${sc.text} ${sc.border} ring-2 ring-gray-900 ring-offset-1`
                    : `${sc.bg} ${sc.text} ${sc.border} opacity-85 hover:opacity-100`
                }`}
              >
                {STAGE_TILE_LABELS[stage]} {stageCounts[stage]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRIORITIES.map((p) => {
            const pc = priorityColors[p];
            const active = filterPriority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPriority(active ? '' : p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  active ? `${pc} ring-2 ring-gray-900 ring-offset-1` : `${pc} opacity-80 hover:opacity-100`
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFilterPoolOnly((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              filterPoolOnly
                ? 'border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-400 ring-offset-1'
                : 'border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Open pool
          </button>
          {(filterStage || filterPriority || search || filterPoolOnly) && (
            <button
              type="button"
              onClick={() => { setFilterStage(''); setFilterPriority(''); setSearch(''); setFilterPoolOnly(false); }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-600 hover:text-red-800 font-medium"
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {liveCases.map((c, idx) => {
            const sc = stageColors[c.currentStage];
            const pc = priorityColors[c.priority];
            const isOverdue = new Date(c.surgeryDate) < new Date() && c.status !== 'Completed';
            const isWaiting = c.status === 'Waiting For Approval';

            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden group"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => { setSelectedCase(c.id); setActiveTab('cases'); }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-indigo-600">{c.caseNumber}</p>
                    <Badge className={`${pc} text-[10px] shrink-0`}>{c.priority}</Badge>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {c.hospital.name}
                      {c.hospital.branch ? (
                        <span className="font-normal text-gray-500"> · {c.hospital.branch}</span>
                      ) : null}
                    </span>
                  </div>

                  {c.implantRequired ? (
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Surgery</p>
                        <p className="text-xs font-medium text-gray-800 line-clamp-2">{c.implantRequired}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-1.5 mb-1.5">
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Doctor</p>
                      <p className="text-xs text-gray-700 truncate">Dr. {c.doctor.name}</p>
                    </div>
                  </div>

                  {(c.implantType || c.implantCompany) && (
                    <div className="flex items-start gap-1.5 mb-3">
                      <Package className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Product</p>
                        <p className="text-xs text-gray-600 truncate">
                          {[c.implantType, c.implantCompany].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {!c.implantType && !c.implantCompany && <div className="mb-2" />}

                  <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-[11px] mb-2`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                    {c.currentStage}
                  </Badge>

                  {c.cancelReason && (
                    <div className="flex items-center gap-1 mt-1 mb-2 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg">
                      <span className="text-[10px] text-amber-800 font-medium">Cancelled — return unused kit</span>
                    </div>
                  )}

                  {c.postponeReason && !c.cancelReason && (
                    <div className="flex items-center gap-1 mt-1 mb-2 px-2 py-1 bg-sky-50 border border-sky-100 rounded-lg">
                      <span className="text-[10px] text-sky-800 font-medium">Postponed</span>
                    </div>
                  )}

                  {isWaiting && (
                    <div className="flex items-center gap-1 mt-1 mb-2 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-[10px] text-amber-700 font-medium">Awaiting Admin</span>
                    </div>
                  )}

                  {isFcfsPoolCase(c) && (
                    <div className="flex items-center gap-1 mt-1 mb-2 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg">
                      <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wide">Open pool</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                    {c.assignedEmployee ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar name={c.assignedEmployee.name} size="xs" />
                        <span className="text-xs text-gray-700 truncate max-w-[90px]">{c.assignedEmployee.name.split(' ')[0]}</span>
                      </div>
                    ) : isFcfsPoolCase(c) ? (
                      <div className="flex items-center gap-1 text-amber-600">
                        <User className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Pool</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400">
                        <User className="h-3.5 w-3.5" />
                        <span className="text-xs">Unassigned</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                      {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(c.surgeryDate)}
                    </div>
                  </div>

                  {(c.paymentStatus || c.invoiceAmount) && (
                    <div className="flex items-center justify-between mt-2">
                      <Badge className={`${paymentBadge[c.paymentStatus ?? 'Pending']} text-[10px]`}>
                        <IndianRupee className="h-2.5 w-2.5" />
                        {c.paymentStatus ?? 'Pending'}
                      </Badge>
                      {c.invoiceAmount ? (
                        <span className="text-xs font-medium text-gray-700">{formatCurrency(c.invoiceAmount)}</span>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setSelectedCase(c.id); setActiveTab('cases'); }}
                    className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-gray-100"
                  >
                    <Eye className="h-3 w-3" /> View
                  </button>
                  {canEdit(c) && (
                    <button
                      onClick={() => setEditCaseId(c.id)}
                      className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-md hover:bg-indigo-50"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                  )}
                  {viewMode === 'admin' && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete case ${c.caseNumber}? This cannot be undone.`)) {
                          void deleteCase(c.id);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {liveCases.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <p className="text-sm font-medium">No live cases match your filters</p>
          </div>
        )}
      </div>

      {editCaseId && (() => {
        const editingCase = cases.find((c) => c.id === editCaseId);
        return editingCase ? (
          <EditCaseModal isOpen={true} onClose={() => setEditCaseId(null)} case={editingCase} />
        ) : null;
      })()}
    </div>
  );
};
