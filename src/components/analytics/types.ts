export type AnalyticsSection = 'overview' | 'cases' | 'employees';

export const ANALYTICS_SECTIONS: { id: AnalyticsSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Cases' },
  { id: 'employees', label: 'Employees' },
];
