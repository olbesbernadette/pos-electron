-- Add employee_type column to distinguish "Boy" or "Girl" employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_type TEXT CHECK (employee_type IN ('Boy', 'Girl'));
