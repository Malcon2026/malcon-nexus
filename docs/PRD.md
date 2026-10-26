# Malcon Nexus — Product Requirements Document

> Status legend: ✅ IMPLEMENTED · 🟡 PARTIALLY IMPLEMENTED · 🔵 PLANNED · ⚪ PLACEHOLDER · ❓ UNKNOWN
> Last verified against the repository on 2026-10-26.

---

## AI Agent Usage

- **What this document is for:** what Malcon Nexus does and why, described from the code that is actually shipped.
- **Read it when:** you need to know what a feature is for, who uses it, or whether it exists before changing it.
- **Authoritative sections:** the Feature Inventory (§12) and Current Implementation Status (§30).
- **Do not infer from it:** technical design (see `TRD.md`), screen-by-screen navigation (see `APP_FLOW.md`), or anything marked 🔵 PLANNED or ⚪ PLACEHOLDER. Recommendations in §33 are not requirements.

---

## 1. Executive Summary

Malcon Nexus is an internal operations app for a medical-implant logistics business. It tracks each surgery case from hospital booking through implant preparation, delivery, surgery, pickup, checking, restock, billing and close. Staff record what they did at each stage, with photos. Admins watch every case, approve work, and manage employees, hospitals, doctors, attendance, expenses and field trips.

It is a single web application (React) backed by Supabase (Postgres, authentication, storage, edge functions). Stage photos are stored in Google Drive. Notifications go out through Telegram, email and web push.

## 2. Product Overview

| Item | Current state |
|---|---|
| Product | Malcon Nexus (internal workflow and operations app) |
| Users | Company staff (about 40 employees across roles) and 2 administrators in the current operation |
| Platform | Responsive web app, used on phones and desktops |
| Live address | `app.malconnexus.com` (static hosting on Hostinger) |
| Data | Supabase Postgres (cases, people, hospitals, doctors, attendance, expenses, trips) |
| Photos | New stage photos in Google Drive; older photos in Supabase Storage |

## 3. Business Context

The business books surgeries at hospitals and must bring the right implant kit to the operating theatre, deliver it, retrieve unused items, check them, restock, and bill the hospital. Each step needs a named person, a time, and often a photo as proof. Before this app, tracking was done by hand and by messaging.

## 4. Problem Statement

- Nobody can see at a glance where a case is, who is holding it, or what is overdue.
- Proof of delivery and preparation (photos) is not linked to the case.
- Approvals, attendance corrections, leave, expenses and field trips are handled outside a system of record.
- End-of-day status depends on people remembering.

## 5. Product Vision

One shared record per case, with each stage done by the responsible person, photo proof attached, and an admin able to see and steer everything from one screen.

## 6. Product Goals

| Goal | Status |
|---|---|
| Single case record with stage-by-stage workflow | ✅ IMPLEMENTED |
| Photo proof at stage completion, stored and viewable | ✅ IMPLEMENTED (Google Drive for new photos) |
| Role-based views for admins, employees, store managers, petrol staff | ✅ IMPLEMENTED |
| Approvals queue for admin decisions | ✅ IMPLEMENTED |
| Attendance, leave, expenses, field trips, petrol, food, KM incentive | 🟡 PARTIALLY IMPLEMENTED (screens exist; depth varies) |
| Automatic end-of-day report | ✅ IMPLEMENTED (CSV in Drive, nightly) |
| Access control enforced in the database for every table | 🟡 PARTIALLY IMPLEMENTED (RLS on all tables; policy gaps noted in TRD §15) |

## 7. Target Users

- **Administrators** — run the operation, approve work, manage people and masters.
- **Employees** — field and store staff who carry out stages and submit proof.
- **Store managers** — manage store-side set preparation and restock tasks.
- **Petrol / field staff** — submit petrol requests and track their own field usage.
- **Gallery and TV viewers** — read-only display screens (no login for the public gallery feed; token-protected TV board).

## 8. User Roles

Roles come from the `employees.role` column: `admin`, `employee`, `store_manager`, `petrol`.

