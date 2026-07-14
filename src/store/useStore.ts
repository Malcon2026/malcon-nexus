import { create } from 'zustand';
import type {
  ImplantCase, Employee, Notification, WorkflowStage, Department,
  Hospital, Doctor, Approval, DepartmentInfo, SurgicalKit, ActivityEvent, AttendanceRecord, PunchType
} from '../types';
import { Database } from '../lib/database/database';
import { taskRepository } from '../lib/database/repositories/tasks';
import { notificationRepository } from '../lib/database/repositories/notifications';
import { employeeRepository } from '../lib/database/repositories/employees';
import { hospitalRepository } from '../lib/database/repositories/hospitals';
import { approvalRepository } from '../lib/database/repositories/approvals';
import { doctorRepository } from '../lib/database/repositories/doctors';
import { newId, USE_SUPABASE, setCache } from '../lib/database/config';
import { notifyCaseAssignment } from '../lib/email';
import { syncEmployeeLoginEmail, createEmployeeLogin, DEFAULT_EMPLOYEE_PASSWORD } from '../lib/auth-sync';
import { uploadStagePhotos } from '../lib/stagePhotos';
import { sbActivityRepo, sbNotificationRepo, sbAttendanceRepo } from '../lib/database/repositories/supabaseRepositories';
import { checkOfficeGeofence, OFFICE_LOCATION, summarizeTodayAttendance } from '../lib/attendance';
import type { GeoPosition } from '../lib/attendance';
import type { EmployeeCsvRow } from '../utils/employeeCsvImport';

const WORKFLOW_STAGES: WorkflowStage[] = [
  'Kit Preparation', 'Surgery', 'Cleaning', 'Audit', 'Billing', 'Bill Submission', 'Completed',
];

interface AppState {
  // Auth / View Mode
  currentUser: Employee;
  viewMode: 'admin' | 'employee';

  // State Collections
  cases: ImplantCase[];
  selectedCaseId: string | null;
  notifications: Notification[];
  employees: Employee[];
  hospitals: Hospital[];
  doctors: Doctor[];
  departments: DepartmentInfo[];
  kits: SurgicalKit[];
  activityLog: ActivityEvent[];
  attendanceRecords: AttendanceRecord[];

  // UI State
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  activeTab: string;

  // Actions
  setCurrentUser: (user: Employee) => void;
  setSelectedCase: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;

  // Case Actions
  createCase: (caseData: Partial<ImplantCase>) => Promise<void>;
  updateCase: (id: string, updates: Partial<ImplantCase>) => void;
  approveStage: (caseId: string, adminNotes: string) => void;
  rejectStage: (caseId: string, adminNotes: string) => void;
  requestChanges: (caseId: string, adminNotes: string) => void;
  assignEmployee: (caseId: string, employee: Employee, nextStage?: WorkflowStage) => void;
  submitStage: (
    caseId: string,
    notes: string,
    photos: File[],
    onUploadProgress?: (completed: number, total: number) => void,
  ) => Promise<{ error: string | null }>;
  closeCase: (caseId: string) => void;
  deleteCase: (id: string) => void;

  // Employee Actions
  createEmployee: (employeeData: Partial<Employee>, options?: { password?: string }) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<{ error: string | null }>;
  deleteEmployee: (id: string) => void;
  importEmployeesFromCsv: (rows: EmployeeCsvRow[]) => Promise<{
    created: number;
    updated: number;
    failed: number;
    errors: string[];
  }>;

  // Hospital Actions
  createHospital: (data: Partial<Hospital>) => void;
  updateHospital: (id: string, updates: Partial<Hospital>) => void;
  deleteHospital: (id: string) => void;

  // Doctor Actions
  createDoctor: (data: Partial<Doctor>) => void;
  updateDoctor: (id: string, updates: Partial<Doctor>) => void;
  deleteDoctor: (id: string) => void;

  // Notification Actions
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Attendance
  punchAttendance: (punchType: PunchType, position: GeoPosition) => Promise<{ error: string | null }>;
  getMyTodayAttendance: () => ReturnType<typeof summarizeTodayAttendance>;

  // Dynamic Metrics
  getMonthlyData: () => { month: string; cases: number; revenue: number; completed: number }[];
  getDepartmentPerformance: () => { department: string; avgTime: number; casesHandled: number; onTime: number }[];
  getStageDistribution: () => { stage: WorkflowStage; count: number; color: string }[];

  // Data reset
  clearAllData: () => void;
  reloadFromDatabase: () => void;
}

// --- Helpers ---

const getNextStage = (current: WorkflowStage): WorkflowStage | null => {
  const idx = WORKFLOW_STAGES.indexOf(current);
  if (idx >= 0 && idx < WORKFLOW_STAGES.length - 1) {
    return WORKFLOW_STAGES[idx + 1];
  }
  return null;
};

const getDepartmentForStage = (stage: WorkflowStage): Department | null => {
  const map: Record<WorkflowStage, Department | null> = {
    'Kit Preparation': 'Stores',
    'Surgery': 'Scrub Person',
    'Cleaning': 'Cleaning Department',
    'Audit': 'Stores Audit',
    'Billing': 'Accounts',
    'Bill Submission': 'Bill Submission',
    'Completed': null,
  };
  return map[stage];
};

