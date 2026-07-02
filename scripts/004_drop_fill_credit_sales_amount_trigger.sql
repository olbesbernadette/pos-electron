-- credit_details no longer has a transaction_id column (credit sales are
-- recorded directly with sales_amount from the payment form), so this
-- trigger's "fill sales_amount from shift_transactions" fallback is dead
-- code. Worse, it fires whenever sales_amount = 0 and crashes trying to
-- reference the nonexistent new.transaction_id, blocking legitimate 0
-- sales_amount values.
DROP TRIGGER IF EXISTS trg_fill_credit_sales_amount ON public.credit_details;
DROP FUNCTION IF EXISTS public.fill_credit_sales_amount();