| Role | Who | Main access |
|---|---|---|
| `admin` | Full administrators | All modules; approvals; employee and master data; reports |
| `store_manager` | Store-side managers | Case board for store tasks; set preparation submissions; case duties |
| `employee` | Field and office staff | Own assigned cases and stages; own attendance, leave, expenses, food |
| `petrol` | Petrol / field users | Petrol dashboard only |

**Super administrator** is a separate flag. It is granted by the `is_super_admin()` database function and a client-side email allowlist. Super admins are the only users who can view stage photos. See §27.

## 9. User Needs

- See every open case and its current stage at a glance.
- Submit a stage quickly from a phone, with photos, with no typing beyond notes.
- Know which cases need action today.
- Admins approve or return work with a reason.
- Records of who did what, and when.

## 10. Product Scope

**In scope (shipped):** case lifecycle workflow, stage submission with photos, approvals, employees, hospitals, doctors, attendance and leave, expenses, petrol requests, food selections, field trips and KM, notifications (in-app, Telegram, email, web push), gallery and TV displays, reports, activity log, end-of-day CSV report.

**Out of scope (not in this codebase):** customer billing or accounting integration; hospital-facing portal; inventory accounting beyond stage records.

## 11. Core Modules

| Module | Purpose | Status |
|---|---|---|
| Dashboard | Summary for admins | ✅ IMPLEMENTED |
| Employee Dashboard | Own work for employees | ✅ IMPLEMENTED |
| Cases | Create, list and open cases | ✅ IMPLEMENTED |
| Case Detail | Stages, photos, comments, assignments, duties | ✅ IMPLEMENTED |
| Live Cases | Cases in progress right now | ✅ IMPLEMENTED |
| Workflow Board | Cases by workflow stage | ✅ IMPLEMENTED |
| Postponed Cases | Cases with a postponed surgery | ✅ IMPLEMENTED |
| Approval Queue | Admin decisions on submitted work | ✅ IMPLEMENTED |
| Task Requests | Claim-from-pool requests | ⚪ PLACEHOLDER (pool feature turned off in code) |
| Case Duties | Post-surgery duties for store managers | ✅ IMPLEMENTED |
| Employees | Staff records and login setup | ✅ IMPLEMENTED |
| Hospitals / Doctors | Master data | ✅ IMPLEMENTED |
| Attendance / Attendance Approvals | Punches, corrections, approvals | 🟡 PARTIALLY IMPLEMENTED |
| Expenses | Daily expense entries | 🟡 PARTIALLY IMPLEMENTED |
| Petrol | Petrol requests and receipts | 🟡 PARTIALLY IMPLEMENTED |
| Food | Meal selections | 🟡 PARTIALLY IMPLEMENTED |
| KM / Field trips | Trip start and end with distance and incentive | 🟡 PARTIALLY IMPLEMENTED |
| Notes | Internal notes board | ❓ UNKNOWN (screen exists; usage not verified) |
| Telegram | Telegram linking and broadcasts | 🟡 PARTIALLY IMPLEMENTED (see §22) |
| Reports | Reporting screen | 🟡 PARTIALLY IMPLEMENTED |
| Case History | Closed and past cases | ✅ IMPLEMENTED |
| Activity Log | Audit-style history of actions | ✅ IMPLEMENTED |
| Settings | Profile and app settings | ✅ IMPLEMENTED |
| Gallery | Public read-only photo feed | 🟡 PARTIALLY IMPLEMENTED |
| TV Board | Kiosk display | 🟡 PARTIALLY IMPLEMENTED |
| Daily report | End-of-day CSV in Drive | ✅ IMPLEMENTED |

## 12. Feature Inventory

Feature-level status (✅ / 🟡 / 🔵 / ⚪ / ❓):