const createActivityEvent = (
  action: string,
  entityType: ActivityEvent['entityType'],
  entityId: string,
  entityLabel: string,
  performedBy: string,
  performedByRole: 'admin' | 'employee',
  details: string,
): ActivityEvent => ({
  id: newId(),
  action,
  entityType,
  entityId,
  entityLabel,
  performedBy,
  performedByRole,
  timestamp: new Date().toISOString(),
  details,
});

const createNotification = (
  title: string,
  message: string,
  type: Notification['type'],
  caseId?: string,
): Notification => ({
  id: newId(),
  title,
  message,
  type,
  timestamp: new Date().toISOString(),
  read: false,
  caseId,
});

// Persist activity event to DB and return it
const persistActivity = async (event: ActivityEvent): Promise<void> => {
  if (USE_SUPABASE) {
    await sbActivityRepo.insert(event).catch((err) => console.error('[activity] persist failed:', err));
    const list = Database.getAll<ActivityEvent>('activityLog');
    setCache('activityLog', [event, ...list]);
    return;
  }
  const list = Database.getAll<ActivityEvent>('activityLog');
  Database.saveAll('activityLog', [event, ...list]);
};

// Persist notification to DB and return it
const persistNotification = async (notif: Notification): Promise<void> => {
  if (USE_SUPABASE) {
    await sbNotificationRepo.create(notif).catch((err) => console.error('[notification] persist failed:', err));
    const list = Database.getAll<Notification>('notifications');
    setCache('notifications', [notif, ...list]);
    return;
  }
  const list = Database.getAll<Notification>('notifications');
  Database.saveAll('notifications', [notif, ...list]);
};

const persistAttendance = async (record: AttendanceRecord): Promise<void> => {
  if (USE_SUPABASE) {
    await sbAttendanceRepo.insert(record).catch((err) => console.error('[attendance] persist failed:', err));
    const list = Database.getAll<AttendanceRecord>('attendanceRecords');
    setCache('attendanceRecords', [record, ...list]);
    return;
  }
  const list = Database.getAll<AttendanceRecord>('attendanceRecords');
  Database.saveAll('attendanceRecords', [record, ...list]);
};

const updateCaseApproval = async (
  caseId: string,
  stage: WorkflowStage,
  updates: Partial<Approval>,
): Promise<void> => {
  const approval = await approvalRepository.findByCaseAndStage(caseId, stage);
  if (!approval) return;
  await approvalRepository.update(approval.id, updates);
};

// --- Initialize DB and fetch collections ---
const initialEmployees = Database.getAll<Employee>('employees');
const initialCases = Database.getAll<ImplantCase>('cases');
const initialNotifications = Database.getAll<Notification>('notifications');
const initialHospitals = Database.getAll<Hospital>('hospitals');
const initialDoctors = Database.getAll<Doctor>('doctors');
const initialDepartments = Database.getAll<DepartmentInfo>('departments');
const initialKits = Database.getAll<SurgicalKit>('kits');
const initialActivity = Database.getAll<ActivityEvent>('activityLog');
const initialAttendance = Database.getAll<AttendanceRecord>('attendanceRecords');

const placeholderAdmin: Employee = {
  id: 'guest',
  name: 'Admin',
  department: 'Admin',
  email: '',
  avatar: 'AD',
  role: 'admin',
  status: 'Active',
  casesCompleted: 0,
  casesActive: 0,
  joinDate: new Date().toISOString().split('T')[0],
  phone: '',
};

const adminUser = initialEmployees.find(e => e.role === 'admin') ?? placeholderAdmin;

const ADMIN_ONLY_TABS = ['approvals', 'employees', 'hospitals', 'reports', 'case-history', 'activity'];

const applyUserSession = (
  user: Employee,
  current: { activeTab: string },
): { currentUser: Employee; viewMode: 'admin' | 'employee'; activeTab: string } => {
  const viewMode = user.role === 'admin' ? 'admin' : 'employee';
  const activeTab =
    user.role !== 'admin' && ADMIN_ONLY_TABS.includes(current.activeTab)
      ? 'dashboard'
      : current.activeTab;
  return { currentUser: user, viewMode, activeTab };
};

