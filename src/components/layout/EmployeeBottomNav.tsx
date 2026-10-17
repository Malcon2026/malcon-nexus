import React from 'react';
import { Home, FolderOpen, Fuel, User, ScanFace } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';
import {
  EMPLOYEE_SHELL_TAB_LABELS,
  type EmployeeShellTab,
} from '../../lib/employeeShell';

const ICON = { size: 22, stroke: 2.25 } as const;

type SideTab = {
  id: Exclude<EmployeeShellTab, 'punch'>;
  icon: React.ReactNode;
};

const LEFT: SideTab[] = [
  { id: 'home', icon: <Home size={ICON.size} strokeWidth={ICON.stroke} /> },
  { id: 'cases', icon: <FolderOpen size={ICON.size} strokeWidth={ICON.stroke} /> },
];

const RIGHT: SideTab[] = [
  { id: 'petrol', icon: <Fuel size={ICON.size} strokeWidth={ICON.stroke} /> },
  { id: 'profile', icon: <User size={ICON.size} strokeWidth={ICON.stroke} /> },
];

function SideTabButton({
  tab,
  icon,
  active,
  onSelect,
}: {
  tab: SideTab['id'];
  icon: React.ReactNode;
  active: boolean;
  onSelect: (tab: EmployeeShellTab) => void;
}) {
  return (
    <button
      type="button"
      className={cn('employee-bottom-nav__tab', active && 'is-active')}
      onClick={() => onSelect(tab)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="employee-bottom-nav__icon-chip" aria-hidden>
        {icon}
      </span>
      <span className="employee-bottom-nav__label">{EMPLOYEE_SHELL_TAB_LABELS[tab]}</span>
    </button>
  );
}

export const EmployeeBottomNav: React.FC = () => {
  const employeeShellTab = useStore((s) => s.employeeShellTab);
  const setEmployeeShellTab = useStore((s) => s.setEmployeeShellTab);
  const punchActive = employeeShellTab === 'punch';

  return (
    <div className="employee-bottom-nav-wrap" role="navigation" aria-label="Employee app">
      <nav className="employee-bottom-nav">
        {LEFT.map(({ id, icon }) => (
          <SideTabButton
            key={id}
            tab={id}
            icon={icon}
            active={employeeShellTab === id}
            onSelect={setEmployeeShellTab}
          />
        ))}

        <div
          className={cn('employee-bottom-nav__tab employee-bottom-nav__tab--center', punchActive && 'is-active')}
        >
          <div className="employee-bottom-nav__fab-mount">
            <button
              type="button"
              className="employee-bottom-nav__fab"
              onClick={() => setEmployeeShellTab('punch')}
              aria-label={EMPLOYEE_SHELL_TAB_LABELS.punch}
              aria-current={punchActive ? 'page' : undefined}
            >
              <ScanFace size={26} strokeWidth={1.85} />
            </button>
          </div>
          <span className="employee-bottom-nav__label">{EMPLOYEE_SHELL_TAB_LABELS.punch}</span>
        </div>

        {RIGHT.map(({ id, icon }) => (
          <SideTabButton
            key={id}
            tab={id}
            icon={icon}
            active={employeeShellTab === id}
            onSelect={setEmployeeShellTab}
          />
        ))}
      </nav>
    </div>
  );
};
