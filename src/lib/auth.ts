// src/lib/auth.ts
// Supabase Auth helpers — wraps signIn, signOut, and session management.
// On sign-in, links the Supabase auth user to the corresponding employee record.

import { supabase } from './supabase';
import { sbEmployeeRepo } from './database/repositories/supabaseRepositories';
import type { Employee } from '../types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export interface AuthResult {
  employee: Employee | null;
  error: string | null;
}

async function employeeFromSession(session: Session | null): Promise<Employee | null> {
  if (!session?.user) return null;

  const authUserId = session.user.id;
  const { data: byAuth } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (byAuth) {
    return sbEmployeeRepo.getById(byAuth.id);
  }

  const email = session.user.email;
  if (!email) return null;

  const employee = await sbEmployeeRepo.getByEmail(email);
  if (!employee) return null;

  await sbEmployeeRepo.linkAuthUser(employee.id, authUserId).catch(() => {
    // Non-fatal if already linked
  });

  return employee;
}

export const authService = {
  /** Sign in with email + password. Returns the matching Employee record. */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { employee: null, error: error.message };

    const authUserId = data.user?.id;
    if (!authUserId) return { employee: null, error: 'Authentication failed' };

    // Find matching employee by email
    const employee = await sbEmployeeRepo.getByEmail(email);
    if (!employee) {
      await supabase.auth.signOut();
      return {
        employee: null,
        error: 'No employee account found for this email. Contact your administrator.',
      };
    }

    // Link auth user ID to employee record (idempotent)
    await sbEmployeeRepo.linkAuthUser(employee.id, authUserId).catch(() => {
      // Non-fatal if already linked
    });

    return { employee, error: null };
  },

  /** Sign out the current user */
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  /** Get the currently logged-in employee (on page refresh) */
  async getCurrentEmployee(): Promise<Employee | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return employeeFromSession(session);
  },

  /** Subscribe to auth state changes */
  onAuthStateChange(callback: (event: AuthChangeEvent, employee: Employee | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        callback(event, null);
        return;
      }

      const employee = await employeeFromSession(session);
      callback(event, employee);
    });
  },

  /** Create a Supabase auth user for a new employee (admin action) */
  async inviteEmployee(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  },
};
