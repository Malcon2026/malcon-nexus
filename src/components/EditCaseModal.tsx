import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { EmployeeAssignPicker } from './EmployeeAssignPicker';
import { useStore } from '../store/useStore';
import type { ImplantCase, Priority } from '../types';
import { STAGE_DEPARTMENT_MAP, isCaseAssignedToEmployee } from '../lib/caseWorkflow';

interface EditCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  case: ImplantCase;
}

export const EditCaseModal: React.FC<EditCaseModalProps> = ({ isOpen, onClose, case: c }) => {
  const { updateCase, assignEmployee, hospitals, employees, viewMode, currentUser } = useStore();
  const isAdmin = viewMode === 'admin';
  const isOwnCase = !isAdmin && isCaseAssignedToEmployee(c, currentUser);

  const [form, setForm] = useState({
    hospitalId: c.hospital.id,
    doctorName: c.doctor.name,
    surgeryDate: c.surgeryDate,
    implantRequired: c.implantRequired,
    implantType: c.implantType,
    priority: c.priority,
    remarks: c.remarks || '',
    invoiceAmount: c.invoiceAmount != null ? String(c.invoiceAmount) : '',
    collectedAmount: c.collectedAmount != null ? String(c.collectedAmount) : '',
    paymentStatus: c.paymentStatus || 'Pending',
  });
  const [reassignPicker, setReassignPicker] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(c.assignedEmployee);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedDept = STAGE_DEPARTMENT_MAP[c.currentStage] ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Employees only ever touch remarks on their own case — everything else stays as-is.
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
    const hospital = hospitals.find(h => h.id === form.hospitalId);
    if (!hospital) return;

    const doctor = {
      id: c.doctor.id.startsWith('doc-') ? c.doctor.id : `doc-${Date.now()}`,
      name: form.doctorName.trim(),
      specialization: 'Surgeon',
      hospitalId: hospital.id,
      phone: '',
    };

    setSubmitting(true);
    try {
      await updateCase(c.id, {
        hospital,
        doctor,
        surgeryDate: form.surgeryDate,
        implantRequired: form.implantRequired,
        implantType: form.implantType,
        priority: form.priority,
        remarks: form.remarks,
        dueDate: form.surgeryDate,
        invoiceAmount: form.invoiceAmount === '' ? undefined : Number(form.invoiceAmount),
        collectedAmount: form.collectedAmount === '' ? undefined : Number(form.collectedAmount),
        paymentStatus: form.paymentStatus,
      });

      if (selectedEmp && selectedEmp.id !== c.assignedEmployee?.id) {
        await assignEmployee(c.id, selectedEmp, c.currentStage);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white placeholder:text-gray-400";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1.5";

  if (!isAdmin && !isOwnCase) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Implant Case"
      subtitle={isAdmin ? `Modify details for Case ${c.caseNumber}` : `Add notes for Case ${c.caseNumber}`}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
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
              onChange={e => setForm({ ...form, remarks: e.target.value })}
              autoFocus
            />
          </div>
        )}

        {isAdmin && (
          <>
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

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Billing</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Invoice Amount</label>
                  <input type="number" min="0" step="0.01" className={inputClass} placeholder="0.00" value={form.invoiceAmount} onChange={e => setForm({...form, invoiceAmount: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>Collected Amount</label>
                  <input type="number" min="0" step="0.01" className={inputClass} placeholder="0.00" value={form.collectedAmount} onChange={e => setForm({...form, collectedAmount: e.target.value})} />
                </div>
                <div>
                  <label className={labelClass}>Payment Status</label>
                  <select className={inputClass} value={form.paymentStatus} onChange={e => setForm({...form, paymentStatus: e.target.value as 'Pending' | 'Partial' | 'Collected'})}>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Collected">Collected</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Assigned employee — {c.currentStage}
                </p>
                {!reassignPicker && (
                  <button
                    type="button"
                    onClick={() => setReassignPicker(true)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Change
                  </button>
                )}
              </div>
              {!reassignPicker ? (
                <p className="text-sm text-gray-600">
                  {selectedEmp ? `${selectedEmp.name} (${selectedEmp.department})` : 'Unassigned'}
                </p>
              ) : (
                <EmployeeAssignPicker
                  employees={employees}
                  selected={selectedEmp}
                  onSelect={setSelectedEmp}
                  suggestedDepartment={suggestedDept}
                />
              )}
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};
