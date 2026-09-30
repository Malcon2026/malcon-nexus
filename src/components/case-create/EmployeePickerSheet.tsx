import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Clock, PauseCircle, Search, UserX } from 'lucide-react';
import { PickerSheet } from './PickerSheet';
import { Avatar } from '../ui/Avatar';
import type { Employee } from '../../types';
import { cn } from '../../utils/cn';
import { getEmployeeDepartments } from '../../constants/departments';
import { SURGERY_SELF_ASSIGNMENT_VALUE } from '../../lib/caseWorkflow';
import {
  RETURN_OUTCOMES,
  RETURN_PARKED_VALUE,
  RETURN_USED_NO_RETURN_VALUE,
} from '../../lib/returnPickup';
import {
  HOSPITAL_SELF_LABEL,
  matchesEmployee,
  splitEmployeesByDepartment,
} from './caseCreateHelpers';

interface EmployeePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  employees: Employee[];
  /** Current draft value (employee id or a special sentinel). */
  value: string;
  onSelect: (value: string) => void;
  /** Surgery only — SURGERY_SELF_ASSIGNMENT_VALUE. */
  allowHospitalSelf?: boolean;
  /** Return duty only — Used/no return + Parked. */
  allowReturnSpecial?: boolean;
  /** Offer "Assign later" when something is selected. */
  clearLabel?: string;
  /** Set false when a value is mandatory (e.g. punched-in-by). */
  allowClear?: boolean;
  /** Typical department — matching people appear first. */
  suggestedDepartment?: string | null;
  excludeId?: string;
}

const optionBase =
  'flex w-full items-center gap-3 px-4 sm:px-5 min-h-[56px] py-2 text-left transition-colors focus:outline-none focus-visible:bg-[var(--color-accent-muted)] hover:bg-gray-50';

const Check_: React.FC<{ show: boolean }> = ({ show }) =>
  show ? <Check className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-label="Selected" /> : null;

export const EmployeePickerSheet: React.FC<EmployeePickerSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  employees,
  value,
  onSelect,
  allowHospitalSelf = false,
  allowReturnSpecial = false,
  clearLabel = 'Assign later',
  allowClear = true,
  suggestedDepartment,
  excludeId,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const pool = useMemo(
    () => employees.filter((e) => e.id !== excludeId && matchesEmployee(e, query)),
    [employees, excludeId, query],
  );
  const { preferred, others } = useMemo(
    () => splitEmployeesByDepartment(pool, suggestedDepartment),
    [pool, suggestedDepartment],
  );

  const pick = (v: string) => {
    onSelect(v);
    onClose();
  };

  const q = query.trim().toLowerCase();
  const showHospital = allowHospitalSelf && (!q || 'self hospital'.includes(q));
  const showReturn = allowReturnSpecial && !q;

  const renderPerson = (emp: Employee) => {
    const selected = value === emp.id;
    return (
      <li key={emp.id}>
        <button
          type="button"
          onClick={() => pick(emp.id)}
          aria-pressed={selected}
          className={cn(optionBase, selected && 'bg-[var(--color-accent-muted)]')}
        >
          <Avatar name={emp.name} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-gray-900">
              {emp.name}
            </span>
            <span className="block truncate text-xs text-gray-500">
              {getEmployeeDepartments(emp).join(', ') || 'Team member'}
            </span>
          </span>
          <Check_ show={selected} />
        </button>
      </li>
    );
  };

  const groupLabel = (text: string) => (
    <li className="px-4 sm:px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500" aria-hidden>
      {text}
    </li>
  );

  return (
    <PickerSheet isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="px-4 sm:px-5 pb-2 sticky top-0 bg-white z-10">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            inputMode="search"
            autoFocus={
              typeof window === 'undefined' ||
              !window.matchMedia('(hover: none) and (pointer: coarse)').matches
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or team"
            aria-label="Search people"
            className="nexus-field-input !min-h-[48px] !text-base"
          />
        </div>
      </div>

      <ul className="pb-3">
        {showHospital && (
          <li>
            <button
              type="button"
              onClick={() => pick(SURGERY_SELF_ASSIGNMENT_VALUE)}
              aria-pressed={value === SURGERY_SELF_ASSIGNMENT_VALUE}
              className={cn(optionBase, value === SURGERY_SELF_ASSIGNMENT_VALUE && 'bg-[var(--color-accent-muted)]')}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-900">{HOSPITAL_SELF_LABEL}</span>
              <Check_ show={value === SURGERY_SELF_ASSIGNMENT_VALUE} />
            </button>
          </li>
        )}

        {showReturn &&
          RETURN_OUTCOMES.map((o) => {
            const v = o.id === 'used_no_return' ? RETURN_USED_NO_RETURN_VALUE : o.id === 'parked' ? RETURN_PARKED_VALUE : null;
            if (!v) return null;
            const selected = value === v;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => pick(v)}
                  aria-pressed={selected}
                  className={cn(optionBase, selected && 'bg-[var(--color-accent-muted)]')}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    {o.id === 'parked' ? <PauseCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-900">{o.title}</span>
                  <Check_ show={selected} />
                </button>
              </li>
            );
          })}

        {preferred.length > 0 && (
          <>
            {groupLabel(suggestedDepartment ?? 'Suggested')}
            {preferred.map(renderPerson)}
            {others.length > 0 && groupLabel('Everyone else')}
          </>
        )}
        {others.map(renderPerson)}

        {preferred.length === 0 && others.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-gray-500">No one matches “{query}”.</li>
        )}

        {value && !q && allowClear && (
          <li className="mt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => pick('')}
              className={cn(optionBase, 'text-gray-600')}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <UserX className="h-5 w-5" />
              </span>
              <span className="text-[15px] font-medium">{clearLabel}</span>
            </button>
          </li>
        )}
      </ul>
    </PickerSheet>
  );
};
