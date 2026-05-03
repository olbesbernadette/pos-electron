DROP FUNCTION IF EXISTS public.get_check_transactions(INTEGER, DATE);
DROP FUNCTION IF EXISTS public.get_check_transactions(SMALLINT, DATE);

CREATE OR REPLACE FUNCTION public.get_check_transactions(
  p_branch_id INTEGER DEFAULT NULL,
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  transaction_date DATE,
  branch_id INTEGER,
  branch_name TEXT,
  transaction_id INTEGER,
  shift_id INTEGER,
  bank_name TEXT,
  check_number TEXT,
  check_date TEXT,
  amount NUMERIC,
  transaction_status SMALLINT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    st.id,
    st.created_at::date AS transaction_date,
    st.branch_id,
    CASE st.branch_id
      WHEN 1 THEN 'Hardware'
      WHEN 2 THEN 'Pawa Gas'
      WHEN 3 THEN 'Matnog Gas'
      WHEN 4 THEN 'Gotis Hotel'
      WHEN 5 THEN 'Rental'
      WHEN 6 THEN 'Boarders'
      ELSE 'Unknown'
    END                 AS branch_name,
    st.id               AS transaction_id,
    st.shift_id,
    st.details1         AS bank_name,
    st.details2         AS check_number,
    st.details3         AS check_date,
    st.amount,
    st.status           AS transaction_status,
    st.created_at
  FROM shift_transactions st
  WHERE
    st.payment_type     = 3
    AND st.transaction_type = 1
    AND (p_branch_id IS NULL OR st.branch_id = p_branch_id)
    AND (p_date      IS NULL OR st.created_at::date = p_date)
  ORDER BY st.created_at DESC;
$$;
