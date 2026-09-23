import React, { useMemo, useState } from 'react';
import { Search, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmployeeSearchSelect } from '../components/EmployeeSearchSelect';
import { formatDate } from '../utils/helpers';
import {
  CASE_DUTY_KINDS,
  CASE_DUTY_LABELS,
  type CaseDutyKind,
  type CaseDutyTabId,
  casesForDutyBoard,
  dutyKindForTab,
  getDutySlot,
} from '../lib/caseDuties';
import type { ImplantCase } from '../types';
import { CaseDetail } from './CaseDetail';
import { NEXUS_FORM_CONTROL } from '../constants/formStyles';

type Props = {
  tabId: CaseDutyTabId;
};

export const CaseDutiesPage: React.FC<Props> = ({ tabId }) => {
  const { cases, employees, assignCaseDuty, setSelectedCase, selectedCaseId, viewMode } = useStore();
  const [search, setSearch] = useState('');
  const [assignCase, setAssignCase] = useState<ImplantCase | null>(null);
  const [assignKind, setAssignKind] = useState<CaseDutyKind>('return');
  const [employeeId, setEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const focusKind = dutyKindForTab(tabId);
  const canAssign = viewMode === 'admin' || viewMode === 'store_manager';

  const title =
    tabId === 'case-duties-combined'
      ? 'Return, Cleaning & Restock'
      : CASE_DUTY_LABELS[focusKind as CaseDutyKind] ?? 'Duties';

  const list = useMemo(() => {
    let rows = casesForDutyBoard(cases);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          c.hospital.name.toLowerCase().includes(q) ||
          c.doctor.name.toLowerCase().includes(q),
      );
    }
    return rows.sort((a, b) => b.caseNumber.localeCompare(a.caseNumber));
  }, [cases, search]);

  const openAssign = (c: ImplantCase, kind: CaseDutyKind) => {
    setAssignCase(c);
    setAssignKind(kind);
    setEmployeeId(getDutySlot(c, kind).assignedEmployee?.id ?? '');
  };

  const handleSaveAssign = async () => {
    if (!assignCase || !employeeId) return;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    setSubmitting(true);
    try {
      await assignCaseDuty(assignCase.id, assignKind, emp);
      setAssignCase(null);
      setEmployeeId('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not assign.');
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedCaseId) {
    const theCase = cases.find((c) => c.id === selectedCaseId);
    if (theCase) {
      return <CaseDetail case={theCase} onBack={() => setSelectedCase(null)} />;
    }
  }

  const showKinds: CaseDutyKind[] =
    focusKind === 'all' ? CASE_DUTY_KINDS : [focusKind as CaseDutyKind];

  return (
    <NexusPage maxWidthClass="max-w-[1600px]">
      <NexusPageHeader
        title={title}
        description="Assign return, pick-up, cleaning, and restock duties per case — separate from the main surgery workflow stage."
      />

      <Card className="mb-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search case, hospital, doctor…"
            className={NEXUS_FORM_CONTROL}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Case</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Surgery</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Hospital</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Workflow stage</th>
                {showKinds.map((kind) => (
                  <th key={kind} className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[140px]">
                    {CASE_DUTY_LABELS[kind]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-semibold text-[var(--color-accent)] hover:underline"
                      onClick={() => setSelectedCase(c.id)}
                    >
                      {c.caseNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(c.surgeryDate)}</td>
                  <td className="px-4 py-3 text-gray-700">{c.hospital.name}</td>
                  <td className="px-4 py-3">
                    <Badge className="text-xs">{c.currentStage}</Badge>
                  </td>
                  {showKinds.map((kind) => {
                    const slot = getDutySlot(c, kind);
                    return (
                      <td key={kind} className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-medium truncate max-w-[160px]">
                            {slot.assignedEmployee?.name ?? '—'}
                          </span>
                          {canAssign && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="!min-h-8 text-xs w-fit"
                              icon={<User className="h-3.5 w-3.5" />}
                              onClick={() => openAssign(c, kind)}
                            >
                              Assign
                            </Button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <p className="text-center text-gray-500 py-12 text-sm">No open cases match your search.</p>
          )}
        </div>
      </Card>

      <Modal
        isOpen={!!assignCase}
        onClose={() => setAssignCase(null)}
        title={`Assign ${CASE_DUTY_LABELS[assignKind]}`}
        subtitle={assignCase ? `${assignCase.caseNumber} · ${assignCase.hospital.name}` : ''}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignCase(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!employeeId || submitting}
              onClick={() => void handleSaveAssign()}
            >
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="p-6">
          <EmployeeSearchSelect
            employees={employees}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder="Search employee…"
          />
        </div>
      </Modal>
    </NexusPage>
  );
};
