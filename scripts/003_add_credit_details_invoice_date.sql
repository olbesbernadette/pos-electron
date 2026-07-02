-- Add invoice_date to credit_details, defaulting to the day the row is created
ALTER TABLE public.credit_details
  ADD COLUMN IF NOT EXISTS invoice_date DATE NOT NULL DEFAULT CURRENT_DATE;
