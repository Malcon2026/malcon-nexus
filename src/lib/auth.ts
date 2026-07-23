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

/**
 * Supabase fires a SIGNED_IN auth-state event as part of signInWithPassword
 * resolving. `signIn()` below already resolves + returns the employee (and
 * the caller hydrates immediately from that), so when this flag is set the
 * listener skips re-fetching the employee and re-triggering hydration a
 * second time for the exact same login.
 */
let pendingManualSignIn = false;

async function employeeFromSession(session: Session | null): Promise<Employee | null> {
  if (!session?.user) return null;

  const authUserId = session.user.id;
  const employee = await sbEmployeeRepo.getByAuthUserId(authUserId);
  if (employee) return employee;

  const email = session.user.email;
  if (!email) return null;

  const found = await sbEmployeeRepo.getByEmail(email);
  if (!found) return null;

  // Self-heal the link in the background — don't block resolving the
  // employee on it.
  void sbEmployeeRepo.linkAuthUser(found.id, authUserId).catch(() => {
    // Non-fatal if already linked
  });

  return found;
}

export const authService = {
  /** Sign in with email + password. Returns the matching Employee record. */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const startedAt = performance.now();
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) return { employee: null, error: error.message };

    const authUserId = data.user?.id;
    if (!authUserId) return { employee: null, error: 'Authentication failed' };

    // Set this *before* the further awaits below — the SIGNED_IN event can
    // fire concurrently with them, and the listener needs to see the flag
    // in time to skip its own redundant employee lookup + hydration.
    pendingManualSignIn = true;

    // Single round-trip when the auth user is already linked (the common
    // case) instead of a "find id" query followed by a "fetch full row" one.
    let employee = await sbEmployeeRepo.getByAuthUserId(authUserId);

    if (!employee) {
      // First login before auth_user_id has been linked yet — fall back to
      // email lookup and link in the background.
      employee = await sbEmployeeRepo.getByEmail(normalizedEmail);
      if (employee) {
        void sbEmployeeRepo.linkAuthUser(employee.id, authUserId).catch(() => {
          // Non-fatal if already linked
        });
      }
    }

    if (!employee) {
      pendingManualSignIn = false;
      await supabase.auth.signOut();
      return {
        employee: null,
        error: 'No employee account found for this email. Contact your administrator.',
      };
    }

    console.info(`[perf] auth.signIn resolved in ${Math.round(performance.now() - startedAt)}ms`);
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

      if (event === 'INITIAL_SESSION') {
        // Already resolved once via getCurrentEmployee() on boot — the
        // caller ignores this event anyway, so skip the redundant fetch.
        return;
      }

      if (event === 'SIGNED_IN' && pendingManualSignIn) {
        // Already handled directly by signIn()'s return value — skip the
        // duplicate employee fetch + hydration for this login.
        pendingManualSignIn = false;
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
