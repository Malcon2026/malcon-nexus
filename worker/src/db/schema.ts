/**
 * Cloudflare D1 (SQLite) schema — manual mapping from Supabase PostgreSQL.
 * JSON columns are TEXT holding valid JSON. Booleans are INTEGER 0/1.
 *
 * NOT applied to production. Supabase remains source of truth until cutover.
 */
import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// ─── Auth reference (no Supabase auth.users table) ───────────────────────────
// employees.auth_user_id stores opaque Supabase Auth user UUID (or future Worker JWT `sub`).

export const employees = sqliteTable(
  'employees',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    department: text('department').notNull(),
    /** JSON string: string[] department tags */
    departments: text('departments').notNull().default('[]'),
    role: text('role').notNull().default('employee'),
    status: text('status').notNull().default('Active'),
    avatar: text('avatar').notNull().default(''),
    phone: text('phone').notNull().default(''),
    employeeCode: text('employee_code'),
    telegramChatId: text('telegram_chat_id'),
    casesCompleted: integer('cases_completed').notNull().default(0),
    casesActive: integer('cases_active').notNull().default(0),
    joinDate: text('join_date').notNull(),
    /** External auth subject (Supabase auth.users.id or Malcon JWT `sub`) */
    authUserId: text('auth_user_id'),
    /** PBKDF2 password hash for Cloudflare-native login (admins / provisioned accounts) */
    passwordHash: text('password_hash'),
    /** Supabase Auth `encrypted_password` (bcrypt) — migrated; upgraded to password_hash on login */
    supabasePasswordHash: text('supabase_password_hash'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_employees_auth_user_id').on(t.authUserId),
    uniqueIndex('idx_employees_employee_code')
      .on(t.employeeCode)
      .where(sql`${t.employeeCode} IS NOT NULL AND ${t.employeeCode} != ''`),
  ],
);

export const hospitals = sqliteTable(
  'hospitals',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    branch: text('branch').notNull().default(''),
    address: text('address').notNull().default(''),
    city: text('city').notNull().default(''),
    contactPerson: text('contact_person').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    status: text('status').notNull().default('Active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_hospitals_city').on(t.city)],
);

export const doctors = sqliteTable(
  'doctors',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    specialization: text('specialization').notNull().default(''),
    hospitalId: text('hospital_id').references(() => hospitals.id, { onDelete: 'set null' }),
    phone: text('phone').notNull().default(''),
    doctorCode: text('doctor_code'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_doctors_hospital_id').on(t.hospitalId)],
);

export const departments = sqliteTable('departments', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default('bg-gray-100 text-gray-800'),
});

export const surgicalKits = sqliteTable(
  'surgical_kits',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull().default(''),
    serialNumber: text('serial_number').notNull().unique(),
    status: text('status').notNull().default('Available'),
    lastUsedDate: text('last_used_date'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
);

/**
 * Critical table — large JSON payloads preserved as TEXT (see PHASE_2 doc § cases JSON shapes).
 */
export const cases = sqliteTable(
  'cases',
  {
    id: text('id').primaryKey(),
    caseNumber: text('case_number').notNull().unique(),
    hospitalId: text('hospital_id')
      .notNull()
      .references(() => hospitals.id, { onDelete: 'restrict' }),
    doctorId: text('doctor_id').references(() => doctors.id, { onDelete: 'set null' }),
    /** JSON: Hospital snapshot at create time */
    hospitalSnapshot: text('hospital_snapshot').notNull().default('{}'),
    /** JSON: Doctor snapshot at create time */
    doctorSnapshot: text('doctor_snapshot').notNull().default('{}'),
    surgeryDate: text('surgery_date'),
    implantRequired: text('implant_required').notNull().default(''),
    implantType: text('implant_type').notNull().default(''),
    implantCompany: text('implant_company').notNull().default(''),
    cancelReason: text('cancel_reason').notNull().default(''),
    surgeryOutcome: text('surgery_outcome').notNull().default(''),
    surgeryOutcomeDetail: text('surgery_outcome_detail').notNull().default(''),
    postponeReason: text('postpone_reason').notNull().default(''),
    postponedFrom: text('postponed_from'),
    priority: text('priority').notNull().default('Medium'),
    status: text('status').notNull().default('Draft'),
    currentStage: text('current_stage').notNull().default('Set Preparation'),
    currentDepartment: text('current_department'),
    /** JSON: post-surgery duty assignments */
    postSurgeryDuties: text('post_surgery_duties').notNull().default('{}'),
    assignedEmployeeId: text('assigned_employee_id').references(() => employees.id, {
      onDelete: 'set null',
    }),
    /** JSON: Employee snapshot */
    assignedEmployeeSnapshot: text('assigned_employee_snapshot'),
    createdBy: text('created_by').notNull().default(''),
    dueDate: text('due_date'),
    remarks: text('remarks').notNull().default(''),
    /** JSON: WorkflowStage[] — primary workflow payload */
    stages: text('stages').notNull().default('[]'),
    /** JSON: embedded activity (legacy; also see activity_log table) */
    activityLogs: text('activity_logs').notNull().default('[]'),
    /** JSON: comment thread */
    comments: text('comments').notNull().default('[]'),
    /** Minor currency units (paise) — transform from PG NUMERIC on import */
    invoiceAmountMinor: integer('invoice_amount_minor'),
    collectedAmountMinor: integer('collected_amount_minor'),
    paymentStatus: text('payment_status'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_cases_status').on(t.status),
    index('idx_cases_current_stage').on(t.currentStage),
    index('idx_cases_assigned_employee').on(t.assignedEmployeeId),
    index('idx_cases_hospital_id').on(t.hospitalId),
    index('idx_cases_surgery_date').on(t.surgeryDate),
    index('idx_cases_updated_at').on(t.updatedAt),
    index('idx_cases_list_admin').on(t.status, t.currentStage, t.updatedAt),
  ],
);

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    message: text('message').notNull().default(''),
    type: text('type').notNull().default('info'),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    caseId: text('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    recipientId: text('recipient_id').references(() => employees.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_notifications_recipient_created').on(t.recipientId, t.createdAt),
    index('idx_notifications_recipient_unread').on(t.recipientId, t.isRead),
  ],
);

