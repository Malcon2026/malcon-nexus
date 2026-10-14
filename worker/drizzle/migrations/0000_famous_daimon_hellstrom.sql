CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_label` text DEFAULT '' NOT NULL,
	`performed_by` text NOT NULL,
	`performed_by_role` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_log_created_at` ON `activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_entity` ON `activity_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`case_number` text NOT NULL,
	`stage` text NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` text NOT NULL,
	`approved_at` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`notes` text,
	`admin_notes` text,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_approvals_case_id` ON `approvals` (`case_id`);--> statement-breakpoint
CREATE INDEX `idx_approvals_status` ON `approvals` (`status`);--> statement-breakpoint
CREATE TABLE `attendance_approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`punch_type` text NOT NULL,
	`requested_at` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracy_m` real DEFAULT 0 NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_by_id` text,
	`reviewed_at` text,
	`admin_notes` text,
	`attendance_record_id` text,
	`selfie_url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`attendance_record_id`) REFERENCES `attendance_records`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_approval_employee` ON `attendance_approval_requests` (`employee_id`,`requested_at`);--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`punch_type` text NOT NULL,
	`punched_at` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracy_m` real DEFAULT 0 NOT NULL,
	`distance_m` real DEFAULT 0 NOT NULL,
	`within_office` integer DEFAULT false NOT NULL,
	`office_address` text DEFAULT '' NOT NULL,
	`selfie_url` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_employee_punched` ON `attendance_records` (`employee_id`,`punched_at`);--> statement-breakpoint
