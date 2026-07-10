import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Building2, User, FileText,
  CheckCircle, XCircle, MessageSquare, Clock, ChevronRight,
  Download, Upload, AlertTriangle, Send, Clipboard, Edit3
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import type { ImplantCase, Employee, WorkflowStage } from '../types';
import {
  priorityColors, statusColors, stageColors, departmentColors,
  formatDate, formatDateTime, timeAgo, formatCurrency, getStageIndex
} from '../utils/helpers';

const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation', 'Surgery', 'Cleaning', 'Audit', 'Billing', 'Collection', 'Completed'
];

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Submit to Admin',
  'Surgery': 'Surgery Completed',
  'Cleaning': 'Cleaning Completed',
  'Audit': 'Audit Completed',
  'Billing': 'Invoice Generated',
  'Collection': 'Collection Completed',
  'Completed': 'Case Closed',
};

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'approve' | 'reject' | 'changes';
  caseId: string;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose, type, caseId }) => {
  const { approveStage, rejectStage, requestChanges } = useStore();
  const [notes, setNotes] = useState('');

  const config = {
    approve: { title: 'Approve Stage', subtitle: 'Add optional approval notes', color: 'success' as const, label: 'Approve' },
    reject: { title: 'Reject Stage', subtitle: 'Provide rejection reason', color: 'danger' as const, label: 'Reject' },
    changes: { title: 'Request Changes', subtitle: 'Describe the changes needed', color: 'warning' as const, label: 'Request Changes' },
  };

  const handleSubmit = () => {
    if (type === 'approve') approveStage(caseId, notes);
    else if (type === 'reject') rejectStage(caseId, notes);
    else requestChanges(caseId, notes);
    setNotes('');
    onClose();
  };

  const c = config[type];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={c.title} subtitle={c.subtitle} size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant={c.color} size="sm" onClick={handleSubmit}>{c.label}</Button>
        </div>
      }
    >
      <div className="p-6">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes</label>
        <textarea
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          rows={4}
          placeholder="Add your notes here..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
};

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  nextStage: WorkflowStage;
}

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, caseId, nextStage }) => {
  const { assignEmployee, employees } = useStore();

  const stageToDepart: Record<WorkflowStage, Department> = {
    'Kit Preparation': 'Stores',
    'Surgery': 'Scrub Person',
    'Cleaning': 'Cleaning Department',
    'Audit': 'Stores Audit',
    'Billing': 'Accounts',
    'Collection': 'Collection Executive',
    'Completed': 'Admin',
  };

  const DEPT_TO_STAGE: Record<string, WorkflowStage> = {
    'Stores': 'Kit Preparation',
    'Scrub Person': 'Surgery',
    'Cleaning Department': 'Cleaning',
    'Stores Audit': 'Audit',
    'Accounts': 'Billing',
    'Collection Executive': 'Collection',
    'Admin': 'Completed',
  };

  const initialDept = stageToDepart[nextStage] || 'Stores';
  const [selectedDept, setSelectedDept] = useState<Department>(initialDept);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const DEPARTMENTS: Department[] = ['Stores', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Collection Executive'];
  const deptEmployees = employees.filter(e => e.department === selectedDept && e.role === 'employee');

  const handleAssign = () => {
    if (!selectedEmp) return;
    const targetStage = DEPT_TO_STAGE[selectedDept] || nextStage;
    assignEmployee(caseId, selectedEmp, targetStage);
    setSelectedEmp(null);
    onClose();
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white placeholder:text-gray-400 mb-4";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1.5";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Workflow Stage" subtitle="Select a department and an employee to assign this case" size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleAssign} disabled={!selectedEmp}>Assign Employee</Button>
        </div>
      }
    >
      <div className="p-6">
        <div>
          <label className={labelClass}>Department</label>
          <select
            className={inputClass}
            value={selectedDept}
            onChange={e => {
              setSelectedDept(e.target.value as Department);
              setSelectedEmp(null);
            }}
          >
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <label className={labelClass}>Select Employee from {selectedDept}</label>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {deptEmployees.map(emp => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmp(emp)}
              className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedEmp?.id === emp.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
            >
              <Avatar name={emp.name} size="md" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                <p className="text-xs text-gray-500">{emp.email}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{emp.casesCompleted} completed</span>
                  <span>•</span>
                  <span>{emp.casesActive} active</span>
                </div>
              </div>
              <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 border-gray-300">
                {selectedEmp?.id === emp.id && <div className="h-2 w-2 bg-gray-900 rounded-full" />}
              </div>
            </div>
          ))}
          {deptEmployees.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No employees registered in this department.</p>
          )}
        </div>
      </div>
    </Modal>
  );
};

