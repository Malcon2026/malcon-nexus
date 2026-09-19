/** Tabs allowed for Stores department kiosk accounts (role = stores). */
export const STORES_KIOSK_TABS = [
  'dashboard',
  'cases',
  'live-cases',
  'workflow',
  'settings',
] as const;

export type StoresKioskTab = (typeof STORES_KIOSK_TABS)[number];

export function isStoresKioskTab(tab: string): tab is StoresKioskTab {
  return (STORES_KIOSK_TABS as readonly string[]).includes(tab);
}

export function defaultStoresKioskTab(): StoresKioskTab {
  return 'live-cases';
}
