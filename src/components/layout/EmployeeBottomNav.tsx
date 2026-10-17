import React from 'react';
import { Home, FolderOpen, Fuel, User, ScanFace } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';
import {
  EMPLOYEE_SHELL_TAB_LABELS,
  type EmployeeShellTab,
} from '../../lib/employeeShell';

const SIDE_TABS: { id: EmployeeShellTab; icon: React.ReactNode }[] = [
  { id: 'home', icon: <Home className="h-[18px] w-[18px]" strokeWidth={2} /> },
  { id: 'cases', icon: <FolderOpen className="h-[18px] w-[18px]" strokeWidth={2} /> },
];

const SIDE_TABS_RIGHT: { id: EmployeeShellTab; icon: React.ReactNode }[] = [
  { id: 'petrol', icon: <Fuel className="h-[18px] w-[18px]" strokeWidth={2} /> },
  { id: 'profile', icon: <User className="h-[18px] w-[18px]" strokeWidth={2} /> },
];

function NavItem({
  tab,
  icon,
  active,
  onSelect,
}: {
  tab: EmployeeShellTab;
  icon: React.ReactNode;
  active: boolean;
  onSelect: (tab: EmployeeShellTab) => void;
}) {
  return (
    <button
      type="button"
      className={cn('employee-bottom-nav__item', active && 'is-active')}
      onClick={() => onSelect(tab)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="employee-bottom-nav__icon" aria-hidden>
        {icon}
      </span>
      <span className="employee-bottom-nav__label">{EMPLOYEE_SHELL_TAB_LABELS[tab]}</span>
    </button>
  );
}

export const EmployeeBottomNav: React.FC = () => {
  const employeeShellTab = useStore((s) => s.employeeShellTab);
  const setEmployeeShellTab = useStore((s) => s.setEmployeeShellTab);

  return (
    <div className="employee-bottom-nav-wrap" role="navigation" aria-label="Employee app">
      <div className="employee-bottom-nav">
        {SIDE_TABS.map(({ id, icon }) => (
          <NavItem
            key={id}
            tab={id}
            icon={icon}
            active={employeeShellTab === id}
            onSelect={setEmployeeShellTab}
          />
        ))}

        <div className="employee-bottom-nav__center-slot">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              className={cn(
                'employee-bottom-nav__center-btn',
                employeeShellTab === 'punch' && 'is-active',
              )}
              onClick={() => setEmployeeShellTab('punch')}
              aria-label={EMPLOYEE_SHELL_TAB_LABELS.punch}
              aria-current={employeeShellTab === 'punch' ? 'page' : undefined}
            >
              <ScanFace className="h-7 w-7" strokeWidth={1.75} />
            </button>
            <span
              className={cn(
                'employee-bottom-nav__label text-[10px]',
                employeeShellTab === 'punch' && 'text-[var(--color-accent)] font-semibold',
              )}
            >
              {EMPLOYEE_SHELL_TAB_LABELS.punch}
            </span>
          </div>
        </div>

        {SIDE_TABS_RIGHT.map(({ id, icon }) => (
          <NavItem
            key={id}
            tab={id}
            icon={icon}
            active={employeeShellTab === id}
            onSelect={setEmployeeShellTab}
          />
        ))}
      </div>
    </div>
  );
};
