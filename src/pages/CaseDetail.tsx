import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Building2, User, FileText,
  CheckCircle, XCircle, MessageSquare, Clock, ChevronRight,
  Download, Upload, AlertTriangle, Send, Clipboard, Edit3, FastForward, Trash2, Ban
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { SubmitStageModal } from '../components/SubmitStageModal';
import { StagePhotoGallery } from '../components/StagePhotoGallery';
import { EmployeeAssignPicker } from '../components/EmployeeAssignPicker';
import { EditCaseModal } from '../components/EditCaseModal';
import { RestockOutcomeBadge } from '../components/RestockOutcomeBadge';
import { useStore } from '../store/useStore';
import type { ImplantCase, Employee, WorkflowStage } from '../types';
import {
  priorityColors, statusColors, stageColors, departmentColors,
  formatDate, formatDateTime, timeAgo, formatCurrency, getStageIndex
} from '../utils/helpers';
import { canEmployeeSubmitCase, needsAssignmentReactivation, isCaseAssignedToEmployee, getNextWorkflowStage } from '../lib/caseWorkflow';

const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation', 'Delivery', 'Surgery', 'Pickup from Hospital', 'Cleaning & Audit', 'Restock', 'Billing', 'Bill Submission', 'Completed'
];

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Submit to Admin',
  'Delivery': 'Delivery Completed',
  'Surgery': 'Surgery Completed',
  'Pickup from Hospital': 'Pickup Completed',
  'Cleaning & Audit': 'Cleaning & Audit Completed',
  'Restock': 'Restock Completed',
  'Billing': 'Invoice Generated',
  'Bill Submission': 'Bill Submission Completed',
  'Completed': 'Case Closed',
};

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'approve' | 'reject' | 'changes' | 'force';
  caseId: string;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose, type, caseId }) => {
  const { approveStage, rejectStage, requestChanges, cases } = useStore();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const implantCase = cases.find((x) => x.id === caseId);
  const stageIdx = implantCase ? WORKFLOW_STAGES.indexOf(implantCase.currentStage) : -1;
  const nextStage = stageIdx >= 0 ? WORKFLOW_STAGES[stageIdx + 1] : undefined;
  const nextAssignee =
    nextStage && nextStage !== 'Completed'
      ? implantCase?.stages.find((s) => s.stage === nextStage)?.assignedEmployee
      : null;

  const config = {
    approve: { title: 'Approve Stage', subtitle: 'Add optional approval notes', color: 'success' as const, label: 'Approve' },
    reject: { title: 'Reject Stage', subtitle: 'Provide rejection reason', color: 'danger' as const, label: 'Reject' },
    changes: { title: 'Request Changes', subtitle: 'Describe the changes needed', color: 'warning' as const, label: 'Request Changes' },
    force: {
      title: 'Force Advance Stage',
      subtitle: `${implantCase?.assignedEmployee?.name ?? 'The employee'} hasn't submitted this stage yet`,
      color: 'warning' as const,
      label: 'Force Advance',
    },
  };

  const notesRequired = type === 'force';
  const canSubmit = !notesRequired || notes.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (type === 'approve') await approveStage(caseId, notes);
      else if (type === 'force') await approveStage(caseId, `Manually advanced by admin — employee did not submit. Reason: ${notes.trim()}`);
      else if (type === 'reject') await rejectStage(caseId, notes);
      else await requestChanges(caseId, notes);
      setNotes('');
      onClose();
    } catch (err) {
      alert(err instanceof Error ? `Failed to save: ${err.message}` : 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const c = config[type];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={c.title} subtitle={c.subtitle} size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant={c.color} size="sm" onClick={() => void handleSubmit()} disabled={submitting || !canSubmit}>
            {submitting ? 'Saving...' : c.label}
          </Button>
        </div>
      }
    >
      <div className="p-6">
        {type === 'force' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              This skips the employee's submission for <strong>{implantCase?.currentStage}</strong> and moves the
              case forward as if it were approved. Use this only when the employee forgot to submit or can't
              access the app — it's logged in the case's activity history.
            </p>
          </div>
        )}
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {notesRequired ? 'Reason (required)' : 'Notes'}
        </label>
        <textarea
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          rows={4}
          placeholder={notesRequired ? 'Why are you advancing this manually?' : 'Add your notes here...'}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        {notesRequired && !canSubmit && (
          <p className="text-xs text-amber-600 mt-1">A reason is required so there's a record of why this was overridden.</p>
        )}
        {(type === 'approve' || type === 'force') && nextStage === 'Completed' && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">
              This is the final stage — approving will mark the case as Completed and close it.
            </p>
          </div>
        )}
        {(type === 'approve' || type === 'force') && nextAssignee && nextStage && nextStage !== 'Completed' && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">
              Next: <strong>{nextStage}</strong> will activate for <strong>{nextAssignee.name}</strong> automatically.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

const STAGE_TO_DEPT: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Stores',
  'Delivery': 'Delivery',
  'Surgery': 'Scrub Person',
  'Pickup from Hospital': 'Delivery',
  'Cleaning & Audit': 'Cleaning & Audit',
  'Restock': 'Stores',
  'Billing': 'Accounts',
  'Bill Submission': 'Bill Submission',
  'Completed': 'Admin',
};

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  nextStage: WorkflowStage;
}

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, caseId, nextStage }) => {
  const { assignEmployee, employees } = useStore();
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const suggestedDept = STAGE_TO_DEPT[nextStage] ?? null;

  const handleAssign = async () => {
    if (!selectedEmp) return;
    setSubmitting(true);
    try {
      await assignEmployee(caseId, selectedEmp, nextStage);
      setSelectedEmp(null);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? `Failed to assign: ${err.message}` : 'Failed to assign employee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); setSelectedEmp(null); }}
      title="Assign Workflow Stage"
      subtitle={`Assign ${nextStage} to any employee`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={() => { onClose(); setSelectedEmp(null); }} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => void handleAssign()} disabled={!selectedEmp || submitting}>
            {submitting ? 'Assigning...' : 'Assign Employee'}
          </Button>
        </div>
      }
    >
      <div className="p-6">
        <EmployeeAssignPicker
          employees={employees}
          selected={selectedEmp}
          onSelect={setSelectedEmp}
          suggestedDepartment={suggestedDept}
        />
      </div>
    </Modal>
  );
};

