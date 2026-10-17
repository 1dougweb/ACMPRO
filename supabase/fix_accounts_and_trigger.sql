-- 1. Copy any accounts from acm360_accounts to license_accounts that aren't there yet
insert into public.license_accounts (id, owner_user_id, name, created_at, updated_at)
select a.id, a.owner_user_id, a.name, a.created_at, a.updated_at
from public.acm360_accounts a
where not exists (select 1 from public.license_accounts l where l.id = a.id)
on conflict (id) do nothing;

-- 2. Copy any members from acm360_members to license_members that aren't there yet
insert into public.license_members (id, account_id, user_id, email, display_name, role, status, joined_at, created_at)
select m.id, m.account_id, m.user_id, lower(m.email), m.display_name, m.role, m.status, m.joined_at, m.created_at
from public.acm360_members m
where not exists (select 1 from public.license_members l where l.id = m.id)
on conflict (id) do nothing;

-- 3. Update acm360_attach_confirmed_user trigger function to use license_accounts and license_members!
create or replace function public.acm360_attach_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  target_account_id uuid;
  target_member_id uuid;
  invitation_id_text text;
  has_invitation_metadata boolean := false;
  target_display_name text;
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  invitation_id_text := nullif(new.raw_user_meta_data ->> 'license_member_invitation_id', '');
  has_invitation_metadata := invitation_id_text is not null;
  if invitation_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select m.id, m.account_id
      into target_member_id, target_account_id
      from public.license_members m
     where m.id = invitation_id_text::uuid
       and lower(m.email) = lower(new.email)
       and m.status = 'invited'
     for update;
  end if;

  if target_member_id is null and not has_invitation_metadata then
    select m.id, m.account_id
      into target_member_id, target_account_id
      from public.license_members m
     where lower(m.email) = lower(new.email)
       and m.status = 'invited'
     order by m.created_at, m.id
     limit 1
     for update;
  end if;

  if target_member_id is null and has_invitation_metadata then
    return new;
  end if;

  if target_member_id is not null then
    if exists (
      select 1
        from public.license_members m
       where m.user_id = new.id
         and m.status = 'active'
    ) then
      update public.license_members as m
         set status = 'removed'
       where lower(m.email) = lower(new.email)
         and m.status = 'invited';
      return new;
    end if;

    target_display_name := coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    );

    update public.license_members as m
       set user_id = new.id,
           status = 'active',
           display_name = coalesce(target_display_name, m.display_name),
           joined_at = now()
     where m.id = target_member_id
       and m.status = 'invited';

    update public.license_members as m
       set status = 'removed'
     where lower(m.email) = lower(new.email)
       and m.status = 'invited'
       and m.id <> target_member_id;

    return new;
  end if;

  if exists (
    select 1
      from public.license_members m
     where m.user_id = new.id
       and m.status = 'active'
  ) then
    return new;
  end if;

  if exists (
    select 1
      from public.license_accounts a
     where a.owner_user_id = new.id
  ) then
    return new;
  end if;

  target_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.license_accounts (owner_user_id, name)
  values (new.id, target_display_name)
  returning id into target_account_id;

  insert into public.license_members (account_id, user_id, email, display_name, role, status, joined_at)
  values (target_account_id, new.id, lower(new.email), target_display_name, 'owner', 'active', now());

  return new;
end;
$$;
