#!/usr/bin/env node
/**
 * Small fictional seed for local D1 only. No production data.
 */
import { d1Execute, d1ExecuteFile, d1EnableForeignKeys } from './exec-local-d1.mjs';

function q(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const NOW = '2026-04-01T10:00:00.000Z';
const DATE = '2026-04-15';

const stagesSample = JSON.stringify([
  {
    stage: 'Set Preparation',
    status: 'Approved',
    assignedEmployee: { id: 'a1000001-0001-4001-8001-000000000001', name: 'Dev Store A' },
    documents: [],
  },
  {
    stage: 'Delivery',
    status: 'In Progress',
    assignedEmployee: { id: 'a1000002-0001-4001-8001-000000000002', name: 'Dev Driver B' },
    documents: [{ id: 'doc1', url: 'https://example.invalid/thumb.jpg', type: 'image/jpeg' }],
  },
]);

const hospitalSnap = JSON.stringify({
  id: 'b2000001-0001-4001-8001-000000000001',
  name: 'Dev Hospital Alpha',
  branch: 'North',
  city: 'Dev City',
});

const doctorSnap = JSON.stringify({
  id: 'c3000001-0001-4001-8001-000000000001',
  name: 'Dr Dev One',
  doctorCode: 'DOC001',
});

const postSurgery = JSON.stringify({ return: null, checking: null, restock: null });
const deptTags = JSON.stringify(['Stores', 'Delivery']);

console.log('Seeding local D1 (fictional data)...\n');
d1EnableForeignKeys();

d1ExecuteFile(`
DELETE FROM notifications;
DELETE FROM activity_log;
DELETE FROM approvals;
DELETE FROM attendance_records;
DELETE FROM attendance_approval_requests;
DELETE FROM field_team_attendance_approvals;
DELETE FROM employee_food_selections;
DELETE FROM leave_requests;
DELETE FROM petrol_requests;
DELETE FROM location_trips;
DELETE FROM employee_daily_expenses;
DELETE FROM case_task_requests;
DELETE FROM cases;
DELETE FROM doctors;
DELETE FROM employees;
DELETE FROM hospitals;
DELETE FROM surgical_kits;
DELETE FROM departments;
DELETE FROM app_settings;

INSERT INTO departments (id, name, description, color) VALUES
  ('d1111111-0001-4001-8001-000000000001', 'Stores', 'Dev stores', 'bg-violet-100'),
  ('d1111111-0001-4001-8001-000000000002', 'Delivery', 'Dev delivery', 'bg-rose-100'),
  ('d1111111-0001-4001-8001-000000000003', 'Admin', 'Dev admin', 'bg-slate-100');

INSERT INTO hospitals (id, name, branch, address, city, contact_person, phone, email, status, created_at, updated_at) VALUES
  ('b2000001-0001-4001-8001-000000000001', 'Dev Hospital Alpha', 'North', '1 Dev Road', 'Dev City', 'Contact A', '1000000001', 'alpha@example.invalid', 'Active', ${q(NOW)}, ${q(NOW)}),
  ('b2000002-0001-4001-8001-000000000002', 'Dev Hospital Beta', 'Central', '2 Dev Road', 'Dev City', 'Contact B', '1000000002', 'beta@example.invalid', 'Active', ${q(NOW)}, ${q(NOW)}),
  ('b2000003-0001-4001-8001-000000000003', 'Dev Hospital Gamma', 'South', '3 Dev Road', 'Dev City', 'Contact C', '1000000003', 'gamma@example.invalid', 'Active', ${q(NOW)}, ${q(NOW)});

INSERT INTO employees (id, name, email, department, departments, role, status, avatar, phone, employee_code, telegram_chat_id, cases_completed, cases_active, join_date, auth_user_id, created_at, updated_at) VALUES
  ('a1000001-0001-4001-8001-000000000001', 'Dev Store A', 'store.a@example.invalid', 'Stores', ${q(deptTags)}, 'employee', 'Active', '', '1000000101', 'DEV001', NULL, 0, 2, '2025-01-01', 'auth-subject-001', ${q(NOW)}, ${q(NOW)}),
  ('a1000002-0001-4001-8001-000000000002', 'Dev Driver B', 'driver.b@example.invalid', 'Delivery', ${q(JSON.stringify(['Delivery']))}, 'employee', 'Active', '', '1000000102', 'DEV002', NULL, 0, 1, '2025-01-01', 'auth-subject-002', ${q(NOW)}, ${q(NOW)}),
  ('a1000003-0001-4001-8001-000000000003', 'Dev Admin C', 'admin.c@example.invalid', 'Admin', ${q(JSON.stringify(['Admin']))}, 'admin', 'Active', '', '1000000103', 'DEV003', NULL, 0, 0, '2025-01-01', 'auth-subject-003', ${q(NOW)}, ${q(NOW)}),
  ('a1000004-0001-4001-8001-000000000004', 'Dev Manager D', 'manager.d@example.invalid', 'Stores', ${q(JSON.stringify(['Stores']))}, 'store_manager', 'Active', '', '1000000104', 'DEV004', NULL, 0, 0, '2025-01-01', 'auth-subject-004', ${q(NOW)}, ${q(NOW)}),
  ('a1000005-0001-4001-8001-000000000005', 'Dev Petrol E', 'petrol.e@example.invalid', 'Delivery', ${q(JSON.stringify(['Delivery']))}, 'petrol', 'Active', '', '1000000105', 'DEV005', NULL, 0, 0, '2025-01-01', 'auth-subject-005', ${q(NOW)}, ${q(NOW)});

INSERT INTO doctors (id, name, specialization, hospital_id, phone, doctor_code, created_at) VALUES
  ('c3000001-0001-4001-8001-000000000001', 'Dr Dev One', 'Ortho', 'b2000001-0001-4001-8001-000000000001', '1000000201', 'DOC001', ${q(NOW)}),
  ('c3000002-0001-4001-8001-000000000002', 'Dr Dev Two', 'Ortho', 'b2000001-0001-4001-8001-000000000001', '1000000202', 'DOC002', ${q(NOW)}),
  ('c3000003-0001-4001-8001-000000000003', 'Dr Dev Three', 'Spine', 'b2000002-0001-4001-8001-000000000002', '1000000203', 'DOC003', ${q(NOW)}),
  ('c3000004-0001-4001-8001-000000000004', 'Dr Dev Four', 'Trauma', 'b2000002-0001-4001-8001-000000000002', '1000000204', 'DOC004', ${q(NOW)}),
  ('c3000005-0001-4001-8001-000000000005', 'Dr Dev Five', 'Knee', 'b2000003-0001-4001-8001-000000000003', '1000000205', 'DOC005', ${q(NOW)});

INSERT INTO surgical_kits (id, name, type, serial_number, status, last_used_date, created_at, updated_at) VALUES
  ('k4000001-0001-4001-8001-000000000001', 'Dev Knee Kit', 'Knee', 'DEV-SN-001', 'Available', NULL, ${q(NOW)}, ${q(NOW)}),
  ('k4000002-0001-4001-8001-000000000002', 'Dev Hip Kit', 'Hip', 'DEV-SN-002', 'Available', NULL, ${q(NOW)}, ${q(NOW)});
`);

const caseIds = [
  'e5000001-0001-4001-8001-000000000001',
  'e5000002-0001-4001-8001-000000000002',
  'e5000003-0001-4001-8001-000000000003',
  'e5000004-0001-4001-8001-000000000004',
  'e5000005-0001-4001-8001-000000000005',
  'e5000006-0001-4001-8001-000000000006',
  'e5000007-0001-4001-8001-000000000007',
  'e5000008-0001-4001-8001-000000000008',
  'e5000009-0001-4001-8001-000000000009',
  'e500000a-0001-4001-8001-00000000000a',
];

const caseRows = [];
for (let i = 0; i < 10; i++) {
  const id = caseIds[i];
  const num = `IMP-DEV-${String(i + 1).padStart(3, '0')}`;
  const hosp = caseIds[i].charAt(7) <= '3' ? 'b2000001-0001-4001-8001-000000000001' : i < 7 ? 'b2000002-0001-4001-8001-000000000002' : 'b2000003-0001-4001-8001-000000000003';
  const doc = `c300000${(i % 5) + 1}-0001-4001-8001-00000000000${(i % 5) + 1}`;
  const assign = i % 2 === 0 ? 'a1000002-0001-4001-8001-000000000002' : 'a1000001-0001-4001-8001-000000000001';
  const invoiceMinor = i === 0 ? 125050 : i === 1 ? 50000 : 'NULL';
  const collectedMinor = i === 0 ? 125050 : 'NULL';
  const payment = i === 0 ? q('Collected') : 'NULL';
  caseRows.push(`(
    ${q(id)}, ${q(num)}, ${q(hosp)}, ${q(doc)}, ${q(hospitalSnap)}, ${q(doctorSnap)},
    ${q(DATE)}, 'Dev procedure', 'Implant', 'DevCo', '', '', '', '', '', 'Medium', 'Active',
    'Set Preparation', 'Stores', ${q(postSurgery)}, ${q(assign)}, NULL, 'dev-seed', NULL, '',
    ${q(stagesSample)}, '[]', '[]',
    ${invoiceMinor}, ${collectedMinor}, ${payment},
    ${q(NOW)}, ${q(NOW)}
  )`);
}

d1ExecuteFile(`
INSERT INTO cases (
  id, case_number, hospital_id, doctor_id, hospital_snapshot, doctor_snapshot,
  surgery_date, implant_required, implant_type, implant_company,
  cancel_reason, surgery_outcome, surgery_outcome_detail, postpone_reason, postponed_from,
  priority, status, current_stage, current_department, post_surgery_duties,
  assigned_employee_id, assigned_employee_snapshot, created_by, due_date, remarks,
  stages, activity_logs, comments, invoice_amount_minor, collected_amount_minor, payment_status,
  created_at, updated_at
) VALUES ${caseRows.join(',\n')};
`);

// notifications 20, activity 20, attendance 10
const notifIds = Array.from({ length: 20 }, (_, i) =>
  `f60000${String(i + 1).padStart(2, '0')}-0001-4001-8001-000000000001`,
);
let notifSql = '';
for (let i = 0; i < 20; i++) {
  const nid = notifIds[i];
  const recip = i % 2 === 0 ? 'a1000001-0001-4001-8001-000000000001' : 'a1000002-0001-4001-8001-000000000002';
  const caseId = caseIds[i % 10];
  notifSql += `INSERT INTO notifications (id, title, message, type, is_read, case_id, recipient_id, created_at) VALUES (${q(nid)}, 'Dev notice ${i + 1}', 'Message ${i + 1}', 'info', ${i % 3 === 0 ? 1 : 0}, ${q(caseId)}, ${q(recip)}, ${q(NOW)});\n`;
}

let actSql = '';
for (let i = 0; i < 20; i++) {
  const aid = `a70000${String(i + 1).padStart(2, '0')}-0001-4001-8001-000000000001`;
  actSql += `INSERT INTO activity_log (id, action, entity_type, entity_id, entity_label, performed_by, performed_by_role, details, created_at) VALUES (${q(aid)}, 'dev_action', 'case', ${q(caseIds[i % 10])}, 'Dev case', 'Dev Admin C', 'admin', 'seed', ${q(NOW)});\n`;
}

let attSql = '';
for (let i = 0; i < 10; i++) {
  const rid = `a80000${String(i + 1).padStart(2, '0')}-0001-4001-8001-000000000001`;
  const emp = i % 2 === 0 ? 'a1000001-0001-4001-8001-000000000001' : 'a1000002-0001-4001-8001-000000000002';
  attSql += `INSERT INTO attendance_records (id, employee_id, employee_name, punch_type, punched_at, latitude, longitude, accuracy_m, distance_m, within_office, office_address, selfie_url, created_at) VALUES (${q(rid)}, ${q(emp)}, 'Dev', 'in', ${q(NOW)}, 17.44, 78.38, 5, 0, 1, 'Dev office', NULL, ${q(NOW)});\n`;
}

d1ExecuteFile(`
${notifSql}
${actSql}
${attSql}

INSERT INTO approvals (id, case_id, case_number, stage, submitted_by, submitted_at, approved_at, status, notes, admin_notes) VALUES
  ('b9000001-0001-4001-8001-000000000001', ${q(caseIds[0])}, 'IMP-DEV-001', 'Delivery', 'Dev Driver B', ${q(NOW)}, NULL, 'Pending', NULL, NULL);

INSERT INTO case_task_requests (id, case_id, case_number, stage, employee_id, employee_name, employee_department, status, requested_at) VALUES
  ('j9000001-0001-4001-8001-000000000001', ${q(caseIds[1])}, 'IMP-DEV-002', 'Set Preparation', 'a1000001-0001-4001-8001-000000000001', 'Dev Store A', 'Stores', 'pending', ${q(NOW)});

INSERT INTO leave_requests (id, employee_id, employee_name, leave_type, from_date, to_date, reason, status, admin_notes, comp_off_work_date, created_at, updated_at) VALUES
  ('c9000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', 'Dev Store A', 'Casual', '2026-04-20', '2026-04-21', 'Dev leave reason text here', 'pending', '', NULL, ${q(NOW)}, ${q(NOW)});

INSERT INTO petrol_requests (id, employee_id, employee_name, vehicle_no, amount_minor, requested_at, status, book_no, token_no, issued_by, issued_by_id, issued_at, kms, receipt_url, kms_photo_url, receipt_submitted_at, notes, admin_notes, created_at, updated_at) VALUES
  ('d9000001-0001-4001-8001-000000000001', 'a1000005-0001-4001-8001-000000000005', 'Dev Petrol E', 'DEV-VEH-1', 75000, ${q(NOW)}, 'pending', '', '', NULL, NULL, NULL, NULL, '', '', NULL, '', '', ${q(NOW)}, ${q(NOW)});

INSERT INTO location_trips (id, employee_id, employee_name, trip_no, notes, status, start_at, start_lat, start_lng, start_accuracy_m, start_plus_code, end_at, end_lat, end_lng, end_accuracy_m, end_plus_code, distance_km, bike_km, bike_minutes, bike_source, bike_mode, from_name, from_address, from_eloc, from_lat, from_lng, hospital_name, hospital_address, hospital_eloc, hospital_lat, hospital_lng, created_at, updated_at) VALUES
  ('e9000001-0001-4001-8001-000000000001', 'a1000002-0001-4001-8001-000000000002', 'Dev Driver B', 1, 'Dev trip', 'completed', ${q(NOW)}, 17.44, 78.38, 5, '', ${q(NOW)}, 17.45, 78.39, 5, '', 12.5, NULL, NULL, '', '', '', '', '', NULL, NULL, 'Dev Hospital Alpha', '', '', NULL, NULL, ${q(NOW)}, ${q(NOW)});

INSERT INTO employee_daily_expenses (id, employee_id, employee_name, expense_date, kms_driven, petrol_amount, food_amount, other_amount, other_description, notes, entered_by, entered_by_id, created_at, updated_at) VALUES
  ('f9000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', 'Dev Store A', '2026-04-01', 45.5, 750, 120, 0, '', 'Dev seed expense', 'Dev Admin C', 'a1000003-0001-4001-8001-000000000003', ${q(NOW)}, ${q(NOW)});

INSERT INTO attendance_approval_requests (id, employee_id, employee_name, punch_type, requested_at, latitude, longitude, accuracy_m, distance_m, reason, status, admin_notes, created_at) VALUES
  ('g9000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', 'Dev Store A', 'in', ${q(NOW)}, 17.44, 78.38, 5, 120, 'Dev remote punch', 'pending', '', ${q(NOW)});

INSERT INTO field_team_attendance_approvals (id, employee_id, employee_name, department, date_key, status, admin_notes, created_at, updated_at) VALUES
  ('h9000001-0001-4001-8001-000000000001', 'a1000002-0001-4001-8001-000000000002', 'Dev Driver B', 'Delivery', '2026-04-15', 'pending', '', ${q(NOW)}, ${q(NOW)});

INSERT INTO employee_food_selections (id, employee_id, employee_name, meal_date, breakfast, lunch, dinner, submitted_at, created_at, updated_at) VALUES
  ('i9000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000001', 'Dev Store A', '2026-04-15', 1, 1, 0, ${q(NOW)}, ${q(NOW)}, ${q(NOW)});

INSERT OR REPLACE INTO app_settings (key, value, updated_by, updated_at) VALUES ('tv_notice', 'Dev TV notice', 'dev-seed', ${q(NOW)});
`);

const counts = d1Execute(
  "SELECT 'employees' AS t, COUNT(*) AS c FROM employees UNION ALL SELECT 'cases', COUNT(*) FROM cases UNION ALL SELECT 'notifications', COUNT(*) FROM notifications;",
);
console.log('Row counts:', counts);
console.log('\nSeed complete.');
