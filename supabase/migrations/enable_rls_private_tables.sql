-- Enable Row Level Security on private application tables.
--
-- The public/admin browser code does not read Supabase tables directly; it
-- authenticates with Supabase Auth, then calls Cloudflare Pages Functions.
-- Those functions use the service-role key server-side and bypass RLS.
--
-- No anon/authenticated table policies are added here. Public-safe data should
-- continue to be exposed through narrowly scoped API functions.

DO $$
DECLARE
  table_name text;
  private_tables text[] := ARRAY[
    'attendance',
    'certificates',
    'companies',
    'courses',
    'enquiries',
    'enrolments',
    'invoices',
    'sessions',
    'students',
    'teachers'
  ];
BEGIN
  FOREACH table_name IN ARRAY private_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

