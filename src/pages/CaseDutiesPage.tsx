import React, { useMemo, useState } from 'react';
import { Search, ChevronRight, RotateCcw, Info } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmployeeSearchSelect } from '../components/EmployeeSearchSelect';
import { formatDate, stageColors } from '../utils/helpers';
import {
  CASE_DUTY_KINDS,
  CASE_DUTY_LABELS,
  CASE_DUTIES_PAGE_DESCRIPTION,
  CASE_DUTIES_PAGE_TITLE,
  dutyModalTitle,
  dutyPickerPlaceholder,
  type CaseDutyKind,
  casesForDutyBoard,
  getDutySlot,
} from '../lib/caseDuties';
import type { ImplantCase } from '../types';
import { CaseDetail } from './CaseDetail';

export const CaseDutiesPage: React.FC = () => {
  const { cases, employees, assignCaseDuty, setSelectedCase, selectedCaseId, viewMode } = useStore();
  const [search, setSearch] = useState('');
  const [assignCase, setAssignCase] = useState<ImplantCase | null>(null);
  const [assignKind, setAssignKind] = useState<CaseDutyKind>('return');
  const [employeeId, setEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canPick = viewMode === 'admin' || viewMode === 'store_manager';

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

  const openPicker = (c: ImplantCase, kind: CaseDutyKind) => {
    if (!canPick) return;
    setAssignCase(c);
    setAssignKind(kind);
    setEmployeeId(getDutySlot(c, kind).assignedEmployee?.id ?? '');
  };

  const handleSave = async () => {
    if (!assignCase || !employeeId) return;
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    setSubmitting(true);
    try {
      await assignCaseDuty(assignCase.id, assignKind, emp);
      setAssignCase(null);
      setEmployeeId('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save.');
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

  const desktopDutyCell = (c: ImplantCase, kind: CaseDutyKind) => {
    const name = getDutySlot(c, kind).assignedEmployee?.name;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
          {name ?? '—'}
        </span>
        {canPick && (
          <button
            type="button"
            className="text-xs font-medium text-[var(--color-accent)] hover:underline text-left w-fit"
            onClick={() => openPicker(c, kind)}
          >
            {name ? 'Change' : 'Select person'}
          </button>
        )}
      </div>
    );
  };

  return (
    <NexusPage maxWidthClass="max-w-[1600px]">
      <NexusPageHeader
        title={CASE_DUTIES_PAGE_TITLE}
        description={`${list.length} open ${list.length === 1 ? 'case' : 'cases'}`}
      />

      <div className="mb-4 flex gap-2.5 rounded-xl border border-sky-100 bg-sky-50/90 px-3.5 py-3 text-sm text-sky-950">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600" aria-hidden />
        <p className="leading-snug">{CASE_DUTIES_PAGE_DESCRIPTION}</p>
      </div>

      <Card className="mb-4">
        <div className="p-4">
          <div className="relative w-full min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search case or hospital…"
              className="nexus-field-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Mobile — one card per case, tap a row to pick a person */}
      <div className="lg:hidden space-y-3 mb-4">
        {list.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <button
              type="button"
              className="w-full text-left px-4 pt-4 pb-3 border-b border-gray-100 active:bg-gray-50/80"
              onClick={() => setSelectedCase(c.id)}
            >
              <p className="text-base font-semibold text-[var(--color-accent)]">{c.caseNumber}</p>
              <p className="text-sm text-gray-800 font-medium truncate mt-0.5">{c.hospital.name}</p>
              <p className="text-xs text-gray-500 mt-1">{formatDate(c.surgeryDate)}</p>
            </button>
            <div className="px-2 pb-1">
              {CASE_DUTY_KINDS.map((kind) => {
                const name = getDutySlot(c, kind).assignedEmployee?.name;
                const Row = canPick ? 'button' : 'div';
                return (
                  <Row
                    key={kind}
                    type={canPick ? 'button' : undefined}
                    className={
                      canPick
                        ? 'w-full flex items-center gap-2 min-h-[48px] px-2 py-2 rounded-lg active:bg-gray-50 text-left'
                        : 'flex items-center gap-2 min-h-[48px] px-2 py-2'
                    }
                    onClick={canPick ? () => openPicker(c, kind) : undefined}
                  >
                    <span className="text-sm text-gray-600 w-[7rem] shrink-0">{CASE_DUTY_LABELS[kind]}</span>
                    <span
                      className={`flex-1 text-sm truncate text-right ${
                        name ? 'font-medium text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {name ?? 'Select person'}
                    </span>
                    {canPick && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />}
                  </Row>
                );
              })}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No cases found</p>
          </div>
        )}
      </div>

      {/* Desktop */}
      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Case</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Surgery</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Hospital</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Workflow</th>
                {CASE_DUTY_KINDS.map((kind) => (
                  <th key={kind} className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[130px]">
                    {CASE_DUTY_LABELS[kind]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((c) => {
                const sc = stageColors[c.currentStage];
                return (
                  <tr key={c.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        className="text-sm font-semibold nexus-link"
                        onClick={() => setSelectedCase(c.id)}
                      >
                        {c.caseNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">{formatDate(c.surgeryDate)}</td>
                    <td className="px-4 py-3.5 text-gray-700">{c.hospital.name}</td>
                    <td className="px-4 py-3.5">
                      <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                        {c.currentStage}
                      </Badge>
                    </td>
                    {CASE_DUTY_KINDS.map((kind) => (
                      <td key={kind} className="px-4 py-3.5">
                        {desktopDutyCell(c, kind)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No cases found</p>
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={!!assignCase}
        onClose={() => setAssignCase(null)}
        title={dutyModalTitle(assignKind)}
        subtitle={
          assignCase
            ? `${assignCase.caseNumber} · ${assignCase.hospital.name} · not workflow assignee`
            : ''
        }
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
              onClick={() => void handleSave()}
            >
              {submitting ? 'Saving…' : 'Save selection'}
            </Button>
          </div>
        }
      >
        <div className="p-6 space-y-3">
          <p className="text-xs text-gray-600">
            This name is stored for return & cleaning team only. It does not change who is assigned on the
            workflow board.
          </p>
          <EmployeeSearchSelect
            employees={employees}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder={dutyPickerPlaceholder(assignKind)}
          />
        </div>
      </Modal>
    </NexusPage>
  );
};
