-- Add scheduled shift start time to attendance, separate from the actual
-- clock-in (time_in), so lateness can later be computed as time_in - shift_start.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS shift_start TIME WITHOUT TIME ZONE NULL;
