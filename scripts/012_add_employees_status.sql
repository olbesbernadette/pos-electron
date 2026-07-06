-- Add status to employees so they can be deactivated instead of deleted
-- (deleting would cascade-remove their attendance/payroll history).
-- 1 = Active, 2 = Inactive.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (1, 2));
