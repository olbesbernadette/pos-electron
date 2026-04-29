-- Add composite index for efficient transaction lookups
-- This index optimizes queries that filter by shift_id, branch_id, payment_type, and transaction_type
CREATE INDEX IF NOT EXISTS idx_shift_transactions_lookup 
ON shift_transactions(shift_id, branch_id, payment_type, transaction_type);

-- Add index for created_at ordering (used in ORDER BY)
CREATE INDEX IF NOT EXISTS idx_shift_transactions_created_at 
ON shift_transactions(created_at DESC);
