import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Download, Plus, ChevronUp, ChevronDown,
  Eye, MoreHorizontal, Calendar, Building2, User, ArrowUpDown, X, Trash2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import type { ImplantCase, Priority, WorkflowStage, CaseStatus } from '../types';
import { priorityColors, statusColors, stageColors, formatDate, formatCurrency } from '../utils/helpers';
import { CaseDetail } from './CaseDetail';

type SortKey = 'caseNumber' | 'hospital' | 'surgeryDate' | 'currentStage' | 'priority' | 'status';
type SortDir = 'asc' | 'desc';

const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];
const STAGES: WorkflowStage[] = ['Kit Preparation', 'Surgery', 'Cleaning', 'Audit', 'Billing', 'Collection', 'Completed'];
const STATUSES: CaseStatus[] = ['Active', 'Waiting For Approval', 'Approved', 'Completed', 'Rejected'];

const CreateCaseModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { createCase, hospitals, employees } = useStore();
  const [form, setForm] = useState({
    hospitalId: '',
    doctorName: '',
    surgeryDate: '',
    implantRequired: '',
    implantType: '',
    priority: 'Medium' as Priority,
    remarks: '',
    department: 'Stores' as Department,
    employeeId: '',
  });

  const DEPARTMENTS: Department[] = ['Stores', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Collection Executive'];
  const filteredEmployees = employees.filter(e => e.department === form.department && e.role === 'employee');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hospitalId || !form.doctorName || !form.surgeryDate || !form.implantRequired) {
      alert("Please fill in all required fields marked with an asterisk (*).");
      return;
    }
    const hospital = hospitals.find(h => h.id === form.hospitalId);
    if (!hospital) return;

    // Create a dynamic, inline Doctor object
    const doctor = {
      id: `doc-${Date.now()}`,
      name: form.doctorName.trim(),
      specialization: 'Surgeon',
      hospitalId: hospital.id,
      phone: '',
    };

    const assignedEmployee = employees.find(e => e.id === form.employeeId) || null;

    createCase({
      hospital,
      doctor,
      surgeryDate: form.surgeryDate,
      implantRequired: form.implantRequired,
      implantType: form.implantType,
      priority: form.priority,
      remarks: form.remarks,
      dueDate: form.surgeryDate,
      currentDepartment: form.department,
      assignedEmployee,
    });
    onClose();
    setForm({
      hospitalId: '',
      doctorName: '',
      surgeryDate: '',
      implantRequired: '',
      implantType: '',
      priority: 'Medium',
      remarks: '',
      department: 'Stores',
      employeeId: '',
    });
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white placeholder:text-gray-400";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1.5";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Implant Case" subtitle="Fill in the case details to begin the workflow" size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>Create Case</Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Hospital *</label>
            <select className={inputClass} value={form.hospitalId} onChange={e => setForm({...form, hospitalId: e.target.value, doctorName: ''})}>
              <option value="">Select hospital...</option>
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>
                  {h.branch ? `${h.name} — ${h.branch}` : h.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Doctor Name *</label>
            <input
              type="text"
              placeholder="Enter doctor's name"
              className={inputClass}
              value={form.doctorName}
              onChange={e => setForm({...form, doctorName: e.target.value})}
              disabled={!form.hospitalId}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Surgery Date *</label>
            <input type="date" className={inputClass} value={form.surgeryDate} onChange={e => setForm({...form, surgeryDate: e.target.value})} />
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <select className={inputClass} value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Priority})}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Initial Department</label>
            <select className={inputClass} value={form.department} onChange={e => setForm({...form, department: e.target.value as Department, employeeId: ''})}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Assign Employee</label>
            <select className={inputClass} value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})}>
              <option value="">Do not assign yet (Draft)</option>
              {filteredEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Implant Required *</label>
          <input type="text" className={inputClass} placeholder="e.g. Total Knee Replacement System" value={form.implantRequired} onChange={e => setForm({...form, implantRequired: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>Implant Type</label>
          <input type="text" className={inputClass} placeholder="e.g. Knee Implant, Hip Implant" value={form.implantType} onChange={e => setForm({...form, implantType: e.target.value})} />
        </div>
        <div>
          <label className={labelClass}>Remarks</label>
          <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Any special instructions or notes..." value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
        </div>
      </form>
    </Modal>
  );
};

export const Cases: React.FC = () => {
  const { cases, selectedCaseId, setSelectedCase, viewMode, deleteCase } = useStore();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('caseNumber');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [filterStage, setFilterStage] = useState<WorkflowStage | ''>('');
  const [filterStatus, setFilterStatus] = useState<CaseStatus | ''>('');
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const PAGE_SIZE = 8;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let result = [...cases];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.caseNumber.toLowerCase().includes(q) ||
        c.hospital.name.toLowerCase().includes(q) ||
        c.doctor.name.toLowerCase().includes(q) ||
        c.implantRequired.toLowerCase().includes(q)
      );
    }
    if (filterPriority) result = result.filter(c => c.priority === filterPriority);
    if (filterStage) result = result.filter(c => c.currentStage === filterStage);
    if (filterStatus) result = result.filter(c => c.status === filterStatus);

    result.sort((a, b) => {
      let av: string = '', bv: string = '';
      if (sortKey === 'caseNumber') { av = a.caseNumber; bv = b.caseNumber; }
      else if (sortKey === 'hospital') { av = a.hospital.name; bv = b.hospital.name; }
      else if (sortKey === 'surgeryDate') { av = a.surgeryDate; bv = b.surgeryDate; }
      else if (sortKey === 'currentStage') { av = a.currentStage; bv = b.currentStage; }
      else if (sortKey === 'priority') {
        const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return sortDir === 'asc'
          ? order[a.priority] - order[b.priority]
          : order[b.priority] - order[a.priority];
      }
      else if (sortKey === 'status') { av = a.status; bv = b.status; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return result;
  }, [cases, search, sortKey, sortDir, filterPriority, filterStage, filterStatus]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (selectedCaseId) {
    const theCase = cases.find(c => c.id === selectedCaseId);
    if (theCase) return <CaseDetail case={theCase} onBack={() => setSelectedCase(null)} />;
  }

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1">
      {sortKey === k ? (
        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </span>
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <CreateCaseModal isOpen={showCreate} onClose={() => setShowCreate(false)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Implant Cases</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} cases found</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} className="flex-1 sm:flex-none">Export</Button>
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)} className="flex-1 sm:flex-none">New Case</Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="mb-4">
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search cases, hospitals, doctors..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            icon={<Filter className="h-4 w-4" />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters {(filterPriority || filterStage || filterStatus) ? `(${[filterPriority, filterStage, filterStatus].filter(Boolean).length})` : ''}
          </Button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full flex items-center gap-3 flex-wrap overflow-hidden"
              >
                <select
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                  value={filterPriority}
                  onChange={e => { setFilterPriority(e.target.value as Priority | ''); setPage(0); }}
                >
                  <option value="">All Priorities</option>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                  value={filterStage}
                  onChange={e => { setFilterStage(e.target.value as WorkflowStage | ''); setPage(0); }}
                >
                  <option value="">All Stages</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value as CaseStatus | ''); setPage(0); }}
                >
                  <option value="">All Statuses</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {(filterPriority || filterStage || filterStatus) && (
                  <button
                    onClick={() => { setFilterPriority(''); setFilterStage(''); setFilterStatus(''); setPage(0); }}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Mobile card list */}
      <div className="lg:hidden space-y-3 mb-4">
        {paginated.map((c: ImplantCase) => {
          const sc = stageColors[c.currentStage];
          const pc = priorityColors[c.priority];
          const stc = statusColors[c.status];
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <button
                  onClick={() => setSelectedCase(c.id)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {c.caseNumber}
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`${pc} text-xs`}>{c.priority}</Badge>
                  <Badge className={`${stc} text-xs`}>{c.status}</Badge>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-gray-900 font-medium truncate">{c.hospital.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-gray-700 truncate">{c.doctor.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{formatDate(c.surgeryDate)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                  {c.currentStage}
                </Badge>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedCase(c.id)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {viewMode === 'admin' && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete case ${c.caseNumber}?`)) {
                          deleteCase(c.id);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {paginated.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No cases found</p>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  { key: 'caseNumber', label: 'Case ID', w: 'w-28' },
                  { key: 'hospital', label: 'Hospital', w: 'w-40' },
                  { key: null, label: 'Doctor', w: 'w-40' },
                  { key: 'surgeryDate', label: 'Surgery Date', w: 'w-32' },
                  { key: 'currentStage', label: 'Current Stage', w: 'w-36' },
                  { key: null, label: 'Assigned To', w: 'w-36' },
                  { key: 'priority', label: 'Priority', w: 'w-24' },
                  { key: 'status', label: 'Status', w: 'w-40' },
                  { key: null, label: 'Invoice', w: 'w-28' },
                  { key: null, label: 'Actions', w: 'w-24' },
                ].map(({ key, label, w }) => (
                  <th key={label} className={`${w} px-4 py-3 text-left`}>
                    <button
                      className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                      onClick={() => key && handleSort(key as SortKey)}
                    >
                      {label}
                      {key && <SortIcon k={key as SortKey} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((c: ImplantCase) => {
                const sc = stageColors[c.currentStage];
                const pc = priorityColors[c.priority];
                const stc = statusColors[c.status];
                return (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-gray-50/70 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelectedCase(c.id)}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {c.caseNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{c.hospital.name}</p>
                          <p className="text-xs text-gray-400">{c.hospital.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <User className="h-3 w-3 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-800 truncate max-w-[130px]">{c.doctor.name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[130px]">{c.doctor.specialization}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {formatDate(c.surgeryDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                        {c.currentStage}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.assignedEmployee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={c.assignedEmployee.name} size="xs" />
                          <div>
                            <p className="text-xs font-medium text-gray-800 truncate max-w-[100px]">{c.assignedEmployee.name}</p>
                            <p className="text-[10px] text-gray-400">{c.assignedEmployee.department}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className={`${pc} text-xs`}>
                        <div className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        {c.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className={`${stc} text-xs`}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.invoiceAmount ? (
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(c.invoiceAmount)}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedCase(c.id)}
                          className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {viewMode === 'admin' && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete case ${c.caseNumber}?`)) {
                                deleteCase(c.id);
                              }
                            }}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                            title="Delete Case"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {paginated.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No cases found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500 text-center sm:text-left">
            Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} cases
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-7 w-7 text-xs rounded-md transition-colors ${page === i ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Mobile pagination */}
      {filtered.length > 0 && (
        <div className="lg:hidden flex flex-col items-center gap-2 mt-2">
          <p className="text-xs text-gray-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-8 w-8 text-xs rounded-md transition-colors ${page === i ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FolderOpen = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
  </svg>
);
