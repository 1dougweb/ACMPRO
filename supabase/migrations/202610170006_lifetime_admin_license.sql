-- Permanent entitlement for the site owner account, with no member seat cap.
create table if not exists public.license_account_entitlements (
  account_id uuid primary key references public.license_accounts(id) on delete cascade,
  entitlement text not null check (entitlement in ('lifetime')),
  seat_limit integer check (seat_limit is null or seat_limit > 0),
  granted_at timestamptz not null default now(),
  granted_reason text not null default 'site_admin'
);

alter table public.license_account_entitlements enable row level security;
revoke all on public.license_account_entitlements from anon, authenticated;

insert into public.license_account_entitlements (account_id, entitlement, seat_limit, granted_reason)
select account_id, 'lifetime', null, 'site_admin'
  from public.license_members
 where lower(email) = 'douglaseps@gmail.com'
   and role = 'owner'
   and status = 'active'
on conflict (account_id) do update
  set entitlement = excluded.entitlement,
      seat_limit = excluded.seat_limit,
      granted_reason = excluded.granted_reason;

create or replace function public.license_enforce_member_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  occupied_seats integer;
  effective_limit integer := 3;
begin
  if new.role = 'member' and new.status <> 'removed' then
    perform pg_advisory_xact_lock(hashtextextended(new.account_id::text, 0));

    select seat_limit into effective_limit
      from public.license_account_entitlements
     where account_id = new.account_id
       and entitlement = 'lifetime';
    if not found then
      effective_limit := 3;
    end if;

    select count(*) into occupied_seats
      from public.license_members m
     where m.account_id = new.account_id
       and m.status <> 'removed'
       and m.id is distinct from new.id;

    if effective_limit is not null and occupied_seats >= effective_limit then
      raise exception 'seat_limit_reached' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists acm360_enforce_seat_limit on public.license_members;
drop trigger if exists license_members_enforce_seat_limit on public.license_members;
create trigger license_members_enforce_seat_limit
  before insert or update of account_id, role, status on public.license_members
  for each row execute function public.license_enforce_member_seat_limit();

notify pgrst, 'reload schema';
