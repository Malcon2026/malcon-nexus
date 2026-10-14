#!/usr/bin/env node
/** Fictional JSONL dataset for local import testing (not production). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'worker/fixtures/synthetic-migration');
const NOW = '2026-05-01T12:00:00.000Z';
const DATE = '2026-05-15';

mkdirSync(outDir, { recursive: true });

function writeJsonl(name, rows) {
  writeFileSync(join(outDir, `${name}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

const hospitalId = 'b2100001-0001-4001-8001-000000000001';
const empId = 'a2100001-0001-4001-8001-000000000001';
const docId = 'c2100001-0001-4001-8001-000000000001';
const caseId = 'e2100001-0001-4001-8001-000000000001';
const walkId = 'w2100001-0001-4001-8001-000000000001';
const kycId = 'k2100001-0001-4001-8001-000000000001';
const onboardId = 'o2100001-0001-4001-8001-000000000001';
const tmsProfile = 'p2100001-0001-4001-8001-000000000001';
const tmsTask = 't2100001-0001-4001-8001-000000000001';

writeJsonl('departments', [{ id: 'd2100001-0001-4001-8001-000000000001', name: 'Stores', description: 'Syn', color: 'bg-gray-100' }]);
writeJsonl('app_settings', [{ key: 'tv_notice', value: 'Synthetic', updated_by: 'test', updated_at: NOW }]);
writeJsonl('hospitals', [{
  id: hospitalId, name: 'Syn Hospital', branch: '', address: '', city: 'Syn', contact_person: '',
  phone: '', email: 'h@example.invalid', status: 'Active', created_at: NOW, updated_at: NOW,
}]);
writeJsonl('employees', [{
  id: empId, name: 'Syn Emp', email: 'syn@example.invalid', department: 'Stores', departments: '["Stores"]',
  role: 'employee', status: 'Active', avatar: '', phone: '', employee_code: 'SYN1', telegram_chat_id: null,
  cases_completed: 0, cases_active: 0, join_date: '2026-01-01', auth_user_id: null, created_at: NOW, updated_at: NOW,
}]);
writeJsonl('doctors', [{
  id: docId, name: 'Syn Doc', specialization: 'Ortho', hospital_id: hospitalId, phone: '', doctor_code: 'SD1', created_at: NOW,
}]);
writeJsonl('cases', [{
  id: caseId, case_number: 'SYN-001', hospital_id: hospitalId, doctor_id: docId,
  hospital_snapshot: '{}', doctor_snapshot: '{}', surgery_date: DATE, implant_required: '', implant_type: '',
  implant_company: '', cancel_reason: '', surgery_outcome: '', surgery_outcome_detail: '', postpone_reason: '',
  postponed_from: null, priority: 'Medium', status: 'Active', current_stage: 'Set Preparation', current_department: 'Stores',
  post_surgery_duties: '{}', assigned_employee_id: empId, assigned_employee_snapshot: null, created_by: 'test',
  due_date: null, remarks: '', stages: '[{"stage":"Set Preparation","status":"Pending"}]', activity_logs: '[]', comments: '[]',
  invoice_amount_minor: 125050, collected_amount_minor: null, payment_status: null, created_at: NOW, updated_at: NOW,
}]);
writeJsonl('employee_daily_expenses', [{
  id: 'x2100001-0001-4001-8001-000000000001', employee_id: empId, employee_name: 'Syn Emp', expense_date: '2026-05-01',
  kms_driven: 10, petrol_amount: 500, food_amount: 100, other_amount: 0, other_description: '', notes: '',
  entered_by: 'admin', entered_by_id: empId, created_at: NOW, updated_at: NOW,
}]);
writeJsonl('notifications', [{
  id: 'n2100001-0001-4001-8001-000000000001', title: 'Syn', message: 'm', type: 'info', is_read: 0,
  case_id: caseId, recipient_id: empId, created_at: NOW,
}]);
writeJsonl('activity_log', [{
  id: 'l2100001-0001-4001-8001-000000000001', action: 'test', entity_type: 'case', entity_id: caseId,
  entity_label: 'SYN-001', performed_by: 'Syn Emp', performed_by_role: 'admin', details: '', created_at: NOW,
}]);
writeJsonl('attendance_records', [{
  id: 'r2100001-0001-4001-8001-000000000001', employee_id: empId, employee_name: 'Syn Emp', punch_type: 'in',
  punched_at: NOW, latitude: 17.4, longitude: 78.4, accuracy_m: 5, distance_m: 0, within_office: 1,
  office_address: '', selfie_url: null, created_at: NOW,
}]);

writeJsonl('hr_job_postings', [{
  id: 'job-syn-001', code: 'SYN-JOB', title: 'Syn Role', status: 'Draft', data: '{"dept":"Stores"}',
  created_at: NOW, updated_at: NOW,
}]);
writeJsonl('hr_walk_in_applications', [{
  id: walkId, first_name: 'Syn', last_name: 'Walk', mobile: '9000000001', previous_company: 'X', previous_salary: '0',
  expected_salary: '0', address: 'Addr', status: 'new', created_at: NOW, form_version: '1', form_data: '{}',
  full_name: 'Syn Walk', position_applied: 'Stores', email: 'walk@example.invalid', job_code: 'SYN-JOB',
}]);
writeJsonl('hr_kyc_intake', [{
  id: kycId, first_name: 'Syn', last_name: 'Kyc', mobile: '9000000002', email: 'kyc@example.invalid', employee_id: '',
  date_of_birth: '1990-01-01', gender: 'M', aadhaar: '', pan: '', current_address: '', permanent_address: '',
  bank_account: '', bank_ifsc: '', bank_name: '', highest_qualification: '', emergency_name: '', emergency_relation: '',
  emergency_phone: '', status: 'new', created_at: NOW, father_name: '', mother_name: '', father_aadhaar: '',
  mother_aadhaar: '', qualification_ssc: '', qualification_intermediate: '', qualification_degree: '',
  qualification_other: '', form_version: '1', form_data: '{}', full_name: 'Syn Kyc', photo_storage_path: '',
  hr_signature_data: '',
}]);
writeJsonl('hr_onboarding_tracks', [{
  id: onboardId, full_name: 'Syn Onboard', mobile: '9000000003', position_applied: 'Stores', walk_in_id: walkId,
  kyc_intake_id: kycId, employee_id_mls: '', uan: '', esi_eligible: null, esi_generated: 0, checkpoints: '{}',
  status: 'in_progress', created_at: NOW, updated_at: NOW, job_code: 'SYN-JOB',
}]);
writeJsonl('malcon_tms_profiles', [{
  id: tmsProfile, name: 'Syn TMS', email: 'tms@example.invalid', role: 'admin', color: '#000', created_at: NOW,
}]);
writeJsonl('malcon_tms_tasks', [{
  id: tmsTask, title: 'Syn task', description: 'd', status: 'todo', priority: 'medium', tags: '["syn"]',
  due: DATE, assignee_id: tmsProfile, created_by: tmsProfile, created_at: NOW, updated_at: NOW, completed_at: null,
}]);
writeJsonl('malcon_tms_activity', [{
  id: 'a2100001-0001-4001-8001-000000000099', user_id: tmsProfile, action: 'create', detail: 'syn', task_id: tmsTask, at: NOW,
}]);

const expected = {
  departments: 1, app_settings: 1, hospitals: 1, employees: 1, doctors: 1, cases: 1,
  employee_daily_expenses: 1, notifications: 1, activity_log: 1, attendance_records: 1,
  hr_job_postings: 1, hr_walk_in_applications: 1, hr_kyc_intake: 1, hr_onboarding_tracks: 1,
  malcon_tms_profiles: 1, malcon_tms_tasks: 1, malcon_tms_activity: 1,
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ synthetic: true, expected_counts: expected, generatedAt: NOW }, null, 2));
console.log(`Synthetic JSONL written to ${outDir}`);