export const useStore = create<AppState>((set, get) => ({
  currentUser: adminUser,
  viewMode: adminUser.role === 'admin' ? 'admin' : 'employee',
  cases: initialCases,
  selectedCaseId: null,
  notifications: initialNotifications,
  employees: initialEmployees,
  hospitals: initialHospitals,
  doctors: initialDoctors,
  departments: initialDepartments,
  kits: initialKits,
  activityLog: initialActivity,
  attendanceRecords: initialAttendance,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  activeTab: 'dashboard',

  setCurrentUser: (user) => {
    const state = get();
    set(applyUserSession(user, { activeTab: state.activeTab }));
  },
  setSelectedCase: (id) => set({ selectedCaseId: id }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab, mobileSidebarOpen: false }),

  // ========== CASE ACTIONS ==========

  createCase: async (caseData) => {
    const state = get();
    const caseId = newId();
    const targetDept = caseData.currentDepartment || 'Stores';
    const targetEmp = caseData.assignedEmployee || null;
    const isAssigned = !!targetEmp;

    const DEPT_TO_STAGE: Record<string, WorkflowStage> = {
      'Stores': 'Kit Preparation',
      'Scrub Person': 'Surgery',
      'Cleaning Department': 'Cleaning',
      'Stores Audit': 'Audit',
      'Accounts': 'Billing',
      'Bill Submission': 'Bill Submission',
      'Admin': 'Completed',
    };

    const targetStage = DEPT_TO_STAGE[targetDept] || 'Kit Preparation';
    const caseNumber = await taskRepository.getNextCaseNumber();

    const newCase: ImplantCase = {
      id: caseId,
      caseNumber,
      hospital: caseData.hospital!,
      doctor: caseData.doctor!,
      surgeryDate: caseData.surgeryDate || '',
      implantRequired: caseData.implantRequired || '',
      implantType: caseData.implantType || '',
      priority: caseData.priority || 'Medium',
      status: isAssigned ? 'Active' : 'Draft',
      currentStage: targetStage,
      currentDepartment: targetDept,
      assignedEmployee: targetEmp,
      createdBy: state.currentUser.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: caseData.dueDate || caseData.surgeryDate || '',
      remarks: caseData.remarks || '',
      stages: WORKFLOW_STAGES.map((stage) => {
        const isTarget = stage === targetStage;
        return {
          stage,
          department: getDepartmentForStage(stage) as Department,
          assignedEmployee: isTarget ? targetEmp : null,
          assignedAt: isTarget && targetEmp ? new Date().toISOString() : null,
          submittedAt: null,
          approvedAt: null,
          status: isTarget && targetEmp ? ('Assigned' as const) : ('Pending' as const),
          notes: '',
          adminNotes: '',
          documents: [],
        };
      }),
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          caseId,
          action: 'Case Created',
          performedBy: state.currentUser.name,
          performedByRole: state.currentUser.role,
          timestamp: new Date().toISOString(),
          details: isAssigned
            ? `New implant case created for ${caseData.hospital?.name} and assigned to ${targetEmp.name} (${targetDept}).`
            : `New implant case created for ${caseData.hospital?.name}.`,
        },
      ],
      comments: [],
      invoiceAmount: 0,
      paymentStatus: 'Pending',
    };

    try {
      await taskRepository.create(newCase);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('duplicate key') || message.includes('cases_case_number_key')) {
        throw new Error('Could not generate a unique case number. Please refresh and try again.');
      }
      if (message.includes('Hospital must be saved')) {
        throw new Error('This hospital is not saved in the database. Re-add it from Settings and try again.');
      }
      throw new Error(message || 'Failed to create case.');
    }

    let updatedEmployees = state.employees;
    if (targetEmp) {
      const updated = await employeeRepository.update(targetEmp.id, {
        casesActive: targetEmp.casesActive + 1,
      });
      updatedEmployees = state.employees.map(e => (e.id === targetEmp.id ? updated : e));
    }

    // Activity + Notification
    const activity = createActivityEvent('Case Created', 'case', caseId, newCase.caseNumber, state.currentUser.name, state.currentUser.role, isAssigned ? `New case created and assigned to ${targetEmp.name}.` : `New implant case created.`);
    persistActivity(activity);

    const notif = createNotification('New Case Created', `Case ${newCase.caseNumber} created for ${caseData.hospital?.name}.`, 'info', caseId);
    persistNotification(notif);

    set((s) => ({
      cases: [newCase, ...s.cases],
      employees: updatedEmployees,
      activityLog: [activity, ...s.activityLog],
      notifications: [notif, ...s.notifications],
    }));

    if (targetEmp) {
      void notifyCaseAssignment(caseId, targetEmp.id);
    }
  },

  updateCase: async (id, updates) => {
    const updated = await taskRepository.update(id, updates);
    set((s) => ({
      cases: s.cases.map((c) => (c.id === id ? updated : c)),
    }));
  },

  approveStage: async (caseId, adminNotes) => {
    const state = get();
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return;

    const stageIdx = WORKFLOW_STAGES.indexOf(c.currentStage);
    const updatedStages = c.stages.map((s, i) =>
      i === stageIdx
        ? { ...s, status: 'Approved' as const, approvedAt: new Date().toISOString(), adminNotes }
        : s
    );
    const newLog = {
      id: `log-${Date.now()}`,
      caseId,
      action: `Stage Approved: ${c.currentStage}`,
      performedBy: state.currentUser.name,
      performedByRole: 'admin' as const,
      timestamp: new Date().toISOString(),
      details: `Admin approved ${c.currentStage} stage. ${adminNotes}`,
    };

    // Update approvals table
    await updateCaseApproval(caseId, c.currentStage, {
      status: 'Approved',
      approvedAt: new Date().toISOString(),
      adminNotes,
    });

    const updatedCase = await taskRepository.update(caseId, {
      stages: updatedStages,
      status: 'Approved',
      activityLogs: [...c.activityLogs, newLog],
    });

    // Activity + Notification
    const activity = createActivityEvent(`Stage Approved: ${c.currentStage}`, 'case', caseId, c.caseNumber, state.currentUser.name, 'admin', `${c.currentStage} stage approved. ${adminNotes}`);
    persistActivity(activity);

    const notif = createNotification('Stage Approved', `${c.caseNumber} ${c.currentStage} approved by admin.`, 'success', caseId);
    persistNotification(notif);

    set((s) => ({
      cases: s.cases.map((x) => (x.id === caseId ? updatedCase : x)),
      activityLog: [activity, ...s.activityLog],
      notifications: [notif, ...s.notifications],
    }));
  },

  rejectStage: async (caseId, adminNotes) => {
    const state = get();
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return;

    const stageIdx = WORKFLOW_STAGES.indexOf(c.currentStage);
    const updatedStages = c.stages.map((s, i) =>
      i === stageIdx
        ? { ...s, status: 'Rejected' as const, adminNotes }
        : s
    );
    const newLog = {
      id: `log-${Date.now()}`,
      caseId,
      action: `Stage Rejected: ${c.currentStage}`,
      performedBy: state.currentUser.name,
      performedByRole: 'admin' as const,
      timestamp: new Date().toISOString(),
      details: `Admin rejected ${c.currentStage} stage. Reason: ${adminNotes}`,
    };

    await updateCaseApproval(caseId, c.currentStage, {
      status: 'Rejected',
      adminNotes,
    });

    const updatedCase = await taskRepository.update(caseId, {
      stages: updatedStages,
      status: 'Rejected',
      activityLogs: [...c.activityLogs, newLog],
    });

    const activity = createActivityEvent(`Stage Rejected: ${c.currentStage}`, 'case', caseId, c.caseNumber, state.currentUser.name, 'admin', `${c.currentStage} rejected. ${adminNotes}`);
    persistActivity(activity);

    const notif = createNotification('Stage Rejected', `${c.caseNumber} ${c.currentStage} rejected.`, 'error', caseId);
    persistNotification(notif);

    set((s) => ({
      cases: s.cases.map((x) => (x.id === caseId ? updatedCase : x)),
      activityLog: [activity, ...s.activityLog],
      notifications: [notif, ...s.notifications],
    }));
  },

  requestChanges: async (caseId, adminNotes) => {
    const state = get();
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return;

    const stageIdx = WORKFLOW_STAGES.indexOf(c.currentStage);
    const updatedStages = c.stages.map((s, i) =>
      i === stageIdx
        ? { ...s, status: 'Changes Requested' as const, adminNotes }
        : s
    );
    const newLog = {
      id: `log-${Date.now()}`,
      caseId,
      action: `Changes Requested: ${c.currentStage}`,
      performedBy: state.currentUser.name,
      performedByRole: 'admin' as const,
      timestamp: new Date().toISOString(),
      details: `Admin requested changes for ${c.currentStage}. Notes: ${adminNotes}`,
    };

    await updateCaseApproval(caseId, c.currentStage, {
      status: 'Changes Requested',
      adminNotes,
    });

    const updatedCase = await taskRepository.update(caseId, {
      stages: updatedStages,
      status: 'Changes Requested',
      activityLogs: [...c.activityLogs, newLog],
    });

    const activity = createActivityEvent(`Changes Requested: ${c.currentStage}`, 'case', caseId, c.caseNumber, state.currentUser.name, 'admin', `Changes requested for ${c.currentStage}. ${adminNotes}`);
    persistActivity(activity);

    const notif = createNotification('Changes Requested', `${c.caseNumber} ${c.currentStage} sent back for changes.`, 'warning', caseId);
    persistNotification(notif);

    set((s) => ({
      cases: s.cases.map((x) => (x.id === caseId ? updatedCase : x)),
      activityLog: [activity, ...s.activityLog],
      notifications: [notif, ...s.notifications],
    }));
  },

  assignEmployee: async (caseId, employee, nextStage) => {
    const state = get();
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return;

    const targetStage = nextStage || getNextStage(c.currentStage) || c.currentStage;
    const stageIdx = WORKFLOW_STAGES.indexOf(targetStage);
    const updatedStages = c.stages.map((s, i) =>
      i === stageIdx
        ? { ...s, assignedEmployee: employee, assignedAt: new Date().toISOString(), status: 'Assigned' as const }
        : s
    );
    const newLog = {
      id: `log-${Date.now()}`,
      caseId,
      action: `Assigned to ${employee.department}`,
      performedBy: state.currentUser.name,
      performedByRole: 'admin' as const,
      department: employee.department,
      timestamp: new Date().toISOString(),
      details: `${employee.name} assigned to ${targetStage} stage.`,
    };

    const updatedCase = await taskRepository.update(caseId, {
      currentStage: targetStage,
      currentDepartment: employee.department,
      assignedEmployee: employee,
      status: 'Active',
      stages: updatedStages,
      activityLogs: [...c.activityLogs, newLog],
    });

    // Update employee active count
    let updatedEmployees = state.employees;
    const employeeList = Database.getAll<Employee>('employees');
    const target = employeeList.find(e => e.id === employee.id);
    if (target) {
      const updated = await employeeRepository.update(employee.id, {
        casesActive: target.casesActive + 1,
      });
      updatedEmployees = state.employees.map(e => (e.id === employee.id ? updated : e));
    }

    const activity = createActivityEvent(`Assigned to ${employee.department}`, 'case', caseId, c.caseNumber, state.currentUser.name, 'admin', `${employee.name} assigned to ${targetStage}.`);
    persistActivity(activity);

    const notif = createNotification('New Assignment', `${employee.name} assigned to case ${c.caseNumber} — ${targetStage}.`, 'info', caseId);
    persistNotification(notif);

    set((s) => ({
      cases: s.cases.map((x) => (x.id === caseId ? updatedCase : x)),
      notifications: [notif, ...s.notifications],
      employees: updatedEmployees,
      activityLog: [activity, ...s.activityLog],
    }));

    void notifyCaseAssignment(caseId, employee.id);
  },

  submitStage: async (caseId, notes, photos, onUploadProgress) => {
    const state = get();
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return { error: 'Case not found' };
    if (c.status === 'Waiting For Approval') {
      return { error: 'This stage is already submitted and waiting for admin approval.' };
    }
    if (photos.length === 0) {
      return { error: 'At least one photo is required.' };
    }

    const uploadedBy = c.assignedEmployee?.name || state.currentUser.name;

    try {
      const stageDocuments = await uploadStagePhotos(
        caseId,
        c.currentStage,
        photos,
        uploadedBy,
        onUploadProgress,
      );

      const stageIdx = WORKFLOW_STAGES.indexOf(c.currentStage);
      const updatedStages = c.stages.map((s, i) =>
        i === stageIdx
          ? {
              ...s,
              status: 'Submitted' as const,
              submittedAt: new Date().toISOString(),
              notes,
              documents: [...s.documents, ...stageDocuments],
            }
          : s
      );
      const photoLabel = stageDocuments.length === 1 ? 'photo' : `${stageDocuments.length} photos`;
      const newLog = {
        id: `log-${Date.now()}`,
        caseId,
        action: `Submitted: ${c.currentStage}`,
        performedBy: uploadedBy,
        performedByRole: 'employee' as const,
        timestamp: new Date().toISOString(),
        details: `Stage ${c.currentStage} submitted with ${photoLabel}. Notes: ${notes}`,
      };

      const updatedCase = await taskRepository.update(caseId, {
        stages: updatedStages,
        status: 'Waiting For Approval',
        activityLogs: [...c.activityLogs, newLog],
      });

      const newApproval: Approval = {
        id: newId(),
        caseId,
        caseNumber: c.caseNumber,
        stage: c.currentStage,
        submittedBy: uploadedBy,
        submittedAt: new Date().toISOString(),
        status: 'Pending',
        notes,
      };

      await approvalRepository.create(newApproval).catch((err) => {
        console.error('[submitStage] approval create failed:', err);
      });

      const activity = createActivityEvent(
        `Submitted: ${c.currentStage}`,
        'case',
        caseId,
        c.caseNumber,
        uploadedBy,
        'employee',
        `${c.currentStage} submitted with ${photoLabel} for review.`,
      );
      void persistActivity(activity);

      const notif = createNotification(
        'Approval Required',
        `Case ${c.caseNumber} ${c.currentStage} submitted for review.`,
        'warning',
        caseId,
      );
      void persistNotification(notif);

      set((s) => ({
        cases: s.cases.map((x) => (x.id === caseId ? updatedCase : x)),
        notifications: [notif, ...s.notifications],
        activityLog: [activity, ...s.activityLog],
      }));

      return { error: null };
    } catch (err) {
      console.error('[submitStage] failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: `Failed to submit: ${message}` };
    }
  },

  closeCase: async (caseId) => {
    const state = get();
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return;

    const newLog = {
      id: `log-${Date.now()}`,
      caseId,
      action: 'Case Closed',
      performedBy: state.currentUser.name,
      performedByRole: 'admin' as const,
      timestamp: new Date().toISOString(),
      details: 'Admin closed the case. All stages complete.',
    };

    const updatedCase = await taskRepository.update(caseId, {
      status: 'Completed',
      currentStage: 'Completed',
      currentDepartment: null,
      assignedEmployee: null,
      activityLogs: [...c.activityLogs, newLog],
    });

    const assignedEmp = c.assignedEmployee;
    let updatedEmployees = state.employees;
    if (assignedEmp) {
      const target = state.employees.find(e => e.id === assignedEmp.id);
      if (target) {
        const updated = await employeeRepository.update(assignedEmp.id, {
          casesActive: Math.max(0, target.casesActive - 1),
          casesCompleted: target.casesCompleted + 1,
        });
        updatedEmployees = state.employees.map(e => (e.id === assignedEmp.id ? updated : e));
      }
    }

    const activity = createActivityEvent('Case Closed', 'case', caseId, c.caseNumber, state.currentUser.name, 'admin', `Case ${c.caseNumber} completed and closed.`);
    persistActivity(activity);

    const notif = createNotification('Case Completed', `Case ${c.caseNumber} has been completed.`, 'success', caseId);
    persistNotification(notif);

    set((s) => ({
      cases: s.cases.map((x) => (x.id === caseId ? updatedCase : x)),
      employees: updatedEmployees,
      activityLog: [activity, ...s.activityLog],
      notifications: [notif, ...s.notifications],
    }));
  },

  deleteCase: async (id) => {
    const state = get();
    const c = state.cases.find(x => x.id === id);
    await taskRepository.delete(id);

    if (c) {
      const activity = createActivityEvent('Case Deleted', 'case', id, c.caseNumber, state.currentUser.name, state.currentUser.role, `Case ${c.caseNumber} permanently deleted.`);
      persistActivity(activity);
      set((s) => ({
        cases: s.cases.filter((x) => x.id !== id),
        selectedCaseId: s.selectedCaseId === id ? null : s.selectedCaseId,
        activityLog: [activity, ...s.activityLog],
      }));
    } else {
      set((s) => ({
        cases: s.cases.filter((x) => x.id !== id),
        selectedCaseId: s.selectedCaseId === id ? null : s.selectedCaseId,
      }));
    }
  },

  // ========== EMPLOYEE ACTIONS ==========

  createEmployee: async (employeeData, options) => {
    const state = get();
    const initials = (employeeData.name || '')
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newEmp: Employee = {
      id: newId(),
      name: employeeData.name || '',
      department: employeeData.department || 'Stores',
      email: (employeeData.email || '').trim().toLowerCase(),
      avatar: initials || 'EE',
      role: employeeData.role || 'employee',
      status: 'Active',
      casesCompleted: 0,
      casesActive: 0,
      joinDate: new Date().toISOString().split('T')[0],
      phone: employeeData.phone || '',
    };

    await employeeRepository.create(newEmp);

    if (USE_SUPABASE) {
      const { error: loginError } = await createEmployeeLogin(
        newEmp.id,
        newEmp.email,
        newEmp.name,
        options?.password ?? DEFAULT_EMPLOYEE_PASSWORD,
      );
      if (loginError) {
        console.error('[createEmployee] login creation failed:', loginError);
        throw new Error(loginError);
      }
    }

    const activity = createActivityEvent('Employee Created', 'employee', newEmp.id, newEmp.name, state.currentUser.name, state.currentUser.role, `New employee ${newEmp.name} added to ${newEmp.department}.`);
    persistActivity(activity);

    const notif = createNotification('Employee Added', `${newEmp.name} has been added to ${newEmp.department}.`, 'info');
    persistNotification(notif);

    set((s) => ({
      employees: [...s.employees, newEmp],
      activityLog: [activity, ...s.activityLog],
      notifications: [notif, ...s.notifications],
    }));
  },

  importEmployeesFromCsv: async (rows) => {
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const existing = get().employees.find(
          (e) => e.email.toLowerCase() === row.email.toLowerCase(),
        );

        if (existing) {
          const { error } = await get().updateEmployee(existing.id, {
            name: row.name,
            email: row.email,
            department: row.department,
            role: row.role,
            phone: row.phone,
            avatar: row.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase(),
          });
          if (error) throw new Error(error);
          updated += 1;
        } else {
          await get().createEmployee(
            {
              name: row.name,
              email: row.email,
              department: row.department,
              role: row.role,
              phone: row.phone,
            },
            { password: row.password },
          );
          created += 1;
        }
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${row._line} (${row.email}): ${message}`);
      }
    }

    return { created, updated, failed, errors };
  },

  updateEmployee: async (id, updates) => {
    const state = get();
    const existing = state.employees.find((e) => e.id === id);

    if (USE_SUPABASE && updates.email && existing) {
      const nextEmail = updates.email.trim().toLowerCase();
      const currentEmail = existing.email.trim().toLowerCase();

      if (nextEmail !== currentEmail) {
        const { error: authError } = await syncEmployeeLoginEmail(id, nextEmail);
        if (authError) {
          return { error: `Login email not updated: ${authError}` };
        }
        updates = { ...updates, email: nextEmail };
      }
    }

    const updated = await employeeRepository.update(id, updates);

    const activity = createActivityEvent('Employee Updated', 'employee', id, updated.name, state.currentUser.name, state.currentUser.role, `Employee ${updated.name} profile updated.`);
    persistActivity(activity);

    set((s) => ({
      employees: s.employees.map(e => (e.id === id ? updated : e)),
      // If updating self, update currentUser too
      currentUser: s.currentUser.id === id ? updated : s.currentUser,
      activityLog: [activity, ...s.activityLog],
    }));

    return { error: null };
  },

  deleteEmployee: async (id) => {
    const state = get();
    const emp = state.employees.find(e => e.id === id);
    await employeeRepository.delete(id);

    if (emp) {
      const activity = createActivityEvent('Employee Deleted', 'employee', id, emp.name, state.currentUser.name, state.currentUser.role, `Employee ${emp.name} removed from the system.`);
      persistActivity(activity);

      set((s) => ({
        employees: s.employees.filter(e => e.id !== id),
        activityLog: [activity, ...s.activityLog],
      }));
    } else {
      set((s) => ({
        employees: s.employees.filter(e => e.id !== id),
      }));
    }
  },

  // ========== HOSPITAL ACTIONS ==========

  createHospital: async (data) => {
    const state = get();
    const newHospital: Hospital = {
      id: newId(),
      name: data.name || '',
      branch: data.branch || '',
      address: data.address || '',
      city: data.city || '',
      contactPerson: data.contactPerson || '',
      phone: data.phone || '',
      email: data.email || '',
      status: 'Active',
    };

    await hospitalRepository.create(newHospital);

    const activity = createActivityEvent('Hospital Added', 'hospital', newHospital.id, newHospital.name, state.currentUser.name, state.currentUser.role, `Hospital ${newHospital.name} (${newHospital.city}) added.`);
    persistActivity(activity);

    const notif = createNotification('Hospital Added', `${newHospital.name} has been registered.`, 'info');
    persistNotification(notif);

    set((s) => ({
      hospitals: [...s.hospitals, newHospital],
      activityLog: [activity, ...s.activityLog],
      notifications: [notif, ...s.notifications],
    }));
  },

  updateHospital: async (id, updates) => {
    const state = get();
    const updated = await hospitalRepository.update(id, updates);

    const activity = createActivityEvent('Hospital Updated', 'hospital', id, updated.name, state.currentUser.name, state.currentUser.role, `Hospital ${updated.name} details updated.`);
    persistActivity(activity);

    set((s) => ({
      hospitals: s.hospitals.map(h => (h.id === id ? updated : h)),
      activityLog: [activity, ...s.activityLog],
    }));
  },

  deleteHospital: async (id) => {
    const state = get();
    const hosp = state.hospitals.find(h => h.id === id);
    await hospitalRepository.delete(id);

    if (hosp) {
      const activity = createActivityEvent('Hospital Deleted', 'hospital', id, hosp.name, state.currentUser.name, state.currentUser.role, `Hospital ${hosp.name} removed from the system.`);
      persistActivity(activity);

      set((s) => ({
        hospitals: s.hospitals.filter(h => h.id !== id),
        activityLog: [activity, ...s.activityLog],
      }));
    } else {
      set((s) => ({
        hospitals: s.hospitals.filter(h => h.id !== id),
      }));
    }
  },

  // ========== DOCTOR ACTIONS ==========

  createDoctor: async (data) => {
    const state = get();
    const newDoctor = await doctorRepository.create({
      id: newId(),
      name: data.name || '',
      specialization: data.specialization || '',
      hospitalId: data.hospitalId || '',
      phone: data.phone || '',
    });

    const activity = createActivityEvent('Doctor Added', 'hospital', newDoctor.id, newDoctor.name, state.currentUser.name, state.currentUser.role, `Dr. ${newDoctor.name} registered.`);
    persistActivity(activity);

    set((s) => ({
      doctors: [...s.doctors, newDoctor],
      activityLog: [activity, ...s.activityLog],
    }));
  },

  updateDoctor: async (id, updates) => {
    const state = get();
    const updatedDoc = await doctorRepository.update(id, updates);

    const activity = createActivityEvent('Doctor Updated', 'hospital', id, updatedDoc.name, state.currentUser.name, state.currentUser.role, `Doctor profile updated.`);
    persistActivity(activity);

    set((s) => ({
      doctors: s.doctors.map(d => (d.id === id ? updatedDoc : d)),
      activityLog: [activity, ...s.activityLog],
    }));
  },

  deleteDoctor: async (id) => {
    const state = get();
    const doc = state.doctors.find(d => d.id === id);
    await doctorRepository.delete(id);

    if (doc) {
      const activity = createActivityEvent('Doctor Removed', 'hospital', id, doc.name, state.currentUser.name, state.currentUser.role, `Dr. ${doc.name} removed.`);
      persistActivity(activity);

      set((s) => ({
        doctors: s.doctors.filter(d => d.id !== id),
        activityLog: [activity, ...s.activityLog],
      }));
    } else {
      set((s) => ({
        doctors: s.doctors.filter(d => d.id !== id),
      }));
    }
  },

  // ========== NOTIFICATION ACTIONS ==========

  markNotificationRead: async (id) => {
    await notificationRepository.update(id, { read: true });
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  markAllNotificationsRead: async () => {
    const notifications = get().notifications;
    for (const n of notifications) {
      if (!n.read) {
        await notificationRepository.update(n.id, { read: true });
      }
    }
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  // ========== ATTENDANCE ==========

  getMyTodayAttendance: () => {
    const { attendanceRecords, currentUser } = get();
    return summarizeTodayAttendance(attendanceRecords, currentUser.id);
  },

  punchAttendance: async (punchType, position) => {
    const { currentUser, attendanceRecords } = get();
    const summary = summarizeTodayAttendance(attendanceRecords, currentUser.id);

    if (punchType === 'in' && summary.isPunchedIn) {
      return { error: 'You are already punched in. Punch out first.' };
    }
    if (punchType === 'out' && !summary.isPunchedIn) {
      return { error: 'You are not punched in yet. Punch in first.' };
    }

    const geofence = checkOfficeGeofence(position.latitude, position.longitude);
    if (!geofence.withinOffice) {
      return {
        error: `You must be at the office (${OFFICE_LOCATION.address}) to punch. You are ${geofence.distanceM}m away (max ${OFFICE_LOCATION.radiusM}m).`,
      };
    }

    const punchedAt = new Date().toISOString();
    const record: AttendanceRecord = {
      id: newId(),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      punchType,
      punchedAt,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracyM: position.accuracyM,
      distanceM: geofence.distanceM,
      withinOffice: geofence.withinOffice,
      officeAddress: OFFICE_LOCATION.address,
    };

    await persistAttendance(record);

    const label = punchType === 'in' ? 'Punch In' : 'Punch Out';
    const activity: ActivityEvent = {
      id: newId(),
      action: label,
      entityType: 'attendance',
      entityId: record.id,
      entityLabel: currentUser.name,
      performedBy: currentUser.name,
      performedByRole: currentUser.role,
      timestamp: punchedAt,
      details: `${label} at ${OFFICE_LOCATION.address} (${geofence.distanceM}m from office)`,
    };
    persistActivity(activity);

    set((s) => ({
      attendanceRecords: [record, ...s.attendanceRecords],
      activityLog: [activity, ...s.activityLog],
    }));

    return { error: null };
  },

  // ========== DYNAMIC METRICS ==========

  getMonthlyData: () => {
    const cases = get().cases;
    const result = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const monthNum = d.getMonth();
      const year = d.getFullYear();

      const casesInMonth = cases.filter(c => {
        const cDate = new Date(c.createdAt);
        return cDate.getMonth() === monthNum && cDate.getFullYear() === year;
      });

      const completedInMonth = cases.filter(c => {
        if (c.status !== 'Completed') return false;
        const uDate = new Date(c.updatedAt);
        return uDate.getMonth() === monthNum && uDate.getFullYear() === year;
      });

      const revenueInMonth = casesInMonth.reduce((sum, c) => sum + (c.invoiceAmount || 0), 0);

      result.push({
        month: monthName,
        cases: casesInMonth.length,
        revenue: revenueInMonth,
        completed: completedInMonth.length,
      });
    }
    return result;
  },

  getDepartmentPerformance: () => {
    const cases = get().cases;
    const departments: Department[] = ['Stores', 'Scrub Person', 'Cleaning Department', 'Stores Audit', 'Accounts', 'Bill Submission'];

    return departments.map(dept => {
      let casesHandled = 0;
      let totalDurationMs = 0;
      let approvedCount = 0;
      let onTimeCount = 0;

      cases.forEach(c => {
        const stage = c.stages.find(s => s.department === dept);
        if (stage && (stage.status === 'Approved' || stage.assignedAt)) {
          casesHandled++;
          if (stage.status === 'Approved' && stage.assignedAt && stage.approvedAt) {
            approvedCount++;
            const duration = new Date(stage.approvedAt).getTime() - new Date(stage.assignedAt).getTime();
            totalDurationMs += duration;

            const target = 24 * 60 * 60 * 1000;
            if (duration <= target * 1.5) {
              onTimeCount++;
            }
          }
        }
      });

      const avgTimeDays = approvedCount > 0
        ? parseFloat((totalDurationMs / approvedCount / (24 * 60 * 60 * 1000)).toFixed(1))
        : 0;

      const onTimeRate = approvedCount > 0
        ? Math.round((onTimeCount / approvedCount) * 100)
        : 100;

      let displayDept = dept as string;
      if (displayDept === 'Cleaning Department') displayDept = 'Cleaning';

      return {
        department: displayDept,
        avgTime: avgTimeDays || 1.0,
        casesHandled,
        onTime: onTimeRate,
      };
    });
  },

  getStageDistribution: () => {
    const cases = get().cases;
    const stages: WorkflowStage[] = ['Kit Preparation', 'Surgery', 'Cleaning', 'Audit', 'Billing', 'Bill Submission', 'Completed'];
    const colors: Record<WorkflowStage, string> = {
      'Kit Preparation': '#6366f1',
      'Surgery': '#8b5cf6',
      'Cleaning': '#06b6d4',
      'Audit': '#f59e0b',
      'Billing': '#10b981',
      'Bill Submission': '#f97316',
      'Completed': '#22c55e',
    };

    return stages.map(stage => ({
      stage,
      count: cases.filter(c => c.currentStage === stage).length,
      color: colors[stage],
    }));
  },

  // ========== DATA RESET ==========

  clearAllData: () => {
    Database.clearAll();
    const resetEmployees = get().employees.map(e => ({
      ...e,
      casesCompleted: 0,
      casesActive: 0,
    }));
    set({
      cases: [],
      notifications: [],
      activityLog: [],
      attendanceRecords: [],
      employees: resetEmployees,
      selectedCaseId: null,
    });
  },

  reloadFromDatabase: () => {
    const state = get();
    const employees = Database.getAll<Employee>('employees');
    const matched =
      employees.find(e => e.id === state.currentUser.id) ??
      employees.find(e => state.currentUser.email && e.email === state.currentUser.email);
    const session = matched
      ? applyUserSession(matched, { activeTab: state.activeTab })
      : { currentUser: state.currentUser, viewMode: state.viewMode, activeTab: state.activeTab };

    set({
      employees,
      cases: Database.getAll<ImplantCase>('cases'),
      notifications: Database.getAll<Notification>('notifications'),
      hospitals: Database.getAll<Hospital>('hospitals'),
      doctors: Database.getAll<Doctor>('doctors'),
      departments: Database.getAll<DepartmentInfo>('departments'),
      kits: Database.getAll<SurgicalKit>('kits'),
      activityLog: Database.getAll<ActivityEvent>('activityLog'),
      attendanceRecords: Database.getAll<AttendanceRecord>('attendanceRecords'),
      ...session,
    });
  },
}));