export const approvals = sqliteTable(
  'approvals',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    caseNumber: text('case_number').notNull(),
    stage: text('stage').notNull(),
    submittedBy: text('submitted_by').notNull(),
    submittedAt: text('submitted_at').notNull(),
    approvedAt: text('approved_at'),
    status: text('status').notNull().default('Pending'),
    notes: text('notes'),
    adminNotes: text('admin_notes'),
  },
  (t) => [
    index('idx_approvals_case_id').on(t.caseId),
    index('idx_approvals_status').on(t.status),
  ],
);

export const activityLog = sqliteTable(
  'activity_log',
  {
    id: text('id').primaryKey(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    entityLabel: text('entity_label').notNull().default(''),
    performedBy: text('performed_by').notNull(),
    performedByRole: text('performed_by_role').notNull(),
    details: text('details').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_activity_log_created_at').on(t.createdAt),
    index('idx_activity_log_entity').on(t.entityType, t.entityId),
  ],
);

export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    punchType: text('punch_type').notNull(),
    punchedAt: text('punched_at').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    accuracyM: real('accuracy_m').notNull().default(0),
    distanceM: real('distance_m').notNull().default(0),
    withinOffice: integer('within_office', { mode: 'boolean' }).notNull().default(false),
    officeAddress: text('office_address').notNull().default(''),
    selfieUrl: text('selfie_url'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_attendance_employee_punched').on(t.employeeId, t.punchedAt),
    index('idx_attendance_punched_at').on(t.punchedAt),
  ],
);

