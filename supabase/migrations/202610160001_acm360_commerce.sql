-- Base persistente do portal.
-- Este arquivo prepara os dados para a migração; nenhuma credencial é armazenada aqui.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.acm360_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acm360_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.acm360_accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  display_name text,
  role text not null check (role in ('owner', 'member')),
  status text not null check (status in ('invited', 'active', 'removed')),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  constraint acm360_owner_is_active check (role <> 'owner' or status = 'active')
);

create unique index if not exists acm360_members_account_email_active_key
  on public.acm360_members (account_id, lower(email))
  where status <> 'removed';
create unique index if not exists acm360_members_user_active_key
  on public.acm360_members (user_id)
  where user_id is not null and status <> 'removed';
create unique index if not exists acm360_members_one_owner_key
  on public.acm360_members (account_id)
  where role = 'owner' and status = 'active';
create index if not exists acm360_members_account_status_idx
  on public.acm360_members (account_id, status);

create or replace function public.acm360_enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  occupied_seats integer;
begin
  if new.role = 'member' and new.status <> 'removed' then
    perform pg_advisory_xact_lock(hashtextextended(new.account_id::text, 0));
    select count(*) into occupied_seats
      from public.acm360_members m
     where m.account_id = new.account_id
       and m.status <> 'removed'
       and m.id is distinct from new.id;
    if occupied_seats >= 3 then
      raise exception 'seat_limit_reached' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists acm360_enforce_seat_limit on public.acm360_members;
create trigger acm360_enforce_seat_limit
  before insert or update of account_id, role, status on public.acm360_members
  for each row execute function public.acm360_enforce_seat_limit();

create table if not exists public.acm360_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.acm360_accounts(id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text,
  offer_key text not null check (offer_key in ('pro_monthly', 'pro_annual')),
  status text not null check (status in ('pending', 'active', 'past_due', 'canceled', 'expired', 'refunded')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  starts_at timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists acm360_subscriptions_provider_subscription_key
  on public.acm360_subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists acm360_subscriptions_account_status_idx
  on public.acm360_subscriptions (account_id, status, current_period_end desc);

create table if not exists public.acm360_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.acm360_accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  provider text not null,
  provider_checkout_id text,
  offer_key text not null check (offer_key in ('pro_monthly', 'pro_annual')),
  status text not null check (status in ('pending', 'paid', 'canceled', 'expired', 'refunded')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  checkout_url text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists acm360_orders_provider_checkout_key
  on public.acm360_orders (provider, provider_checkout_id)
  where provider_checkout_id is not null;
create index if not exists acm360_orders_account_created_idx
  on public.acm360_orders (account_id, created_at desc);

create table if not exists public.acm360_devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.acm360_accounts(id) on delete cascade,
  member_id uuid not null references public.acm360_members(id) on delete cascade,
  machine_id text not null,
  name text not null default 'SketchUp',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (account_id, machine_id)
);

create index if not exists acm360_devices_member_active_idx
  on public.acm360_devices (member_id, last_seen_at desc)
  where revoked_at is null;
create index if not exists acm360_devices_account_active_idx
  on public.acm360_devices (account_id, last_seen_at desc)
  where revoked_at is null;

-- Registre de idempotência. O payload integral do gateway não é retido para reduzir PII.
create table if not exists public.acm360_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  resource_id text,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create or replace function public.acm360_is_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.acm360_members m
    where m.account_id = target_account_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.acm360_is_owner(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.acm360_members m
    where m.account_id = target_account_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.status = 'active'
  );
$$;

revoke all on function public.acm360_is_member(uuid) from public;
revoke all on function public.acm360_is_owner(uuid) from public;
grant execute on function public.acm360_is_member(uuid) to authenticated;
grant execute on function public.acm360_is_owner(uuid) to authenticated;

create or replace function public.acm360_user_by_email(target_email text)
returns table(user_id uuid, email_confirmed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email_confirmed_at is not null
    from auth.users u
   where lower(u.email) = lower(target_email)
   limit 1;
$$;
revoke all on function public.acm360_user_by_email(text) from public, anon, authenticated;
grant execute on function public.acm360_user_by_email(text) to service_role;

create or replace function public.acm360_attach_confirmed_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  target_account_id uuid;
  display_name text;
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  select m.account_id
    into target_account_id
    from public.acm360_members m
   where lower(m.email) = lower(new.email)
     and m.status = 'invited'
   order by m.created_at
   limit 1
   for update;

  if target_account_id is not null then
    update public.acm360_members
       set user_id = new.id,
           status = 'active',
           display_name = coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
           joined_at = now()
     where account_id = target_account_id
       and lower(email) = lower(new.email)
       and status = 'invited';
    return new;
  end if;

  if exists (
    select 1 from public.acm360_accounts a where a.owner_user_id = new.id
  ) then
    return new;
  end if;

  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.acm360_accounts (owner_user_id, name)
  values (new.id, display_name)
  returning id into target_account_id;

  insert into public.acm360_members (account_id, user_id, email, display_name, role, status, joined_at)
  values (target_account_id, new.id, lower(new.email), display_name, 'owner', 'active', now());

  return new;
end;
$$;

drop trigger if exists acm360_attach_confirmed_user on auth.users;
create trigger acm360_attach_confirmed_user
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.acm360_attach_confirmed_user();

alter table public.acm360_accounts enable row level security;
alter table public.acm360_members enable row level security;
alter table public.acm360_subscriptions enable row level security;
alter table public.acm360_orders enable row level security;
alter table public.acm360_devices enable row level security;
alter table public.acm360_webhook_events enable row level security;

revoke all on public.acm360_accounts, public.acm360_members, public.acm360_subscriptions,
  public.acm360_orders, public.acm360_devices, public.acm360_webhook_events
  from anon, authenticated;

-- Portal data is served through authenticated Edge Functions so client code does
-- not receive provider IDs, payment links, or direct write access to records.

create policy acm360_accounts_select_member
  on public.acm360_accounts for select to authenticated
  using (public.acm360_is_member(id));
create policy acm360_accounts_update_owner
  on public.acm360_accounts for update to authenticated
  using (public.acm360_is_owner(id))
  with check (public.acm360_is_owner(id));

create policy acm360_members_select_member
  on public.acm360_members for select to authenticated
  using (public.acm360_is_member(account_id));

create policy acm360_subscriptions_select_member
  on public.acm360_subscriptions for select to authenticated
  using (public.acm360_is_member(account_id));

create policy acm360_orders_select_member
  on public.acm360_orders for select to authenticated
  using (public.acm360_is_member(account_id));

create policy acm360_devices_select_member
  on public.acm360_devices for select to authenticated
  using (public.acm360_is_member(account_id));
