-- Fix: allow store managers to add new doctors to the master list
BEGIN;

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors_store_manager_insert" ON public.doctors
  FOR INSERT WITH CHECK (current_user_role() = 'store_manager');

COMMIT;
