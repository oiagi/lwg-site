-- Fixes for the Supabase Security Advisor warnings reported on 2 Oct 2026:
--
--   0011 function_search_path_mutable                  public.get_next_course_code
--   0028 anon_security_definer_function_executable     public.rls_auto_enable()
--   0029 authenticated_security_definer_function_executable  (same function)
--   auth_leaked_password_protection                    Supabase Auth setting
--
-- Neither function is defined in this repo; both were created directly in
-- the Supabase SQL editor. The app does not call either one: every database
-- access goes through functions/api/* with the service key, and nothing in
-- the codebase hits /rest/v1/rpc/ any more.
--
-- The fourth warning is not SQL. Enable it in the dashboard:
--   Authentication -> Sign In / Providers -> Email
--   -> "Prevent use of leaked passwords" (HaveIBeenPwned check; may need the
--   Pro plan). See
--   https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
--
-- Run in the Supabase SQL editor, then rerun the linter under
-- Database -> Advisors -> Security Advisor.

-- 1. Lint 0011: get_next_course_code(prefix text, level_code text) has no
--    fixed search_path. It generated sequential course codes
--    (e.g. "LWG_A1_7") and was last called from confirm-booking.js before
--    course codes became random 5-digit numbers (generateCourseCode() in
--    functions/api/confirm-booking.js). Drop it rather than patch it.
--    No CASCADE on purpose: if anything in the database still depends on it,
--    this statement fails loudly instead of removing the dependent object.
--
--    Fallback, only if the DROP fails because of a dependency: keep the
--    function but pin its search_path (the body reads `courses` unqualified,
--    so it must stay on `public`):
--      alter function public.get_next_course_code(text, text)
--        set search_path = public, pg_temp;
drop function if exists public.get_next_course_code(text, text);

-- 2. Lints 0028 / 0029: rls_auto_enable() is SECURITY DEFINER, so it runs
--    with its owner's privileges. It only has to fire inside the database
--    (it enables row level security on newly created tables) and must never
--    be reachable through PostgREST as /rest/v1/rpc/rls_auto_enable.
--    Postgres grants EXECUTE on new functions to PUBLIC, and anon /
--    authenticated inherit that grant, so all three have to be revoked.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

notify pgrst, 'reload schema';
