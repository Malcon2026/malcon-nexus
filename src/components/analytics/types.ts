export type AnalyticsSection = 'overview' | 'cases' | 'billing' | 'employees';

export const ANALYTICS_SECTIONS: { id: AnalyticsSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Cases' },
  { id: 'billing', label: 'Billing' },
  { id: 'employees', label: 'Employees' },
];
