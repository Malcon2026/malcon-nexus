import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User,
  CheckCircle, XCircle, Clock,
  AlertTriangle, Send, Edit3, FastForward, Trash2, Ban, CalendarClock, HandMetal, MoreHorizontal, ParkingCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { SubmitStageModal } from '../components/SubmitStageModal';
import { EmployeeAssignPicker } from '../components/EmployeeAssignPicker';
import { EditCaseModal } from '../components/EditCaseModal';
import { useStore } from '../store/useStore';
import type { ImplantCase, Employee, ReturnOutcome, WorkflowStage } from '../types';
import { RETURN_OUTCOMES, returnOutcomeToDutyId } from '../lib/returnPickup';
import {
  priorityColors, statusColors,
  formatDate, timeAgo
} from '../utils/helpers';
import { canEmployeeSubmitCase, isCaseVisibleToEmployee, getCurrentStageTeamDisplay, findStageRecord, isCaseAssistantOnCurrentStage, needsAssignmentReactivation, getNextWorkflowStage, isFcfsPoolCase, isWorkflowStageEnabled, FORCE_ADVANCE_ENABLED, VISIBLE_WORKFLOW_STAGES, mapCaseToVisibleStage, normalizeWorkflowStageName, getEmployeeSubmitStage, getStageSubmitWaitMessage } from '../lib/caseWorkflow';
import { CANCEL_CASE_REASONS, type CancelCaseReasonType } from '../lib/cancelCase';
import { NexusPage } from '../components/layout/NexusPageHeader';
import { NEXUS_FORM_CONTROL, NEXUS_TEXTAREA_CONTROL } from '../constants/formStyles';
import { cn } from '../utils/cn';
import { canEmployeeRequestTask, getPendingTaskRequestsForCase, hasEmployeePendingTaskRequest } from '../lib/caseTaskRequests';
import { canStoreManagerSubmitSetPreparation, isFullAdmin, isSetPreparationStage } from '../lib/roles';
import { CASE_DUTIES_TAB_ID } from '../lib/caseDuties';
import { CaseCurrentWork, type CaseAction } from '../components/case-detail/CaseCurrentWork';
import { CaseDetailTabs, type CaseTab } from '../components/case-detail/CaseDetailTabs';
import {
  CaseActivity,
  CaseComments,
  CaseOverview,
  CaseProgressTimeline,
} from '../components/case-detail/CaseDetailSections';

const WORKFLOW_STAGES: WorkflowStage[] = [
  'Set Preparation', 'Delivery', 'Surgery', 'Pickup from Hospital', 'Checking & Audit', 'Restock', 'Billing', 'Bill Submission', 'Completed'
];

