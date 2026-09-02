-- Align h_pay/s_pay multipliers with DOLE holiday pay rules:
-- Regular holiday (h_pay) = 200% of the regular hourly rate.
-- Special (non-working) holiday (s_pay) = 130% of the regular hourly rate.
-- Generated column expressions can't be altered in place, so drop and recreate them.
ALTER TABLE public.employees DROP COLUMN h_pay;
ALTER TABLE public.employees ADD COLUMN h_pay NUMERIC(12, 2) GENERATED ALWAYS AS (r_pay * 2) STORED;

ALTER TABLE public.employees DROP COLUMN s_pay;
ALTER TABLE public.employees ADD COLUMN s_pay NUMERIC(12, 2) GENERATED ALWAYS AS (r_pay * 1.3) STORED;
