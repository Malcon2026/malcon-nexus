import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Dashboard } from './pages/Dashboard';
import { Cases } from './pages/Cases';
import { CaseDutiesPage } from './pages/CaseDutiesPage';
import { isCaseDutyTab } from './lib/caseDuties';
import { LiveCases } from './pages/LiveCases';
import { TvBoard } from './pages/TvBoard';
import { WorkflowBoard } from './pages/WorkflowBoard';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { TaskRequestQueue } from './pages/TaskRequestQueue';
import { PostponedCases } from './pages/PostponedCases';
import { Employees } from './pages/Employees';
import { Attendance } from './pages/Attendance';
import { AttendanceApprovals } from './pages/AttendanceApprovals';
import { Expenses } from './pages/Expenses';
import { PetrolDashboard } from './pages/PetrolDashboard';
import { FoodDashboard } from './pages/FoodDashboard';
import { KmsDashboard } from './pages/KmsDashboard';
import { Hospitals } from './pages/Hospitals';
import { Doctors } from './pages/Doctors';
import { Reports } from './pages/Reports';
import { CaseHistory } from './pages/CaseHistory';
import { ActivityLog } from './pages/ActivityLog';
import { Settings } from './pages/Settings';
import { TelegramDashboard } from './pages/TelegramDashboard';
import { Notes } from './pages/Notes';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { FCFS_POOL_ENABLED } from './lib/caseWorkflow';
import { Login } from './pages/Login';
import { AppBootScreen } from './components/AppBootScreen';
import {
  DataHydrationBanner,
  DataHydrationMainOverlay,
  type DataHydrationPhase,
} from './components/DataHydrationBanner';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ShortcutsHelpModal } from './components/ShortcutsHelpModal';
import { GlobalAddCaseFab } from './components/layout/GlobalAddCaseFab';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useLiveDataSync } from './hooks/useLiveDataSync';
import { useStore } from './store/useStore';
import { registerServiceWorker } from './lib/webPush';
import { restoreBootstrapCacheForDisplay } from './lib/bootstrapSessionCache';
import { USE_CLOUDFLARE_BACKEND } from './lib/cloudflareConfig';
import { USE_SUPABASE } from './lib/database/config';
import type { Employee } from './types';

function primeStoreFromSessionCache(employeeId: string): boolean {
  if (!restoreBootstrapCacheForDisplay(employeeId)) return false;
  useStore.getState().reloadFromDatabase();
  return true;
}

function storeHasBootstrapData(): boolean {
  const s = useStore.getState();
  if (s.cases.length > 0) return true;
  if (s.attendanceRecords.length > 0) return true;
  if (s.employees.filter((e) => e.id !== 'guest').length > 0) return true;
  return false;
}

/** Remote login + Worker/Supabase data bootstrap (not offline localStorage demo mode). */
const REMOTE_AUTH = USE_SUPABASE || USE_CLOUDFLARE_BACKEND;

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.2 };

function App() {
  return <MainApp />;
}

