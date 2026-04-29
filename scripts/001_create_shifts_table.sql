-- Create shifts table to track user work sessions
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "shifts_select_own" ON public.shifts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "shifts_insert_own" ON public.shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shifts_update_own" ON public.shifts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "shifts_delete_own" ON public.shifts FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_ended_at ON public.shifts(ended_at);
