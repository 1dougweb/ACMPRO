alter table public.acm360_members
  add column if not exists legal_accepted_at timestamptz,
  add column if not exists legal_terms_version text,
  add column if not exists legal_privacy_version text;

create or replace function public.acm360_record_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  terms_version text;
  privacy_version text;
  accepted_at timestamptz;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  terms_version := nullif(new.raw_user_meta_data ->> 'legal_terms_version', '');
  privacy_version := nullif(new.raw_user_meta_data ->> 'legal_privacy_version', '');
  if terms_version is null or privacy_version is null then
    return new;
  end if;

  begin
    accepted_at := nullif(new.raw_user_meta_data ->> 'legal_accepted_at', '')::timestamptz;
  exception when others then
    accepted_at := null;
  end;

  update public.acm360_members
     set legal_accepted_at = coalesce(accepted_at, now()),
         legal_terms_version = terms_version,
         legal_privacy_version = privacy_version
   where user_id = new.id;

  return new;
end;
$$;

revoke all on function public.acm360_record_legal_acceptance() from public, anon, authenticated;

drop trigger if exists acm360_record_legal_acceptance on auth.users;
create trigger acm360_record_legal_acceptance
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.acm360_record_legal_acceptance();
