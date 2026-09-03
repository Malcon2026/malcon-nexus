import React, { useMemo, useState } from 'react';
import { HandMetal } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import type { Department, Employee } from '../types';
import { departmentColors } from '../utils/helpers';
import { employeeCoversDepartment, getEmployeeDepartments } from '../constants/departments';

export const ASSIGN_DEPARTMENTS: Department[] = [
  'Stores',
  'Delivery',
  'Drivers',
  'Scrub Person',
  'Cleaning & Audit',
  'Accounts',
  'Bill Submission',
  'Office Staff',
];

type DeptFilter = Department | 'All';

interface EmployeeAssignPickerProps {
  employees: Employee[];
  selected: Employee | null;
  onSelect: (employee: Employee) => void;
  /** Typical department for the workflow stage — shown as a hint only. */
  suggestedDepartment?: string | null;
  defaultFilter?: DeptFilter;
  /** Show a "Self" choice above the employee list (e.g. Surgery — hospital performs it independently). */
  allowSelfOption?: boolean;
  selfLabel?: string;
  selfDescription?: string;
  isSelfSelected?: boolean;
  onSelectSelf?: () => void;
}

export const EmployeeAssignPicker: React.FC<EmployeeAssignPickerProps> = ({
  employees,
  selected,
  onSelect,
  suggestedDepartment,
  defaultFilter = 'All',
  allowSelfOption = false,
  selfLabel = 'Self — Hospital performs this independently',
  selfDescription = 'No Malcon staff needed. Marks this stage done and moves the case forward.',
  isSelfSelected = false,
  onSelectSelf,
}) => {
  const [deptFilter, setDeptFilter] = useState<DeptFilter>(defaultFilter);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.role === 'employee' && e.status === 'Active'),
    [employees],
  );

  const visibleEmployees = useMemo(() => {
    if (deptFilter === 'All') return activeEmployees;
    return activeEmployees.filter((e) => employeeCoversDepartment(e, deptFilter));
  }, [activeEmployees, deptFilter]);

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white mb-4';
  const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

  return (
    <div>
      {suggestedDepartment && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          Typical department for this stage: <strong>{suggestedDepartment}</strong>. You can assign any active
          employee — filter below is optional.
        </p>
      )}

      <label className={labelClass}>Filter by department (optional)</label>
      <select
        className={inputClass}
        value={deptFilter}
        onChange={(e) => setDeptFilter(e.target.value as DeptFilter)}
      >
        <option value="All">All departments</option>
        {ASSIGN_DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {allowSelfOption && (
        <div
          onClick={onSelectSelf}
          className={`flex items-center gap-4 p-3 mb-3 rounded-xl border-2 cursor-pointer transition-all ${
            isSelfSelected ? 'border-amber-400 bg-amber-50' : 'border-amber-200 bg-amber-50/40 hover:border-amber-300 hover:bg-amber-50'
          }`}
        >
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <HandMetal className="h-5 w-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">{selfLabel}</p>
            <p className="text-xs text-amber-700/90 mt-0.5">{selfDescription}</p>
          </div>
          <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 border-amber-400">
            {isSelfSelected && <div className="h-2 w-2 bg-amber-600 rounded-full" />}
          </div>
        </div>
      )}

      <label className={labelClass}>
        Select employee{deptFilter === 'All' ? '' : ` — ${deptFilter}`}
      </label>
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {visibleEmployees.map((emp) => (
          <div
            key={emp.id}
            onClick={() => onSelect(emp)}
            className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${
              selected?.id === emp.id ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Avatar name={emp.name} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                {getEmployeeDepartments(emp).map((d) => (
                  <Badge key={d} className={`${departmentColors[d]} text-[10px]`}>{d}</Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500 truncate">{emp.email}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span>{emp.casesCompleted} completed</span>
                <span>•</span>
                <span>{emp.casesActive} active</span>
              </div>
            </div>
            <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 border-gray-300">
              {selected?.id === emp.id && <div className="h-2 w-2 bg-gray-900 rounded-full" />}
            </div>
          </div>
        ))}
        {visibleEmployees.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No active employees match this filter.</p>
        )}
      </div>
    </div>
  );
};
