export type ReportSection =
  | 'overview'
  | 'cases'
  | 'attendance'
  | 'employees'
  | 'billing'
  | 'approvals'
  | 'activity'
  | 'hospitals';

export const REPORT_SECTIONS: { id: ReportSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Cases' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'employees', label: 'Employees' },
  { id: 'billing', label: 'Billing' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'activity', label: 'Activity' },
  { id: 'hospitals', label: 'Hospitals' },
];
