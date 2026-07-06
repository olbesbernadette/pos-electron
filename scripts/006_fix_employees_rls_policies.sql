-- Recreate employees RLS policies using Supabase's recommended role-targeted
-- pattern (TO authenticated) instead of checking auth.role() in the USING/CHECK
-- expression. Functionally equivalent, but more robust against edge cases.
DROP POLICY IF EXISTS "employees_select_authenticated" ON public.employees;
DROP POLICY IF EXISTS "employees_insert_authenticated" ON public.employees;
DROP POLICY IF EXISTS "employees_update_authenticated" ON public.employees;
DROP POLICY IF EXISTS "employees_delete_authenticated" ON public.employees;

CREATE POLICY "employees_select_authenticated" ON public.employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "employees_insert_authenticated" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "employees_update_authenticated" ON public.employees
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "employees_delete_authenticated" ON public.employees
  FOR DELETE TO authenticated USING (true);