const STAGE_ACTIONS: Record<WorkflowStage, string> = {
  'Set Preparation': 'Submit to Admin',
  'Delivery': 'Delivery Completed',
  'Surgery': 'Mark Surgery Completed',
  'Pickup from Hospital': 'Pickup Completed',
  'Checking & Audit': 'Checking & Audit Completed',
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

const SET_PARKED = 'SetParked' as const;
type ForceTarget = WorkflowStage | typeof SET_PARKED;

const ApprovalModal: React.FC<ApprovalModalProps> = ({ isOpen, onClose, type, caseId }) => {
  const { approveStage, rejectStage, requestChanges, forceAdvanceCase, setParkedCompleteCase, cases } = useStore();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const implantCase = cases.find((x) => x.id === caseId);
  const stageIdx = implantCase ? WORKFLOW_STAGES.indexOf(implantCase.currentStage) : -1;
  const nextStage = implantCase
    ? (getNextWorkflowStage(implantCase.currentStage, { skipBilling: Boolean(implantCase.cancelReason) }) ?? undefined)
    : undefined;

  const forceTargetOptions = useMemo(() => {
    if (stageIdx < 0) return [] as WorkflowStage[];
    return WORKFLOW_STAGES.slice(stageIdx + 1).filter((stage) => isWorkflowStageEnabled(stage));
  }, [stageIdx]);

  const [forceTarget, setForceTarget] = useState<ForceTarget>('Completed');
  const isSetParked = forceTarget === SET_PARKED;

  useEffect(() => {
    if (!isOpen || type !== 'force') return;
    setForceTarget(SET_PARKED);
    setNotes('');
  }, [isOpen, type, caseId, forceTargetOptions]);

  const skippedStageLabels =
    stageIdx >= 0 && !isSetParked
      ? WORKFLOW_STAGES.slice(stageIdx, WORKFLOW_STAGES.indexOf(forceTarget as WorkflowStage)).join(', ')
      : stageIdx >= 0
        ? WORKFLOW_STAGES.slice(stageIdx).join(', ')
        : '';

  const forceTargetAssignee =
    !isSetParked && forceTarget && forceTarget !== 'Completed'
      ? implantCase?.stages.find((s) => s.stage === forceTarget)?.assignedEmployee
      : null;

  const nextAssignee =
    type === 'force' && !isSetParked && forceTarget && forceTarget !== 'Completed'
      ? forceTargetAssignee
      : nextStage && nextStage !== 'Completed'
        ? implantCase?.stages.find((s) => s.stage === nextStage)?.assignedEmployee
        : null;

  const previewStage = type === 'force' ? (isSetParked ? 'Completed' : forceTarget) : nextStage;

  const config = {
    approve: { title: 'Approve Stage', subtitle: undefined, color: 'success' as const, label: 'Approve' },
    reject: { title: 'Reject Stage', subtitle: undefined, color: 'danger' as const, label: 'Reject' },
    changes: { title: 'Request Changes', subtitle: undefined, color: 'warning' as const, label: 'Request Changes' },
    force: {
      title: 'Force Advance Stage',
      subtitle: undefined,
      color: 'warning' as const,
      label: isSetParked ? 'Set Parked & Complete' : forceTarget === 'Completed' ? 'Skip & Close Case' : `Jump to ${forceTarget}`,
    },
  };

  const notesRequired = type === 'force';
  const canSubmit = !notesRequired || notes.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (type === 'approve') await approveStage(caseId, notes);
      else if (type === 'force') {
        if (isSetParked) {
          await setParkedCompleteCase(caseId, notes.trim());
        } else {
          await forceAdvanceCase(
            caseId,
            forceTarget as WorkflowStage,
            `Manually advanced by admin — employee did not submit. Reason: ${notes.trim()}`,
          );
        }
      }
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
          <>
            <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Skips <strong>{implantCase?.currentStage}</strong>
                {isSetParked || forceTarget === 'Completed' ? (
                  ' and all remaining stages, then closes the case.'
                ) : (
                  <>
                    {' '}
                    and every stage until <strong>{forceTarget}</strong>.
                  </>
                )}
                {' '}Logged in activity history.
              </p>
            </div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Jump to stage *</label>
            <select
              className={`${NEXUS_FORM_CONTROL} mb-3`}
              value={forceTarget}
              onChange={(e) => setForceTarget(e.target.value as ForceTarget)}
            >
              <option value={SET_PARKED}>Set Parked (complete case)</option>
              {forceTargetOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {stage === 'Completed' ? 'Close case (Completed)' : stage}
                </option>
              ))}
            </select>
            {isSetParked && skippedStageLabels && (
              <p className="text-[11px] text-gray-500 mb-3">
                Will skip and complete from: {skippedStageLabels}
              </p>
            )}
            {!isSetParked && skippedStageLabels && forceTarget !== 'Completed' && (
              <p className="text-[11px] text-gray-500 mb-3">
                Will mark as skipped: {skippedStageLabels}
              </p>
            )}
            {!isSetParked && forceTarget === 'Completed' && skippedStageLabels && (
              <p className="text-[11px] text-gray-500 mb-3">
                Will skip and close from: {skippedStageLabels}
              </p>
            )}
          </>
        )}
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          {notesRequired ? 'Reason (required)' : 'Notes'}
        </label>
        <textarea
          className={NEXUS_TEXTAREA_CONTROL}
          rows={4}
          placeholder={notesRequired ? 'Why are you advancing this manually?' : 'Add your notes here...'}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        {notesRequired && !canSubmit && (
          <p className="text-xs text-amber-600 mt-1">A reason is required so there's a record of why this was overridden.</p>
        )}
        {(type === 'approve' || type === 'force') && previewStage === 'Completed' && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">
              This will mark the case as Completed and close it.
            </p>
          </div>
        )}
        {(type === 'approve' || type === 'force') && nextAssignee && previewStage && previewStage !== 'Completed' && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">
              Next: <strong>{previewStage}</strong> will activate for <strong>{nextAssignee.name}</strong> automatically.
            </p>
          </div>
        )}
        {(type === 'force') && previewStage && previewStage !== 'Completed' && !nextAssignee && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
            <p className="text-xs text-gray-600">
              No one is pre-assigned for <strong>{previewStage}</strong> — assign from Edit Case after jumping.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

const STAGE_TO_DEPT: Record<WorkflowStage, string> = {
  'Set Preparation': 'Stores',
  'Delivery': 'Delivery',
  'Surgery': 'Scrub Person',
  'Pickup from Hospital': 'Delivery',
  'Checking & Audit': 'Checking & Audit',
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
  const { assignEmployee, markSurgerySelfPerformed, confirmPostSurgeryTeam, employees, currentUser } = useStore();
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [returnSpecial, setReturnSpecial] = useState<ReturnOutcome | null>(null);
  const [selfChosen, setSelfChosen] = useState(false);
  const [selfNotes, setSelfNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const suggestedDept = STAGE_TO_DEPT[nextStage] ?? null;
  const allowSelf = nextStage === 'Surgery';
  const isPickupAssign = nextStage === 'Pickup from Hospital';
  const allowAssignToMe =
    nextStage === 'Set Preparation' &&
    (currentUser.role === 'store_manager' || (currentUser.role as string) === 'case_manager');

  const resetLocal = () => {
    setSelectedEmp(null);
    setReturnSpecial(null);
    setSelfChosen(false);
    setSelfNotes('');
  };

  const handleAssign = async () => {
    if (returnSpecial && isPickupAssign) {
      setSubmitting(true);
      try {
        await confirmPostSurgeryTeam(caseId, { return: returnOutcomeToDutyId(returnSpecial) });
        resetLocal();
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Could not save return option.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (selfChosen) {
      setSubmitting(true);
      try {
        const { error } = await markSurgerySelfPerformed(caseId, selfNotes);
        if (error) {
          alert(error);
          return;
        }
        resetLocal();
        onClose();
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!selectedEmp) return;
    setSubmitting(true);
    try {
      await assignEmployee(caseId, selectedEmp, nextStage);
      resetLocal();
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
      onClose={() => { onClose(); resetLocal(); }}
      title="Assign Workflow Stage"
      subtitle={
        isPickupAssign
          ? 'Assign pickup driver, or choose no return / parked (skips checking → Restock)'
          : `Assign ${nextStage} to any employee`
      }
      size={isPickupAssign ? 'lg' : 'md'}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={() => { onClose(); resetLocal(); }} disabled={submitting}>Cancel</Button>
          <Button
            variant={selfChosen ? 'warning' : 'primary'}
            size="sm"
            onClick={() => void handleAssign()}
            disabled={(!selectedEmp && !selfChosen && !returnSpecial) || submitting}
          >
            {submitting
              ? 'Saving...'
              : returnSpecial
                ? 'Save return option'
                : selfChosen
                  ? 'Confirm — Self Performed'
                  : 'Assign Employee'}
          </Button>
        </div>
      }
    >
      <div className="p-6">
        {isPickupAssign ? (
          <div className="mb-5 space-y-2">
            <p className="text-xs font-medium text-gray-700">No pickup trip</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RETURN_OUTCOMES.map((opt) => {
                const active = returnSpecial === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setReturnSpecial(opt.id);
                      setSelectedEmp(null);
                      setSelfChosen(false);
                    }}
                    className={`rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
                      active
                        ? opt.id === 'used_no_return'
                          ? 'border-violet-400 bg-violet-50'
                          : 'border-slate-400 bg-slate-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span
                      className={`flex items-center gap-2 text-sm font-semibold ${
                        opt.id === 'used_no_return' ? 'text-violet-800' : 'text-slate-800'
                      }`}
                    >
                      {opt.id === 'used_no_return' ? (
                        <Ban className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <ParkingCircle className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      {opt.title}
                    </span>
                    <span className="mt-1 block text-xs text-gray-600">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <EmployeeAssignPicker
          employees={employees}
          selected={selectedEmp}
          onSelect={(emp) => { setSelectedEmp(emp); setSelfChosen(false); setReturnSpecial(null); }}
          suggestedDepartment={suggestedDept}
          allowSelfOption={allowSelf}
          selfLabel="Self — Hospital performs surgery"
          selfDescription="No scrub person needed. Marks Surgery done and moves the case to Pickup from Hospital."
          isSelfSelected={selfChosen}
          onSelectSelf={() => { setSelfChosen(true); setSelectedEmp(null); setReturnSpecial(null); }}
          allowAssignToMe={allowAssignToMe}
          currentUser={currentUser}
          assignToMeLabel="Assign to me"
          onSelectMe={() => {
            setSelectedEmp(currentUser);
            setSelfChosen(false);
          }}
        />
        {selfChosen && (
          <div className="mt-1">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              className={NEXUS_TEXTAREA_CONTROL}
              rows={2}
              placeholder="e.g. Confirmed with hospital OT staff."
              value={selfNotes}
              onChange={(e) => setSelfNotes(e.target.value)}
            />
          </div>
        )}
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
  const [reasonType, setReasonType] = useState<CancelCaseReasonType | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const selected = CANCEL_CASE_REASONS.find((r) => r.id === reasonType);
  const canSubmit =
    reasonType !== null &&
    (reasonType !== 'other' || details.trim().length > 0);

  const handleClose = () => {
    setReasonType(null);
    setDetails('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !reasonType) return;
    setSubmitting(true);
    try {
      await cancelCase(caseId, reasonType, details);
      setReasonType(null);
      setDetails('');
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
      onClose={handleClose}
      title="Cancel Case"
      subtitle="Pick a reason."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>Keep Case</Button>
          <Button variant="danger" size="sm" onClick={() => void handleSubmit()} disabled={submitting || !canSubmit}>
            {submitting ? 'Cancelling...' : 'Cancel Case'}
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            {selected?.hint ?? (
              <>
                Use when the case will not complete normally. If the kit already left Stores
                (currently <strong>{currentStage}</strong>), it returns via Pickup → Checking & Audit → Restock.
              </>
            )}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Reason (required)</label>
          <div className="space-y-2">
            {CANCEL_CASE_REASONS.map((option) => {
              const active = reasonType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReasonType(option.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                    active
                      ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {reasonType === 'other' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Details (required)</label>
            <textarea
              className={NEXUS_TEXTAREA_CONTROL}
              rows={3}
              placeholder="Describe why this case is being cancelled..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        )}

        {reasonType && reasonType !== 'other' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              className={NEXUS_TEXTAREA_CONTROL}
              rows={2}
              placeholder="e.g. Patient postponed at Apollo — kit unused."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

const PostponeCaseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  currentStage: WorkflowStage;
  surgeryDate: string;
}> = ({ isOpen, onClose, caseId, currentStage, surgeryDate }) => {
  const { postponeCase } = useStore();
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = newDate.length > 0 && newDate !== surgeryDate && reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await postponeCase(caseId, newDate, reason);
      setNewDate('');
      setReason('');
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to postpone case.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Postpone Case"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Keep Date</Button>
          <Button variant="warning" size="sm" onClick={() => void handleSubmit()} disabled={submitting || !canSubmit}>
            {submitting ? 'Saving...' : 'Postpone Case'}
          </Button>
        </div>
      }
    >
      <div className="p-6">
        <div className="mb-4 p-3 bg-sky-50 border border-sky-100 rounded-lg flex items-start gap-2">
          <CalendarClock className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-700">
            Use this when surgery is delayed, not cancelled. The case will{' '}
            <strong>stay postponed at Surgery</strong> — assign the scrub person as usual; when surgery is
            completed the case moves to the next person.
            If implants will not be used at all, use Cancel Case instead.
          </p>
        </div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">New surgery date *</label>
        <input
          type="date"
          className={`${NEXUS_FORM_CONTROL} mb-4`}
          value={newDate}
          min={surgeryDate || undefined}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Reason (required)</label>
        <textarea
          className={NEXUS_TEXTAREA_CONTROL}
          rows={3}
          placeholder="e.g. Patient unwell. Surgery moved to next week. Kit stays at hospital."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
};


/* ------------------------------------------------------------------ */
/* Small UI helpers for the redesigned Case Detail                      */
/* ------------------------------------------------------------------ */

const NOTICE_TONES = {
  amber: { box: 'bg-amber-50 border-amber-200', icon: 'text-amber-700', title: 'text-amber-900', body: 'text-amber-800' },
  slate: { box: 'bg-slate-50 border-slate-200', icon: 'text-slate-600', title: 'text-slate-900', body: 'text-slate-700' },
  sky: { box: 'bg-sky-50 border-sky-200', icon: 'text-sky-700', title: 'text-sky-900', body: 'text-sky-800' },
} as const;

const Notice: React.FC<{
  tone: keyof typeof NOTICE_TONES;
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}> = ({ tone, icon, title, children }) => {
  const t = NOTICE_TONES[tone];
  return (
    <div className={cn('mb-4 flex items-start gap-2 rounded-xl border p-3', t.box)}>
      <span className={cn('mt-0.5 shrink-0', t.icon)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', t.title)}>{title}</p>
        {children ? <div className={cn('mt-0.5 text-xs', t.body)}>{children}</div> : null}
      </div>
    </div>
  );
};

interface MoreMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}

/** Overflow menu for rare / destructive actions. */
const MoreMenu: React.FC<{ items: MoreMenuItem[] }> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--color-separator)] bg-white py-1 shadow-[var(--shadow-popover)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              title={item.title}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                'flex min-h-[44px] w-full items-center gap-3 px-4 text-left text-sm font-medium hover:bg-gray-50 focus:outline-none focus-visible:bg-[var(--color-accent-muted)]',
                item.danger ? 'text-red-600' : 'text-gray-800',
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

interface CaseDetailProps {
  case: ImplantCase;
  onBack: () => void;
}

export const CaseDetail: React.FC<CaseDetailProps> = ({ case: initialCase, onBack }) => {
  const { viewMode, currentUser, closeCase, reactivateAssignedCase, assignEmployee, deleteCase, requestTask, approveTaskRequest, caseTaskRequests, setSelectedCase, setActiveTab } = useStore();
  const c = useStore((s) => s.cases.find((x) => x.id === initialCase.id)) ?? initialCase;
  const [approvalModal, setApprovalModal] = useState<'approve' | 'reject' | 'changes' | 'force' | null>(null);
  const [assignStage, setAssignStage] = useState<WorkflowStage | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showPostpone, setShowPostpone] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [activeTabLocal, setActiveTabLocal] = useState<'overview' | 'stages' | 'activity' | 'comments'>('overview');

  const progressStage = mapCaseToVisibleStage(c.currentStage);
  const currentStageIdx = VISIBLE_WORKFLOW_STAGES.indexOf(progressStage);
  const pc = priorityColors[c.priority];
  const stc = statusColors[c.status];

  const nextStage = (getNextWorkflowStage(c.currentStage, { skipBilling: Boolean(c.cancelReason) }) ?? undefined) as WorkflowStage | undefined;
  const isWaitingApproval = c.status === 'Waiting For Approval';
  const isApproved = c.status === 'Approved';
  const isActive = c.status === 'Active';
  const returningUnused = Boolean(c.cancelReason) && c.status !== 'Cancelled' && c.currentStage !== 'Completed';
  const isFullAdminUser = isFullAdmin(currentUser.role);
  const isStoreManagerUser = viewMode === 'store_manager';
  const atSetPrep = isSetPreparationStage(c.currentStage);
  const canStoreManagerSetSubmit =
    isStoreManagerUser && canStoreManagerSubmitSetPreparation(c, currentUser);
  const canCancel = isFullAdminUser && c.status !== 'Completed' && c.status !== 'Cancelled' && !c.cancelReason;
  const canPostpone =
    isFullAdminUser &&
    c.status !== 'Completed' &&
    c.status !== 'Cancelled' &&
    !c.cancelReason;
  const canForceAdvance =
    FORCE_ADVANCE_ENABLED &&
    isFullAdminUser &&
    c.currentStage !== 'Completed' &&
    c.status !== 'Completed' &&
    c.status !== 'Cancelled' &&
    c.status !== 'Waiting For Approval';
  const canEmployeeSubmit =
    (viewMode === 'employee' || viewMode === 'store_manager') && canEmployeeSubmitCase(c, currentUser);
  const employeeSubmitStage = getEmployeeSubmitStage(c, currentUser);
  const stageSubmitWaitMessage =
    (viewMode === 'employee' || viewMode === 'store_manager')
      ? getStageSubmitWaitMessage(c, currentUser)
      : null;
  const canEmployeeEdit =
    (viewMode === 'employee' || viewMode === 'store_manager') && isCaseVisibleToEmployee(c, currentUser);
  const inFcfsPool = isFcfsPoolCase(c);
  const pendingForCase = getPendingTaskRequestsForCase(caseTaskRequests, c.id);
  const myPendingRequest = hasEmployeePendingTaskRequest(caseTaskRequests, c.id, currentUser.id);
  const canRequest = viewMode === 'employee' && canEmployeeRequestTask(c, caseTaskRequests, currentUser);

  useEffect(() => {
    if (viewMode !== 'employee' && viewMode !== 'store_manager') return;
    if (!needsAssignmentReactivation(c, currentUser)) return;
    void reactivateAssignedCase(c.id);
  }, [c.id, c.status, c.currentStage, viewMode, currentUser, reactivateAssignedCase, c.assignedEmployee?.id]);

  const stageRec = findStageRecord(c.stages, c.currentStage);
  const assistantOnStage = stageRec?.assistantEmployee ?? null;
  type TabId = typeof activeTabLocal;
  const tabs: CaseTab<TabId>[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'stages', label: 'Progress' },
    { id: 'activity', label: 'Activity' },
    ...(c.comments.length > 0 ? [{ id: 'comments' as const, label: 'Comments', count: c.comments.length }] : []),
  ];

  const canEditCase = isFullAdminUser || isStoreManagerUser || canEmployeeEdit;
  const moreItems: MoreMenuItem[] = [
    ...(isFullAdminUser && canForceAdvance
      ? [{
          label: 'Force advance',
          icon: <FastForward className="h-4 w-4" />,
          title: "Move this case forward even if nobody is assigned or the employee hasn't submitted",
          onClick: () => setApprovalModal('force'),
        }]
      : []),
    ...(isFullAdminUser && canPostpone
      ? [{ label: 'Postpone', icon: <CalendarClock className="h-4 w-4" />, onClick: () => setShowPostpone(true) }]
      : []),
    ...(isFullAdminUser && canCancel
      ? [{ label: 'Cancel case', icon: <Ban className="h-4 w-4" />, onClick: () => setShowCancel(true) }]
      : []),
    ...(isFullAdminUser
      ? [{
          label: 'Delete case',
          icon: <Trash2 className="h-4 w-4" />,
          danger: true,
          onClick: () => {
            if (!confirm(`Delete case ${c.caseNumber}? This cannot be undone.`)) return;
            void deleteCase(c.id);
            onBack();
          },
        }]
      : []),
  ];

  const nextStageAssigned = nextStage ? c.stages.find((s) => s.stage === nextStage)?.assignedEmployee : undefined;
  const isFieldUser = viewMode === 'employee' || viewMode === 'store_manager';

  /* Actions available right now — same conditions as before, ordered by importance. */
  const actions: CaseAction[] = [];
  if (isFullAdminUser && isWaitingApproval) {
    actions.push(
      { key: 'approve', label: 'Approve', tone: 'success', icon: <CheckCircle className="h-5 w-5" />, onClick: () => setApprovalModal('approve') },
      { key: 'changes', label: 'Request changes', icon: <AlertTriangle className="h-4 w-4" />, onClick: () => setApprovalModal('changes') },
      { key: 'reject', label: 'Reject', danger: true, icon: <XCircle className="h-4 w-4" />, onClick: () => setApprovalModal('reject') },
    );
  }
  if (canStoreManagerSetSubmit) {
    actions.push({ key: 'set-photos', label: 'Upload set photos', tone: 'primary', icon: <Send className="h-5 w-5" />, onClick: () => setShowSubmit(true) });
  }
  if (isFieldUser && canEmployeeSubmit && !canStoreManagerSetSubmit && employeeSubmitStage) {
    actions.push({
      key: 'submit',
      label: STAGE_ACTIONS[employeeSubmitStage] ?? 'Submit',
      tone: 'primary',
      icon: <Send className="h-5 w-5" />,
      onClick: () => setShowSubmit(true),
    });
  }
  if (isFullAdminUser && isApproved && nextStage === 'Completed') {
    actions.push({
      key: 'close',
      label: c.cancelReason ? 'Close as cancelled' : 'Close case',
      tone: 'success',
      icon: <CheckCircle className="h-5 w-5" />,
      onClick: () => closeCase(c.id),
    });
  }
  if (isFullAdminUser && inFcfsPool) {
    actions.push({ key: 'pool', label: 'Assign from pool', tone: 'primary', icon: <User className="h-5 w-5" />, onClick: () => setAssignStage(c.currentStage) });
  }
  if (isFullAdminUser && c.status === 'Draft' && !inFcfsPool) {
    actions.push({ key: 'assign', label: 'Assign employee', tone: 'primary', icon: <User className="h-5 w-5" />, onClick: () => setAssignStage(c.currentStage) });
  }
  if (isFullAdminUser && isApproved && nextStage && nextStage !== 'Completed' && !nextStageAssigned) {
    actions.push({ key: 'assign-next', label: `Assign ${nextStage}`, tone: 'primary', icon: <User className="h-5 w-5" />, onClick: () => setAssignStage(nextStage) });
  }
  if (isFullAdminUser && isApproved && nextStage && nextStage !== 'Completed' && !!nextStageAssigned) {
    actions.push({
      key: 'activate',
      label: `Activate ${nextStage}`,
      tone: 'primary',
      icon: <User className="h-5 w-5" />,
      onClick: () => {
        const emp = c.stages.find((s) => s.stage === nextStage)?.assignedEmployee;
        if (emp) void assignEmployee(c.id, emp, nextStage);
      },
    });
  }
  if (viewMode === 'employee' && canRequest) {
    actions.push({
      key: 'request',
      label: requesting ? 'Sending…' : 'Request task',
      tone: 'primary',
      disabled: requesting,
      icon: <HandMetal className="h-5 w-5" />,
      onClick: async () => {
        setRequesting(true);
        const { error } = await requestTask(c.id);
        setRequesting(false);
        if (error) alert(error);
      },
    });
  }
  if (isFullAdminUser && isActive && c.currentStage !== 'Completed') {
    actions.push({ key: 'reassign', label: 'Reassign', icon: <User className="h-4 w-4" />, onClick: () => setAssignStage(c.currentStage) });
  }
  if (isStoreManagerUser && isActive && atSetPrep) {
    actions.push({ key: 'reassign-prep', label: 'Reassign set prep', icon: <User className="h-4 w-4" />, onClick: () => setAssignStage(c.currentStage) });
  }

  const ownerFirst = c.assignedEmployee?.name.split(' ')[0];
  const statusLine =
    c.status === 'Completed'
      ? 'This case is completed.'
      : c.status === 'Cancelled'
        ? 'This case was cancelled.'
        : isWaitingApproval
          ? isFullAdminUser
            ? `${c.currentStage} was submitted — review it and decide.`
            : `${c.currentStage} was submitted — waiting for admin approval.`
          : isActive && ownerFirst && !actions.some((a) => a.tone)
            ? `${ownerFirst} is working on ${c.currentStage}.`
            : null;

  const manageTeam =
    (viewMode === 'admin' || viewMode === 'store_manager') && c.status !== 'Completed' && c.status !== 'Cancelled'
      ? () => {
          setSelectedCase(null);
          setActiveTab(CASE_DUTIES_TAB_ID);
        }
      : undefined;

  return (
    <NexusPage maxWidthClass="max-w-[1400px]">
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
      {showPostpone && (
        <PostponeCaseModal
          isOpen={true}
          onClose={() => setShowPostpone(false)}
          caseId={c.id}
          currentStage={c.currentStage}
          surgeryDate={c.surgeryDate}
        />
      )}

      {/* Header */}
      <header className="mb-5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </button>
          <div className="flex items-center gap-2">
            {canEditCase && (
              <Button variant="outline" size="sm" icon={<Edit3 className="h-4 w-4" />} className="min-h-[40px]" onClick={() => setShowEdit(true)}>
                Edit
              </Button>
            )}
            <MoreMenu items={moreItems} />
          </div>
        </div>
        <p className="mt-2 text-xs font-medium tracking-wide text-gray-500">{c.caseNumber}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-gray-900 sm:text-3xl">{c.hospital.name}</h1>
          <Badge className={`${stc} text-xs`}>{c.status}</Badge>
          {c.priority !== 'Medium' ? <Badge className={`${pc} text-xs`}>{c.priority}</Badge> : null}
        </div>
        <p className="mt-1.5 text-sm font-semibold text-gray-900">
          {c.implantRequired} — Dr {c.doctor.name} · {formatDate(c.surgeryDate)}
        </p>
        {c.createdBy ? (
          <p className="mt-1 text-xs text-gray-500">
            Case added by <span className="font-medium text-gray-700">{c.createdBy}</span>
            {c.createdAt ? <> · {formatDate(c.createdAt)}</> : null}
          </p>
        ) : null}
      </header>

      {inFcfsPool && (
        <Notice tone="amber" icon={<AlertTriangle className="h-4 w-4" />} title={`Open pool — ${c.currentStage}`}>
          <p>
            {isFullAdminUser
              ? `${pendingForCase.length} pending request${pendingForCase.length === 1 ? '' : 's'}. Assign from the list below, Task Requests page, or pick anyone manually.`
              : myPendingRequest
                ? 'Your request is waiting for admin approval.'
                : 'Request this case — admin will assign who handles it.'}
          </p>
          {isFullAdminUser && pendingForCase.length > 0 && (
            <div className="mt-3 space-y-2">
              {pendingForCase.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white/80 p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={r.employeeName} size="xs" />
                    <span className="truncate text-xs font-medium text-gray-800">{r.employeeName}</span>
                    <span className="text-[10px] text-gray-500">{r.employeeDepartment} · {timeAgo(r.requestedAt)}</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={approvingRequestId === r.id}
                    onClick={async () => {
                      setApprovingRequestId(r.id);
                      const { error } = await approveTaskRequest(r.id);
                      setApprovingRequestId(null);
                      if (error) alert(error);
                    }}
                  >
                    {approvingRequestId === r.id ? '…' : 'Assign'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Notice>
      )}

      {returningUnused && (
        <Notice tone="amber" icon={<Ban className="h-4 w-4" />} title="Case cancelled — kit returning">
          The kit still comes back through Pickup → Checking &amp; Audit → Restock.
          {c.cancelReason ? ` Reason: ${c.cancelReason}` : ''}
        </Notice>
      )}

      {stageSubmitWaitMessage && isFieldUser && (
        <Notice tone="slate" icon={<Clock className="h-4 w-4" />} title="Not ready to submit yet">
          {stageSubmitWaitMessage}
        </Notice>
      )}

      {Boolean(c.postponeReason) && !returningUnused && c.status !== 'Cancelled' && (
        <Notice tone="sky" icon={<CalendarClock className="h-4 w-4" />} title={`Postponed to ${formatDate(c.surgeryDate)}`}>
          {c.postponedFrom ? `Was ${formatDate(c.postponedFrom)}. ` : ''}Reason: {c.postponeReason}
        </Notice>
      )}

      <CaseCurrentWork
        currentStage={c.currentStage}
        stages={VISIBLE_WORKFLOW_STAGES}
        currentIndex={currentStageIdx}
        owner={c.assignedEmployee}
        assistant={assistantOnStage}
        statusLine={statusLine}
        actions={actions}
        extra={
          viewMode === 'employee' && myPendingRequest && inFcfsPool ? (
            <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-xs">Request pending</Badge>
          ) : null
        }
      />

      <CaseDetailTabs tabs={tabs} active={activeTabLocal} onChange={setActiveTabLocal} />

      <motion.div key={activeTabLocal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
        {activeTabLocal === 'overview' && <CaseOverview case={c} onManageTeam={manageTeam} />}
        {activeTabLocal === 'stages' && (
          <CaseProgressTimeline stages={c.stages} currentIndex={currentStageIdx} viewer={currentUser} />
        )}
        {activeTabLocal === 'activity' && <CaseActivity logs={c.activityLogs} />}
        {activeTabLocal === 'comments' && <CaseComments comments={c.comments} />}
      </motion.div>
    </NexusPage>
  );
};