interface SubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  stage: WorkflowStage;
}

const SubmitModal: React.FC<SubmitModalProps> = ({ isOpen, onClose, caseId, stage }) => {
  const { submitStage } = useStore();
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    submitStage(caseId, notes);
    setNotes('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={STAGE_ACTIONS[stage]} subtitle="Submit your work to admin for review" size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} icon={<Send className="h-4 w-4" />}>Submit to Admin</Button>
        </div>
      }
    >
      <div className="p-6">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Completion Notes *</label>
        <textarea
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          rows={4}
          placeholder="Describe what was completed, any issues found, items used, etc..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <p className="text-xs text-gray-400 mt-2">Your submission will be reviewed by the Admin before proceeding to the next stage.</p>
      </div>
    </Modal>
  );
};

interface EditCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  case: ImplantCase;
}

const EditCaseModal: React.FC<EditCaseModalProps> = ({ isOpen, onClose, case: c }) => {
  const { updateCase, hospitals } = useStore();
  const [form, setForm] = useState({
    hospitalId: c.hospital.id,
    doctorName: c.doctor.name,
    surgeryDate: c.surgeryDate,
    implantRequired: c.implantRequired,
    implantType: c.implantType,
    priority: c.priority,
    remarks: c.remarks || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hospitalId || !form.doctorName || !form.surgeryDate || !form.implantRequired) {
      alert("Please fill in all required fields marked with an asterisk (*).");
      return;
    }
    const hospital = hospitals.find(h => h.id === form.hospitalId);
    if (!hospital) return;

    // Create inline doctor object
    const doctor = {
      id: c.doctor.id.startsWith('doc-') ? c.doctor.id : `doc-${Date.now()}`,
      name: form.doctorName.trim(),
      specialization: 'Surgeon',
      hospitalId: hospital.id,
      phone: '',
    };

    updateCase(c.id, {
      hospital,
      doctor,
      surgeryDate: form.surgeryDate,
      implantRequired: form.implantRequired,
      implantType: form.implantType,
      priority: form.priority,
      remarks: form.remarks,
      dueDate: form.surgeryDate,
    });
    onClose();
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white placeholder:text-gray-400";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1.5";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Implant Case" subtitle={`Modify details for Case ${c.caseNumber}`} size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>Save Changes</Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Surgery Date *</label>
            <input type="date" className={inputClass} value={form.surgeryDate} onChange={e => setForm({...form, surgeryDate: e.target.value})} />
          </div>
          <div>
            <label className={labelClass}>Priority *</label>
            <select className={inputClass} value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Priority})}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Implant Required *</label>
            <input type="text" className={inputClass} placeholder="e.g. Knee Implant" value={form.implantRequired} onChange={e => setForm({...form, implantRequired: e.target.value})} />
          </div>
          <div>
            <label className={labelClass}>Implant Type</label>
            <input type="text" className={inputClass} placeholder="e.g. Kneeed" value={form.implantType} onChange={e => setForm({...form, implantType: e.target.value})} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Remarks / Notes</label>
          <textarea rows={3} className={inputClass} placeholder="Add any special instructions..." value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
        </div>
      </form>
    </Modal>
  );
};

interface CaseDetailProps {
  case: ImplantCase;
  onBack: () => void;
}

