import React, { useState } from 'react';
import { Bell, Search, ChevronDown, User, Menu, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';
import { Avatar } from '../ui/Avatar';
import { timeAgo } from '../../utils/helpers';
import { formatEmployeeDepartments } from '../../constants/departments';

export const TopBar: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    currentUser,
    activeTab,
    setMobileSidebarOpen,
  } = useStore();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unread = notifications.filter(n => !n.read).length;

  const pageTitle: Record<string, string> = {
    dashboard: 'Dashboard',
    'live-cases': 'Live Cases',
    notes: 'Notes',
    cases: 'Implant Cases',
    workflow: 'Workflow Board',
    'postponed-cases': 'Postponed Cases',
    approvals: 'Approval Queue',
    'task-requests': 'Task Requests',
    employees: 'Employees',
    attendance: 'Attendance',
    expenses: 'Expenses',
    'petrol-dashboard': 'Petrol Dashboard',
    'food-dashboard': 'Food',
    'kms-dashboard': 'KMs Dashboard',
    hospitals: 'Hospitals',
    reports: 'Reports',
    'case-history': 'Case History',
    activity: 'Activity Log',
    settings: 'Settings',
  };

  const notifDot: Record<string, string> = {
    info: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      const { authService } = await import('../../lib/auth');
      await authService.signOut();
    } catch (err) {
      console.error('[TopBar] logout failed:', err);
    }
    onLogout?.();
  };

  return (
    <header className="nexus-topbar flex items-center gap-2 sm:gap-3 shrink-0">
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="nexus-topbar-icon-btn lg:hidden shrink-0"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="nexus-topbar-title truncate">
          {pageTitle[activeTab] || 'Dashboard'}
        </h1>
      </div>

      <div className="relative hidden md:block shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-label-tertiary)]" />
        <input
          type="text"
          placeholder="Search cases, hospitals..."
          className="nexus-topbar-search"
        />
      </div>

      <span className="nexus-topbar-chip hidden sm:inline-flex shrink-0 capitalize">
        {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'petrol' ? 'Petrol desk' : formatEmployeeDepartments(currentUser)}
      </span>

      <div className="relative shrink-0">
        <button
          onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
          className="nexus-topbar-icon-btn relative"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full ring-2 ring-[var(--color-bg-sidebar)]" />
          )}
        </button>

        <AnimatePresence>
          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-14 sm:top-full sm:mt-2 sm:w-80 bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-popover)] border border-[var(--color-separator)] z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-separator)]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">Notifications</span>
                    {unread > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{unread}</span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-xs text-[var(--color-accent)] hover:underline font-medium">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={cn(
                        'px-4 py-3 cursor-pointer transition-colors',
                        n.read ? 'hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50/70'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', notifDot[n.type])} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-medium', n.read ? 'text-gray-500' : 'text-gray-900')}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                        </div>
                        {!n.read && <div className="h-1.5 w-1.5 bg-[var(--color-accent)] rounded-full shrink-0 mt-2" />}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="relative shrink-0">
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
          className="flex items-center gap-1.5 sm:gap-2.5 px-1.5 sm:px-2 py-1.5 rounded-xl hover:bg-black/[0.05] transition-colors"
        >
          <Avatar name={currentUser.name} size="sm" />
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-gray-900 leading-none">{currentUser.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-none capitalize">{formatEmployeeDepartments(currentUser)}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 hidden sm:block" />
        </button>

        <AnimatePresence>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-14 sm:top-full sm:mt-2 sm:w-56 bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-popover)] border border-[var(--color-separator)] z-50 overflow-hidden py-1"
              >
                <div className="px-4 py-3 border-b border-[var(--color-separator)]">
                  <p className="text-xs font-semibold text-gray-900">{currentUser.name}</p>
                  <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-xs text-gray-500">
                    <User className="h-3.5 w-3.5" />
                    Profile Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-xs text-red-700 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};
