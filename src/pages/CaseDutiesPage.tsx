import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  User,
  Building2,
  Calendar,
  Eye,
  RotateCcw,
  UserPlus,
} from 'lucide-react';
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

  const canAssign = viewMode === 'admin' || viewMode === 'store_manager';

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

  const renderDutyRow = (c: ImplantCase, kind: CaseDutyKind, compact?: boolean) => {
    const slot = getDutySlot(c, kind);
    const name = slot.assignedEmployee?.name;
    return (
      <div
        key={kind}
        className={
          compact
            ? 'flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0'
            : 'flex flex-col gap-1'
        }
      >
        <span className={`text-gray-600 shrink-0 ${compact ? 'text-xs w-[7.5rem]' : 'text-xs font-medium'}`}>
          {CASE_DUTY_LABELS[kind]}
        </span>
        <span
          className={`flex-1 truncate text-gray-900 ${compact ? 'text-sm font-medium' : 'font-medium max-w-[160px]'}`}
        >
          {name ?? '—'}
        </span>
        {canAssign && (
          <Button
            variant="outline"
            size="sm"
            className={`!min-h-8 shrink-0 ${compact ? 'text-xs px-2.5' : 'text-xs w-fit'}`}
            icon={<UserPlus className="h-3.5 w-3.5" />}
            onClick={() => openAssign(c, kind)}
          >
            {name ? 'Change' : 'Assign'}
          </Button>
        )}
      </div>
    );
  };

  return (
    <NexusPage maxWidthClass="max-w-[1600px]">
      <NexusPageHeader
        title="Return, Clean & Restock"
        description={`${list.length} open ${list.length === 1 ? 'case' : 'cases'} · assign duties separate from workflow stages`}
      />

      <Card className="mb-4">
        <div className="p-4">
          <div className="relative w-full min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search cases, hospitals, doctors…"
              className="nexus-field-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Mobile — same card pattern as Cases list */}
      <div className="lg:hidden space-y-3 mb-4">
        {list.map((c) => {
          const sc = stageColors[c.currentStage];
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setSelectedCase(c.id)}
                  className="text-sm font-semibold nexus-link text-left"
                >
                  {c.caseNumber}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCase(c.id)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 shrink-0"
                  title="View case"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 text-sm mb-3">
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
              <div className="mb-3">
                <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-xs`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                  {c.currentStage}
                </Badge>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Duties</p>
                {CASE_DUTY_KINDS.map((kind) => renderDutyRow(c, kind, true))}
              </div>
            </motion.div>
          );
        })}
        {list.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No open cases match your search</p>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Case</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Surgery</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Hospital</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Workflow stage</th>
                {CASE_DUTY_KINDS.map((kind) => (
                  <th key={kind} className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[140px]">
                    {CASE_DUTY_LABELS[kind]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map((c) => (
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
                    <Badge className="text-xs">{c.currentStage}</Badge>
                  </td>
                  {CASE_DUTY_KINDS.map((kind) => (
                    <td key={kind} className="px-4 py-3.5">
                      {renderDutyRow(c, kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <RotateCcw className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No open cases match your search</p>
            </div>
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
