export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type CaseStatus =
  | 'Draft'
  | 'Active'
  | 'Waiting For Approval'
  | 'Approved'
  | 'Rejected'
  | 'Changes Requested'
  | 'Completed'
  | 'Cancelled';

export type WorkflowStage =
  | 'Kit Preparation'
  | 'Delivery'
  | 'Surgery'
  | 'Pickup from Hospital'
  | 'Cleaning & Audit'
  | 'Restock'
  | 'Billing'
  | 'Bill Submission'
  | 'Completed';

export type RestockOutcome = 'restocked' | 'order';

export type Department =
  | 'Stores'
  | 'Delivery'
  | 'Drivers'
  | 'Scrub Person'
  | 'Cleaning & Audit'
  | 'Accounts'
  | 'Bill Submission'
  | 'Office Staff'
  | 'Admin';

export interface Employee {
  id: string;
  name: string;
  /** Primary department — shown on cards and used when a single label is needed. */
  department: Department;
  /** All departments this person can work in (includes `department` when set in admin). */
  departments?: Department[];
  email: string;
  avatar: string;
  role: 'admin' | 'employee' | 'petrol';
  status: 'Active' | 'Inactive';
  casesCompleted: number;
  casesActive: number;
  joinDate: string;
  phone: string;
  /** Payroll / attendance sheet ID (e.g. 0001, 0210). */
  employeeCode: string;
}

export interface Hospital {
  id: string;
  name: string;
  branch: string;
  address: string;
  city: string;
  contactPerson: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  hospitalId: string;
  phone: string;
}

export interface StageRecord {
  stage: WorkflowStage;
  department: Department;
  assignedEmployee: Employee | null;
  assignedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Submitted' | 'Approved' | 'Rejected' | 'Changes Requested';
  notes: string;
  adminNotes: string;
  documents: Document[];
  /** Restock stage only — kit refilled vs order placed when stock unavailable. */
  restockOutcome?: RestockOutcome;
  /** Surgery stage only — hospital performed the surgery independently; no Malcon staff involved. */
  selfPerformed?: boolean;
  /** Delivery / Surgery only — optional extra helper; primary assignee submits the stage. */
  assistantEmployee?: Employee | null;
  assistantAssignedAt?: string | null;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

export interface ActivityLog {
  id: string;
  caseId: string;
  action: string;
  performedBy: string;
  performedByRole: 'admin' | 'employee';
  department?: Department;
  timestamp: string;
  details: string;
}

export interface Comment {
  id: string;
  caseId: string;
  author: string;
  authorRole: 'admin' | 'employee';
  department?: Department;
  content: string;
  timestamp: string;
}

export interface ImplantCase {
  id: string;
  caseNumber: string;
  hospital: Hospital;
  doctor: Doctor;
  surgeryDate: string;
  /** Surgery / procedure name, e.g. "Total Knee Replacement". */
  implantRequired: string;
  implantType: string;
  /** Manufacturer / brand supplying the implant, e.g. "Zimmer Biomet". */
  implantCompany: string;
  priority: Priority;
  status: CaseStatus;
  currentStage: WorkflowStage;
  currentDepartment: Department | null;
  assignedEmployee: Employee | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  remarks: string;
  stages: StageRecord[];
  activityLogs: ActivityLog[];
  comments: Comment[];
  invoiceAmount?: number;
  collectedAmount?: number;
  paymentStatus?: 'Pending' | 'Partial' | 'Collected';
  /**
   * Set when surgery is cancelled and unused implants must come back.
   * Case stays live through Pickup → Cleaning → Restock, then closes as Cancelled (no billing).
   */
  cancelReason?: string;
  /** Set when surgery is postponed to a later date. Case stays live at the current stage. */
  postponeReason?: string;
  /** Surgery date before the latest postpone. */
  postponedFrom?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  caseId?: string;
}

export type ViewMode = 'admin' | 'employee';
export type ActiveEmployee = Employee | null;

export interface Task {
  id: string;
  caseId: string;
  caseNumber: string;
  stage: WorkflowStage;
  department: Department;
  assignedEmployee: Employee | null;
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Submitted' | 'Approved' | 'Rejected' | 'Changes Requested';
  dueDate: string;
}

export interface SurgicalKit {
  id: string;
  name: string;
  type: string;
  serialNumber: string;
  status: 'Available' | 'Assigned' | 'In Surgery' | 'Cleaning' | 'Audit' | 'Completed';
  lastUsedDate?: string;
}

export interface Approval {
  id: string;
  caseId: string;
  caseNumber: string;
  stage: WorkflowStage;
  submittedBy: string;
  submittedAt: string;
  approvedAt?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Changes Requested';
  notes?: string;
  adminNotes?: string;
}

export type CaseTaskRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** Employee requested an open pool-stage case; admin picks who gets assigned. */
export interface CaseTaskRequest {
  id: string;
  caseId: string;
  caseNumber: string;
  stage: WorkflowStage;
  employeeId: string;
  employeeName: string;
  employeeDepartment: Department;
  status: CaseTaskRequestStatus;
  requestedAt: string;
  reviewedBy?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  adminNotes?: string;
}

export interface DepartmentInfo {
  id: string;
  name: Department;
  description: string;
  color: string;
}

export type ActivityEntityType = 'case' | 'employee' | 'hospital' | 'department' | 'kit' | 'system' | 'attendance' | 'leave' | 'expense' | 'petrol';

export interface ActivityEvent {
  id: string;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  performedBy: string;
  performedByRole: 'admin' | 'employee';
  timestamp: string;
  details: string;
}

export type PunchType = 'in' | 'out';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  punchType: PunchType;
  punchedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  withinOffice: boolean;
  officeAddress: string;
  /** Stamped selfie URL (punch in only). */
  selfieUrl: string | null;
}

