import React, { useMemo, useState } from 'react';
import { Search, ChevronRight, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { NexusPage, NexusPageHeader } from '../components/layout/NexusPageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmployeeSearchSelect } from '../components/EmployeeSearchSelect';
import { formatDate } from '../utils/helpers';
import {
  CASE_DUTY_KINDS,
  CASE_DUTY_LABELS,
  CASE_DUTIES_PAGE_DESCRIPTION,
  CASE_DUTIES_PAGE_TITLE,
  dutyPickerPlaceholder,
  getDutyEmployee,
  postSurgerySummaryLine,
  type CaseDutyKind,
  casesForDutyBoard,
} from '../lib/caseDuties';
import type { ImplantCase } from '../types';
import { CaseDetail } from './CaseDetail';

function emptyDraftIds(): Record<CaseDutyKind, string> {
  return { return: '', cleaning: '', restock: '' };
}

export const CaseDutiesPage: React.FC = () => {
  const { cases, employees, confirmPostSurgeryTeam, setSelectedCase, selectedCaseId, viewMode } =
    useStore();
  const [search, setSearch] = useState('');
  const [pickCase, setPickCase] = useState<ImplantCase | null>(null);
  const [draftIds, setDraftIds] = useState<Record<CaseDutyKind, string>>(emptyDraftIds);
  const [submitting, setSubmitting] = useState(false);

  const canConfirm = viewMode === 'admin' || viewMode === 'store_manager';

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

  const openPicker = (c: ImplantCase) => {
    if (!canConfirm) return;
    setPickCase(c);
    setDraftIds(
      Object.fromEntries(
        CASE_DUTY_KINDS.map((k) => [k, getDutyEmployee(c, k)?.id ?? '']),
      ) as Record<CaseDutyKind, string>,
    );
  };

  const handleConfirm = async () => {
    if (!pickCase) return;
    setSubmitting(true);
    try {
      await confirmPostSurgeryTeam(pickCase.id, draftIds);
      setPickCase(null);
      setDraftIds(emptyDraftIds());
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

  const hasAnyDraft = CASE_DUTY_KINDS.some((k) => draftIds[k]?.trim());

  return (
    <NexusPage maxWidthClass="max-w-[1600px]">
      <NexusPageHeader
        title={CASE_DUTIES_PAGE_TITLE}
        description={`${list.length} open ${list.length === 1 ? 'case' : 'cases'}`}
      />

      <p className="mb-4 text-sm text-gray-600 leading-relaxed px-0.5">{CASE_DUTIES_PAGE_DESCRIPTION}</p>

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

      <div className="space-y-2 lg:space-y-0">
        {list.map((c) => {
          const Row = canConfirm ? 'button' : 'div';
          return (
            <Row
              key={c.id}
              type={canConfirm ? 'button' : undefined}
              className={
                canConfirm
                  ? 'w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-3 active:bg-gray-50/90 lg:hidden'
                  : 'bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 lg:hidden'
              }
              onClick={canConfirm ? () => openPicker(c) : undefined}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-accent)]">{c.caseNumber}</p>
                <p className="text-sm text-gray-800 truncate">{c.hospital.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(c.surgeryDate)}</p>
                <p className="text-xs text-gray-600 mt-2 leading-snug">{postSurgerySummaryLine(c)}</p>
              </div>
              {canConfirm && <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />}
            </Row>
          );
        })}
      </div>

      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Case</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Surgery</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Hospital</th>
                {CASE_DUTY_KINDS.map((kind) => (
                  <th key={kind} className="text-left px-4 py-3 font-semibold text-gray-700">
                    {CASE_DUTY_LABELS[kind]}
                  </th>
                ))}
                {canConfirm && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/80">
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
                  {CASE_DUTY_KINDS.map((kind) => (
                    <td key={kind} className="px-4 py-3.5 text-gray-900 font-medium">
                      {getDutyEmployee(c, kind)?.name ?? '—'}
                    </td>
                  ))}
                  {canConfirm && (
                    <td className="px-4 py-3.5">
                      <Button variant="outline" size="sm" onClick={() => openPicker(c)}>
                        Select people
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {list.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100 mt-2">
          <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No cases found</p>
        </div>
      )}

      <Modal
        isOpen={!!pickCase}
        onClose={() => {
          setPickCase(null);
          setDraftIds(emptyDraftIds());
        }}
        title="Return, clean & restock"
        subtitle={pickCase ? `${pickCase.caseNumber} · ${pickCase.hospital.name}` : ''}
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setPickCase(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!hasAnyDraft || submitting}
              onClick={() => void handleConfirm()}
            >
              {submitting ? 'Updating…' : 'Confirm assignments'}
            </Button>
          </div>
        }
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-600">
            Kit prep, Delivery, and Surgery were set when the case was created. Choose the three people
            below — they will appear on the case and be notified.
          </p>
          {CASE_DUTY_KINDS.map((kind) => (
            <div key={kind}>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {CASE_DUTY_LABELS[kind]}
              </label>
              <EmployeeSearchSelect
                employees={employees}
                value={draftIds[kind]}
                onChange={(value) => setDraftIds((d) => ({ ...d, [kind]: value }))}
                placeholder={dutyPickerPlaceholder(kind)}
              />
            </div>
          ))}
        </div>
      </Modal>
    </NexusPage>
  );
};
