import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { Analytics } from './pages/Analytics';
import { CaseHistory } from './pages/CaseHistory';
import { ActivityLog } from './pages/ActivityLog';
import { Settings } from './pages/Settings';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { Login } from './pages/Login';
import { AppBootScreen } from './components/AppBootScreen';
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

function DataHydrationBar({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="h-0.5 w-full bg-indigo-100 shrink-0">
      <div className="h-full w-full bg-indigo-500/80 animate-pulse" />
    </div>
  );
}

function App() {
  const { activeTab, viewMode, setCurrentUser, reloadFromDatabase } = useStore();

  const [authChecked, setAuthChecked] = useState(!SUPABASE_ENABLED);
  const [isAuthenticated, setIsAuthenticated] = useState(!SUPABASE_ENABLED);
  const [isHydrating, setIsHydrating] = useState(false);

  const hydrateGeneration = useRef(0);

  const hydrateForUser = useCallback(async (employee: Employee) => {
    const generation = ++hydrateGeneration.current;
    setIsHydrating(true);
    try {
      const { bootstrapEssential, bootstrapDeferred } = await import('./lib/database/bootstrap');
      const role = employee.role === 'admin' ? 'admin' : 'employee';

      await bootstrapEssential(role);
      if (generation !== hydrateGeneration.current) return;
      reloadFromDatabase();

      if (role === 'admin') {
        void bootstrapDeferred(role).then(() => {
          if (generation !== hydrateGeneration.current) return;
          reloadFromDatabase();
          setIsHydrating(false);
        });
        return;
      }

      setIsHydrating(false);
    } catch (err) {
      console.error('[App] Data hydrate failed:', err);
      if (generation === hydrateGeneration.current) setIsHydrating(false);
    }
  }, [reloadFromDatabase]);

  useEffect(() => {
    if (!SUPABASE_ENABLED) return;

    let unsubscribe: (() => void) | undefined;
    let initialSessionHandled = false;

    async function applySession(employee: Employee | null) {
      if (employee) {
        setCurrentUser(employee);
        setIsAuthenticated(true);
        void hydrateForUser(employee);
        return;
      }
      hydrateGeneration.current += 1;
      setIsHydrating(false);
      setIsAuthenticated(false);
    }

    async function boot() {
      try {
        const { authService } = await import('./lib/auth');

        const finishAuth = () => {
          initialSessionHandled = true;
          setAuthChecked(true);
        };

        const { data: { subscription } } = authService.onAuthStateChange(async (event, employee) => {
          if (event === 'INITIAL_SESSION') {
            await applySession(employee);
            finishAuth();
            return;
          }

          if (event === 'SIGNED_OUT') {
            hydrateGeneration.current += 1;
            setIsHydrating(false);
            setIsAuthenticated(false);
            return;
          }

          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (employee) {
              await applySession(employee);
            }
          }
        });

        unsubscribe = () => subscription.unsubscribe();

        window.setTimeout(async () => {
          if (initialSessionHandled) return;
          const employee = await authService.getCurrentEmployee();
          await applySession(employee);
          finishAuth();
        }, 100);
      } catch (err) {
        console.error('[App] Auth bootstrap failed:', err);
        setAuthChecked(true);
      }
    }

    boot();
    return () => unsubscribe?.();
  }, [setCurrentUser, hydrateForUser]);

  const handleLogout = () => {
    hydrateGeneration.current += 1;
    setIsHydrating(false);
    setIsAuthenticated(false);
  };

  const handleLoginSuccess = (employee: Employee) => {
    setCurrentUser(employee);
    setIsAuthenticated(true);
    if (SUPABASE_ENABLED) {
      void hydrateForUser(employee);
    }
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
      case 'analytics':
        return viewMode === 'admin' ? <Analytics /> : <EmployeeDashboard />;
      case 'reports':
        return viewMode === 'admin' ? <Reports /> : <EmployeeDashboard />;
      case 'case-history': return <CaseHistory />;
      case 'activity':   return <ActivityLog />;
      case 'settings':   return <Settings />;
      default:           return <Dashboard />;
    }
  };

  if (!authChecked) {
    return <AppBootScreen />;
  }

  if (SUPABASE_ENABLED && !isAuthenticated) {
    return (
      <div className="w-full min-w-0 overflow-x-hidden">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full max-w-full min-w-0 bg-gray-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col bg-gray-50 overflow-hidden">
        <TopBar onLogout={handleLogout} />
        <DataHydrationBar active={isHydrating} />

        <main className="flex-1 min-w-0 bg-gray-50 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${viewMode}`}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-gray-50"
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
