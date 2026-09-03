import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, HandMetal, Search, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import type { Employee } from '../types';
import { departmentColors } from '../utils/helpers';
import { employeeCoversDepartment, getEmployeeDepartments } from '../constants/departments';
import { SURGERY_SELF_ASSIGNMENT_VALUE } from '../lib/caseWorkflow';

interface EmployeeSearchSelectProps {
  employees: Employee[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Typical department — matching employees appear first in results. */
  suggestedDepartment?: string | null;
  allowSelf?: boolean;
  selfLabel?: string;
  disabled?: boolean;
}

function sortEmployees(employees: Employee[], suggestedDepartment?: string | null): Employee[] {
  if (!suggestedDepartment) {
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }
  const preferred = employees
    .filter((e) => employeeCoversDepartment(e, suggestedDepartment))
    .sort((a, b) => a.name.localeCompare(b.name));
  const others = employees
    .filter((e) => !employeeCoversDepartment(e, suggestedDepartment))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...preferred, ...others];
}

function matchesQuery(emp: Employee, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    emp.name.toLowerCase().includes(q) ||
    getEmployeeDepartments(emp).some((d) => d.toLowerCase().includes(q)) ||
    emp.email.toLowerCase().includes(q) ||
    emp.employeeCode.toLowerCase().includes(q)
  );
}

export const EmployeeSearchSelect: React.FC<EmployeeSearchSelectProps> = ({
  employees,
  value,
  onChange,
  placeholder = 'Assign later...',
  suggestedDepartment,
  allowSelf = false,
  selfLabel = 'Self — Hospital performs surgery',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.role === 'employee' && e.status === 'Active'),
    [employees],
  );

  const sortedEmployees = useMemo(
    () => sortEmployees(activeEmployees, suggestedDepartment),
    [activeEmployees, suggestedDepartment],
  );

  const filteredEmployees = useMemo(
    () => sortedEmployees.filter((emp) => matchesQuery(emp, query)),
    [sortedEmployees, query],
  );

  const selectedEmployee = value && value !== SURGERY_SELF_ASSIGNMENT_VALUE
    ? activeEmployees.find((e) => e.id === value) ?? null
    : null;

  const displayLabel = value === SURGERY_SELF_ASSIGNMENT_VALUE
    ? selfLabel
    : selectedEmployee
      ? `${selectedEmployee.name} — ${getEmployeeDepartments(selectedEmployee).join(', ')}`
      : placeholder;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const fieldClass =
    'w-full flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${fieldClass} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-gray-300 cursor-pointer'} ${
          value === SURGERY_SELF_ASSIGNMENT_VALUE ? 'border-amber-200 bg-amber-50/50' : ''
        }`}
      >
        {value === SURGERY_SELF_ASSIGNMENT_VALUE ? (
          <HandMetal className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        ) : selectedEmployee ? (
          <Avatar name={selectedEmployee.name} size="xs" />
        ) : null}
        <span
          className={`flex-1 min-w-0 truncate ${
            selectedEmployee || value === SURGERY_SELF_ASSIGNMENT_VALUE ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          {displayLabel}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              pick('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                pick('');
              }
            }}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, department, ID..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setQuery('');
                  }
                }}
              />
            </div>
          </div>

          <div className="max-h-[220px] overflow-y-auto p-1">
            {!query && (
              <button
                type="button"
                onClick={() => pick('')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !value ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {placeholder}
              </button>
            )}

            {allowSelf && (() => {
              const q = query.trim().toLowerCase();
              const showSelf = !q || q.includes('self') || selfLabel.toLowerCase().includes(q);
              if (!showSelf) return null;
              return (
              <button
                type="button"
                onClick={() => pick(SURGERY_SELF_ASSIGNMENT_VALUE)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  value === SURGERY_SELF_ASSIGNMENT_VALUE
                    ? 'bg-amber-50 text-amber-900'
                    : 'hover:bg-amber-50/60 text-amber-800'
                }`}
              >
                <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <HandMetal className="h-3.5 w-3.5 text-amber-700" />
                </div>
                <span className="text-sm font-medium truncate">{selfLabel}</span>
              </button>
              );
            })()}

            {filteredEmployees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => pick(emp.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  value === emp.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <Avatar name={emp.name} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{emp.name}</span>
                    {getEmployeeDepartments(emp).map((d) => (
                      <Badge key={d} className={`${departmentColors[d]} text-[10px]`}>{d}</Badge>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">
                    {emp.employeeCode ? `#${emp.employeeCode}` : emp.email}
                  </p>
                </div>
              </button>
            ))}

            {filteredEmployees.length === 0 && query && (
              <p className="text-sm text-gray-400 text-center py-4 px-2">No employees match &ldquo;{query}&rdquo;</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
