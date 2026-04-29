-- Update the create_deposit function to include shift_id and branch_id
CREATE OR REPLACE FUNCTION public.create_deposit(
  p_transaction_ids INTEGER[],
  p_deposit_date DATE,
  p_deposit_type INTEGER,
  p_total_amount NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_shift_id INTEGER DEFAULT NULL,
  p_branch_id INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit_id INTEGER;
BEGIN
  -- Insert the deposit record with shift_id and branch_id
  INSERT INTO deposits (
    deposit_date,
    deposit_type,
    total_amount,
    notes,
    created_by,
    shift_id,
    branch_id
  ) VALUES (
    p_deposit_date,
    p_deposit_type,
    p_total_amount,
    p_notes,
    p_created_by,
    p_shift_id,
    p_branch_id
  )
  RETURNING id INTO v_deposit_id;

  -- Update the transactions to link them to this deposit
  UPDATE shift_transactions
  SET deposit_id = v_deposit_id
  WHERE id = ANY(p_transaction_ids);

  RETURN v_deposit_id;
END;
$$;
