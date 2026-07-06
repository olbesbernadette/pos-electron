-- Add branch_id to employees to identify which branch each employee belongs to.
-- Matches the branch id mapping used across the app's [branch] pages:
-- 1=Hardware, 2=Pawa Gas, 3=Matnog Gas, 4=Gotis Hotel, 5=Rental, 6=Boarders.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS branch_id INTEGER CHECK (branch_id BETWEEN 1 AND 6);

CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON public.employees(branch_id);
