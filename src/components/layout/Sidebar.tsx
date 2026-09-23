import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  CheckCircle,
  Users,
  ClipboardList,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Archive,
  Building2,
  Fuel,
  Gauge,
  Ticket,
  X,
  LayoutGrid,
  Tv,
  StickyNote,
  HandMetal,
  MessageCircle,
  UtensilsCrossed,
  CalendarClock,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';
import { countPendingLeaveSubmissions } from '../../lib/leave';
import { getISTDateKey } from '../../lib/attendance';
import { countPendingTaskRequests } from '../../lib/caseTaskRequests';
import { AUTO_APPROVE_STAGE_SUBMISSIONS, FCFS_POOL_ENABLED, isPostponedCase } from '../../lib/caseWorkflow';
import { CASE_DUTY_TAB_IDS, isCaseDutyTab } from '../../lib/caseDuties';
import { isFullAdmin } from '../../lib/roles';
import loginLogo from '../../assets/login-logo.png';
import { PoweredByAiBadge } from '../PoweredByAiBadge';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  /** Return / cleaning / restock duty boards ? admin + store manager only */
  dutyBoardOnly?: boolean;
}

const CASES_TAB_IDS = ['cases', 'live-cases', 'case-history', 'postponed-cases', ...CASE_DUTY_TAB_IDS] as const;

const casesGroupChildren: NavItem[] = [
  { id: 'cases', label: 'All Cases', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'live-cases', label: 'Live Cases', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'case-duties-combined', label: 'Return, Clean & Restock', icon: <RotateCcw className="h-4 w-4" />, dutyBoardOnly: true },
  { id: 'case-history', label: 'Case History', icon: <Archive className="h-4 w-4" />, adminOnly: true },
  { id: 'postponed-cases', label: 'Postponed', icon: <CalendarClock className="h-4 w-4" />, adminOnly: true },
];

const topNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'notes', label: 'Notes', icon: <StickyNote className="h-4 w-4" />, adminOnly: true },
  { id: 'workflow', label: 'Workflow Board', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'tv-board', label: 'TV Board', icon: <Tv className="h-4 w-4" />, adminOnly: true },
  { id: 'approvals', label: 'Approval Queue', icon: <CheckCircle className="h-4 w-4" />, adminOnly: true },
  { id: 'task-requests', label: 'Task Requests', icon: <HandMetal className="h-4 w-4" />, adminOnly: true },
  { id: 'employees', label: 'Employees', icon: <Users className="h-4 w-4" />, adminOnly: true },
  { id: 'telegram', label: 'Telegram', icon: <MessageCircle className="h-4 w-4" />, adminOnly: true },
  { id: 'attendance', label: 'Attendance', icon: <ClipboardList className="h-4 w-4" />, adminOnly: true },
  { id: 'attendance-approvals', label: 'Attendance Approvals', icon: <CheckCircle className="h-4 w-4" />, adminOnly: true },
  { id: 'expenses', label: 'Expenses', icon: <Fuel className="h-4 w-4" />, adminOnly: true },
  { id: 'petrol-dashboard', label: 'Petrol Dashboard', icon: <Ticket className="h-4 w-4" />, adminOnly: true },
  { id: 'food-dashboard', label: 'Food', icon: <UtensilsCrossed className="h-4 w-4" />, adminOnly: true },
  { id: 'kms-dashboard', label: 'KMs Dashboard', icon: <Gauge className="h-4 w-4" />, adminOnly: true },
  { id: 'hospitals', label: 'Hospitals', icon: <Building2 className="h-4 w-4" />, adminOnly: true },
  { id: 'reports', label: 'Reports', icon: <Download className="h-4 w-4" />, adminOnly: true },
  { id: 'activity', label: 'Activity Log', icon: <ScrollText className="h-4 w-4" />, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

function isCasesTab(tab: string): boolean {
  return (CASES_TAB_IDS as readonly string[]).includes(tab) || isCaseDutyTab(tab);
}

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    cases,
    currentUser,
    leaveRequests,
    attendanceApprovalRequests,
    fieldTeamAttendanceApprovals,
    petrolRequests,
    caseTaskRequests,
  } = useStore();

  const [casesGroupOpen, setCasesGroupOpen] = useState(() => isCasesTab(activeTab));

  useEffect(() => {
    if (isCasesTab(activeTab)) setCasesGroupOpen(true);
  }, [activeTab]);

  const pendingApprovals = AUTO_APPROVE_STAGE_SUBMISSIONS
    ? 0
    : cases.filter(c => c.status === 'Waiting For Approval').length;
  const pendingTaskRequests = countPendingTaskRequests(caseTaskRequests);
  const activeCases = cases.filter(c => c.status === 'Active' || c.status === 'Waiting For Approval').length;
  const pendingAttendanceApprovals =
    countPendingLeaveSubmissions(leaveRequests) +
    attendanceApprovalRequests.filter((r) => r.status === 'pending').length;
  const todayKey = getISTDateKey();
  const pendingFieldTeamAttendance = fieldTeamAttendanceApprovals.filter(
    (a) => a.dateKey === todayKey && a.status === 'pending',
  ).length;
  const postponedCount = cases.filter(isPostponedCase).length;

  const getBadge = (id: string) => {
    if (id === 'postponed-cases') return postponedCount || undefined;
    if (id === 'approvals') return pendingApprovals;
    if (id === 'task-requests') return pendingTaskRequests || undefined;
    if (id === 'cases' || id === 'live-cases') return activeCases;
    if (id === 'attendance') return pendingAttendanceApprovals;
    if (id === 'attendance-approvals') return pendingFieldTeamAttendance || undefined;
    if (id === 'petrol-dashboard') {
      return petrolRequests.filter((r) => r.status === 'pending' || r.status === 'issued').length;
    }
    return undefined;
  };

  const casesGroupBadge = useMemo(() => {
    const a = getBadge('cases') ?? 0;
    const p = postponedCount;
    const total = Math.max(a, p);
    return total > 0 ? total : undefined;
  }, [activeCases, postponedCount]);

  const isAdmin = isFullAdmin(currentUser.role);
  const isStoreManager = currentUser.role === 'store_manager';

  const visibleCaseChildren = useMemo(
    () =>
      casesGroupChildren.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.dutyBoardOnly && !isAdmin && !isStoreManager) return false;
        return true;
      }),
    [isAdmin, isStoreManager],
  );

  const filterTopItem = (item: NavItem) => {
    if (AUTO_APPROVE_STAGE_SUBMISSIONS && item.id === 'approvals') return false;
    if (!FCFS_POOL_ENABLED && item.id === 'task-requests') return false;
    if (currentUser.role === 'petrol') {
      return item.id === 'petrol-dashboard' || item.id === 'settings';
    }
    if (isStoreManager) {
      return item.id === 'dashboard' || item.id === 'workflow' || item.id === 'settings';
    }
    return !item.adminOnly || isAdmin;
  };

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileSidebarOpen(false);
  };

  const showLabels = mobileSidebarOpen || !sidebarCollapsed;
  const casesGroupActive = isCasesTab(activeTab);

  const renderNavButton = (item: NavItem, opts?: { nested?: boolean }) => {
    const badge = getBadge(item.id);
    const isActive = activeTab === item.id;
    const nested = opts?.nested ?? false;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleNavClick(item.id)}
        className={cn(
          'nexus-sidebar-link',
          nested && 'pl-9',
          isActive && 'is-active',
          !showLabels && !nested && 'justify-center px-2',
        )}
        title={!showLabels ? item.label : undefined}
      >
        <span className="nexus-sidebar-link-icon shrink-0">{item.icon}</span>
        <AnimatePresence>
          {showLabels && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 text-left truncate"
            >
              {currentUser.role === 'petrol' && item.id === 'petrol-dashboard' ? 'Petrol Tokens' : item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {showLabels && badge !== undefined && badge > 0 && (
          <span
            className="nexus-sidebar-badge"
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  const renderCasesGroup = () => {
    if (currentUser.role === 'petrol') return null;

    if (!showLabels) {
      return (
        <button
          type="button"
          onClick={() => handleNavClick(casesGroupActive ? activeTab : 'cases')}
          className={cn('nexus-sidebar-link justify-center px-2', casesGroupActive && 'is-active')}
          title="Cases"
        >
          <FolderOpen className="nexus-sidebar-link-icon h-4 w-4" />
        </button>
      );
    }

    return (
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setCasesGroupOpen((o) => !o)}
          className={cn('nexus-sidebar-link', casesGroupActive && !casesGroupOpen && 'is-active')}
        >
          <FolderOpen className="nexus-sidebar-link-icon h-4 w-4 shrink-0" />
          <span className="flex-1 text-left truncate">Cases</span>
          {casesGroupBadge !== undefined && (
            <span className="nexus-sidebar-badge">{casesGroupBadge}</span>
          )}
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', casesGroupOpen && 'rotate-180')}
          />
        </button>
        <AnimatePresence initial={false}>
          {casesGroupOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden space-y-0.5"
            >
              {visibleCaseChildren.map((child) => renderNavButton(child, { nested: true }))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const sidebarContent = (
    <>
      <div
        className={cn(
          'flex items-center px-4 py-5 border-b border-[var(--color-separator)]',
          !showLabels ? 'justify-center' : 'gap-3 justify-between lg:justify-start',
        )}
      >
        <div className="flex items-center gap-2.5">
          <img src={loginLogo} alt="Malcon Nexus" className="h-8 w-8 shrink-0 object-contain" />
          <AnimatePresence>
            {showLabels && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <p className="nexus-sidebar-brand-title leading-none">Malcon Nexus</p>
                <p className="nexus-sidebar-brand-sub mt-0.5 leading-none">by Malcon Life Sciences</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg hover:bg-black/[0.05] text-[var(--color-label-secondary)]"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {currentUser.role === 'petrol' ? (
          topNavItems.filter(filterTopItem).map((item) => renderNavButton(item))
        ) : (
          <>
            {renderNavButton(topNavItems[0])}
            {renderCasesGroup()}
            {topNavItems.slice(1).filter(filterTopItem).map((item) => renderNavButton(item))}
          </>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-[var(--color-separator)] space-y-2 mt-auto">
        {showLabels ? (
          <PoweredByAiBadge variant="sidebar" />
        ) : (
          <PoweredByAiBadge variant="sidebarCollapsed" />
        )}
        {showLabels && (
          <p
            className="text-[10px] text-[var(--color-label-tertiary)] leading-none px-0.5"
            title="Build time — confirms you're on the latest deploy"
          >
            Build: {new Date(__BUILD_TIME__).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>
    </>
  );

  return (
    <>
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: mobileSidebarOpen ? 0 : '-100%' }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="nexus-sidebar fixed inset-y-0 left-0 w-[min(280px,85vw)] flex flex-col h-screen z-50 lg:hidden shadow-[var(--shadow-popover)]"
      >
        {sidebarContent}
      </motion.aside>

      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 232 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="nexus-sidebar relative hidden lg:flex flex-col h-screen shrink-0 z-20"
      >
        {sidebarContent}

        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="nexus-sidebar-collapse-btn"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3 w-3 text-gray-600" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-gray-600" />
          )}
        </button>
      </motion.aside>
    </>
  );
};