| Feature | Status | Notes |
|---|---|---|
| Email and password sign-in | ✅ | Supabase Auth |
| Employee-code OTP sign-in (employee and store manager) | ✅ | Edge functions `request-login-otp` and `verify-login-otp`; admins and petrol are refused |
| Forgot password | ❓ UNKNOWN | No reset flow found in code |
| Self sign-up | ❓ UNKNOWN | Not found; accounts are created by admins |
| Create case (case name, hospital, doctor, company, implant type, date, priority) | ✅ | Multi-step form: date and case name → hospital and doctor → details → team → review |
| Keyboard selection in hospital and doctor pickers | ✅ | Arrow keys and Enter |
| Stage submission with photos | ✅ | Photos to Google Drive |
| Stage submission without photos | ✅ | Non-photo stages |
| Surgery postpone and cancel | ✅ | Postponed cases screen |
| Pickup outcomes (used, parked, returned) | ✅ | |
| Restock outcomes | ✅ | |
| Approvals with reasons | ✅ | Approval queue |
| Task requests from pool | ⚪ | Pool disabled (`FCFS_POOL_ENABLED = false`) |
| Attendance punch in and out | 🟡 | Present in code; verify with users |
| Leave requests | 🟡 | Table and screens exist |
| Expenses | 🟡 | |
| Petrol requests with receipts | 🟡 | Receipts in a public bucket — see §21 |
| Food meal selection | 🟡 | |
| Field trips and KM incentive | 🟡 | Uses map and route services |
| Telegram notifications | 🟡 | Code present; live configuration not verified |
| Email notifications | 🟡 | Code present (Resend); live configuration not verified |
| Web push notifications | 🟡 | Code present (VAPID); live configuration not verified |
| Dashboard AI insights | 🟡 | Edge function uses Gemini; live use not verified |
| Hospital search and route | 🟡 | Mappls and Google Maps keys named in code |
| Activity log | ✅ | |
| Gallery public feed | 🟡 | Token-protected endpoint |
| TV board | 🟡 | Token-protected endpoint |
| End-of-day CSV | ✅ | Nightly at 23:59 IST |
| Export to Excel/PDF | ❓ UNKNOWN | Libraries listed, not verified in screens |
| Cloudflare, Convex, AWS backends | ⚪ REMOVED from repository | Legacy code deleted 2026-10-25; some config flags remain |

## 13. Functional Requirements

### FR-1 Sign-in
- Admins sign in with email and password. Employee and store-manager accounts can also sign in with their employee code and a one-time code. The petrol desk uses its own login.
- A user without an active employee profile must not reach the app.

### FR-2 Case creation
- An admin or case operations user creates a case.
- Required: surgery date, case name, hospital, doctor.
- Optional: company, implant type, priority (default Medium).
- Case number is generated as `MLS-MM-YY-NNN`, using the month and year of the surgery date, with a sequence number within that month (e.g. `MLS-10-26-001`).

### FR-3 Stage workflow
- A case moves through workflow stages (§13 of TRD lists the stage values).
- Some stages can run in parallel (for example, set preparation can be approved while the case is already at Delivery).
- Each stage submission records who did it, when, notes and photos.

### FR-4 Photo proof
- A stage submission may include up to 10 photos, compressed on the device and stamped with the employee name, ID and time.
- Photos are stored in Google Drive, grouped by date, case and stage.
- Only super administrators can open stage photos. Everyone else sees a count.

### FR-5 Approvals
- Some submissions wait for admin approval.
- Admins can approve, or return with a reason.

### FR-6 People and masters
- Admins create and edit employees, hospitals and doctors.
- Employee login is linked to the employee record.

### FR-7 Attendance, leave, expenses, field trips
- Employees record their own punches, leave, expenses and trips.
- Admins approve corrections and requests.

### FR-8 Notifications
- Activity on a case can notify the assigned person through the app, and (when configured) Telegram, email or web push.

### FR-9 Reporting
- Activity log shows changes.
- A nightly CSV lists the cases created that day, with hospital, doctor, status, current stage, assignee, and who submitted each stage.

## 14. User Stories