CREATE INDEX `idx_attendance_punched_at` ON `attendance_records` (`punched_at`);--> statement-breakpoint
CREATE TABLE `case_alert_escalations` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`event_type` text NOT NULL,
	`alert_1_sent_at` text NOT NULL,
	`alert_2_sent_at` text,
	`alert_3_sent_at` text,
	`acknowledged_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_case_alert_unique` ON `case_alert_escalations` (`case_id`,`employee_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `idx_case_alert_pending` ON `case_alert_escalations` (`alert_1_sent_at`);--> statement-breakpoint
CREATE TABLE `case_task_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`case_number` text NOT NULL,
	`stage` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`employee_department` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text NOT NULL,
	`reviewed_by` text,
	`reviewed_by_id` text,
	`reviewed_at` text,
	`admin_notes` text,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_case_task_requests_case` ON `case_task_requests` (`case_id`);--> statement-breakpoint
CREATE INDEX `idx_case_task_requests_employee` ON `case_task_requests` (`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_case_task_requests_status` ON `case_task_requests` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_case_task_requests_one_pending` ON `case_task_requests` (`case_id`,`employee_id`) WHERE "case_task_requests"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`case_number` text NOT NULL,
	`hospital_id` text NOT NULL,
	`doctor_id` text,
	`hospital_snapshot` text DEFAULT '{}' NOT NULL,
	`doctor_snapshot` text DEFAULT '{}' NOT NULL,
	`surgery_date` text,
	`implant_required` text DEFAULT '' NOT NULL,
	`implant_type` text DEFAULT '' NOT NULL,
	`implant_company` text DEFAULT '' NOT NULL,
	`cancel_reason` text DEFAULT '' NOT NULL,
	`surgery_outcome` text DEFAULT '' NOT NULL,
	`surgery_outcome_detail` text DEFAULT '' NOT NULL,
	`postpone_reason` text DEFAULT '' NOT NULL,
	`postponed_from` text,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`current_stage` text DEFAULT 'Set Preparation' NOT NULL,
	`current_department` text,
	`post_surgery_duties` text DEFAULT '{}' NOT NULL,
	`assigned_employee_id` text,
	`assigned_employee_snapshot` text,
	`created_by` text DEFAULT '' NOT NULL,
	`due_date` text,
	`remarks` text DEFAULT '' NOT NULL,
	`stages` text DEFAULT '[]' NOT NULL,
	`activity_logs` text DEFAULT '[]' NOT NULL,
	`comments` text DEFAULT '[]' NOT NULL,
	`invoice_amount_minor` integer,
	`collected_amount_minor` integer,
	`payment_status` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cases_case_number_unique` ON `cases` (`case_number`);--> statement-breakpoint
CREATE INDEX `idx_cases_status` ON `cases` (`status`);--> statement-breakpoint
CREATE INDEX `idx_cases_current_stage` ON `cases` (`current_stage`);--> statement-breakpoint
CREATE INDEX `idx_cases_assigned_employee` ON `cases` (`assigned_employee_id`);--> statement-breakpoint
CREATE INDEX `idx_cases_hospital_id` ON `cases` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `idx_cases_surgery_date` ON `cases` (`surgery_date`);--> statement-breakpoint
CREATE INDEX `idx_cases_updated_at` ON `cases` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_cases_list_admin` ON `cases` (`status`,`current_stage`,`updated_at`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'bg-gray-100 text-gray-800' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE TABLE `doctors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`specialization` text DEFAULT '' NOT NULL,
	`hospital_id` text,
	`phone` text DEFAULT '' NOT NULL,
	`doctor_code` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_doctors_hospital_id` ON `doctors` (`hospital_id`);--> statement-breakpoint
CREATE TABLE `employee_daily_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`expense_date` text NOT NULL,
	`kms_driven` real DEFAULT 0 NOT NULL,
	`petrol_amount` real DEFAULT 0 NOT NULL,
	`food_amount` real DEFAULT 0 NOT NULL,
	`other_amount` real DEFAULT 0 NOT NULL,
	`other_description` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`entered_by` text DEFAULT '' NOT NULL,
	`entered_by_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entered_by_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_employee_id` ON `employee_daily_expenses` (`employee_id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_expense_date` ON `employee_daily_expenses` (`expense_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_daily_expenses_one_per_day` ON `employee_daily_expenses` (`employee_id`,`expense_date`);--> statement-breakpoint
CREATE TABLE `employee_food_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`meal_date` text NOT NULL,
	`breakfast` integer DEFAULT false NOT NULL,
	`lunch` integer DEFAULT false NOT NULL,
	`dinner` integer DEFAULT false NOT NULL,
	`submitted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_food_employee_meal_date` ON `employee_food_selections` (`employee_id`,`meal_date`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`department` text NOT NULL,
	`departments` text DEFAULT '[]' NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`employee_code` text,
	`telegram_chat_id` text,
	`cases_completed` integer DEFAULT 0 NOT NULL,
	`cases_active` integer DEFAULT 0 NOT NULL,
	`join_date` text NOT NULL,
	`auth_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE INDEX `idx_employees_auth_user_id` ON `employees` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_employees_employee_code` ON `employees` (`employee_code`) WHERE "employees"."employee_code" IS NOT NULL AND "employees"."employee_code" != '';--> statement-breakpoint
CREATE TABLE `field_team_attendance_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`date_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_id` text,
	`reviewed_at` text,
	`admin_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_field_team_attendance_employee_date` ON `field_team_attendance_approvals` (`employee_id`,`date_key`);--> statement-breakpoint
CREATE TABLE `hospital_trip_punches` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`hospital_id` text,
	`hospital_name` text DEFAULT '' NOT NULL,
	`punched_at` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracy_m` real DEFAULT 0 NOT NULL,
	`from_latitude` real,
	`from_longitude` real,
	`from_label` text DEFAULT '' NOT NULL,
	`distance_km` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_hospital_trip_employee` ON `hospital_trip_punches` (`employee_id`,`punched_at`);--> statement-breakpoint
CREATE TABLE `hospitals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`branch` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`contact_person` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_hospitals_city` ON `hospitals` (`city`);--> statement-breakpoint
CREATE TABLE `hr_job_postings` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hr_kyc_intake` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hr_onboarding_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hr_walk_in_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`leave_type` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`comp_off_work_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_leave_employee` ON `leave_requests` (`employee_id`,`from_date`);--> statement-breakpoint
CREATE TABLE `location_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`trip_no` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'started' NOT NULL,
	`start_at` text NOT NULL,
	`start_lat` real NOT NULL,
	`start_lng` real NOT NULL,
	`start_accuracy_m` real DEFAULT 0 NOT NULL,
	`start_plus_code` text DEFAULT '' NOT NULL,
	`end_at` text,
	`end_lat` real,
	`end_lng` real,
	`end_accuracy_m` real,
	`end_plus_code` text DEFAULT '' NOT NULL,
	`distance_km` real DEFAULT 0 NOT NULL,
	`bike_km` real,
	`bike_minutes` integer,
	`bike_source` text DEFAULT '' NOT NULL,
	`bike_mode` text DEFAULT '' NOT NULL,
	`from_name` text DEFAULT '' NOT NULL,
	`from_address` text DEFAULT '' NOT NULL,
	`from_eloc` text DEFAULT '' NOT NULL,
	`from_lat` real,
	`from_lng` real,
	`hospital_name` text DEFAULT '' NOT NULL,
	`hospital_address` text DEFAULT '' NOT NULL,
	`hospital_eloc` text DEFAULT '' NOT NULL,
	`hospital_lat` real,
	`hospital_lng` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_location_trips_employee_start` ON `location_trips` (`employee_id`,`start_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_location_trips_one_open` ON `location_trips` (`employee_id`) WHERE "location_trips"."status" = 'started';--> statement-breakpoint
CREATE TABLE `login_otps` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_login_otps_employee_created` ON `login_otps` (`employee_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_login_otps_active` ON `login_otps` (`employee_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `malcon_tms_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `malcon_tms_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `malcon_tms_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`case_id` text,
	`recipient_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_recipient_created` ON `notifications` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_recipient_unread` ON `notifications` (`recipient_id`,`is_read`);--> statement-breakpoint
CREATE TABLE `petrol_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text DEFAULT '' NOT NULL,
	`vehicle_no` text DEFAULT '' NOT NULL,
	`amount_minor` integer NOT NULL,
	`requested_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`book_no` text DEFAULT '' NOT NULL,
	`token_no` text DEFAULT '' NOT NULL,
	`issued_by` text,
	`issued_by_id` text,
	`issued_at` text,
	`kms` real,
	`receipt_url` text DEFAULT '' NOT NULL,
	`kms_photo_url` text DEFAULT '' NOT NULL,
	`receipt_submitted_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`issued_by_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_petrol_employee` ON `petrol_requests` (`employee_id`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_petrol_status` ON `petrol_requests` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_petrol_one_open_per_employee` ON `petrol_requests` (`employee_id`) WHERE "petrol_requests"."status" IN ('pending', 'issued');--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_employee` ON `push_subscriptions` (`employee_id`);--> statement-breakpoint
CREATE TABLE `surgical_kits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`serial_number` text NOT NULL,
	`status` text DEFAULT 'Available' NOT NULL,
	`last_used_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surgical_kits_serial_number_unique` ON `surgical_kits` (`serial_number`);