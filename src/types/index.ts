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
  | 'Cleaning'
  | 'Audit'
  | 'Billing'
  | 'Bill Submission'
  | 'Completed';

export type Department =
  | 'Stores'
  | 'Delivery'
  | 'Scrub Person'
  | 'Cleaning Department'
  | 'Stores Audit'
  | 'Accounts'
  | 'Bill Submission'
  | 'Admin';

export interface Employee {
  id: string;
  name: string;
  department: Department;
  email: string;
  avatar: string;
  role: 'admin' | 'employee';
  status: 'Active' | 'Inactive';
  casesCompleted: number;
  casesActive: number;
  joinDate: string;
  phone: string;
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
  implantRequired: string;
  implantType: string;
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

export interface DepartmentInfo {
  id: string;
  name: Department;
  description: string;
  color: string;
}

export type ActivityEntityType = 'case' | 'employee' | 'hospital' | 'department' | 'kit' | 'system' | 'attendance' | 'leave';

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
}

export type LeaveType = 'Casual' | 'Sick' | 'Unpaid';
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
}

