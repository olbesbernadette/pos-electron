-- Create attendance table to track daily employee time in/out
CREATE TABLE IF NOT EXISTS public.attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  day TEXT GENERATED ALWAYS AS (
    (ARRAY['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])[extract(dow from attendance_date)::int + 1]
  ) STORED,
  day_type TEXT NOT NULL DEFAULT 'R' CHECK (day_type IN ('R', 'S', 'H')),
  time_in TIME,
  time_out TIME,
  break_duration INTERVAL NOT NULL DEFAULT '0',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, attendance_date)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create policies (authenticated users can manage attendance records)
CREATE POLICY "attendance_select_authenticated" ON public.attendance
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "attendance_insert_authenticated" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "attendance_update_authenticated" ON public.attendance
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "attendance_delete_authenticated" ON public.attendance
  FOR DELETE TO authenticated USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_attendance_date ON public.attendance(attendance_date);