| As a | I want | So that | Status |
|---|---|---|---|
| Employee | to submit a stage with photos from my phone | proof is recorded quickly | ✅ |
| Employee | to see only the cases assigned to me | I don't work on someone else's case | ✅ |
| Store manager | to submit set preparation | store work moves forward | ✅ |
| Admin | to see every case and its stage | I can steer the operation | ✅ |
| Admin | to approve or return submissions with a reason | quality is controlled | ✅ |
| Admin | to see who did what | accountability | ✅ |
| Admin | a daily report | I can review the day without opening every case | ✅ |
| Super admin | to view stage photos | proof can be checked | ✅ |
| Employee | to claim an unassigned case from a pool | load is shared | ⚪ |

## 15. Core User Workflows

1. **Book and create a case:** date and case name → hospital and doctor → company, implant type, priority → team → review → create.
2. **Prepare and deliver:** set preparation (store) → delivery (driver) → surgery.
3. **Surgery outcome:** completed, postponed (new date), or cancelled (implant not used).
4. **Return:** pickup from hospital → checking and audit → restock → billing → bill submission → completed.
5. **Admin review:** approval queue; live cases; activity log.

## 16. Dashboard Requirements

- **Admin dashboard:** open cases, cases by stage, pending approvals, overdue items.
- **Employee dashboard:** own assigned cases and pending actions.
- **Petrol dashboard:** own petrol requests.
- Status: ✅ IMPLEMENTED for admin and employee; 🟡 PARTIALLY IMPLEMENTED for petrol, food and KM dashboards.

## 17. Employee Requirements

- Employee records include name, email, department (one primary and optional extra departments), role, status, phone, employee code, and Telegram chat link.
- Departments in code: Stores, Delivery, Drivers, Scrub Person, Checking & Audit, Accounts, Bill Submission, Office Staff, Admin.
- Employees can be deactivated; history is kept.

## 18. Operations Requirements

- Stage ownership: each stage has a responsible department.
- Parallel approvals: an approval can run while the case moves on.
- Surgery outcomes and pickup outcomes must be recorded with a reason where the workflow requires it.

## 19. Case / Task Requirements

- A case has one current stage and one current department.
- Post-surgery duties (return, pickup, clean, restock) can be assigned to team members.
- Case task requests can be raised. The pool-claim mode is disabled.

## 20. Delivery Requirements

- Delivery is a workflow stage with its own submission.
- Delivery photos follow the same photo rules as other stages.

## 21. File / Photo Requirements

| Requirement | Status |
|---|---|
| Up to 10 photos per stage submission | ✅ |
| Photos compressed and stamped on device | ✅ |
| New photos stored in Google Drive | ✅ |
| Photos organised by year, month, date, case, stage | ✅ |
| Only super admins view photos | ✅ (enforced in app; see TRD §16 for storage policy) |
| Old photos moved from Supabase to Drive | 🔵 PLANNED |
| Attendance selfies stored privately | 🟡 Bucket is public (see gap below) |
| Petrol receipts stored privately | 🟡 Bucket is public (see gap below) |

**Gap:** the `attendance-selfies` and `petrol-receipts` storage buckets are public. Anyone with a file's link can open it. This is recorded in the TRD and in the security review. It is a product risk, not a planned behaviour.

## 22. Notification Requirements

| Channel | Status | Notes |
|---|---|---|
| In-app | ✅ | Notifications table |
| Telegram | 🟡 | Bot and webhook code present |
| Email (Resend) | 🟡 | Assignment emails present |
| Web push | 🟡 | Subscription and send functions present |
| Alert escalations | 🟡 | Scheduled escalation function present |

## 23. Search and Filtering

- Hospital search by name, branch, city, address — ✅.
- Doctor search by name or doctor code — ✅.
- Case lists filter by stage, status and search text — ✅ (confirm details in screens).

## 24. Reporting

- Activity log — ✅.
- End-of-day CSV in Drive, one per day — ✅.
- Reports screen — 🟡.

## 25. Administration

- Employee creation and edits, login setup, admin password utility — ✅.
- Hospital and doctor masters — ✅.
- Super admin list — configured via environment variable and database function.

## 26. Authentication

