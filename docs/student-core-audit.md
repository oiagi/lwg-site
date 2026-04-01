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

## Follow-up validation: claims E–H

### E) `active` is still the student status model — **accurate**
- `get-students` still reads query param `active` and applies `active=eq.true|false` filters.
- The selected columns still include `active`.
- `save-student` still whitelists `active` and defaults new rows to `active=true`.

### F) `confirm-booking` dedupe behavior is email-only — **accurate**
- `findOrCreateStudent` only checks existing students by exact email match.
- If participant email is missing/falsy, lookup is skipped and a new student row is inserted.
- Enrolment dedupe (`Prefer: resolution=ignore-duplicates`) only affects `enrolments` inserts, not student creation.

### G) Partial-failure behavior is non-atomic — **accurate, with an extra severity gap**
- In `confirm-booking`, course creation failure returns an error, but session sync, student/enrolment linking, and enquiry patch failures are all swallowed (log-only) and the endpoint still returns success.
- In `create-invoice`, invoice insert failure hard-fails, but invoice-line insert failure only logs and still returns `200` with persisted invoice and empty `lines`.
- **Additional gap:** session inserts in `confirm-booking` are not checked for `res.ok`; even per-session DB write failures can pass silently inside the sync loop.

### H) Enquiry/student linkage claim is understated — **partially accurate**
- Correct: multiple participants can map to multiple students through per-participant enrolment creation.
- More important gap: `enquiries` currently has no `student_id` linkage at all; the current flow writes denormalized lead fields on enquiry creation and later patches only `status` and `course_id`.

## Additional gaps (beyond E–H wording)

- **`findOrCreateStudent` no `res.ok` on email lookup — severity understated**: The description "ambiguous runtime failures" is wrong. Supabase errors return a JSON object, not an array. `existing.length` resolves to `undefined` (falsy), causing silent fallthrough to student INSERT. A DB error during lookup deterministically produces a **duplicate student row**, not just an ambiguous failure.
- Student dedupe is case/normalization fragile (`email=eq.<raw encoded input>`), with no canonicalization step (`trim/lowercase`) before lookup.
- No transactional boundary exists between calendar creation and DB writes in `confirm-booking`. The gap is one-directional: calendar event creation failure is caught and returned as an error; but if the calendar event is created successfully and any subsequent DB write fails, the calendar event persists with no linked course record.
- **`create-invoice` — five unchecked fetches**: Lines fetching company, student, sessions, courses, and existing invoice numbers all call `.json()` without checking `res.ok` first. A Supabase 5xx on any of these either throws (outer catch returns "Connection error", masking the real error) or parses an error object causing misleading 404 responses downstream. None of these are mentioned in claims E–H.
- **`create-invoice` — invoice number TOCTOU race**: `nextInvoiceNumber()` reads existing invoice numbers and computes the next value in application code. Two concurrent requests will read identical state and generate the same invoice number. There is no DB-level sequence or uniqueness enforcement visible in this endpoint.
- **`create-invoice` — no double-invoicing guard**: `session_ids` are not validated against existing `invoice_lines` rows. The same session can be invoiced multiple times with no error.
