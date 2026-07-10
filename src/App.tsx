import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Cases } from './pages/Cases';
import { WorkflowBoard } from './pages/WorkflowBoard';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { Employees } from './pages/Employees';
import { Hospitals } from './pages/Hospitals';
import { Reports } from './pages/Reports';
import { ActivityLog } from './pages/ActivityLog';
import { Settings } from './pages/Settings';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { Login } from './pages/Login';
import { useStore } from './store/useStore';
import type { Employee } from './types';

const SUPABASE_ENABLED =
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project-id.supabase.co';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.2 };

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const { activeTab, viewMode, setCurrentUser, reloadFromDatabase } = useStore();

  const [bootReady, setBootReady] = useState(!SUPABASE_ENABLED);
  const [authChecked, setAuthChecked] = useState(!SUPABASE_ENABLED);
  const [isAuthenticated, setIsAuthenticated] = useState(!SUPABASE_ENABLED);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;

    let unsubscribe: (() => void) | undefined;

    async function boot() {
      try {
        const { bootstrapSupabaseData } = await import('./lib/database/bootstrap');
        const { authService } = await import('./lib/auth');

        await bootstrapSupabaseData();
        reloadFromDatabase();

        const employee = await authService.getCurrentEmployee();
        if (employee) {
          setCurrentUser(employee);
          setIsAuthenticated(true);
        }

        const { data: { subscription } } = authService.onAuthStateChange(async (emp) => {
          if (emp) {
            await bootstrapSupabaseData();
            reloadFromDatabase();
            setCurrentUser(emp);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch (err) {
        console.error('[App] Supabase bootstrap failed:', err);
      } finally {
        setAuthChecked(true);
        setBootReady(true);
      }
    }

    boot();
    return () => unsubscribe?.();
  }, [setCurrentUser, reloadFromDatabase]);

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const handleLoginSuccess = async (employee: Employee) => {
    if (SUPABASE_ENABLED) {
      const { bootstrapSupabaseData } = await import('./lib/database/bootstrap');
      await bootstrapSupabaseData();
      reloadFromDatabase();
    }
    setCurrentUser(employee);
    setIsAuthenticated(true);
  };

  const renderPage = () => {
    if (viewMode === 'employee') {
      switch (activeTab) {
        case 'dashboard': return <EmployeeDashboard />;
        case 'cases':     return <Cases />;
        case 'workflow':  return <WorkflowBoard />;
        case 'settings':  return <Settings />;
        default:          return <EmployeeDashboard />;
      }
    }

    switch (activeTab) {
      case 'dashboard':  return <Dashboard />;
      case 'cases':      return <Cases />;
      case 'workflow':   return <WorkflowBoard />;
      case 'approvals':  return <ApprovalQueue />;
      case 'employees':  return <Employees />;
      case 'hospitals':  return <Hospitals />;
      case 'reports':    return <Reports />;
      case 'activity':   return <ActivityLog />;
      case 'settings':   return <Settings />;
      default:           return <Dashboard />;
    }
  };

  if (!bootReady || !authChecked) {
    return <LoadingScreen />;
  }

  if (SUPABASE_ENABLED && !isAuthenticated) {
    return (
      <div className="w-full min-w-0 overflow-x-hidden">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        <TopBar onLogout={handleLogout} />

        <main className="flex-1 bg-gray-50 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${viewMode}`}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="min-h-full w-full bg-gray-50"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
