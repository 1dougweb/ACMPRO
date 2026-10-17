-- Completa tabelas que já existiam antes das migrações comerciais atuais.
-- CREATE TABLE IF NOT EXISTS não adiciona colunas a tabelas preexistentes.

alter table public.acm360_subscriptions
  add column if not exists trial_ends_at timestamptz;

alter table public.acm360_members
  add column if not exists legal_accepted_at timestamptz,
  add column if not exists legal_terms_version text,
  add column if not exists legal_privacy_version text;
