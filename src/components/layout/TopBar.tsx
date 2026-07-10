import React, { useState } from 'react';
import { Bell, Search, ChevronDown, User, Shield, Eye, Menu, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useStore } from '../../store/useStore';
import { Avatar } from '../ui/Avatar';
import { timeAgo } from '../../utils/helpers';

export const TopBar: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    currentUser,
    setCurrentUser,
    viewMode,
    setViewMode,
    activeTab,
    employees,
    setMobileSidebarOpen,
  } = useStore();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unread = notifications.filter(n => !n.read).length;
  const isAdmin = currentUser.role === 'admin';

  const pageTitle: Record<string, string> = {
    dashboard: 'Dashboard',
    cases: 'Implant Cases',
    workflow: 'Workflow Board',
    approvals: 'Approval Queue',
    employees: 'Employees',
    hospitals: 'Hospitals',
    reports: 'Reports',
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
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3 shrink-0 z-10">
      {/* Mobile menu */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          {pageTitle[activeTab] || 'Dashboard'}
        </h1>
      </div>

      {/* Search — tablet+ */}
      <div className="relative hidden md:block shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search cases, hospitals..."
          className="pl-8 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:bg-white w-48 lg:w-64 placeholder:text-gray-400"
        />
      </div>

      {/* View Mode Toggle — admins only (preview employee experience) */}
      {isAdmin && (
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => {
              setViewMode('admin');
              const admin = employees.find(e => e.role === 'admin');
              if (admin) setCurrentUser(admin);
            }}
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
              viewMode === 'admin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Shield className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">Admin</span>
          </button>
          <button
            onClick={() => {
              const emp = employees.find(e => e.role === 'employee');
              if (!emp) {
                alert('No employees found. Please add at least one employee first.');
                return;
              }
              setViewMode('employee');
              setCurrentUser(emp);
            }}
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
              viewMode === 'employee' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Eye className="h-3 w-3 shrink-0" />
            <span className="hidden sm:inline">Employee</span>
          </button>
        </div>
      )}

      {!isAdmin && (
        <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-600 shrink-0 capitalize">
          {currentUser.department}
        </span>
      )}

      {/* Notifications */}
      <div className="relative shrink-0">
        <button
          onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
          className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
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
                className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-sm bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">Notifications</span>
                    {unread > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{unread}</span>
                    )}
                  </div>
                  {unread > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.slice(0, 8).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={cn(
                        'px-4 py-3 cursor-pointer transition-colors',
                        n.read ? 'hover:bg-gray-50' : 'bg-blue-50/50 hover:bg-blue-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', notifDot[n.type])} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-medium', n.read ? 'text-gray-600' : 'text-gray-900')}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                        </div>
                        {!n.read && <div className="h-1.5 w-1.5 bg-blue-500 rounded-full shrink-0 mt-2" />}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* User Menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
          className="flex items-center gap-1.5 sm:gap-2.5 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Avatar name={currentUser.name} size="sm" />
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-gray-900 leading-none">{currentUser.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-none capitalize">{currentUser.department}</p>
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
                className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-1rem)] sm:w-56 max-w-xs bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1"
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-900">{currentUser.name}</p>
                  <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                </div>
                <div className="py-1">
                  {isAdmin && (
                    <>
                      <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Switch User</p>
                      {employees.filter(e => e.role === 'employee').slice(0, 5).map(emp => (
                        <button
                          key={emp.id}
                          onClick={() => { setCurrentUser(emp); setViewMode('employee'); setShowUserMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <Avatar name={emp.name} size="xs" />
                          <div className="text-left min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{emp.name}</p>
                            <p className="text-[10px] text-gray-500">{emp.department}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
                <div className="border-t border-gray-100 py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-xs text-gray-600">
                    <User className="h-3.5 w-3.5" />
                    Profile Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-xs text-red-600 transition-colors"
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
