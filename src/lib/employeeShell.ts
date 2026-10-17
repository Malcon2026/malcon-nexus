/** Primary tabs in the employee mobile shell (bottom bar). */
export type EmployeeShellTab = 'home' | 'cases' | 'punch' | 'petrol' | 'profile';

export const EMPLOYEE_SHELL_TAB_LABELS: Record<EmployeeShellTab, string> = {
  home: 'Home',
  cases: 'Cases',
  punch: 'Punchin/out',
  petrol: 'Petrol',
  profile: 'Profile',
};

export function isEmployeeAppShell(viewMode: string): boolean {
  return viewMode === 'employee';
}
