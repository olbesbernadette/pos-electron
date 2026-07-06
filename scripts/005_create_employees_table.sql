-- Create employees table to track payroll figures per employee
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  r_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  h_pay NUMERIC(12, 2) GENERATED ALWAYS AS (r_pay * 1.3) STORED,
  s_pay NUMERIC(12, 2) GENERATED ALWAYS AS (r_pay * 1.25) STORED,
  incentives NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sss NUMERIC(12, 2) NOT NULL DEFAULT 0,
  phic NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pgbg NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create policies (authenticated users can manage employee records)
CREATE POLICY "employees_select_authenticated" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert_authenticated" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "employees_update_authenticated" ON public.employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "employees_delete_authenticated" ON public.employees FOR DELETE TO authenticated USING (true);

-- Create index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_employees_employee_name ON public.employees(employee_name);
