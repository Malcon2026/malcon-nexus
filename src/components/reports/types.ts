export type ExportReportType =
  | 'cases'
  | 'attendance'
  | 'employees'
  | 'billing'
  | 'activity'
  | 'attendance-approvals'
  | 'stage-approvals'
  | 'hospitals'
  | 'expenses-summary'
  | 'expenses-detail';

export const EXPORT_REPORT_TYPES: {
  id: ExportReportType;
  label: string;
  description: string;
}[] = [
  {
    id: 'cases',
    label: 'Cases',
    description: 'All implant cases with hospital, stage, billing, and assignment details.',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Daily punch in/out summary per employee for each day in the range.',
  },
  {
    id: 'employees',
    label: 'Employees',
    description: 'Team directory with department, role, and case workload stats.',
  },
  {
    id: 'billing',
    label: 'Billing & Revenue',
    description: 'Invoice amounts, collected amounts, and payment status by case.',
  },
  {
    id: 'activity',
    label: 'Activity Log',
    description: 'Audit trail of actions performed in the system.',
  },
  {
    id: 'attendance-approvals',
    label: 'Off-site Punch',
    description: 'Off-site punch in/out approval requests and review status.',
  },
  {
    id: 'stage-approvals',
    label: 'Stage Approvals Queue',
    description: 'Cases currently waiting for admin stage approval.',
  },
  {
    id: 'hospitals',
    label: 'Hospitals',
    description: 'Hospital directory with case volume (filtered by case dates in range).',
  },
  {
    id: 'expenses-summary',
    label: 'Expenses — Summary',
    description: 'Total kms driven, petrol, food, and other expenses per employee for the date range.',
  },
  {
    id: 'expenses-detail',
    label: 'Expenses — Detail',
    description: 'Every daily expense entry (kms, petrol, food, other) in the date range.',
  },
];