export const CaseDetail: React.FC<CaseDetailProps> = ({ case: c, onBack }) => {
  const { viewMode, currentUser, updateCase, hospitals, doctors, closeCase } = useStore();
  const [approvalModal, setApprovalModal] = useState<'approve' | 'reject' | 'changes' | null>(null);
  const [assignStage, setAssignStage] = useState<WorkflowStage | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState<'overview' | 'stages' | 'docs' | 'activity' | 'comments'>('overview');

  const currentStageIdx = getStageIndex(c.currentStage);
  const sc = stageColors[c.currentStage];
  const pc = priorityColors[c.priority];
  const stc = statusColors[c.status];

  const nextStage = WORKFLOW_STAGES[currentStageIdx + 1] as WorkflowStage | undefined;
  const isAssignedToCurrentUser = c.assignedEmployee?.id === currentUser.id;
  const isWaitingApproval = c.status === 'Waiting For Approval';
  const isApproved = c.status === 'Approved';
  const isActive = c.status === 'Active';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Clipboard className="h-3.5 w-3.5" /> },
    { id: 'stages', label: 'Stage Progress', icon: <ChevronRight className="h-3.5 w-3.5" /> },
    { id: 'docs', label: 'Documents', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'activity', label: 'Activity', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'comments', label: 'Comments', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {approvalModal && (
        <ApprovalModal
          isOpen={true}
          onClose={() => setApprovalModal(null)}
          type={approvalModal}
          caseId={c.id}
        />
      )}
      {assignStage && (
        <AssignModal
          isOpen={true}
          onClose={() => setAssignStage(null)}
          caseId={c.id}
          nextStage={assignStage}
        />
      )}
      {showSubmit && (
        <SubmitModal isOpen={showSubmit} onClose={() => setShowSubmit(false)} caseId={c.id} stage={c.currentStage} />
      )}
      {showEdit && (
        <EditCaseModal isOpen={showEdit} onClose={() => setShowEdit(false)} case={c} />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <button onClick={onBack} className="mt-0.5 p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">{c.caseNumber}</h1>
              <Badge className={`${stc} text-xs`}>{c.status}</Badge>
              <Badge className={`${pc} text-xs`}>{c.priority}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 break-words">{c.implantRequired} • {c.hospital.name} • {c.doctor.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
          {viewMode === 'admin' && (
            <>
              {isWaitingApproval && (
                <>
                  <Button variant="success" size="sm" icon={<CheckCircle className="h-4 w-4" />} onClick={() => setApprovalModal('approve')}>Approve</Button>
                  <Button variant="danger" size="sm" icon={<XCircle className="h-4 w-4" />} onClick={() => setApprovalModal('reject')}>Reject</Button>
                  <Button variant="warning" size="sm" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => setApprovalModal('changes')}>Request Changes</Button>
                </>
              )}
              {c.status === 'Draft' && (
                <Button variant="primary" size="sm" icon={<User className="h-4 w-4" />} onClick={() => setAssignStage(c.currentStage)}>Assign Employee</Button>
              )}
              {isApproved && nextStage && nextStage !== 'Completed' && (
                <Button variant="primary" size="sm" icon={<User className="h-4 w-4" />} onClick={() => setAssignStage(nextStage)}>Assign Next Stage</Button>
              )}
              {isActive && c.currentStage !== 'Completed' && (
                <Button variant="outline" size="sm" icon={<User className="h-4 w-4" />} onClick={() => setAssignStage(c.currentStage)}>Reassign</Button>
              )}
              {isApproved && nextStage === 'Completed' && (
                <Button variant="success" size="sm" icon={<CheckCircle className="h-4 w-4" />} onClick={() => closeCase(c.id)}>Close Case</Button>
              )}
            </>
          )}
          {viewMode === 'employee' && isAssignedToCurrentUser && isActive && (
            <Button variant="primary" size="sm" icon={<Send className="h-4 w-4" />} onClick={() => setShowSubmit(true)}>
              {STAGE_ACTIONS[c.currentStage]}
            </Button>
          )}
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>Export</Button>
          {viewMode === 'admin' && (
            <Button variant="outline" size="sm" icon={<Edit3 className="h-4 w-4" />} onClick={() => setShowEdit(true)}>Edit</Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex items-center gap-0 min-w-[480px] sm:min-w-0">
          {WORKFLOW_STAGES.map((stage, idx) => {
            const completed = idx < currentStageIdx;
            const current = idx === currentStageIdx;
            const pending = idx > currentStageIdx;
            const sc2 = stageColors[stage];
            return (
              <React.Fragment key={stage}>
                <div className={`flex flex-col items-center gap-1 ${idx === 0 ? 'flex-none' : 'flex-1'}`}>
                  <div className={`h-2.5 w-full rounded-full transition-all ${completed ? 'bg-gray-900' : current ? `${sc2.dot} opacity-80` : 'bg-gray-100'}`} />
                  <span className={`text-[9px] font-medium whitespace-nowrap ${current ? 'text-gray-900' : pending ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stage.split(' ')[0]}
                  </span>
                </div>
                {idx < WORKFLOW_STAGES.length - 1 && <div className="w-2" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 mb-6 overflow-x-auto -mx-1 px-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTabLocal(tab.id as typeof activeTabLocal)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${activeTabLocal === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={activeTabLocal} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTabLocal === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Case Info */}
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900">Case Information</h3></CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {[
                      { label: 'Case Number', value: c.caseNumber },
                      { label: 'Surgery Date', value: formatDate(c.surgeryDate) },
                      { label: 'Implant Required', value: c.implantRequired },
                      { label: 'Implant Type', value: c.implantType || '—' },
                      { label: 'Priority', value: c.priority },
                      { label: 'Due Date', value: formatDate(c.dueDate) },
                      { label: 'Created By', value: c.createdBy },
                      { label: 'Created At', value: formatDate(c.createdAt) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                  {c.remarks && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Remarks</p>
                      <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{c.remarks}</p>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Current Stage */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Current Stage</h3>
                    <Badge className={`${sc.bg} ${sc.text} ${sc.border}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                      {c.currentStage}
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody>
                  {c.assignedEmployee ? (
                    <div className="flex items-center gap-4">
                      <Avatar name={c.assignedEmployee.name} size="lg" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.assignedEmployee.name}</p>
                        <p className="text-xs text-gray-500">{c.assignedEmployee.email}</p>
                        <Badge className={`${departmentColors[c.assignedEmployee.department]} mt-1 text-xs`}>
                          {c.assignedEmployee.department}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">No employee assigned</p>
                        <p className="text-xs text-gray-400">Admin needs to assign an employee to continue</p>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Billing Info */}
              {c.invoiceAmount && c.invoiceAmount > 0 && (
                <Card>
                  <CardHeader><h3 className="text-sm font-semibold text-gray-900">Billing & Payment</h3></CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <div>
                        <p className="text-xs text-gray-500">Invoice Amount</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(c.invoiceAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Collected</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(c.collectedAmount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Payment Status</p>
                        <Badge className={c.paymentStatus === 'Collected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 mt-1' : 'bg-amber-50 text-amber-700 border-amber-200 mt-1'}>
                          {c.paymentStatus || 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Hospital */}
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Building2 className="h-4 w-4 text-gray-400" /> Hospital Details</h3></CardHeader>
                <CardBody className="space-y-2">
                  {[
                    { label: 'Name', value: c.hospital.name },
                    ...(c.hospital.branch ? [{ label: 'Branch', value: c.hospital.branch }] : []),
                    { label: 'City', value: c.hospital.city },
                    { label: 'Contact', value: c.hospital.contactPerson },
                    ...(c.hospital.phone ? [{ label: 'Phone', value: c.hospital.phone }] : []),
                    { label: 'Email', value: c.hospital.email },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-900 text-right max-w-[150px] truncate">{value}</span>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* Doctor */}
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /> Doctor Details</h3></CardHeader>
                <CardBody>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar name={c.doctor.name} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.doctor.name}</p>
                      <p className="text-xs text-gray-500">{c.doctor.specialization}</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-800">{c.doctor.phone}</span>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {activeTabLocal === 'stages' && (
          <div className="space-y-3">
            {c.stages.map((stage, idx) => {
              const sc2 = stageColors[stage.stage];
              const isCurrentStage = idx === currentStageIdx;
              const isDone = idx < currentStageIdx || stage.status === 'Approved';
              return (
                <Card key={stage.stage} className={isCurrentStage ? 'ring-2 ring-indigo-200' : ''}>
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${isDone ? 'bg-gray-900 text-white' : isCurrentStage ? `${sc2.bg} ${sc2.text}` : 'bg-gray-100 text-gray-400'}`}>
                        {isDone ? <CheckCircle className="h-5 w-5" /> : idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <h4 className="text-sm font-semibold text-gray-900">{stage.stage}</h4>
                            <Badge className={`text-xs ${isDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isCurrentStage ? `${sc2.bg} ${sc2.text} ${sc2.border}` : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                              {stage.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            {stage.assignedAt && <span>Assigned: {formatDate(stage.assignedAt)}</span>}
                            {stage.submittedAt && <span>Submitted: {formatDate(stage.submittedAt)}</span>}
                            {stage.approvedAt && <span>Approved: {formatDate(stage.approvedAt)}</span>}
                          </div>
                        </div>
                        {stage.assignedEmployee && (
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar name={stage.assignedEmployee.name} size="xs" />
                            <span className="text-xs text-gray-600">{stage.assignedEmployee.name}</span>
                            <Badge className={`${departmentColors[stage.assignedEmployee.department]} text-[10px]`}>{stage.assignedEmployee.department}</Badge>
                          </div>
                        )}
                        {stage.notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-500 font-medium mb-0.5">Employee Notes</p>
                            <p className="text-xs text-gray-700">{stage.notes}</p>
                          </div>
                        )}
                        {stage.adminNotes && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-600 font-medium mb-0.5">Admin Notes</p>
                            <p className="text-xs text-gray-700">{stage.adminNotes}</p>
                          </div>
                        )}
                        {stage.documents.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            {stage.documents.map(doc => (
                              <button key={doc.id} className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors">
                                <FileText className="h-3 w-3 text-gray-500" />
                                {doc.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}

        {activeTabLocal === 'docs' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
                <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />}>Upload</Button>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {c.stages.flatMap(s => s.documents).map(doc => (
                  <div key={doc.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.size} • Uploaded by {doc.uploadedBy} • {formatDate(doc.uploadedAt)}</p>
                    </div>
                    <button className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {c.stages.flatMap(s => s.documents).length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No documents uploaded</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {activeTabLocal === 'activity' && (
          <Card>
            <CardBody className="p-0">
              <div className="relative">
                <div className="absolute left-10 top-0 bottom-0 w-px bg-gray-100" />
                <div className="divide-y divide-gray-50">
                  {[...c.activityLogs].reverse().map((log) => (
                    <div key={log.id} className="flex items-start gap-4 px-6 py-4">
                      <div className="relative z-10">
                        <Avatar name={log.performedBy} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{log.performedBy}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{log.action}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{log.details}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDateTime(log.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTabLocal === 'comments' && (
          <Card>
            <CardBody className="space-y-4">
              {c.comments.map(cmt => (
                <div key={cmt.id} className="flex items-start gap-3">
                  <Avatar name={cmt.author} size="sm" />
                  <div className="flex-1">
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-900">{cmt.author}</span>
                        {cmt.department && (
                          <Badge className={`${departmentColors[cmt.department]} text-[10px]`}>{cmt.department}</Badge>
                        )}
                        <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(cmt.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{cmt.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {c.comments.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No comments yet</p>
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Avatar name={currentUser.name} size="sm" />
                <div className="flex-1">
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                    rows={2}
                    placeholder="Add a comment..."
                  />
                  <div className="flex justify-end mt-2">
                    <Button variant="primary" size="xs" icon={<Send className="h-3 w-3" />}>Comment</Button>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </motion.div>
    </div>
  );
};
