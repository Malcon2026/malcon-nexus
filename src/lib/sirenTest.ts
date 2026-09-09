import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

export const SIREN_TEST_SETTING_KEY = 'siren_test_at';

/** Admin-only: ping all employees with the app open to play the in-app siren. */
export async function triggerSirenTestForAll(
  updatedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!USE_SUPABASE) return { ok: false, error: 'Supabase is not enabled.' };

  const { error } = await supabase.from('app_settings').upsert({
    key: SIREN_TEST_SETTING_KEY,
    value: String(Date.now()),
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