export const attendanceApprovalRequests = sqliteTable(
  'attendance_approval_requests',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    punchType: text('punch_type').notNull(),
    requestedAt: text('requested_at').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    accuracyM: real('accuracy_m').notNull().default(0),
    distanceM: real('distance_m').notNull().default(0),
    reason: text('reason').notNull().default(''),
    status: text('status').notNull().default('pending'),
    reviewedBy: text('reviewed_by'),
    reviewedById: text('reviewed_by_id').references(() => employees.id, { onDelete: 'set null' }),
    reviewedAt: text('reviewed_at'),
    adminNotes: text('admin_notes'),
    attendanceRecordId: text('attendance_record_id').references(() => attendanceRecords.id, {
      onDelete: 'set null',
    }),
    selfieUrl: text('selfie_url'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_attendance_approval_employee').on(t.employeeId, t.requestedAt)],
);

export const fieldTeamAttendanceApprovals = sqliteTable(
  'field_team_attendance_approvals',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    department: text('department').notNull().default(''),
    dateKey: text('date_key').notNull(),
    status: text('status').notNull().default('pending'),
    reviewedBy: text('reviewed_by'),
    reviewedById: text('reviewed_by_id').references(() => employees.id, { onDelete: 'set null' }),
    reviewedAt: text('reviewed_at'),
    adminNotes: text('admin_notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('idx_field_team_attendance_employee_date').on(t.employeeId, t.dateKey),
  ],
);

export const leaveRequests = sqliteTable(
  'leave_requests',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    leaveType: text('leave_type').notNull(),
    fromDate: text('from_date').notNull(),
    toDate: text('to_date').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    reviewedBy: text('reviewed_by'),
    reviewedById: text('reviewed_by_id').references(() => employees.id, { onDelete: 'set null' }),
    reviewedAt: text('reviewed_at'),
    adminNotes: text('admin_notes').notNull().default(''),
    compOffWorkDate: text('comp_off_work_date'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_leave_employee').on(t.employeeId, t.fromDate)],
);

export const petrolRequests = sqliteTable(
  'petrol_requests',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    vehicleNo: text('vehicle_no').notNull().default(''),
    /** Minor units (paise) — PG NUMERIC(10,2) × 100 on import */
    amountMinor: integer('amount_minor').notNull(),
    requestedAt: text('requested_at').notNull(),
    status: text('status').notNull().default('pending'),
    bookNo: text('book_no').notNull().default(''),
    tokenNo: text('token_no').notNull().default(''),
    issuedBy: text('issued_by'),
    issuedById: text('issued_by_id').references(() => employees.id, { onDelete: 'set null' }),
    issuedAt: text('issued_at'),
    kms: real('kms'),
    receiptUrl: text('receipt_url').notNull().default(''),
    kmsPhotoUrl: text('kms_photo_url').notNull().default(''),
    receiptSubmittedAt: text('receipt_submitted_at'),
    notes: text('notes').notNull().default(''),
    adminNotes: text('admin_notes').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_petrol_employee').on(t.employeeId, t.requestedAt),
    index('idx_petrol_status').on(t.status),
    uniqueIndex('idx_petrol_one_open_per_employee')
      .on(t.employeeId)
      .where(sql`${t.status} IN ('pending', 'issued')`),
  ],
);

export const locationTrips = sqliteTable(
  'location_trips',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    tripNo: integer('trip_no').notNull(),
    notes: text('notes').notNull().default(''),
    status: text('status').notNull().default('started'),
    startAt: text('start_at').notNull(),
    startLat: real('start_lat').notNull(),
    startLng: real('start_lng').notNull(),
    startAccuracyM: real('start_accuracy_m').notNull().default(0),
    startPlusCode: text('start_plus_code').notNull().default(''),
    endAt: text('end_at'),
    endLat: real('end_lat'),
    endLng: real('end_lng'),
    endAccuracyM: real('end_accuracy_m'),
    endPlusCode: text('end_plus_code').notNull().default(''),
    distanceKm: real('distance_km').notNull().default(0),
    bikeKm: real('bike_km'),
    bikeMinutes: integer('bike_minutes'),
    bikeSource: text('bike_source').notNull().default(''),
    bikeMode: text('bike_mode').notNull().default(''),
    fromName: text('from_name').notNull().default(''),
    fromAddress: text('from_address').notNull().default(''),
    fromEloc: text('from_eloc').notNull().default(''),
    fromLat: real('from_lat'),
    fromLng: real('from_lng'),
    hospitalName: text('hospital_name').notNull().default(''),
    hospitalAddress: text('hospital_address').notNull().default(''),
    hospitalEloc: text('hospital_eloc').notNull().default(''),
    hospitalLat: real('hospital_lat'),
    hospitalLng: real('hospital_lng'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_location_trips_employee_start').on(t.employeeId, t.startAt),
    uniqueIndex('idx_location_trips_one_open')
      .on(t.employeeId)
      .where(sql`${t.status} = 'started'`),
  ],
);

export const employeeFoodSelections = sqliteTable(
  'employee_food_selections',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    mealDate: text('meal_date').notNull(),
    breakfast: integer('breakfast', { mode: 'boolean' }).notNull().default(false),
    lunch: integer('lunch', { mode: 'boolean' }).notNull().default(false),
    dinner: integer('dinner', { mode: 'boolean' }).notNull().default(false),
    submittedAt: text('submitted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('idx_food_employee_meal_date').on(t.employeeId, t.mealDate)],
);

/** Matches `supabase/migrations/add-daily-expenses.sql` (admin daily log, not minor-units). */
export const employeeDailyExpenses = sqliteTable(
  'employee_daily_expenses',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    expenseDate: text('expense_date').notNull(),
    kmsDriven: real('kms_driven').notNull().default(0),
    petrolAmount: real('petrol_amount').notNull().default(0),
    foodAmount: real('food_amount').notNull().default(0),
    otherAmount: real('other_amount').notNull().default(0),
    otherDescription: text('other_description').notNull().default(''),
    notes: text('notes').notNull().default(''),
    enteredBy: text('entered_by').notNull().default(''),
    enteredById: text('entered_by_id').references(() => employees.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_expenses_employee_id').on(t.employeeId),
    index('idx_expenses_expense_date').on(t.expenseDate),
    uniqueIndex('employee_daily_expenses_one_per_day').on(t.employeeId, t.expenseDate),
  ],
);

export const caseTaskRequests = sqliteTable(
  'case_task_requests',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    caseNumber: text('case_number').notNull(),
    stage: text('stage').notNull(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    employeeDepartment: text('employee_department').notNull().default(''),
    status: text('status').notNull().default('pending'),
    requestedAt: text('requested_at').notNull(),
    reviewedBy: text('reviewed_by'),
    reviewedById: text('reviewed_by_id').references(() => employees.id, { onDelete: 'set null' }),
    reviewedAt: text('reviewed_at'),
    adminNotes: text('admin_notes'),
  },
  (t) => [
    index('idx_case_task_requests_case').on(t.caseId),
    index('idx_case_task_requests_employee').on(t.employeeId),
    index('idx_case_task_requests_status').on(t.status),
    uniqueIndex('idx_case_task_requests_one_pending')
      .on(t.caseId, t.employeeId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const caseAlertEscalations = sqliteTable(
  'case_alert_escalations',
  {
    id: text('id').primaryKey(),
    caseId: text('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    alert1SentAt: text('alert_1_sent_at').notNull(),
    alert2SentAt: text('alert_2_sent_at'),
    alert3SentAt: text('alert_3_sent_at'),
    acknowledgedAt: text('acknowledged_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('idx_case_alert_unique').on(t.caseId, t.employeeId, t.eventType),
    index('idx_case_alert_pending').on(t.alert1SentAt),
  ],
);

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  /** JSON or plain string value */
  value: text('value').notNull(),
  /** Admin display name on write (no FK — matches PostgreSQL TEXT) */
  updatedBy: text('updated_by').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
});

export const loginOtps = sqliteTable(
  'login_otps',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: text('consumed_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_login_otps_employee_created').on(t.employeeId, t.createdAt),
    index('idx_login_otps_active').on(t.employeeId, t.expiresAt),
  ],
);

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_push_subscriptions_employee').on(t.employeeId)],
);

export const hospitalTripPunches = sqliteTable(
  'hospital_trip_punches',
  {
    id: text('id').primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    employeeName: text('employee_name').notNull().default(''),
    hospitalId: text('hospital_id').references(() => hospitals.id, { onDelete: 'set null' }),
    hospitalName: text('hospital_name').notNull().default(''),
    punchedAt: text('punched_at').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    accuracyM: real('accuracy_m').notNull().default(0),
    fromLatitude: real('from_latitude'),
    fromLongitude: real('from_longitude'),
    fromLabel: text('from_label').notNull().default(''),
    distanceKm: real('distance_km').notNull().default(0),
    notes: text('notes').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_hospital_trip_employee').on(t.employeeId, t.punchedAt)],
);

/**
 * HR / TMS — mapped from production DDL (Phase 4.7 capture).
 * JSONB → TEXT (valid JSON). UUID → TEXT. timestamptz → ISO TEXT. PG text[] → JSON TEXT.
 * Status/priority CHECK enums enforced in Worker on write (SQLite CHECK omitted for parity).
 */

export const hrJobPostings = sqliteTable(
  'hr_job_postings',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull().default('Draft'),
    /** JSON object (PG jsonb `data`) */
    data: text('data').notNull().default('{}'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('hr_job_postings_code_key').on(t.code),
    index('hr_job_postings_status_idx').on(t.status),
  ],
);

export const hrWalkInApplications = sqliteTable(
  'hr_walk_in_applications',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    mobile: text('mobile').notNull(),
    previousCompany: text('previous_company').notNull(),
    previousSalary: text('previous_salary').notNull(),
    expectedSalary: text('expected_salary').notNull(),
    address: text('address').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
    formVersion: text('form_version').notNull(),
    /** JSON (PG jsonb) */
    formData: text('form_data').notNull().default('{}'),
    fullName: text('full_name').notNull(),
    positionApplied: text('position_applied').notNull(),
    email: text('email').notNull().default(''),
    jobCode: text('job_code'),
  },
  (t) => [
    index('hr_walk_in_applications_created_at_idx').on(t.createdAt),
    index('hr_walk_in_applications_job_code_idx').on(t.jobCode),
    index('hr_walk_in_applications_status_idx').on(t.status),
  ],
);

export const hrKycIntake = sqliteTable(
  'hr_kyc_intake',
  {
    id: text('id').primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    mobile: text('mobile').notNull(),
    email: text('email').notNull().default(''),
    employeeId: text('employee_id').notNull().default(''),
    dateOfBirth: text('date_of_birth').notNull().default(''),
    gender: text('gender').notNull().default(''),
    aadhaar: text('aadhaar').notNull().default(''),
    pan: text('pan').notNull().default(''),
    currentAddress: text('current_address').notNull().default(''),
    permanentAddress: text('permanent_address').notNull().default(''),
    bankAccount: text('bank_account').notNull().default(''),
    bankIfsc: text('bank_ifsc').notNull().default(''),
    bankName: text('bank_name').notNull().default(''),
    highestQualification: text('highest_qualification').notNull().default(''),
    emergencyName: text('emergency_name').notNull().default(''),
    emergencyRelation: text('emergency_relation').notNull().default(''),
    emergencyPhone: text('emergency_phone').notNull().default(''),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
    fatherName: text('father_name').notNull().default(''),
    motherName: text('mother_name').notNull().default(''),
    fatherAadhaar: text('father_aadhaar').notNull().default(''),
    motherAadhaar: text('mother_aadhaar').notNull().default(''),
    qualificationSsc: text('qualification_ssc').notNull().default(''),
    qualificationIntermediate: text('qualification_intermediate').notNull().default(''),
    qualificationDegree: text('qualification_degree').notNull().default(''),
    qualificationOther: text('qualification_other').notNull().default(''),
    formVersion: text('form_version').notNull().default(''),
    /** JSON (PG jsonb) */
    formData: text('form_data').notNull().default('{}'),
    fullName: text('full_name').notNull().default(''),
    photoStoragePath: text('photo_storage_path').notNull().default(''),
    hrSignatureData: text('hr_signature_data').notNull().default(''),
  },
  (t) => [
    index('hr_kyc_intake_created_at_idx').on(t.createdAt),
    index('hr_kyc_intake_employee_id_idx').on(t.employeeId),
    index('hr_kyc_intake_status_idx').on(t.status),
  ],
);

export const hrOnboardingTracks = sqliteTable(
  'hr_onboarding_tracks',
  {
    id: text('id').primaryKey(),
    fullName: text('full_name').notNull(),
    mobile: text('mobile').notNull(),
    positionApplied: text('position_applied').notNull(),
    walkInId: text('walk_in_id').references(() => hrWalkInApplications.id, { onDelete: 'set null' }),
    kycIntakeId: text('kyc_intake_id').references(() => hrKycIntake.id, { onDelete: 'set null' }),
    employeeIdMls: text('employee_id_mls').notNull().default(''),
    uan: text('uan').notNull().default(''),
    esiEligible: integer('esi_eligible', { mode: 'boolean' }),
    esiGenerated: integer('esi_generated', { mode: 'boolean' }).notNull().default(false),
    /** JSON (PG jsonb checkpoints) */
    checkpoints: text('checkpoints').notNull().default('{}'),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    jobCode: text('job_code'),
  },
  (t) => [
    index('hr_onboarding_tracks_created_at_idx').on(t.createdAt),
    index('hr_onboarding_tracks_job_code_idx').on(t.jobCode),
    index('hr_onboarding_tracks_kyc_intake_id_idx').on(t.kycIntakeId),
    index('hr_onboarding_tracks_mobile_idx').on(t.mobile),
    index('hr_onboarding_tracks_walk_in_id_idx').on(t.walkInId),
  ],
);

export const malconTmsProfiles = sqliteTable(
  'malcon_tms_profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    color: text('color').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('malcon_tms_profiles_email_key').on(t.email)],
);

export const malconTmsTasks = sqliteTable(
  'malcon_tms_tasks',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull(),
    priority: text('priority').notNull(),
    /** JSON string array (PG text[]) */
    tags: text('tags').notNull().default('[]'),
    due: text('due'),
    assigneeId: text('assignee_id').references(() => malconTmsProfiles.id, { onDelete: 'set null' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => malconTmsProfiles.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    completedAt: text('completed_at'),
  },
  (t) => [
    index('malcon_tms_tasks_assignee_idx').on(t.assigneeId),
    index('malcon_tms_tasks_status_idx').on(t.status),
  ],
);

export const malconTmsActivity = sqliteTable(
  'malcon_tms_activity',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => malconTmsProfiles.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    detail: text('detail').notNull().default(''),
    taskId: text('task_id').references(() => malconTmsTasks.id, { onDelete: 'set null' }),
    at: text('at').notNull(),
  },
  (t) => [index('malcon_tms_activity_at_idx').on(t.at)],
);
