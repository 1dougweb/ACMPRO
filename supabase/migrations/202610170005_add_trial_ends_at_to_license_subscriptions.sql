-- The production project has the final license_* schema but no migration history.
-- Keep account-summary compatible with the subscription fields it reads.
alter table public.license_subscriptions
  add column if not exists trial_ends_at timestamptz;
