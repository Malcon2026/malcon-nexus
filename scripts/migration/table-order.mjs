/**
 * FK-safe import order for public tables (Phase 5).
 * Derived from worker/src/db/schema.ts foreign keys.
 */
export const IMPORT_TABLE_ORDER = [
  'departments',
  'app_settings',
  'hospitals',
  'surgical_kits',
  'employees',
  'doctors',
  'cases',
  'notifications',
  'approvals',
  'case_task_requests',
  'case_alert_escalations',
  'attendance_records',
  'attendance_approval_requests',
  'field_team_attendance_approvals',
  'leave_requests',
  'employee_food_selections',
  'employee_daily_expenses',
  'petrol_requests',
  'location_trips',
  'hospital_trip_punches',
  'activity_log',
  'login_otps',
  'push_subscriptions',
  'hr_job_postings',
  'hr_walk_in_applications',
  'hr_kyc_intake',
  'hr_onboarding_tracks',
  'malcon_tms_profiles',
  'malcon_tms_tasks',
  'malcon_tms_activity',
];

/** Tables with no incoming FKs from other app tables in this set can load early. */
export const DEFERRED_FK_NOTES = [
  'hr_onboarding_tracks.walk_in_id / kyc_intake_id → loaded after walk_in + kyc',
  'malcon_tms_tasks → profiles before tasks',
  'malcon_tms_activity → profiles + tasks before activity',
  'cases → hospitals, doctors, employees must exist first',
];
