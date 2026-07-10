import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, AlertTriangle, Clock, FileText,
  ChevronRight, Eye, Send
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store/useStore';
import type { ImplantCase, Employee, WorkflowStage } from '../types';
import { priorityColors, stageColors, departmentColors, timeAgo } from '../utils/helpers';

const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation', 'Surgery', 'Cleaning', 'Audit', 'Billing', 'Collection', 'Completed'
];

const getNextStage = (current: WorkflowStage): WorkflowStage | null => {
  const idx = WORKFLOW_STAGES.indexOf(current);
  return idx < WORKFLOW_STAGES.length - 1 ? WORKFLOW_STAGES[idx + 1] : null;
};

const STAGE_TO_DEPT: Record<WorkflowStage, string> = {
  'Kit Preparation': 'Stores',
  'Surgery': 'Scrub Person',
  'Cleaning': 'Cleaning Department',
  'Audit': 'Stores Audit',
  'Billing': 'Accounts',
  'Collection': 'Collection Executive',
  'Completed': 'Admin',
};

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'approve' | 'reject' | 'changes';
  case: ImplantCase;
  onApprove: (notes: string) => void;
  onReject: (notes: string) => void;
  onChanges: (notes: string) => void;
  onAssign: (employee: Employee, nextStage: WorkflowStage) => void;
}