interface SubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  implantCase: ImplantCase;
}

const SubmitModal: React.FC<SubmitModalProps> = ({ isOpen, onClose, implantCase }) => (
  <SubmitStageModal isOpen={isOpen} onClose={onClose} implantCase={implantCase} />
);

const CancelCaseModal: React.FC<{ isOpen: boolean; onClose: () => void; caseId: string; currentStage: WorkflowStage }> = ({
  isOpen, onClose, caseId, currentStage,
}) => {
  const { cancelCase } = useStore();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await cancelCase(caseId, reason);
      setReason('');
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel case.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Case — Unused Implants"
      subtitle="Surgery not done. Kit comes back; billing is skipped."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Keep Case</Button>
          <Button variant="danger" size="sm" onClick={() => void handleSubmit()} disabled={submitting || !canSubmit}>
            {submitting ? 'Cancelling...' : 'Cancel Case'}
          </Button>
        </div>
      }
    >
      <div className="p-6">
        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Use this when the surgery did not happen and <strong>no implants were used</strong>.
            If the kit already left Stores (currently <strong>{currentStage}</strong>), the case
            moves to Pickup → Cleaning & Audit → Restock so unused implants come back.
            Billing and Bill Submission are skipped.
          </p>
        </div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Reason (required)</label>
        <textarea
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
          rows={4}
          placeholder="e.g. Patient postponed. Kit unused at Apollo — returning to Stores."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
};

interface CaseDetailProps {
  case: ImplantCase;
  onBack: () => void;
}

