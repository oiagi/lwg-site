# Supabase Audit

Date: 2026-05-10

Scope: repository-level review of Supabase usage across Cloudflare Pages Functions, public/admin browser code, environment handling, and local SQL migrations. This does not include a live Supabase dashboard inspection.

## Content

- Public course data is intentionally narrow. `/api/public-courses` only returns public-safe course fields and derives display data from explicitly enabled active group courses.
- Student-facing token links expose personal intake/session data. That is expected by the current product flow, but these links should be treated as credentials in all copy, email previews, logs, and support workflows.
- Course venue content is partly public. `location_text` may include classroom company/street/postcode/city for public booking courses. Confirm that each public-booking course is allowed to show that address before enabling `public_booking_enabled`.
- The admin API returns broad student/enquiry details only after Supabase Auth plus the `ADMIN_EMAILS` allowlist. Treat entries in that allowlist as full administrators.

## Security

- The service-role key is used only server-side in the reviewed code. The browser receives only `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `/api/config`.
- A migration now enables Row Level Security on private application tables without adding anon/authenticated table policies. After applying it, confirm in the Supabase dashboard that no broad public policies already exist on sensitive tables.
- Admin authorization now checks `ADMIN_EMAILS` after validating the Supabase Auth token. Keep this env var set in every deployed environment before publishing this branch.
- Token links use UUID-style bearer tokens with a 90-day age check. Intake links now use dedicated intake tokens, and intake submission rotates that token after saving without invalidating the student sessions portal token.
- Public POST endpoints have origin validation and rate limiting. Note that origin checks are CSRF protection, not abuse protection; direct scripts can still submit requests with allowed-looking traffic patterns.
- Security headers are present, and inline page scripts have been moved out so CSP no longer needs `'unsafe-inline'` for scripts. Inline styles are still allowed for now because the static/admin UI still uses some inline style attributes and generated preview markup.

## Cleanliness

- Admin-only Supabase reads now use explicit field lists instead of `select=*`, reducing accidental exposure when new sensitive columns are added.
- SQL migrations are idempotent and commented. The repo now includes a private-table RLS migration; future DB changes should continue to document whether a table is private or intentionally public.
- Some field naming is transitional (`course_type` vs historical `service`, `gender` values that appear to support both legacy and newer formats). This is manageable but worth normalizing before the next schema expansion.
- Secrets are ignored by git via `.gitignore`, and `.dev.vars.example` contains placeholders only.

## Changes Made In This Branch

- Removed a concrete Supabase project URL from an API comment.
- URL-encoded the token lookup in `/api/student-sessions`.
- Escaped user-submitted values in the intake completion notification email.
- Added an `ADMIN_EMAILS` allowlist to admin API authentication.
- Added dedicated intake tokens and rotate them after successful intake submission.
- Added an RLS migration for private application tables.
- Replaced broad Supabase `select=*` API reads with explicit field lists.
- Moved inline page scripts into external files and tightened the script CSP.
