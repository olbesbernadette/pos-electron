-- Close Shift Database Functions
-- Run this script in your Supabase SQL Editor

-- 1. Create shift_totals table if not exists
CREATE TABLE IF NOT EXISTS public.shift_totals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shift_id bigint NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  branch_id smallint NOT NULL,
  transaction_type smallint NOT NULL,
  payment_type smallint NOT NULL,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_payment numeric(12, 2) NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(shift_id, branch_id, transaction_type, payment_type)
);

CREATE INDEX IF NOT EXISTS idx_shift_totals_shift_id ON public.shift_totals(shift_id);

-- 2. Function to fetch shift totals summary (for the confirmation dialog)
CREATE OR REPLACE FUNCTION fetch_shift_totals_summary(p_shift_id bigint)
RETURNS TABLE (
  branch_id smallint,
  transaction_type smallint,
  payment_type smallint,
  total_amount numeric,
  total_payment numeric,
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.branch_id,
    st.transaction_type,
    st.payment_type,
    COALESCE(SUM(st.amount), 0)::numeric AS total_amount,
    COALESCE(SUM(st.payment_amount), 0)::numeric AS total_payment,
    COUNT(*)::bigint AS transaction_count
  FROM shift_transactions st
  WHERE st.shift_id = p_shift_id
  GROUP BY st.branch_id, st.transaction_type, st.payment_type
  ORDER BY st.branch_id, st.transaction_type, st.payment_type;
END;
$$;

-- 3. Function to close shift with totals computation
CREATE OR REPLACE FUNCTION close_shift(p_shift_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shift_status smallint;
  v_rows_inserted integer;
BEGIN
  -- Check if shift exists and get its current status
  SELECT status INTO v_shift_status
  FROM shifts
  WHERE id = p_shift_id
  FOR UPDATE; -- Lock the row to prevent race conditions

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift not found');
  END IF;

  IF v_shift_status = 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift has already been closed');
  END IF;

  -- Insert aggregated totals into shift_totals
  INSERT INTO shift_totals (shift_id, branch_id, transaction_type, payment_type, total_amount, total_payment, transaction_count)
  SELECT 
    p_shift_id,
    st.branch_id,
    st.transaction_type,
    st.payment_type,
    COALESCE(SUM(st.amount), 0),
    COALESCE(SUM(st.payment_amount), 0),
    COUNT(*)::integer
  FROM shift_transactions st
  WHERE st.shift_id = p_shift_id
  GROUP BY st.branch_id, st.transaction_type, st.payment_type
  ON CONFLICT (shift_id, branch_id, transaction_type, payment_type) 
  DO UPDATE SET 
    total_amount = EXCLUDED.total_amount,
    total_payment = EXCLUDED.total_payment,
    transaction_count = EXCLUDED.transaction_count;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  -- Mark the shift as closed
  UPDATE shifts
  SET 
    status = 2,
    end_time = now()
  WHERE id = p_shift_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Shift closed successfully',
    'totals_recorded', v_rows_inserted
  );
END;
$$;

-- 4. Grant execute permissions (adjust as needed for your RLS policies)
GRANT EXECUTE ON FUNCTION fetch_shift_totals_summary(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION close_shift(bigint) TO authenticated;
