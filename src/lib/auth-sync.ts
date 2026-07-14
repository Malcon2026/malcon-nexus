import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

export const DEFAULT_EMPLOYEE_PASSWORD = 'Test@0011';

/** Sync Supabase Auth login email when an employee email changes in the app. */
export async function syncEmployeeLoginEmail(
  employeeId: string,
  newEmail: string,
): Promise<{ error: string | null }> {
  if (!USE_SUPABASE) return { error: null };

  try {
    const { data, error } = await supabase.functions.invoke('update-employee-login-email', {
      body: { employeeId, newEmail },
    });

    if (error) {
      const bodyError =
        data && typeof data === 'object' && 'error' in data ? String(data.error) : null;
      return { error: bodyError ?? error.message };
    }

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return { error: String(data.error) };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update login email' };
  }
}

/** Create Supabase Auth login when a new employee is added. */
export async function createEmployeeLogin(
  employeeId: string,
  email: string,
  name: string,
  password: string = DEFAULT_EMPLOYEE_PASSWORD,
): Promise<{ error: string | null }> {
  if (!USE_SUPABASE) return { error: null };

  try {
    const { data, error } = await supabase.functions.invoke('create-employee-login', {
      body: { employeeId, email: email.trim().toLowerCase(), password, name },
    });

    if (error) {
      const bodyError =
        data && typeof data === 'object' && 'error' in data ? String(data.error) : null;
      return { error: bodyError ?? error.message };
    }

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return { error: String(data.error) };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create login' };
  }
}
