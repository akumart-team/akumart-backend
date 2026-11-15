-- Preserve existing integer points while allowing fractional hardware rewards.
-- Existing defaults and CHECK constraints remain in place.
ALTER TABLE public.points_wallets
  ALTER COLUMN balance TYPE DECIMAL(18, 6) USING balance::DECIMAL(18, 6);

ALTER TABLE public.points_ledger_entries
  ALTER COLUMN amount TYPE DECIMAL(18, 6) USING amount::DECIMAL(18, 6);

ALTER TABLE public.deposits
  ALTER COLUMN awarded_points TYPE DECIMAL(18, 6) USING awarded_points::DECIMAL(18, 6);
