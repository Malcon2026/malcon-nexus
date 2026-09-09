import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { USE_SUPABASE } from '../lib/database/config';
import { playInAppSiren } from '../lib/inAppAlertSound';
import { useStore } from '../store/useStore';

type CaseRow = {
  id?: string;
  assigned_employee_id?: string | null;
  postpone_reason?: string;
  postponed_from?: string | null;
};

function shouldPlayAssignment(oldRow: CaseRow | undefined, newRow: CaseRow, employeeId: string): boolean {
  if (newRow.assigned_employee_id !== employeeId) return false;
  const prevAssignee = oldRow?.assigned_employee_id ?? null;
  return prevAssignee !== employeeId;
}

function shouldPlayPostpone(oldRow: CaseRow | undefined, newRow: CaseRow, employeeId: string): boolean {
  if (newRow.assigned_employee_id !== employeeId) return false;
  if (!newRow.postpone_reason?.trim()) return false;
  return (
    newRow.postpone_reason !== oldRow?.postpone_reason ||
    newRow.postponed_from !== oldRow?.postponed_from
  );
}

/** Optional in-app siren (priority 3) when a case is assigned or postponed to this employee. */
export function InAppAlertListener() {
  const currentUser = useStore((s) => s.currentUser);
  const viewMode = useStore((s) => s.viewMode);
  const recentAlerts = useRef(new Set<string>());

  useEffect(() => {
    if (!USE_SUPABASE) return;
    const isEmployee = viewMode === 'employee' || currentUser.role === 'employee';
    if (!isEmployee) return;

    const employeeId = currentUser.id;
    if (!employeeId) return;

    const dedupe = (key: string) => {
      if (recentAlerts.current.has(key)) return false;
      recentAlerts.current.add(key);
      window.setTimeout(() => recentAlerts.current.delete(key), 5000);
      return true;
    };

    const channel = supabase
      .channel(`in-app-alerts-${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cases',
          filter: `assigned_employee_id=eq.${employeeId}`,
        },
        (payload) => {
          const oldRow = payload.old as CaseRow;
          const newRow = payload.new as CaseRow;
          const caseId = String(newRow.id ?? '');

          if (shouldPlayAssignment(oldRow, newRow, employeeId)) {
            if (dedupe(`${caseId}-assign`)) playInAppSiren();
            return;
          }

          if (shouldPlayPostpone(oldRow, newRow, employeeId)) {
            if (dedupe(`${caseId}-postpone`)) playInAppSiren();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cases',
          filter: `assigned_employee_id=eq.${employeeId}`,
        },
        (payload) => {
          const newRow = payload.new as CaseRow;
          const caseId = String(newRow.id ?? '');
          if (dedupe(`${caseId}-assign`)) playInAppSiren();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser.id, currentUser.role, viewMode]);

  return null;
}
