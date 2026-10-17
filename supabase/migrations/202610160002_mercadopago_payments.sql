-- Mercado Pago checkout and payment ledger.
-- All mutation routines are restricted to the Supabase service role.

alter table public.acm360_subscriptions
  add column if not exists checkout_url text,
  add column if not exists source_order_id uuid references public.acm360_orders(id) on delete set null;

alter table public.acm360_subscriptions
  drop constraint if exists acm360_subscriptions_status_check;
alter table public.acm360_subscriptions
  add constraint acm360_subscriptions_status_check
  check (status in ('pending', 'active', 'past_due', 'paused', 'canceled', 'expired', 'refunded'));

create unique index if not exists acm360_subscriptions_source_order_key
  on public.acm360_subscriptions (source_order_id)
  where source_order_id is not null;

create table if not exists public.acm360_payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_payment_id text not null,
  payment_type text not null check (payment_type in ('payment', 'authorized_payment')),
  order_id uuid references public.acm360_orders(id) on delete set null,
  subscription_id uuid references public.acm360_subscriptions(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  status text not null check (status in ('approved', 'pending', 'rejected', 'refunded', 'charged_back')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, payment_type, provider_payment_id)
);

alter table public.acm360_payments enable row level security;
revoke all on public.acm360_payments from anon, authenticated;

