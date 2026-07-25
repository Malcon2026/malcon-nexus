import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

export const DEFAULT_EMPLOYEE_PASSWORD = 'Test@0011';

async function readFunctionError(
  error: { message: string; context?: Response } | null,
  data: unknown,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return String((data as { error: unknown }).error);
  }

  const context = error && 'context' in error ? error.context : null;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body && typeof body === 'object' && 'error' in body && body.error) {
        return String(body.error);
      }
    } catch {
      // ignore parse failures
    }
  }

  return error?.message ?? 'Unknown edge function error';
}

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
      return { error: await readFunctionError(error, data) };
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
      return { error: await readFunctionError(error, data) };
    }

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return { error: String(data.error) };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create login' };
  }
}
