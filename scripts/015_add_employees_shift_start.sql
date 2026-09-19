-- Give each employee their own default shift start time, instead of the
-- app hardcoding 7:30am for every new attendance entry.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS shift_start TIME WITHOUT TIME ZONE NOT NULL DEFAULT '07:30:00';
