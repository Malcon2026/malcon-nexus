# Malcon Nexus — Agent Handoff

> Shared working memory for Claude Code, OpenCode and any other AI coding agent.
> Keep this file short and current. Record facts, not plans you did not carry out.

## Current Agent

- Last writer: Claude (documentation audit, 2026-10-26).

## Current Task

- None in progress. The documentation set (`PRD.md`, `TRD.md`, `APP_FLOW.md`, this file) was created from a read-only audit of the repository and the live database.

## Current Objective

- Keep the documentation accurate as the code changes.
- Close the high-priority security gaps listed below, after the owner confirms the plan.

## Status

- Production app: live at `app.malconnexus.com` (Hostinger static build, deployed 2026-10-26).
- Production data: cleared on 2026-10-26 at the owner's request (all cases, case alerts, case notifications, and stage photos in Supabase). Employees (46) and hospitals (93) kept. Activity log (14 rows) kept.
- Stage photos: new uploads go to Google Drive. Verified with a test upload.
- Daily report: nightly at 23:59 IST via `pg_cron` → `daily-report` edge function → Apps Script → Drive CSV. Verified manually with zero cases.

## Completed

- Case form: five steps (date and case name; hospital and doctor; details; team; review). Keyboard selection in hospital and doctor pickers.
- Submit-stage sheet redesign and iPhone zoom fix (16px form controls on phones).
- Drive photo path: `Year / Month / Date / Case / Stage / file.jpg`.
- Nightly CSV report with case and team details, stored privately in the date folder.
- Removed Convex, Cloudflare Worker (D1/R2) and AWS backends from the repository (2026-10-25).

## In Progress

- Nothing.

## Next Steps

1. Owner decides on the security items below (High first).
2. Migrate remaining old Supabase photos to Drive, with a dry run and a count before any delete (not started).
3. Delete the test folder `Malcon Nexus Photos / 2026 / 10-October / 26-October-2026 / MLS-TEST-001 Test case` and the test CSV, if still present (owner action).
4. Add `daily-report` to `supabase/config.toml`.
5. Remove dead dependencies and scripts (see below).

## Files Changed (recent, this series of work)

- `src/components/QuickCreateCaseModal.tsx`, `src/components/case-create/*` (case form)
- `src/components/SubmitStageModal.tsx`, `src/components/StagePhotoCapture.tsx`, `src/components/ui/Modal.tsx` (submit sheet)
- `src/styles/nexus-theme.css` (safe-area classes, phone font size)
- `src/lib/stagePhotos.ts` (Drive upload path)
- `supabase/functions/upload-stage-photo/index.ts` (case and stage folders)
- `supabase/functions/daily-report/index.ts` (new)
- `apps-script/stage-photos/Code.gs`, `appsscript.json` (Drive uploader and report)
- `docs/PRD.md`, `docs/TRD.md`, `docs/APP_FLOW.md`, `docs/AGENT_HANDOFF.md` (this set)

## Important Decisions

- Photos are stored in Google Drive through an Apps Script web app, not in Supabase Storage, because Supabase free-plan egress and storage are limited.
- Drive access uses the `drive.file` scope through the Drive advanced service. The full Drive scope is restricted for an unverified app.
- Daily CSV is private. Stage photos are shared "anyone with the link" (owner accepted this risk).
- The case name is stored in the existing `implant_required` field (no new column).
- Live Supabase project is the reference for schema and policies. Migration files are not a complete history.

## Known Issues

- Storage policy: any signed-in user can update or delete objects in `stage-photos`.
- Storage: `attendance-selfies` and `petrol-receipts` buckets are public. Anyone with a link can read them, and `petrol-receipts` can be read without signing in.
- A `VITE_` variable (`VITE_FORCE_ADVANCE_PASSWORD`) is compiled into the public browser bundle. Name only is recorded here; never copy its value into docs or chat.
- Super-admin emails are defined in two places: the `is_super_admin()` database function and `VITE_SUPER_ADMIN_EMAILS`.
- `package.json` still lists `convex` and `pg`, and scripts for Convex, AWS, Cloudflare and D1 that point to deleted code.
- `src/lib/cloudflareConfig.ts` and related `VITE_USE_*` flags remain as dormant branches.
- `malcon_tms_*` tables exist in the live database and are not used by the app.
- No automated tests and no lint gate. `tsc --noEmit` reports existing errors.
- `supabase/.temp/` is created by `supabase link`. Keep it out of commits.

## Tests Run

- Manual API checks, 2026-10-26: Apps Script upload test returned a file ID; daily report test returned `ok` for 2026-10-26 with 0 cases; endpoint without login returns 401.
- Read-only database checks: table list, RLS status, policies, storage buckets and policies, functions.
- No automated test suite exists.

## Build Status

- `npm run build`: passes (three bundles: app, gallery, TV).
- `tsc --noEmit`: existing errors in several files (not introduced by recent work). Recent changed files show no new errors.
- Last deploy: `npm run deploy:hostinger:supabase`, "Request accepted", site returns HTTP 200.

## Security Concerns

- High: S1 (storage update and delete for any signed-in user), S2 and S3 (public petrol and selfie buckets), S4 (password in client env).
- Medium: two super-admin lists (S5), Drive links shareable (S6), no security tests in CI (S9).
- See `docs/TRD.md` §24 for the full list with evidence.

## Blockers

- Owner decisions needed before changing storage policies or removing the client password variable.

## Notes for Next Agent

- Check the live database before assuming a policy or table; use read-only queries.
- Do not print or copy secret values from `.env`, Supabase secrets or Apps Script properties.
- Do not delete production data without a backup and an explicit, specific confirmation from the owner.
- Apps Script changes need a new deployment version and must be pasted by the owner (no automated deploy).
- Hostinger uploads can fail with a server error; retry once.
- The owner works mainly from a phone and tests by hand. Give short, numbered steps.

## Last Updated

- 2026-10-26, by Claude (documentation audit).

---

> Any AI agent starting work on Malcon Nexus must read this file before making changes.
