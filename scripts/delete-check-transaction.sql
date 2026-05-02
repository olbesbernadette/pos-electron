-- Delete Check Transaction RPC
-- Deletes a check shift_transaction and deducts its amount from shift_totals atomically.
-- Run this in your Supabase SQL Editor.

CREATE OR REPLACE FUNCTION delete_check_transaction(p_transaction_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_txn RECORD;
BEGIN
  -- Lock and fetch the transaction
  SELECT shift_id, branch_id, transaction_type, payment_type, amount, status
  INTO v_txn
  FROM shift_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_txn.status = 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete a deposited transaction');
  END IF;

  -- Delete associated check_details
  DELETE FROM check_details WHERE transaction_id = p_transaction_id;

  -- Delete the transaction
  DELETE FROM shift_transactions WHERE id = p_transaction_id;

  -- Deduct from shift_totals (only if the row exists — shift may still be open)
  UPDATE shift_totals
  SET total_amount = total_amount - v_txn.amount,
      updated_at   = now()
  WHERE shift_id         = v_txn.shift_id
    AND branch_id        = v_txn.branch_id
    AND transaction_type = v_txn.transaction_type
    AND payment_type     = v_txn.payment_type;

  RETURN jsonb_build_object('success', true, 'message', 'Transaction deleted successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION delete_check_transaction(bigint) TO authenticated;
