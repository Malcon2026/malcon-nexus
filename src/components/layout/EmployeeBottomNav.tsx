import React, { useMemo } from 'react';
import { Home, FolderOpen, Clock, Fuel, User } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';
import {
  EMPLOYEE_SHELL_TAB_LABELS,
  type EmployeeShellTab,
} from '../../lib/employeeShell';

const TABS: { id: EmployeeShellTab; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'home', icon: Home },
  { id: 'cases', icon: FolderOpen },
  { id: 'punch', icon: Clock },
  { id: 'petrol', icon: Fuel },
  { id: 'profile', icon: User },
];

export const EmployeeBottomNav: React.FC = () => {
  const employeeShellTab = useStore((s) => s.employeeShellTab);
  const setEmployeeShellTab = useStore((s) => s.setEmployeeShellTab);

  const activeIndex = useMemo(
    () => Math.max(0, TABS.findIndex((t) => t.id === employeeShellTab)),
    [employeeShellTab],
  );

  return (
    <div className="employee-glass-bar" role="presentation">
      <nav
        className="employee-glass-bar__pill"
        role="tablist"
        aria-label="Employee app"
        style={{ ['--active-index' as string]: activeIndex }}
      >
        <div className="employee-glass-bar__track">
          <div className="employee-glass-bar__indicator" aria-hidden />
          {TABS.map(({ id, icon: Icon }) => {
            const active = employeeShellTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn('employee-glass-bar__item', active && 'is-active')}
                onClick={() => setEmployeeShellTab(id)}
              >
                <Icon
                  className="employee-glass-bar__icon"
                  strokeWidth={active ? 2.35 : 2}
                  aria-hidden
                />
                <span className="employee-glass-bar__label">{EMPLOYEE_SHELL_TAB_LABELS[id]}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