/** Employee location punchin: start GPS → reached GPS. Not used for attendance. */
export type LocationTripStatus = 'started' | 'completed';

export interface LocationTrip {
  id: string;
  employeeId: string;
  employeeName: string;
  tripNo: number;
  notes: string;
  status: LocationTripStatus;
  startAt: string;
  startLat: number;
  startLng: number;
  startAccuracyM: number;
  startPlusCode: string;
  endAt: string | null;
  endLat: number | null;
  endLng: number | null;
  endAccuracyM: number | null;
  endPlusCode: string;
  distanceKm: number;
  /** Two-wheeler road km from Google/Mappls (e.g. 13). */
  bikeKm: number | null;
  /** Two-wheeler ETA in minutes (e.g. 32). */
  bikeMinutes: number | null;
  bikeSource: string;
  bikeMode: string;
  fromName: string;
  fromAddress: string;
  fromEloc: string;
  fromLat: number | null;
  fromLng: number | null;
  hospitalName: string;
  hospitalAddress: string;
  hospitalEloc: string;
  hospitalLat: number | null;
  hospitalLng: number | null;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceApprovalRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  punchType: PunchType;
  requestedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  reason: string;
  status: AttendanceApprovalStatus;
  reviewedBy: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  adminNotes: string;
  attendanceRecordId: string | null;
  /** Stamped selfie URL (off-site punch in). */
  selfieUrl: string | null;
}

export type LeaveType = 'Casual' | 'Sick' | 'Unpaid' | 'Comp Off';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedBy: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  adminNotes: string;
  createdAt: string;
  /**
   * Comp Off only: the day the employee works / worked in lieu of the leave.
   * Null for other leave types.
   */
  compOffWorkDate: string | null;
}

/** Admin-only manual daily log of travel/food/other spend per employee per day. */
export interface DailyExpense {
  id: string;
  employeeId: string;
  employeeName: string;
  /** YYYY-MM-DD, one entry per employee per date. */
  expenseDate: string;
  kmsDriven: number;
  petrolAmount: number;
  foodAmount: number;
  otherAmount: number;
  otherDescription: string;
  notes: string;
  enteredBy: string;
  enteredById: string;
  createdAt: string;
  updatedAt: string;
}

export type PetrolRequestStatus =
  | 'pending'
  | 'issued'
  | 'receipt_submitted'
  | 'rejected'
  | 'cancelled';

/** Employee petrol token: request → admin book/token → pump receipt + kms. */
export interface PetrolRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  vehicleNo: string;
  amount: number;
  requestedAt: string;
  status: PetrolRequestStatus;
  bookNo: string;
  tokenNo: string;
  issuedBy: string | null;
  issuedById: string | null;
  issuedAt: string | null;
  /** Kms driven this fill: today kms − yesterday kms. */
  kms: number | null;
  /** Yesterday meter reading (last fill). */
  kmsStart: number | null;
  /** Today meter reading (this bill). */
  kmsEnd: number | null;
  receiptUrl: string;
  kmsPhotoUrl: string;
  receiptSubmittedAt: string | null;
  notes: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

