import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

/** Fire-and-forget email when a case is assigned to an employee. */
export async function notifyCaseAssignment(
  caseId: string,
  employeeId: string | undefined | null,
): Promise<void> {
  if (!USE_SUPABASE || !employeeId) return;

  try {
    const { data, error } = await supabase.functions.invoke('send-assignment-email', {
      body: { caseId, employeeId },
    });

    if (error) {
      console.error('[email] assignment notification failed:', error.message, data ?? '');
      return;
    }

    if (data && typeof data === 'object' && 'error' in data) {
      console.error('[email] assignment notification failed:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('[email] assignment notification failed:', err);
  }
}
