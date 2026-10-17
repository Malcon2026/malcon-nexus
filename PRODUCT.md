# Malcon Nexus — Product context (inferred from codebase)

Malcon Nexus is an internal operations web application for **Malcon**’s **hospital implant case** business. It coordinates people, cases, and evidence from set preparation through billing and closure.

## Users and roles

- **Admin / case ops:** Full case catalog, approvals, employees, hospitals, doctors, reports, repairs, Telegram tooling.
- **Store manager:** Case creation, set preparation submission, case duties, limited admin actions.
- **Employee:** Assigned cases, stage submission (photos + notes), attendance, FCFS pools (e.g. Checking & Audit), task requests.
- **Specialized views:** Petrol / food / KMS dashboards for operational expense tracking (role-gated `viewMode`).

Authentication uses configured backends (Supabase and/or Cloudflare Worker / AWS API per deploy profile)—not documented here as requirements.

## Core workflows

1. **Case lifecycle:** Stages include Set Preparation → Delivery → Surgery → Pickup → Checking & Audit → Restock → Billing → Bill Submission → Completed. Cases can be postponed or cancelled (including surgery-not-performed paths).
2. **Assignment:** Employees (and assistants) per stage; self-performed hospital paths; FCFS pools for certain stages.
3. **Submission:** Employees upload **stamped stage photos** and notes; admin approves or force-advances (gated).
4. **Attendance:** Punch-in with selfies; approvals; WhatsApp/report scripts exist outside the SPA.
5. **Supporting data:** Hospitals, doctors, expenses, activity log, notes, live cases, workflow board, TV board for office display.

## Deployment (observed)

- Primary SPA: **https://app.malconnexus.com/** via static build + Hostinger (`npm run deploy:hostinger*`).
- Main Vite build uses **single-file output** (`vite-plugin-singlefile`) for the deployed HTML artifact.
- Separate builds for **gallery** and **TV** sites (`vite.gallery.config.ts`, `vite.tv.config.ts`).

## Out of scope for this document

Business rules encoded in `worker/`, store logic, and migrations are source-of-truth in code—not duplicated here. Do not treat this file as a spec for API or schema changes.