const ActionModal: React.FC<ActionModalProps> = ({
  isOpen, onClose, type, case: c,
  onApprove, onReject, onChanges, onAssign
}) => {
  const { employees } = useStore();
  const [notes, setNotes] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [step, setStep] = useState<'action' | 'assign'>('action');

  const nextStage = getNextStage(c.currentStage);
  const nextDept = nextStage ? STAGE_TO_DEPT[nextStage] : null;
  const nextEmployees = employees.filter(e => e.department === nextDept);

  const config = {
    approve: { title: 'Approve Stage', btnLabel: 'Approve & Continue', btnVariant: 'success' as const, icon: <CheckCircle className="h-4 w-4" /> },
    reject: { title: 'Reject Stage', btnLabel: 'Reject', btnVariant: 'danger' as const, icon: <XCircle className="h-4 w-4" /> },
    changes: { title: 'Request Changes', btnLabel: 'Send Back', btnVariant: 'warning' as const, icon: <AlertTriangle className="h-4 w-4" /> },
  };

  const cfg = config[type];

  const handleAction = () => {
    if (type === 'approve') {
      if (nextStage && step === 'action') {
        setStep('assign');
        return;
      }
      if (selectedEmp && nextStage) {
        onApprove(notes);
        onAssign(selectedEmp, nextStage);
      } else {
        onApprove(notes);
      }
    } else if (type === 'reject') {
      onReject(notes);
    } else {
      onChanges(notes);
    }
    setNotes('');
    setSelectedEmp(null);
    setStep('action');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); setStep('action'); setSelectedEmp(null); setNotes(''); }}
      title={step === 'assign' ? `Assign to ${nextStage}` : cfg.title}
      subtitle={step === 'assign' ? `Select employee for ${nextDept}` : `Case ${c.caseNumber}`}
      size="md"
      footer={
        <div className="flex items-center justify-between">
          {step === 'assign' && (
            <button onClick={() => setStep('action')} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="outline" size="sm" onClick={() => { onClose(); setStep('action'); }}>Cancel</Button>
            <Button
              variant={step === 'assign' ? 'primary' : cfg.btnVariant}
              size="sm"
              icon={step === 'assign' ? <Send className="h-4 w-4" /> : cfg.icon}
              onClick={handleAction}
              disabled={step === 'assign' && !selectedEmp}
            >
              {step === 'assign' ? 'Approve & Assign' : cfg.btnLabel}
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-6">
        {step === 'action' ? (
          <>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {type === 'approve' ? 'Approval Notes (optional)' : type === 'reject' ? 'Rejection Reason *' : 'Changes Required *'}
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
              rows={4}
              placeholder={
                type === 'approve'
                  ? 'Add approval notes...'
                  : type === 'reject'
                  ? 'Explain why this is rejected...'
                  : 'Describe what changes are needed...'
              }
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            {type === 'approve' && nextStage && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">
                  Next step: You'll be asked to assign an employee for <strong>{nextStage}</strong>
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {nextEmployees.map(emp => (
              <div
                key={emp.id}
                onClick={() => setSelectedEmp(emp)}
                className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedEmp?.id === emp.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
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
                <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex items-center justify-center">
                  {selectedEmp?.id === emp.id && <div className="h-2 w-2 bg-gray-900 rounded-full" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export const ApprovalQueue: React.FC = () => {
  const { cases, approveStage, rejectStage, requestChanges, assignEmployee, setSelectedCase, setActiveTab, reloadFromDatabase } = useStore();
  const [actionModal, setActionModal] = useState<{ type: 'approve' | 'reject' | 'changes'; caseId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { bootstrapSupabaseData } = await import('../lib/database/bootstrap');
        await bootstrapSupabaseData();
        if (!cancelled) reloadFromDatabase();
      } catch (err) {
        console.error('[ApprovalQueue] refresh failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadFromDatabase]);

  const pendingCases = cases.filter(c => c.status === 'Waiting For Approval');
  const actionCase = actionModal ? cases.find(c => c.id === actionModal.caseId) : null;

  const handleApprove = (notes: string) => {
    if (actionModal) approveStage(actionModal.caseId, notes);
  };
  const handleReject = (notes: string) => {
    if (actionModal) rejectStage(actionModal.caseId, notes);
  };
  const handleChanges = (notes: string) => {
    if (actionModal) requestChanges(actionModal.caseId, notes);
  };
  const handleAssign = (employee: Employee, nextStage: WorkflowStage) => {
    if (actionModal) assignEmployee(actionModal.caseId, employee, nextStage);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {actionModal && actionCase && (
        <ActionModal
          isOpen={true}
          onClose={() => setActionModal(null)}
          type={actionModal.type}
          case={actionCase}
          onApprove={handleApprove}
          onReject={handleReject}
          onChanges={handleChanges}
          onAssign={handleAssign}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve submitted work from employees</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCases.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">{pendingCases.length} pending</span>
            </div>
          )}
        </div>
      </div>

      {pendingCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">All clear!</h3>
          <p className="text-sm text-gray-500 mt-1">No pending approvals at the moment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingCases.map((c, idx) => {
            const sc = stageColors[c.currentStage];
            const pc = priorityColors[c.priority];
            const currentStageRecord = c.stages.find(s => s.stage === c.currentStage);
            const nextStage = getNextStage(c.currentStage);

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <Card className="overflow-hidden">
                  {/* Priority indicator */}
                  <div className={`h-1 ${c.priority === 'Critical' ? 'bg-red-500' : c.priority === 'High' ? 'bg-orange-400' : c.priority === 'Medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />

                  <CardBody>
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-4 lg:gap-6">
                      {/* Left: Case info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-3">
                          <button
                            onClick={() => { setSelectedCase(c.id); setActiveTab('cases'); }}
                            className="text-base font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {c.caseNumber}
                          </button>
                          <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {c.currentStage}
                          </Badge>
                          <Badge className={`${pc} text-xs`}>{c.priority}</Badge>
                          <div className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                            <Clock className="h-3 w-3" />
                            Awaiting Review
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-400">Hospital</p>
                            <p className="text-sm font-semibold text-gray-900 truncate">{c.hospital.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Doctor</p>
                            <p className="text-sm font-medium text-gray-800 truncate">{c.doctor.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Implant</p>
                            <p className="text-sm font-medium text-gray-800 truncate">{c.implantRequired}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Surgery Date</p>
                            <p className="text-sm font-medium text-gray-800">{c.surgeryDate}</p>
                          </div>
                        </div>

                        {/* Submitted by */}
                        <div className="flex items-center gap-4">
                          {c.assignedEmployee && (
                            <div className="flex items-center gap-2">
                              <Avatar name={c.assignedEmployee.name} size="sm" />
                              <div>
                                <p className="text-xs font-semibold text-gray-900">{c.assignedEmployee.name}</p>
                                <Badge className={`${departmentColors[c.assignedEmployee.department]} text-[10px]`}>
                                  {c.assignedEmployee.department}
                                </Badge>
                              </div>
                            </div>
                          )}
                          {currentStageRecord?.submittedAt && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="h-3 w-3" />
                              Submitted {timeAgo(currentStageRecord.submittedAt)}
                            </div>
                          )}
                        </div>

                        {/* Employee notes */}
                        {currentStageRecord?.notes && (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                            <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Employee Submission Notes
                            </p>
                            <p className="text-sm text-gray-700">{currentStageRecord.notes}</p>
                          </div>
                        )}

                        {/* Documents */}
                        {currentStageRecord?.documents && currentStageRecord.documents.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            {currentStageRecord.documents.map(doc => (
                              <button key={doc.id} className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">
                                <FileText className="h-3 w-3" />
                                {doc.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="shrink-0 flex flex-row lg:flex-col flex-wrap gap-2 w-full lg:w-48">
                        <Button
                          variant="success"
                          size="sm"
                          icon={<CheckCircle className="h-4 w-4" />}
                          onClick={() => setActionModal({ type: 'approve', caseId: c.id })}
                          className="w-full justify-center"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<XCircle className="h-4 w-4" />}
                          onClick={() => setActionModal({ type: 'reject', caseId: c.id })}
                          className="w-full justify-center"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="warning"
                          size="sm"
                          icon={<AlertTriangle className="h-4 w-4" />}
                          onClick={() => setActionModal({ type: 'changes', caseId: c.id })}
                          className="w-full justify-center"
                        >
                          Request Changes
                        </Button>
                        <div className="border-t border-gray-100 pt-2 mt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Eye className="h-4 w-4" />}
                            onClick={() => { setSelectedCase(c.id); setActiveTab('cases'); }}
                            className="w-full justify-center"
                          >
                            View Case
                          </Button>
                        </div>

                        {nextStage && (
                          <div className="p-2 bg-gray-50 rounded-lg text-center">
                            <p className="text-[10px] text-gray-400">Next stage</p>
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                              <ChevronRight className="h-3 w-3 text-gray-400" />
                              <span className="text-xs font-medium text-gray-700">{nextStage}</span>
                            </div>
                            <p className="text-[10px] text-gray-400">{STAGE_TO_DEPT[nextStage]}</p>
                          </div>
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
    </div>
  );
};
