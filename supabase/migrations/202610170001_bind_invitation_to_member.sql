-- Associates the confirmed Supabase user with the exact team invitation accepted.
-- Legacy invitations without metadata fall back to the oldest matching invitation.
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

  -- A stale or revoked invitation must not attach to a different team or
  -- silently turn the invitee into a new account owner.
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
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    );

    update public.license_members as m
       set user_id = new.id,
           status = 'active',
           display_name = coalesce(target_display_name, m.display_name),
           joined_at = now()
     where m.id = target_member_id
       and m.status = 'invited';

    -- A user can belong to only one account. Release other pending seats after
    -- the accepted invitation has been attached to the confirmed user.
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