create or replace function public.acm360_apply_annual_payment(
  target_order_id uuid,
  target_payment_id text,
  paid_amount_cents integer,
  payment_time timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_order public.acm360_orders%rowtype;
  existing_payment public.acm360_payments%rowtype;
  payment_exists boolean := false;
  inserted_payment uuid;
  period_start timestamptz;
begin
  select * into existing_payment
    from public.acm360_payments
   where provider = 'mercadopago'
     and payment_type = 'payment'
     and provider_payment_id = target_payment_id
   for update;
  payment_exists := found;

  select * into target_order
    from public.acm360_orders
   where id = target_order_id and provider = 'mercadopago'
   for update;

  if not found
     or target_order.offer_key <> 'pro_annual'
     or target_order.amount_cents <> paid_amount_cents
     or target_order.currency <> 'BRL'
     or payment_time is null then
    return false;
  end if;

  if payment_exists then
    return coalesce(existing_payment.order_id = target_order.id
       and existing_payment.amount_cents = paid_amount_cents
       and existing_payment.status = 'approved'
       and target_order.status = 'paid', false);
  end if;

  insert into public.acm360_payments (
    provider, provider_payment_id, payment_type, order_id,
    amount_cents, status, paid_at
  ) values (
    'mercadopago', target_payment_id, 'payment', target_order.id,
    paid_amount_cents, 'approved', payment_time
  ) on conflict (provider, payment_type, provider_payment_id) do nothing
  returning id into inserted_payment;

  if inserted_payment is null then
    select * into existing_payment
      from public.acm360_payments
     where provider = 'mercadopago'
       and payment_type = 'payment'
       and provider_payment_id = target_payment_id
     for update;
    return found and coalesce(existing_payment.order_id = target_order.id
       and existing_payment.amount_cents = paid_amount_cents
       and existing_payment.status = 'approved'
       and target_order.status = 'paid', false);
  end if;

  -- A delayed webhook may arrive after the order was marked expired, but an
  -- approval timestamp inside the original payment window is still valid.
  -- Keep a late approved payment in the ledger without granting a license.
  if target_order.status not in ('pending', 'expired', 'canceled')
     or (target_order.status in ('expired', 'canceled') and target_order.expires_at is null)
     or (target_order.expires_at is not null and payment_time > target_order.expires_at) then
    return false;
  end if;

  update public.acm360_orders
     set status = 'paid', paid_at = payment_time, updated_at = now()
   where id = target_order.id;

  select greatest(
           payment_time,
           coalesce(max(s.current_period_end) filter (where s.status in ('active', 'canceled', 'past_due')), payment_time)
         )
    into period_start
    from public.acm360_subscriptions s
   where s.account_id = target_order.account_id;

  insert into public.acm360_subscriptions (
    account_id, provider, source_order_id, offer_key, status,
    amount_cents, currency, starts_at, current_period_end
  ) values (
    target_order.account_id, 'mercadopago', target_order.id, 'pro_annual', 'active',
    paid_amount_cents, 'BRL', period_start, period_start + interval '12 months'
  ) on conflict (source_order_id) where source_order_id is not null
  do update set status = 'active', current_period_end = excluded.current_period_end,
                updated_at = now();

  return true;
end;
$$;

create or replace function public.acm360_apply_recurring_payment(
  target_subscription_id text,
  target_payment_id text,
  paid_amount_cents integer,
  payment_time timestamptz,
  target_period_end timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_subscription public.acm360_subscriptions%rowtype;
  inserted_payment uuid;
begin
  select * into target_subscription
    from public.acm360_subscriptions
   where provider = 'mercadopago'
     and provider_subscription_id = target_subscription_id
     and offer_key = 'pro_monthly'
   order by created_at desc
   limit 1
   for update;

  if not found
     or target_subscription.amount_cents <> paid_amount_cents
     or target_subscription.currency <> 'BRL'
     or target_subscription.status in ('expired', 'refunded') then
    return false;
  end if;

  insert into public.acm360_payments (
    provider, provider_payment_id, payment_type, subscription_id,
    amount_cents, status, paid_at
  ) values (
    'mercadopago', target_payment_id, 'payment', target_subscription.id,
    paid_amount_cents, 'approved', payment_time
  ) on conflict (provider, payment_type, provider_payment_id) do nothing
  returning id into inserted_payment;

  if inserted_payment is null then
    return true;
  end if;

  update public.acm360_subscriptions
     set status = case when status = 'canceled' then 'canceled' else 'active' end,
         starts_at = coalesce(starts_at, payment_time),
         current_period_end = greatest(coalesce(current_period_end, target_period_end), target_period_end),
         trial_ends_at = null,
         updated_at = now()
   where id = target_subscription.id;

  return true;
end;
$$;

create or replace function public.acm360_mark_payment_state(
  target_payment_id text,
  target_state text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  matching_payment public.acm360_payments%rowtype;
begin
  if target_state not in ('refunded', 'charged_back', 'rejected', 'pending') then
    return false;
  end if;

  select * into matching_payment
    from public.acm360_payments
   where provider = 'mercadopago'
     and provider_payment_id = target_payment_id
   order by created_at desc
   limit 1
   for update;

  if not found then
    return false;
  end if;

  update public.acm360_payments
     set status = target_state, updated_at = now()
   where id = matching_payment.id;

  if target_state in ('refunded', 'charged_back') then
    if matching_payment.order_id is not null then
      update public.acm360_orders
         set status = 'refunded', updated_at = now()
       where id = matching_payment.order_id;
      update public.acm360_subscriptions
         set status = 'refunded', updated_at = now()
       where source_order_id = matching_payment.order_id;
    end if;
    if matching_payment.subscription_id is not null then
      update public.acm360_subscriptions
         set status = 'refunded', updated_at = now()
       where id = matching_payment.subscription_id;
    end if;
  elsif target_state = 'rejected' and matching_payment.subscription_id is not null then
    update public.acm360_subscriptions
       set status = 'past_due', updated_at = now()
     where id = matching_payment.subscription_id
       and status not in ('canceled', 'expired', 'refunded');
  end if;

  return true;
end;
$$;

revoke all on function public.acm360_apply_annual_payment(uuid, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.acm360_apply_recurring_payment(text, text, integer, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.acm360_mark_payment_state(text, text) from public, anon, authenticated;
grant execute on function public.acm360_apply_annual_payment(uuid, text, integer, timestamptz) to service_role;
grant execute on function public.acm360_apply_recurring_payment(text, text, integer, timestamptz, timestamptz) to service_role;
grant execute on function public.acm360_mark_payment_state(text, text) to service_role;

create or replace function public.acm360_activate_device(
  target_account_id uuid,
  target_member_id uuid,
  target_machine_id text,
  target_name text,
  device_limit integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_device public.acm360_devices%rowtype;
  active_count integer;
  activated_id uuid;
  device_found boolean;
begin
  if device_limit is null or device_limit <= 0 then
    raise exception 'device_limit_not_configured' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_account_id::text, 1));

  select * into current_device
    from public.acm360_devices d
   where d.account_id = target_account_id
     and d.machine_id = target_machine_id
   for update;
  device_found := found;

  if device_found and current_device.revoked_at is null then
    update public.acm360_devices
       set member_id = target_member_id,
           name = target_name,
           last_seen_at = now()
     where id = current_device.id
     returning id into activated_id;
    return activated_id;
  end if;

  select count(*) into active_count
    from public.acm360_devices d
   where d.account_id = target_account_id
     and d.revoked_at is null;
  if active_count >= device_limit then
    raise exception 'device_limit_reached' using errcode = '23514';
  end if;

  if device_found then
    update public.acm360_devices
       set member_id = target_member_id,
           name = target_name,
           first_seen_at = now(),
           last_seen_at = now(),
           revoked_at = null
     where id = current_device.id
     returning id into activated_id;
  else
    insert into public.acm360_devices (account_id, member_id, machine_id, name)
    values (target_account_id, target_member_id, target_machine_id, target_name)
    returning id into activated_id;
  end if;
  return activated_id;
end;
$$;

revoke all on function public.acm360_activate_device(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.acm360_activate_device(uuid, uuid, text, text, integer) to service_role;