export const CaseDetail: React.FC<CaseDetailProps> = ({ case: initialCase, onBack }) => {
  const { viewMode, currentUser, closeCase, reactivateAssignedCase, assignEmployee, deleteCase } = useStore();
  const c = useStore((s) => s.cases.find((x) => x.id === initialCase.id)) ?? initialCase;
  const [approvalModal, setApprovalModal] = useState<'approve' | 'reject' | 'changes' | 'force' | null>(null);
  const [assignStage, setAssignStage] = useState<WorkflowStage | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [activeTabLocal, setActiveTabLocal] = useState<'overview' | 'stages' | 'docs' | 'activity' | 'comments'>('overview');

  const currentStageIdx = getStageIndex(c.currentStage);
  const sc = stageColors[c.currentStage];
  const pc = priorityColors[c.priority];
  const stc = statusColors[c.status];

  const nextStage = (getNextWorkflowStage(c.currentStage, { skipBilling: Boolean(c.cancelReason) }) ?? undefined) as WorkflowStage | undefined;
  const isWaitingApproval = c.status === 'Waiting For Approval';
  const isApproved = c.status === 'Approved';
  const isActive = c.status === 'Active';
  const returningUnused = Boolean(c.cancelReason) && c.status !== 'Cancelled' && c.currentStage !== 'Completed';
  const canCancel = viewMode === 'admin' && c.status !== 'Completed' && c.status !== 'Cancelled' && !c.cancelReason;
  const canEmployeeSubmit = viewMode === 'employee' && canEmployeeSubmitCase(c, currentUser);
  const canEmployeeEdit = viewMode === 'employee' && isCaseAssignedToEmployee(c, currentUser);

  useEffect(() => {
    if (viewMode !== 'employee') return;
    if (!needsAssignmentReactivation(c, currentUser)) return;
    void reactivateAssignedCase(c.id);
  }, [c.id, c.status, c.currentStage, viewMode, currentUser, reactivateAssignedCase, c.assignedEmployee?.id]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Clipboard className="h-3.5 w-3.5" /> },
    { id: 'stages', label: 'Stage Progress', icon: <ChevronRight className="h-3.5 w-3.5" /> },
    { id: 'docs', label: 'Documents', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'activity', label: 'Activity', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'comments', label: 'Comments', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full min-w-0">
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
        <SubmitModal isOpen={showSubmit} onClose={() => setShowSubmit(false)} implantCase={c} />
      )}
      {showEdit && (
        <EditCaseModal isOpen={showEdit} onClose={() => setShowEdit(false)} case={c} />
      )}
      {showCancel && (
        <CancelCaseModal isOpen={true} onClose={() => setShowCancel(false)} caseId={c.id} currentStage={c.currentStage} />
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
              {isApproved && nextStage && nextStage !== 'Completed' && !c.stages.find((s) => s.stage === nextStage)?.assignedEmployee && (
                <Button variant="primary" size="sm" icon={<User className="h-4 w-4" />} onClick={() => setAssignStage(nextStage)}>Assign Next Stage</Button>
              )}
              {isApproved && nextStage && nextStage !== 'Completed' && !!c.stages.find((s) => s.stage === nextStage)?.assignedEmployee && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<User className="h-4 w-4" />}
                  onClick={() => {
                    const emp = c.stages.find((s) => s.stage === nextStage)?.assignedEmployee;
                    if (emp) void assignEmployee(c.id, emp, nextStage);
                  }}
                >
                  Activate {nextStage}
                </Button>
              )}
              {isActive && c.currentStage !== 'Completed' && (
                <Button variant="outline" size="sm" icon={<User className="h-4 w-4" />} onClick={() => setAssignStage(c.currentStage)}>Reassign</Button>
              )}
              {isActive && c.currentStage !== 'Completed' && (
                <Button
                  variant="warning"
                  size="sm"
                  icon={<FastForward className="h-4 w-4" />}
                  onClick={() => setApprovalModal('force')}
                  title="Move this case forward even though the employee hasn't submitted"
                >
                  Force Advance
                </Button>
              )}
              {isApproved && nextStage === 'Completed' && (
                <Button variant="success" size="sm" icon={<CheckCircle className="h-4 w-4" />} onClick={() => closeCase(c.id)}>
                  {c.cancelReason ? 'Close as Cancelled' : 'Close Case'}
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" size="sm" icon={<Ban className="h-4 w-4" />} onClick={() => setShowCancel(true)}>
                  Cancel Case
                </Button>
              )}
            </>
          )}
          {viewMode === 'employee' && canEmployeeSubmit && (
            <Button variant="primary" size="sm" icon={<Send className="h-4 w-4" />} onClick={() => setShowSubmit(true)}>
              {STAGE_ACTIONS[c.currentStage]}
            </Button>
          )}
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>Export</Button>
          {(viewMode === 'admin' || canEmployeeEdit) && (
            <Button variant="outline" size="sm" icon={<Edit3 className="h-4 w-4" />} onClick={() => setShowEdit(true)}>Edit</Button>
          )}
          {viewMode === 'admin' && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                if (!confirm(`Delete case ${c.caseNumber}? This cannot be undone.`)) return;
                void deleteCase(c.id);
                onBack();
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {returningUnused && (
        <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <Ban className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Surgery cancelled — unused implants returning</p>
            <p className="text-xs text-amber-800 mt-0.5">
              No implants were used. Kit comes back through Pickup → Cleaning & Audit → Restock. Billing is skipped.
              {c.cancelReason ? ` Reason: ${c.cancelReason}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-6 max-w-full overflow-x-auto pb-1">
        <div className="flex items-center gap-0 w-max min-w-full sm:w-full sm:min-w-0">
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
                      { label: 'Surgery', value: c.implantRequired },
                      { label: 'Implant Type', value: c.implantType || '—' },
                      { label: 'Implant Company', value: c.implantCompany || '—' },
                      { label: 'Priority', value: c.priority },
                      { label: 'Due Date', value: formatDate(c.dueDate) },
                      { label: 'Created By', value: c.createdBy },
                      { label: 'Created At', value: formatDate(c.createdAt) },
                      ...(c.cancelReason ? [{ label: 'Cancel Reason', value: c.cancelReason }] : []),
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
                        {stage.stage !== 'Completed' && (
                          stage.assignedEmployee ? (
                            <div className="flex items-center gap-2 mt-2">
                              <Avatar name={stage.assignedEmployee.name} size="xs" />
                              <span className="text-xs text-gray-600">{stage.assignedEmployee.name}</span>
                              <Badge className={`${departmentColors[stage.assignedEmployee.department]} text-[10px]`}>{stage.assignedEmployee.department}</Badge>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 mt-2">No employee assigned yet</p>
                          )
                        )}
                        {stage.restockOutcome && (
                          <div className="mt-2">
                            <RestockOutcomeBadge outcome={stage.restockOutcome} />
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
                          <StagePhotoGallery documents={stage.documents} title="Stage Photo" compact />
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
              <div className="space-y-4">
                {c.stages.flatMap(s => s.documents.map(doc => ({ ...doc, stage: s.stage }))).map(doc => (
                  <div key={doc.id} className="rounded-xl border border-gray-100 overflow-hidden">
                    {doc.type.startsWith('image/') || doc.url.startsWith('data:image') || /\.(jpg|jpeg|png|webp)$/i.test(doc.url) ? (
                      <img src={doc.url} alt={doc.name} className="w-full max-h-72 object-contain bg-gray-50" />
                    ) : null}
                    <div className="flex items-center gap-4 p-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-400">{doc.stage} • {doc.size} • {doc.uploadedBy} • {formatDate(doc.uploadedAt)}</p>
                      </div>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 transition-colors">
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
                {c.stages.flatMap(s => s.documents).length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No stage photos yet</p>
                    <p className="text-xs mt-1">Photos appear here when employees submit for approval</p>
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
                {/* Center line on the sm avatar column (w-7), inset by row px-6 */}
                <div className="absolute left-6 top-0 bottom-0 w-7 flex justify-center pointer-events-none">
                  <div className="w-px h-full bg-gray-100" />
                </div>
                <div className="divide-y divide-gray-50">
                  {[...c.activityLogs].reverse().map((log) => (
                    <div key={log.id} className="flex items-start gap-4 px-6 py-4">
                      <div className="relative z-10 w-7 shrink-0 flex justify-center">
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
