# Student-Core Restructure Audit (April 1, 2026)

## Verdict

The direction is solid, but the implementation plan is **under-scoped** and would break existing flows if executed exactly as written.

## What the current code already does

- `confirm-booking` already has student dedupe/create logic (`findOrCreateStudent`) and enrolment creation for each participant, so extracting `_student-utils.js` is a good refactor target.
- Billing already supports student invoices (`invoices.student_id`) and company invoices (`invoices.company_id`), but there is no multi-student linkage for a company invoice.

## Validation of each claimed API change

### 1) `_student-utils.js` (new)

- **Valid** as a refactor target.
- Gap: only `confirm-booking` currently has this helper, so extraction alone does not satisfy prospect creation in `submit-enquiry` until that file adopts it.

### 2) `submit-enquiry.js`

- **Currently not implemented**: no student is created and `enquiries.student_id` is not set.
- Gap: needs robust matching rules (email-first, fallback handling for missing email, duplicate prevention).

### 3) `confirm-booking.js`

- **Partially aligned**: already creates/links students through enrolments.
- Gaps:
  - does not set `enquiries.student_id`.
  - does not update `students.status` (because code still uses legacy `active` boolean model elsewhere).
  - for multi-participant enquiries, plan should define which participant becomes `enquiries.student_id`.

### 4) `save-student.js`

- **Not aligned**: payload whitelist still accepts `active`, not `status`.

### 5) `get-students.js`

- **Not aligned**: filter is `?active=true|false|all`, response includes `active` field.
- Gap: no enquiry/invoice counters yet.

### 6) `get-student-detail.js`

- **Not aligned**: returns student + courses + company name only.
- Gap: no linked enquiries, no invoices, no attendance summary.

### 7) `update-enquiry.js`

- **Not aligned**: supports only `status` and `notes` updates.
- Gap: must add optional `student_id` patch path.

### 8) `get-enquiries.js`

- **Not aligned**: returns raw enquiry rows only.
- Gap: no student join/display info.

### 9) `create-invoice.js`

- **Not aligned** for the new join table idea.
- Gap: does not write `invoice_students`; only writes `invoices` + `invoice_lines`.
- Additional gap: for company invoices, student roster must be derived from session→course→enrolments explicitly.

### 10) `get-invoice-detail.js`

- **Not aligned**: returns single billed entity (`company` or `student`), no linked student list.

## Critical scope gaps not listed in the 10-file plan

### A) `students.active` removal impacts more than listed files

If you drop `students.active`, these existing endpoints/UI paths will break unless updated:

- `functions/api/submit-intake.js` (creates new students with `active = true`).
- `functions/api/get-company-detail.js` (selects and filters by `active`).
- `functions/api/get-companies.js` (counts `active` students).
- `admin/students.js` (filters, edit modal, payload submission all use `active`).
- `admin/billing.js` (student picker calls `/api/get-students?active=true`).
- Student modal markup/styles will also need to replace active checkbox semantics with status control.

### B) “Untouched (31 files)” is inaccurate

At minimum, the files above are coupled to the `active` field and need changes for a safe migration.

### C) Data migration and integrity details missing

- Add backfill logic for `enquiries.student_id` (existing rows).
- Add indexes likely needed for performance:
  - `enquiries(student_id)`
  - `students(status)`
  - `invoice_students(student_id)`
- Decide FK delete behavior for `enquiries.student_id` (`SET NULL` may be safer than default `NO ACTION`).
- Consider `ON DELETE CASCADE` for `invoice_students.student_id` too (or justify alternative).

### D) API contract changes require frontend updates

- Student filters and forms in admin must move from boolean `active` to enum `status`.
- Enquiry cards likely need student-link UI (manual link/unlink).
- Invoice detail UI should render linked students list.

## Recommended revised rollout order

1. **DB-safe phase**: add `students.status` and `enquiries.student_id`, create `invoice_students`, add indexes, keep `active` temporarily.
2. **Dual-read/write phase**: APIs write `status` + `active` (compat) and read `status` with fallback.
3. **Frontend update phase**: admin students/enquiries/billing updated to new contracts.
4. **Backfill + validation**: script existing enquiries and invoices into new links.
5. **Cleanup phase**: remove `active` column and compatibility branches only after usage checks pass.

## Bottom line

- The architecture objective is correct.
- The 10-file backend plan is a good core, but **not sufficient** for a non-breaking rollout.
- The largest hidden risk is the `students.active` removal ripple into intake/company/billing/student admin paths.