function MainApp() {
  const { activeTab, viewMode, setCurrentUser, reloadFromDatabase } = useStore();

  const [authChecked, setAuthChecked] = useState(!REMOTE_AUTH);
  const [isAuthenticated, setIsAuthenticated] = useState(!REMOTE_AUTH);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const hydrationPhase: DataHydrationPhase | null = isHydrating
    ? 'stage1'
    : isBackgroundSyncing
      ? 'stage2'
      : null;

  const showShortcutsHelp = useCallback(() => setShortcutsHelpOpen(true), []);
  useAppShortcuts({
    enabled: isAuthenticated && authChecked,
    onShowHelp: showShortcutsHelp,
    shortcutsHelpOpen,
  });

  useLiveDataSync(
    REMOTE_AUTH && isAuthenticated && authChecked && activeTab !== 'tv-board',
  );

  const hydrateGeneration = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    void registerServiceWorker();
  }, [isAuthenticated]);

  const hydrateForUser = useCallback(async (employee: Employee) => {
    const generation = ++hydrateGeneration.current;
    const startedAt = performance.now();
    setIsHydrating(true);
    try {
      const {
        bootstrapEssential,
        bootstrapDeferred,
        restoreBootstrapCache,
        persistBootstrapCache,
      } = await import('./lib/database/bootstrap');
      const { bootstrapRoleForEmployee } = await import('./lib/roles');
      const role = bootstrapRoleForEmployee(employee.role);
      const options = { employeeId: employee.id };

      const hadCache = restoreBootstrapCache(employee.id) || storeHasBootstrapData();
      if (hadCache && generation === hydrateGeneration.current) {
        reloadFromDatabase();
      }

      const essentialFetched = await bootstrapEssential(role, options);
      if (generation !== hydrateGeneration.current) return;
      if (essentialFetched) {
        reloadFromDatabase();
        persistBootstrapCache(employee.id, role, { omitCases: role === 'admin' || role === 'store_manager' });
      }
      setIsHydrating(false);
      console.info(`[perf] stage-1 hydration visible in ${Math.round(performance.now() - startedAt)}ms`);

      setIsBackgroundSyncing(true);
      const syncStartedAt = performance.now();
      const syncTimeout = window.setTimeout(() => {
        if (generation === hydrateGeneration.current) {
          setIsBackgroundSyncing(false);
          console.warn('[perf] stage-2 hydration timed out — UI unfrozen; sync may continue in background');
        }
      }, 90_000);

      const finishBackgroundSync = () => {
        window.clearTimeout(syncTimeout);
        if (generation !== hydrateGeneration.current) return;
        setIsBackgroundSyncing(false);
        console.info(
          `[perf] stage-2 hydration visible done in ${Math.round(performance.now() - startedAt)}ms`,
        );
      };

      void bootstrapDeferred(role, options)
        .then(async () => {
          if (generation !== hydrateGeneration.current) return;
          reloadFromDatabase();
          persistBootstrapCache(employee.id, role);
          finishBackgroundSync();

          // Repairs can touch hundreds of cases — never block the “Syncing full history” banner (especially on D1).
          if (role === 'employee' || role === 'store_manager') {
            void useStore.getState().repairStuckAssignmentsForCurrentUser().then(() => {
              if (generation === hydrateGeneration.current) reloadFromDatabase();
            });
          } else if (role === 'admin') {
            void (async () => {
              try {
                await useStore.getState().repairPendingStageSubmissions();
                await useStore.getState().repairStuckSelfSurgeryCases();
                await useStore.getState().repairStuckPickupReturnOutcomes();
                await useStore.getState().repairLegacyBillingCases();
                await useStore.getState().repairCaseHeaderPointers();
              } catch (err) {
                console.error('[bootstrap] admin case repairs failed:', err);
              }
              if (generation === hydrateGeneration.current) reloadFromDatabase();
            })();
          }
          console.info(
            `[perf] stage-2 fetch finished in ${Math.round(performance.now() - syncStartedAt)}ms`,
          );
        })
        .catch((err) => {
          console.warn('[bootstrap] stage-2 failed:', err);
          finishBackgroundSync();
        });
    } catch (err) {
      console.error('[App] Data hydrate failed:', err);
      if (generation === hydrateGeneration.current) {
        setIsHydrating(false);
      }
    }
  }, [reloadFromDatabase]);

  useEffect(() => {
    if (!REMOTE_AUTH) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function boot() {
      try {
        const { authService } = await import('./lib/auth');

        const employee = await authService.getCurrentEmployee();
        if (cancelled) return;

        if (employee) {
          primeStoreFromSessionCache(employee.id);
          setCurrentUser(employee);
          setIsAuthenticated(true);
          void hydrateForUser(employee);
        }
        setAuthChecked(true);

        const { data: { subscription } } = authService.onAuthStateChange(async (event, emp) => {
          if (event === 'INITIAL_SESSION') return;

          if (event === 'SIGNED_OUT') {
            hydrateGeneration.current += 1;
            setIsHydrating(false);
            setIsAuthenticated(false);
            return;
          }

          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && emp) {
            primeStoreFromSessionCache(emp.id);
            setCurrentUser(emp);
            setIsAuthenticated(true);
            void hydrateForUser(emp);
          }
        });

        unsubscribe = () => subscription.unsubscribe();
      } catch (err) {
        console.error('[App] Auth bootstrap failed:', err);
        if (!cancelled) setAuthChecked(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [setCurrentUser, hydrateForUser]);

  const handleLogout = () => {
    hydrateGeneration.current += 1;
    setIsHydrating(false);
    setIsAuthenticated(false);
  };

  const handleLoginSuccess = (employee: Employee) => {
    if (REMOTE_AUTH) primeStoreFromSessionCache(employee.id);
    setCurrentUser(employee);
    setIsAuthenticated(true);
    if (REMOTE_AUTH) {
      void hydrateForUser(employee);
    }
  };

  useEffect(() => {
    if (!REMOTE_AUTH || !isAuthenticated) return;
    let bootstrapReloadTimer: ReturnType<typeof setTimeout> | null = null;
    const onBootstrapUpdated = () => {
      if (bootstrapReloadTimer != null) clearTimeout(bootstrapReloadTimer);
      bootstrapReloadTimer = setTimeout(() => {
        bootstrapReloadTimer = null;
        reloadFromDatabase();
        void Promise.all([
          import('./lib/database/bootstrap'),
          import('./lib/roles'),
        ]).then(([{ persistBootstrapCache }, { bootstrapRoleForEmployee }]) => {
          const user = useStore.getState().currentUser;
          persistBootstrapCache(user.id, bootstrapRoleForEmployee(user.role));
        });
      }, 120);
    };
    window.addEventListener('malcon-bootstrap-updated', onBootstrapUpdated);
    return () => {
      if (bootstrapReloadTimer != null) clearTimeout(bootstrapReloadTimer);
      window.removeEventListener('malcon-bootstrap-updated', onBootstrapUpdated);
    };
  }, [isAuthenticated, reloadFromDatabase]);

  const renderPage = () => {
    if (viewMode === 'petrol') {
      switch (activeTab) {
        case 'petrol-dashboard':
        case 'dashboard':
          return <PetrolDashboard />;
        case 'settings':
          return <Settings />;
        default:
          return <PetrolDashboard />;
      }
    }

    if (viewMode === 'employee' || viewMode === 'store_manager') {
      if (isCaseDutyTab(activeTab)) {
        return viewMode === 'store_manager' ? (
          <CaseDutiesPage />
        ) : (
          <EmployeeDashboard />
        );
      }
      switch (activeTab) {
        case 'dashboard':   return <EmployeeDashboard />;
        case 'cases':       return <Cases />;
        case 'live-cases':  return <LiveCases />;
        case 'workflow':    return <WorkflowBoard />;
        case 'settings':    return <Settings />;
        default:            return <EmployeeDashboard />;
      }
    }

    if (isCaseDutyTab(activeTab)) {
      return <CaseDutiesPage />;
    }

    switch (activeTab) {
      case 'dashboard':  return <Dashboard />;
      case 'cases':      return <Cases />;
      case 'live-cases': return <LiveCases />;
      case 'notes':      return <Notes />;
      case 'workflow':   return <WorkflowBoard />;
      case 'postponed-cases': return <PostponedCases />;
      case 'approvals':  return <ApprovalQueue />;
      case 'task-requests': return FCFS_POOL_ENABLED ? <TaskRequestQueue /> : <Dashboard />;
      case 'employees':  return <Employees />;
      case 'telegram':   return <TelegramDashboard />;
      case 'attendance': return <Attendance />;
      case 'attendance-approvals': return <AttendanceApprovals />;
      case 'expenses':   return <Expenses />;
      case 'petrol-dashboard': return <PetrolDashboard />;
      case 'food-dashboard': return <FoodDashboard />;
      case 'kms-dashboard': return <KmsDashboard />;
      case 'hospitals':  return <Hospitals />;
      case 'doctors':    return <Doctors />;
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

  if (REMOTE_AUTH && !isAuthenticated) {
    return (
      <div className="w-full min-w-0 overflow-x-hidden">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  if (activeTab === 'tv-board') {
    return (
      <AppErrorBoundary>
        <TvBoard />
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
    <div className="nexus-app-shell flex h-[100dvh] w-full max-w-full min-w-0 overflow-hidden">
      <Sidebar />

      <div className="nexus-app-main flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar onLogout={handleLogout} />
        <DataHydrationBanner phase={hydrationPhase} />

        <main className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <DataHydrationMainOverlay active={isHydrating} />
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${viewMode}`}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="nexus-page min-h-full w-full min-w-0 max-w-full overflow-x-hidden"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ShortcutsHelpModal isOpen={shortcutsHelpOpen} onClose={() => setShortcutsHelpOpen(false)} />
      <GlobalAddCaseFab />
    </div>
    </AppErrorBoundary>
  );
}

export default App;
