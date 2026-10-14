ALTER TABLE `field_team_attendance_approvals` ADD COLUMN `employee_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `field_team_attendance_approvals` ADD COLUMN `department` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `field_team_attendance_approvals` ADD COLUMN `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD COLUMN `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD COLUMN `reviewed_by_id` text REFERENCES `employees`(`id`) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD COLUMN `reviewed_at` text;
