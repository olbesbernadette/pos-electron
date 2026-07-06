-- Create payroll_records table to store one submitted payroll summary per
-- employee per pay period (basic/OT/allowance subtotals, deductions, bonus,
-- and net pay), computed from the attendance table by the Payroll tab.
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id SMALLINT NOT NULL REFERENCES public.branches(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ot_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vale NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sss NUMERIC(12, 2) NOT NULL DEFAULT 0,
  phic NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pgbg NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Create policies (authenticated users can manage payroll records)
CREATE POLICY "payroll_records_select_authenticated" ON public.payroll_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "payroll_records_insert_authenticated" ON public.payroll_records
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "payroll_records_update_authenticated" ON public.payroll_records
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "payroll_records_delete_authenticated" ON public.payroll_records
  FOR DELETE TO authenticated USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON public.payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_branch_id ON public.payroll_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON public.payroll_records(period_start, period_end);