- Supabase Auth email and password (`signInWithPassword`).
- OTP sign-in through two edge functions (`request-login-otp`, `verify-login-otp`). It looks up the employee by employee code. Admins and petrol users are refused, and inactive accounts are refused.
- Sessions are kept by the Supabase client.
- Sign-out available from the top bar.
- Password reset and self sign-up: ❓ UNKNOWN (not found).

## 27. Authorization

- Database row-level security is on for every public table.
- The current role is read from the employee record linked to the signed-in user.
- Super admin rights come from the `is_super_admin()` function.
- The client also has its own role checks for showing screens. These are for display only; the database is the real gate.

## 28. Security Requirements

- Staff must sign in before using case data.
- Stage photos visible only to super admins.
- Server functions that write data must check who is calling.
- Secrets (API keys, tokens) must never reach the browser.

Current position against these requirements is in TRD §24 and the security summary. Several gaps are open (public buckets, a password value in client build settings, no automated tests).

## 29. Non-Functional Requirements

| Area | Target | Current state |
|---|---|---|
| Usable on phones | Yes | ✅ Mobile layouts and bottom-sheet modals |
| Photo size | Under 5 MB per photo | ✅ Enforced |
| Cost | Stay on Supabase free-plan limits | 🟡 Egress reduced by moving photos to Drive; usage not yet confirmed |
| Availability | Business hours | ❓ UNKNOWN (no uptime monitoring found) |
| Testing | Automated tests | 🔵 PLANNED (no test files found) |
| Accessibility | Keyboard use and labels | 🟡 Keyboard selection added to case form |

## 30. Current Implementation Status

**Major completed:** case workflow, case creation with keyboard selection, stage submissions with Drive photos, approvals, activity log, hospitals and doctors, employees, case history, daily CSV report.

**Major partial:** attendance, leave, expenses, petrol, food, KM and field trips; notifications outside the app; reports; gallery and TV boards.

**Major missing or planned:** password reset, self sign-up, task pool (disabled), automated testing, migration of old Supabase photos to Drive, private storage for selfies and receipts.

## 31. Known Limitations

- Photo folders are by date, case and stage. Photos cannot be found by case number unless the case folder is known.
- The daily CSV covers cases created that day, not cases updated that day.
- Telegram, email and push depend on configuration that is not verified here.
- Older code paths for removed backends may still exist in the client as dormant flags.

## 32. Product Risks

| Risk | Impact | Mitigation today |
|---|---|---|
| Photos shared by "anyone with link" | Medical-context photos could be seen by someone who has a link | Links are not published; restrict access in future (see TRD §24) |
| Data loss by admin action | Cases or photos can be deleted | Backups are manual; no restore point on the free plan |
| Single owner of Drive storage | Photos depend on one Google account | Owner should enable 2-step verification and keep a backup |
| Public storage buckets | Selfies and receipts readable by URL | Needs change (TRD §24) |
| Single operator knowledge | Limited documentation of setup steps | This document set and `AGENT_HANDOFF.md` |

## 33. Future Opportunities

- Find photos by case number from the app, not only by Drive folder.
- Private storage for selfies and receipts with signed links.
- Automated tests for the case workflow and permissions.
- Retire the legacy backend code and configuration flags.
- Reporting beyond the daily CSV.

These are recommendations. They are not current requirements.

## 34. Acceptance Criteria

- A new case can be created with case name, hospital, doctor, date, and reviewed before submit.
- A stage submission with photos stores the photos in Drive under date → case → stage.
- The nightly CSV appears in the day's Drive folder and lists all cases created that day.
- Non-super-admin users cannot open stage photos from the app.
- Keyboard can select a hospital and a doctor without a mouse.

## 35. Documentation Confidence & Gaps

| Area | Confidence | Gap |
|---|---|---|
| Case workflow and roles | High | Stage rules for every role not traced line by line |
| Photo storage | High | Old Supabase photos not yet migrated |
| Authentication | High | Reset and sign-up not found |
| Notifications | Medium | Live configuration not checked |
| Attendance, expenses, petrol, food, KM | Medium | Screen-level behaviour not all tested |
| Reports and exports | Low | Not verified |
| Availability and monitoring | Low | Not found |
