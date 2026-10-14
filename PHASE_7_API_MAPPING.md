# Phase 7 — Supabase → Worker API mapping

Mapping exercise only. **SPA still calls Supabase** in Phase 7.

Priority: **P0** startup/core · **P1** daily ops · **P2** secondary · **P3** admin/rare

| Existing Supabase operation (repository) | Proposed Worker endpoint | Method | D1 table(s) | AuthZ | Priority |
|------------------------------------------|--------------------------|--------|-------------|-------|----------|
| `EmployeeRepository.getAll` | `/api/employees` | GET | `employees` | authenticated; admin or self-list policy TBD | **P0** ✓ Phase 7 |
| `EmployeeRepository.getById` | `/api/employees/:id` | GET | `employees` | `requireEmployeeAccess` or admin | **P0** ✓ Phase 7 |
| `EmployeeRepository.getByEmail` | `/api/employees?email=` | GET | `employees` | admin / auth bootstrap | P0 |
| `EmployeeRepository.getByAuthUserId` | `/api/me` | GET | `employees` | authenticated (JWT sub) | P0 |
| `EmployeeRepository.create/update/delete/linkAuthUser` | `/api/employees` | POST/PATCH/DELETE | `employees` | admin | P1 |
| `HospitalRepository.getAll/create/update/delete` | `/api/hospitals` | GET/POST/PATCH/DELETE | `hospitals` | admin / read authenticated | P1 |
| `DoctorRepository.getAll/create/update/delete` | `/api/doctors` | GET/POST/PATCH/DELETE | `doctors`, `hospitals` | admin / read authenticated | P1 |
| `CaseRepository.getAll` | `/api/cases` | GET | `cases` | `canReadCase` filter server-side | **P0** ✓ Phase 7 (list) |
| `CaseRepository.getById` | `/api/cases/:id` | GET | `cases` | `canReadCase` | **P0** ✓ Phase 7 |
| `CaseRepository.getForEmployee` | `/api/cases?assignee=` | GET | `cases` | employee scoped | P0 |
| `CaseRepository.create/update/delete/saveAll/claimCase` | `/api/cases` | POST/PATCH/DELETE | `cases`, related | role + stage rules | P1 |
| `NotificationRepository.getAll` | `/api/notifications` | GET | `notifications` | recipient scoped, paginated | P1 |
| `NotificationRepository.markRead/markAllRead/create` | `/api/notifications/:id/read` | PATCH/POST | `notifications` | recipient | P1 |
| `ApprovalRepository.*` | `/api/approvals` | GET/POST/PATCH | `approvals`, `cases` | admin | P1 |
| `CaseTaskRequestRepository.*` | `/api/case-task-requests` | GET/POST/PATCH | `case_task_requests` | case + employee | P1 |
| `ActivityLogRepository.getAll/insert` | `/api/activity-log` | GET/POST | `activity_log` | admin read; paginated | P2 |
| `AttendanceRepository.*` | `/api/employees/:id/attendance` | GET/POST | `attendance_records` | **P1** ✓ Phase 7 (read paginated) |
| `AttendanceApprovalRepository.*` | `/api/attendance-approvals` | GET/POST/PATCH | `attendance_approval_requests` | employee + admin | P1 |
| `FieldTeamAttendanceRepository.*` | `/api/field-team-attendance` | GET/POST/PATCH | `field_team_attendance_approvals` | admin / store_manager | P2 |
| `LeaveRequestRepository.*` | `/api/leave-requests` | GET/POST/PATCH | `leave_requests` | employee + admin | P1 |
| `DailyExpenseRepository.*` | `/api/daily-expenses` | GET/POST/DELETE | `employee_daily_expenses` | employee + admin | P1 |
| `AppSettingsRepository.*` | `/api/settings` | GET/PATCH | `app_settings` | admin | P2 |
| `DepartmentRepository.getAll` | `/api/departments` | GET | `departments` | authenticated | P1 |
| `SurgicalKitRepository.*` | `/api/surgical-kits` | GET/PATCH | `surgical_kits` | admin / stores | P2 |
| `PetrolRequestRepository.*` | `/api/petrol-requests` | GET/POST/PATCH | `petrol_requests` | employee + admin; enforce book/token uniqueness in Worker | P2 |
| `LocationTripRepository.*` | `/api/location-trips` | GET/POST/PATCH | `location_trips` | employee scoped | P2 |
| `HospitalTripPunchRepository.*` | `/api/hospital-trip-punches` | GET/POST | `hospital_trip_punches` | field team | P3 |
| HR/TMS repositories (7 tables) | `/api/hr/*`, `/api/tms/*` | GET/POST/PATCH | `hr_*`, `malcon_tms_*` | HR admin roles | P2–P3 |

**Phase 7 implemented:** rows marked ✓.

**Authorization note:** Do not copy RLS literally; implement equivalent checks in Worker using `RequestContext` + helpers in `authorization.ts`.
