import React, { useMemo, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { EmployeeSearchSelect } from './EmployeeSearchSelect';
import { HospitalSearchSelect } from './HospitalSearchSelect';
import { useStore } from '../store/useStore';
import type { ImplantCase, Priority } from '../types';
import {
  ASSIGNABLE_WORKFLOW_STAGES,
  STAGE_DEPARTMENT_MAP,
  SURGERY_SELF_ASSIGNMENT_VALUE,
  findStageRecord,
  isCaseAssignedToEmployee,
  isFcfsStage,
  type AssignableStage,
} from '../lib/caseWorkflow';

interface EditCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  case: ImplantCase;
}

const emptyStageIds = (): Record<AssignableStage, string> =>
  Object.fromEntries(ASSIGNABLE_WORKFLOW_STAGES.map((s) => [s, ''])) as Record<
    AssignableStage,
    string
  >;

function stageAssignmentsFromCase(c: ImplantCase): Record<AssignableStage, string> {
  const result = emptyStageIds();
  for (const stage of ASSIGNABLE_WORKFLOW_STAGES) {
    const rec = findStageRecord(c.stages, stage);
    if (rec?.selfPerformed) {
      result[stage] = SURGERY_SELF_ASSIGNMENT_VALUE;
    } else if (rec?.assignedEmployee?.id) {
      result[stage] = rec.assignedEmployee.id;
    }
  }
  return result;
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({ isOpen, onClose, case: c }) => {
  const { updateCase, updateCaseStageAssignments, hospitals, employees, viewMode, currentUser } =
    useStore();
  const isAdmin = viewMode === 'admin';
  const isOwnCase = !isAdmin && isCaseAssignedToEmployee(c, currentUser);

  const [form, setForm] = useState({
    hospitalId: c.hospital.id,
    doctorName: c.doctor.name,
    surgeryDate: c.surgeryDate,
    implantRequired: c.implantRequired,
    implantType: c.implantType,
    implantCompany: c.implantCompany || '',
    priority: c.priority,
    remarks: c.remarks || '',
    invoiceAmount: c.invoiceAmount != null ? String(c.invoiceAmount) : '',
    collectedAmount: c.collectedAmount != null ? String(c.collectedAmount) : '',
    paymentStatus: c.paymentStatus || 'Pending',
  });
  const [stageEmployeeIds, setStageEmployeeIds] = useState(() => stageAssignmentsFromCase(c));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.role === 'employee' && e.status === 'Active'),
    [employees],
  );

  const initialStageIds = useMemo(() => stageAssignmentsFromCase(c), [c]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAdmin) {
      if (!isOwnCase) return;
      setSubmitting(true);
      try {
        await updateCase(c.id, { remarks: form.remarks });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save changes.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!form.hospitalId || !form.doctorName || !form.surgeryDate || !form.implantRequired) {
      setError('Please fill in all required fields marked with an asterisk (*).');
      return;
    }
    const hospital = hospitals.find((h) => h.id === form.hospitalId);
    if (!hospital) return;

    const doctor = {
      id: c.doctor.id.startsWith('doc-') ? c.doctor.id : `doc-${Date.now()}`,
      name: form.doctorName.trim(),
      specialization: 'Surgeon',
      hospitalId: hospital.id,
      phone: '',
    };

    const stageDraft: Partial<Record<AssignableStage, string>> = {};
    for (const stage of ASSIGNABLE_WORKFLOW_STAGES) {
      if (stageEmployeeIds[stage] !== initialStageIds[stage]) {
        stageDraft[stage] = stageEmployeeIds[stage];
      }
    }

    setSubmitting(true);
    try {
      await updateCase(c.id, {
        hospital,
        doctor,
        surgeryDate: form.surgeryDate,
        implantRequired: form.implantRequired,
        implantType: form.implantType,
        implantCompany: form.implantCompany,
        priority: form.priority,
        remarks: form.remarks,
        dueDate: form.surgeryDate,
        invoiceAmount: form.invoiceAmount === '' ? undefined : Number(form.invoiceAmount),
        collectedAmount: form.collectedAmount === '' ? undefined : Number(form.collectedAmount),
        paymentStatus: form.paymentStatus,
      });

      if (Object.keys(stageDraft).length > 0) {
        const { error: teamError } = await updateCaseStageAssignments(c.id, stageDraft);
        if (teamError) {
          setError(teamError);
          return;
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white placeholder:text-gray-400';
  const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

  if (!isAdmin && !isOwnCase) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Implant Case"
      subtitle={isAdmin ? `Modify details for Case ${c.caseNumber}` : `Add notes for Case ${c.caseNumber}`}
      size={isAdmin ? 'xl' : 'lg'}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {!isAdmin && (
          <div>
            <label className={labelClass}>Remarks / Notes</label>
            <textarea
              rows={5}
              className={inputClass}
              placeholder="Add any special instructions or updates..."
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              autoFocus
            />
          </div>
        )}

        {isAdmin && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Hospital *</label>
                <HospitalSearchSelect
                  hospitals={hospitals}
                  value={form.hospitalId}
                  onChange={(hospitalId) => setForm({ ...form, hospitalId, doctorName: '' })}
                  placeholder="Search hospital..."
                />
              </div>
              <div>
                <label className={labelClass}>Doctor Name *</label>
                <input
                  type="text"
                  placeholder="Enter doctor's name"
                  className={inputClass}
                  value={form.doctorName}
                  onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
                  disabled={!form.hospitalId}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Surgery Date *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.surgeryDate}
                  onChange={(e) => setForm({ ...form, surgeryDate: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Priority *</label>
                <select
                  className={inputClass}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Surgery *</label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Total Knee Replacement"
                value={form.implantRequired}
                onChange={(e) => setForm({ ...form, implantRequired: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Implant Type</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Knee Implant, Hip Implant"
                  value={form.implantType}
                  onChange={(e) => setForm({ ...form, implantType: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Implant Company</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Zimmer Biomet, Stryker"
                  value={form.implantCompany}
                  onChange={(e) => setForm({ ...form, implantCompany: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Remarks / Notes</label>
              <textarea
                rows={3}
                className={inputClass}
                placeholder="Add any special instructions..."
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Billing</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Invoice Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="0.00"
                    value={form.invoiceAmount}
                    onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Collected Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="0.00"
                    value={form.collectedAmount}
                    onChange={(e) => setForm({ ...form, collectedAmount: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>Payment Status</label>
                  <select
                    className={inputClass}
                    value={form.paymentStatus}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentStatus: e.target.value as 'Pending' | 'Partial' | 'Collected',
                      })
                    }
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Collected">Collected</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Assign team</h3>
              <p className="text-xs text-gray-500 mb-3">
                Change who handles each stage — past, current, or upcoming. Pick{' '}
                <strong>Self</strong> for Surgery when the hospital performs it independently.
              </p>
              <div className="space-y-3">
                {ASSIGNABLE_WORKFLOW_STAGES.map((stage) => {
                  const deptHint = STAGE_DEPARTMENT_MAP[stage];
                  const fcfs = isFcfsStage(stage);
                  const isCurrent = stage === c.currentStage;
                  const stageRecord = findStageRecord(c.stages, stage);
                  const isDone = stageRecord?.status === 'Approved';

                  return (
                    <div
                      key={stage}
                      className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2 sm:gap-3 items-start sm:items-center"
                    >
                      <div>
                        <p className="text-xs font-medium text-gray-800">
                          {stage}
                          {isCurrent && (
                            <span className="ml-1.5 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                              Current
                            </span>
                          )}
                          {isDone && !isCurrent && (
                            <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                              Done
                            </span>
                          )}
                        </p>
                        {deptHint && <p className="text-[11px] text-gray-400">{deptHint}</p>}
                        {fcfs && (
                          <p className="text-[10px] text-amber-600 mt-0.5">FCFS pool when stage opens</p>
                        )}
                      </div>
                      <EmployeeSearchSelect
                        employees={activeEmployees}
                        value={stageEmployeeIds[stage]}
                        onChange={(value) =>
                          setStageEmployeeIds({ ...stageEmployeeIds, [stage]: value })
                        }
                        suggestedDepartment={deptHint}
                        allowSelf={stage === 'Surgery'}
                        placeholder="Unassigned"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
