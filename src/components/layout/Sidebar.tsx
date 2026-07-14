import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  CheckCircle,
  Users,
  BarChart3,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Archive,
  Building2,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';
import loginLogo from '../../assets/login-logo.png';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'cases', label: 'Cases', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'case-history', label: 'Case History', icon: <Archive className="h-4 w-4" />, adminOnly: true },
  { id: 'workflow', label: 'Workflow Board', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'approvals', label: 'Approval Queue', icon: <CheckCircle className="h-4 w-4" />, adminOnly: true },
  { id: 'employees', label: 'Employees', icon: <Users className="h-4 w-4" />, adminOnly: true },
  { id: 'hospitals', label: 'Hospitals', icon: <Building2 className="h-4 w-4" />, adminOnly: true },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" />, adminOnly: true },
  { id: 'activity', label: 'Activity Log', icon: <ScrollText className="h-4 w-4" />, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

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
  } = useStore();

  const pendingApprovals = cases.filter(c => c.status === 'Waiting For Approval').length;
  const activeCases = cases.filter(c => c.status === 'Active' || c.status === 'Waiting For Approval').length;

  const getBadge = (id: string) => {
    if (id === 'approvals') return pendingApprovals;
    if (id === 'cases') return activeCases;
    return undefined;
  };

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileSidebarOpen(false);
  };

  const showLabels = mobileSidebarOpen || !sidebarCollapsed;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        'flex items-center px-4 py-5 border-b border-gray-100',
        !showLabels ? 'justify-center' : 'gap-3 justify-between lg:justify-start'
      )}>
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
                <p className="text-sm font-bold text-gray-900 leading-none">Malcon Nexus</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-none">by Malcon Life Sciences</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems
          .filter(item => !item.adminOnly || currentUser.role === 'admin')
          .map((item) => {
            const badge = getBadge(item.id);
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  !showLabels && 'justify-center px-2'
                )}
                title={!showLabels ? item.label : undefined}
              >
                <span className={cn('shrink-0', isActive ? 'text-white' : 'text-gray-500')}>
                  {item.icon}
                </span>
                <AnimatePresence>
                  {showLabels && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 text-left truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {showLabels && badge !== undefined && badge > 0 && (
                  <span className={cn(
                    'text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  )}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
      </nav>

      {/* Status indicator */}
      {showLabels && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-gray-500">All systems operational</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile backdrop */}
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

      {/* Mobile drawer */}
      <motion.aside
        initial={false}
        animate={{ x: mobileSidebarOpen ? 0 : '-100%' }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="fixed inset-y-0 left-0 w-[min(280px,85vw)] flex flex-col bg-white border-r border-gray-100 h-screen z-50 lg:hidden shadow-xl"
      >
        {sidebarContent}
      </motion.aside>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 232 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="relative hidden lg:flex flex-col bg-white border-r border-gray-100 h-screen shrink-0 z-20"
      >
        {sidebarContent}

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-16 h-6 w-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow hover:border-gray-300 transition-all z-30"
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
