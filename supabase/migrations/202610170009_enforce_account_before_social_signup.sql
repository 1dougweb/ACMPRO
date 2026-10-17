-- Enforce that only users who have already registered (or were invited) can log in via Google/Social OAuth.
-- If an unauthorized new user attempts to sign up via OAuth without an existing account or invitation,
-- the trigger rejects the insert, avoiding phantom users.

create or replace function public.check_user_registration_source()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
begin
  if (new.raw_app_meta_data ->> 'provider') = 'google' or (new.raw_app_meta_data -> 'providers') ? 'google' then
    if not exists (
      select 1 from public.license_members
      where lower(email) = lower(new.email)
    ) then
      raise exception 'Apenas usuários que já criaram uma conta podem acessar com o Google. Por favor, cadastre-se primeiro.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_account_before_social_signup on auth.users;
create trigger enforce_account_before_social_signup
  before insert on auth.users
  for each row
  execute function public.check_user_registration_source();
