# MALCON NEXUS — CURSOR HANDOVER DOCUMENT

**Date:** October 13, 2026  
**Repository:** `https://github.com/Malcon2026/malcon-nexus.git`  
**Current Branch:** `main`  
**Latest Commit:** `dad9438`  
**Status:** Clean, verified, and synchronized with `origin/main`  
**Production URL:** [https://app.malconnexus.com/](https://app.malconnexus.com/) (Hostinger)

---

## 1. EXECUTIVE SUMMARY & CONTEXT

**Malcon Nexus** is an active production ERP and surgical case workflow management system used by surgical coordinators, hospital technicians, store managers, and administrators to track orthopedic implants, instruments, hospital deliveries, surgeries, set returns, checking/audits, and inventory restocking.

The application was maintained and developed in VS Code / Antigravity and is now being handed over to **Cursor**. This document contains everything an AI or engineer in Cursor needs to know to understand the architecture, respect critical safety boundaries, and continue development without breaking production.

---

## 2. CRITICAL SAFETY RULES (PERMANENT)

1. **PRODUCTION DATABASE IS LIVE:**
   - Supabase project reference: `iaxkbiejmwnstckiggwg`
   - **Never** run `supabase db push`, destructive migrations, or schema wipes.
   - **Never** alter table schemas, drop columns, or modify RLS policies casually without explicit need.
   - **Never** alter `cases.stages` JSON structure or rename workflow stage strings.

2. **WORKFLOW STAGE CONTRACT:**
   The stage sequence is fixed and production-critical:
   ```
   Set Preparation → Delivery → Surgery → Pickup from Hospital → Checking & Audit → Restock → Completed
   ```
   *(Note: Legacy stages `Billing` and `Bill Submission` are disabled/skipped in favor of direct completion to `Completed` as defined in `isPostRestockStageDisabled`).*

3. **AUTHENTICATION & SECURITY:**
   - Admins use email/password.
   - Field employees & store managers authenticate via phone/Telegram OTP with linked employee records.
   - Role logic lives in `src/lib/roles.ts` and `src/lib/auth.ts`.
   - Store managers have full case management access under `cases_admin_all` RLS policy.

4. **DESIGN SYSTEM INTEGRITY:**
   - All styling tokens reside in:
     - `src/styles/tokens.css`
     - `src/styles/typography-tokens.css`
     - `src/styles/nexus-theme.css`
   - Reuse shared UI components (`src/components/ui/`) and existing CSS variables.
   - Do **not** create conflicting second design systems or introduce competing CSS frameworks.

5. **PRODUCTION DEPLOYMENT:**
   - Production is hosted on **Hostinger** (`app.malconnexus.com`), **not** Vercel.
   - Do not use Vercel for the live app (legacy Vercel URLs deploy a placeholder redirection notice via `build:vercel-legacy`).
   - Hostinger deployments are run via: `npm run deploy:hostinger`.

---

## 3. SYSTEM ARCHITECTURE

### Tech Stack
- **Frontend Framework:** React 19.2.6 with TypeScript 5.8.2
- **Bundler:** Vite 7.3.2 with `@tailwindcss/vite` 4.1.17
- **State Management:** Zustand 5.0.14 (`src/store/useStore.ts`)
- **Backend / Database:** Supabase PostgreSQL (`@supabase/supabase-js` 2.110.0)
- **UI & Animations:** Tailwind CSS, Framer Motion, Lucide Icons, `@tanstack/react-table`
- **Multi-App Builds:**
  - Main Application: `vite.config.ts` → `dist/index.html` (single-file bundle)
  - Photo Gallery: `vite.gallery.config.ts` → `dist/gallery.html`
  - TV Live Board: `vite.tv.config.ts` → `dist/tv.html`

### Key File Map
| Directory / File | Description |
| :--- | :--- |
| `src/App.tsx` | Main application shell, top-level layout, boot loader, global modal mounting |
| `src/store/useStore.ts` | Monolithic Zustand state store (~6,400 LOC) managing cases, employees, approvals, tasks, and sync |
| `src/lib/caseWorkflow.ts` | Case workflow state engine, next stage resolution, skip logic, FCFS rules |
| `src/lib/checkingPool.ts` | Dedicated helpers for Chandra Gajelli, Srivani Adire, and Ramakanth Perumandla |
| `src/lib/caseDuties.ts` | Post-surgery duties helpers (Return, Checking, Restock) |
| `src/lib/createCaseFromDraft.ts` | Case creation payload builder from UI drafts |
| `src/pages/EmployeeDashboard.tsx`| Field staff / store manager dashboard, active cases, task requests, FCFS cards |
| `src/pages/CaseDetail.tsx` | Individual case view, stage progress, approvals, photo uploads, modals |
| `src/pages/CaseDutiesPage.tsx` | Admin / coordinator table managing post-surgery duty assignments |
| `src/pages/Doctors.tsx` | Doctor master directory with codes, hospital affiliations, and stats |
| `src/lib/database/repositories/` | Repositories wrapping Supabase queries with local caching |

---

## 4. RECENT SESSIONS & IMPLEMENTATIONS

### A. Restock & Checking & Audit Pool (Commit `dad9438`)
- **Restock Auto-Assignment:**
  - Automatically assigned to **Chandra Gajelli** (`chandra.gajelli@malconnexus.com`, ID: `6589771b-07a6-4d20-b674-8e075f79dce3`).
  - Pre-populated on case creation (`QuickCreateCaseModal.tsx`, `createCaseFromDraft.ts`), stage advance (`buildAutoAdvanceFromSubmit`, `approveStage`, `forceAdvanceCase`), and post-surgery duty tables (`CaseDutiesPage.tsx`).
- **Checking & Audit FCFS Pool:**
  - Allotted specifically to **Srivani Adire** (`srivani.adire@malconnexus.com`, ID: `a2e860c9-c136-4c51-a826-7fde024bb1f3`) and **Ramakanth Perumandla** (`ramakanth.perumandla@malconnexus.com`, ID: `81f59008-ee3c-44aa-a6eb-702ca7de9db6`).
  - Unassigned Checking & Audit cases appear in an FCFS pool on their dashboard (`EmployeeDashboard.tsx`) with:
    - **Select & Submit:** Claims the case and immediately opens the submission modal for photos/notes.
    - **Select (Claim):** Claims the case via `claimCheckingCase` into their active cases list.
    - **View:** Opens the case detail page.
  - Submitting Checking & Audit immediately auto-advances the case to Restock with Chandra Gajelli pre-assigned.

### B. Doctors Page Redesign & Permissions (Commits `723443a`, `41cbaa0`)
- Doctors directory redesigned with modern cards/table, search, hospital filter, doctor codes, and drawer.
- Store managers granted insert/update permissions via Supabase RLS policy `doctors_store_manager_create` and `doctors_store_manager_update`.
- Client-side error handling surfaced to alert the user if creation fails.

### C. Boot Performance Optimization (Commit `3a4a91d`)
- App shell rendered immediately upon session recovery rather than blocking on the entire cases dataset download.
- Background sync loads cases in parallel while UI boots interactively.

---

## 5. REPOSITORY STATUS & COMMANDS

### Git Status
```bash
git status
# On branch main
# Your branch is up to date with 'origin/main'.
# nothing to commit, working tree clean
```

### Essential Commands
- **Local Dev:** `npm run dev`
- **Full Build Check:** `npm run build`
  *(Must pass all 3 configs: main, gallery, tv)*
- **Deploy to Hostinger:** `npm run deploy:hostinger`
  *(Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`)*
- **Database Doctor Code Sync:** `npm run db:doctor-code:sync`

---

## 6. INSTRUCTIONS FOR CURSOR

When taking over in Cursor:
1. **Always run `npm run build`** before and after making changes to verify TypeScript and multi-app bundling integrity.
2. **Follow `.cursor/rules/git-push-after-changes.mdc`**:
   - Make focused, why-focused commits on `main`.
   - Push to `origin/main`.
   - If deploying web changes, run `npm run deploy:hostinger`.
3. **Preserve Database Contracts**: Do not modify Supabase tables, migrations, or the `cases.stages` structure unless explicitly instructed by the user.
4. **Preserve Workflow Order**: Keep `Set Preparation` → `Delivery` → `Surgery` → `Pickup from Hospital` → `Checking & Audit` → `Restock` → `Completed`.
