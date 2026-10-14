-- Phase 5: Replace HR/TMS placeholder tables with production-aligned schema.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP TABLE IF EXISTS `malcon_tms_activity`;
--> statement-breakpoint
DROP TABLE IF EXISTS `malcon_tms_tasks`;
--> statement-breakpoint
DROP TABLE IF EXISTS `malcon_tms_profiles`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hr_onboarding_tracks`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hr_kyc_intake`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hr_walk_in_applications`;
--> statement-breakpoint
DROP TABLE IF EXISTS `hr_job_postings`;
--> statement-breakpoint
CREATE TABLE `hr_job_postings` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hr_job_postings_code_key` ON `hr_job_postings` (`code`);
--> statement-breakpoint
CREATE INDEX `hr_job_postings_status_idx` ON `hr_job_postings` (`status`);
--> statement-breakpoint
CREATE TABLE `hr_walk_in_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`mobile` text NOT NULL,
	`previous_company` text NOT NULL,
	`previous_salary` text NOT NULL,
	`expected_salary` text NOT NULL,
	`address` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`form_version` text NOT NULL,
	`form_data` text DEFAULT '{}' NOT NULL,
	`full_name` text NOT NULL,
	`position_applied` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`job_code` text
);
--> statement-breakpoint
CREATE INDEX `hr_walk_in_applications_created_at_idx` ON `hr_walk_in_applications` (`created_at`);
--> statement-breakpoint
CREATE INDEX `hr_walk_in_applications_job_code_idx` ON `hr_walk_in_applications` (`job_code`);
--> statement-breakpoint
CREATE INDEX `hr_walk_in_applications_status_idx` ON `hr_walk_in_applications` (`status`);
--> statement-breakpoint
CREATE TABLE `hr_kyc_intake` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`mobile` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`employee_id` text DEFAULT '' NOT NULL,
	`date_of_birth` text DEFAULT '' NOT NULL,
	`gender` text DEFAULT '' NOT NULL,
	`aadhaar` text DEFAULT '' NOT NULL,
	`pan` text DEFAULT '' NOT NULL,
	`current_address` text DEFAULT '' NOT NULL,
	`permanent_address` text DEFAULT '' NOT NULL,
	`bank_account` text DEFAULT '' NOT NULL,
	`bank_ifsc` text DEFAULT '' NOT NULL,
	`bank_name` text DEFAULT '' NOT NULL,
	`highest_qualification` text DEFAULT '' NOT NULL,
	`emergency_name` text DEFAULT '' NOT NULL,
	`emergency_relation` text DEFAULT '' NOT NULL,
	`emergency_phone` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`father_name` text DEFAULT '' NOT NULL,
	`mother_name` text DEFAULT '' NOT NULL,
	`father_aadhaar` text DEFAULT '' NOT NULL,
	`mother_aadhaar` text DEFAULT '' NOT NULL,
	`qualification_ssc` text DEFAULT '' NOT NULL,
	`qualification_intermediate` text DEFAULT '' NOT NULL,
	`qualification_degree` text DEFAULT '' NOT NULL,
	`qualification_other` text DEFAULT '' NOT NULL,
	`form_version` text DEFAULT '' NOT NULL,
	`form_data` text DEFAULT '{}' NOT NULL,
	`full_name` text DEFAULT '' NOT NULL,
	`photo_storage_path` text DEFAULT '' NOT NULL,
	`hr_signature_data` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hr_kyc_intake_created_at_idx` ON `hr_kyc_intake` (`created_at`);
--> statement-breakpoint
CREATE INDEX `hr_kyc_intake_employee_id_idx` ON `hr_kyc_intake` (`employee_id`);
--> statement-breakpoint
CREATE INDEX `hr_kyc_intake_status_idx` ON `hr_kyc_intake` (`status`);
--> statement-breakpoint
CREATE TABLE `hr_onboarding_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`mobile` text NOT NULL,
	`position_applied` text NOT NULL,
	`walk_in_id` text,
	`kyc_intake_id` text,
	`employee_id_mls` text DEFAULT '' NOT NULL,
	`uan` text DEFAULT '' NOT NULL,
	`esi_eligible` integer,
	`esi_generated` integer DEFAULT 0 NOT NULL,
	`checkpoints` text DEFAULT '{}' NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`job_code` text,
	FOREIGN KEY (`walk_in_id`) REFERENCES `hr_walk_in_applications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`kyc_intake_id`) REFERENCES `hr_kyc_intake`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `hr_onboarding_tracks_created_at_idx` ON `hr_onboarding_tracks` (`created_at`);
--> statement-breakpoint
CREATE INDEX `hr_onboarding_tracks_job_code_idx` ON `hr_onboarding_tracks` (`job_code`);
--> statement-breakpoint
CREATE INDEX `hr_onboarding_tracks_kyc_intake_id_idx` ON `hr_onboarding_tracks` (`kyc_intake_id`);
--> statement-breakpoint
CREATE INDEX `hr_onboarding_tracks_mobile_idx` ON `hr_onboarding_tracks` (`mobile`);
--> statement-breakpoint
CREATE INDEX `hr_onboarding_tracks_walk_in_id_idx` ON `hr_onboarding_tracks` (`walk_in_id`);
--> statement-breakpoint
CREATE TABLE `malcon_tms_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `malcon_tms_profiles_email_key` ON `malcon_tms_profiles` (`email`);
--> statement-breakpoint
CREATE TABLE `malcon_tms_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`due` text,
	`assignee_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`assignee_id`) REFERENCES `malcon_tms_profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `malcon_tms_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `malcon_tms_tasks_assignee_idx` ON `malcon_tms_tasks` (`assignee_id`);
--> statement-breakpoint
CREATE INDEX `malcon_tms_tasks_status_idx` ON `malcon_tms_tasks` (`status`);
--> statement-breakpoint
CREATE TABLE `malcon_tms_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`task_id` text,
	`at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `malcon_tms_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `malcon_tms_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `malcon_tms_activity_at_idx` ON `malcon_tms_activity` (`at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
