-- Serializes payment state changes and approvals so delayed events cannot
-- reactivate a refunded or charged-back annual or monthly payment.
create or replace function public.acm360_reconcile_payment_state(
  target_payment_id text,
  target_state text,
  paid_amount_cents integer,
  target_order_id uuid,
  target_subscription_id uuid,
  payment_time timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_order public.license_orders%rowtype;
  target_subscription public.license_subscriptions%rowtype;
  matching_payment public.license_payments%rowtype;
begin
  if target_payment_id is null or btrim(target_payment_id) = ''
     or target_state is null
     or target_state not in ('pending', 'rejected', 'refunded', 'charged_back')
     or paid_amount_cents is null or paid_amount_cents <= 0
     or (target_order_id is null and target_subscription_id is null)
     or (target_order_id is not null and target_subscription_id is not null) then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mercadopago-payment:' || target_payment_id, 2));

  if target_order_id is not null then
    select * into target_order
      from public.license_orders
     where id = target_order_id and provider = 'mercadopago'
     for update;
    if not found
       or target_order.offer_key <> 'pro_annual'
       or target_order.amount_cents <> paid_amount_cents
       or target_order.currency <> 'BRL' then
      return false;
    end if;
  else
    select * into target_subscription
      from public.license_subscriptions
     where id = target_subscription_id
       and provider = 'mercadopago'
       and offer_key = 'pro_monthly'
     for update;
    if not found
       or target_subscription.amount_cents <> paid_amount_cents
       or target_subscription.currency <> 'BRL' then
      return false;
    end if;
  end if;

  insert into public.license_payments (
    provider, provider_payment_id, payment_type, order_id, subscription_id,
    amount_cents, status, paid_at
  ) values (
    'mercadopago', target_payment_id, 'payment', target_order_id, target_subscription_id,
    paid_amount_cents, target_state, payment_time
  )
  on conflict (provider, payment_type, provider_payment_id)
  do update set
    status = case
      when license_payments.status in ('refunded', 'charged_back') then license_payments.status
      when excluded.status in ('refunded', 'charged_back') then excluded.status
      when license_payments.status = 'approved' then license_payments.status
      when license_payments.status = 'rejected' and excluded.status = 'pending' then license_payments.status
      else excluded.status
    end,
    order_id = coalesce(license_payments.order_id, excluded.order_id),
    subscription_id = coalesce(license_payments.subscription_id, excluded.subscription_id),
    paid_at = coalesce(license_payments.paid_at, excluded.paid_at),
    updated_at = now()
  where license_payments.amount_cents = excluded.amount_cents
    and (license_payments.order_id is null or excluded.order_id is null or license_payments.order_id = excluded.order_id)
    and (license_payments.subscription_id is null or excluded.subscription_id is null or license_payments.subscription_id = excluded.subscription_id)
    and not (
      coalesce(license_payments.order_id, excluded.order_id) is not null
      and coalesce(license_payments.subscription_id, excluded.subscription_id) is not null
    )
  returning * into matching_payment;

  if not found then
    return false;
  end if;

  if matching_payment.status in ('refunded', 'charged_back') then
    if matching_payment.order_id is not null then
      update public.license_orders
         set status = 'refunded', updated_at = now()
       where id = matching_payment.order_id and status <> 'refunded';
      update public.license_subscriptions
         set status = 'refunded', updated_at = now()
       where source_order_id = matching_payment.order_id and status <> 'refunded';
    end if;
    if matching_payment.subscription_id is not null then
      update public.license_subscriptions
         set status = 'refunded', updated_at = now()
       where id = matching_payment.subscription_id and status <> 'refunded';
    end if;
  elsif matching_payment.status = 'rejected' and matching_payment.subscription_id is not null then
    update public.license_subscriptions
       set status = 'past_due', updated_at = now()
     where id = matching_payment.subscription_id
       and status not in ('canceled', 'expired', 'refunded');
  end if;

  return true;
end;
$$;

revoke all on function public.acm360_reconcile_payment_state(text, text, integer, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.acm360_reconcile_payment_state(text, text, integer, uuid, uuid, timestamptz) to service_role;

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
  target_order public.license_orders%rowtype;
  matching_payment public.license_payments%rowtype;
  inserted_payment uuid;
  payment_exists boolean := false;
  period_start timestamptz;
begin
  if target_payment_id is null or btrim(target_payment_id) = '' or payment_time is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mercadopago-payment:' || target_payment_id, 2));

  select * into target_order
    from public.license_orders
   where id = target_order_id and provider = 'mercadopago'
   for update;

  if not found
     or target_order.offer_key <> 'pro_annual'
     or target_order.amount_cents <> paid_amount_cents
     or target_order.currency <> 'BRL' then
    return false;
  end if;

  select * into matching_payment
    from public.license_payments
   where provider = 'mercadopago'
     and payment_type = 'payment'
     and provider_payment_id = target_payment_id
   for update;
  payment_exists := found;

  if payment_exists then
    if matching_payment.amount_cents <> paid_amount_cents
       or (matching_payment.order_id is not null and matching_payment.order_id <> target_order.id)
       or matching_payment.subscription_id is not null
       or matching_payment.status in ('refunded', 'charged_back') then
      return false;
    end if;
    if matching_payment.status = 'approved' and target_order.status = 'paid' then
      return true;
    end if;
    update public.license_payments
       set order_id = target_order.id,
           status = 'approved',
           paid_at = coalesce(paid_at, payment_time),
           updated_at = now()
     where id = matching_payment.id;
  else
    insert into public.license_payments (
      provider, provider_payment_id, payment_type, order_id,
      amount_cents, status, paid_at
    ) values (
      'mercadopago', target_payment_id, 'payment', target_order.id,
      paid_amount_cents, 'approved', payment_time
    ) on conflict (provider, payment_type, provider_payment_id) do nothing
    returning id into inserted_payment;

    if inserted_payment is null then
      select * into matching_payment
        from public.license_payments
       where provider = 'mercadopago'
         and payment_type = 'payment'
         and provider_payment_id = target_payment_id
       for update;
      if not found
         or matching_payment.amount_cents <> paid_amount_cents
         or matching_payment.order_id is not null and matching_payment.order_id <> target_order.id
         or matching_payment.subscription_id is not null
         or matching_payment.status in ('refunded', 'charged_back') then
        return false;
      end if;
      if matching_payment.status = 'approved' and target_order.status = 'paid' then
        return true;
      end if;
      update public.license_payments
         set order_id = target_order.id,
             status = 'approved',
             paid_at = coalesce(paid_at, payment_time),
             updated_at = now()
       where id = matching_payment.id;
    end if;
  end if;

  -- A paid order may have a second successful payment. Keep its ledger entry,
  -- but do not grant a second 12-month term for the same order.
  if target_order.status = 'paid'
     or target_order.status not in ('pending', 'expired', 'canceled')
     or (target_order.status in ('expired', 'canceled') and target_order.expires_at is null)
     or (target_order.expires_at is not null and payment_time > target_order.expires_at) then
    return false;
  end if;

  update public.license_orders
     set status = 'paid', paid_at = payment_time, updated_at = now()
   where id = target_order.id;

  select greatest(
           payment_time,
           coalesce(max(s.current_period_end) filter (where s.status in ('active', 'canceled', 'past_due')), payment_time)
         )
    into period_start
    from public.license_subscriptions s
   where s.account_id = target_order.account_id;

  insert into public.license_subscriptions (
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

revoke all on function public.acm360_apply_annual_payment(uuid, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.acm360_apply_annual_payment(uuid, text, integer, timestamptz) to service_role;

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
  target_subscription public.license_subscriptions%rowtype;
  matching_payment public.license_payments%rowtype;
  inserted_payment uuid;
  payment_exists boolean := false;
begin
  if target_payment_id is null or btrim(target_payment_id) = ''
     or payment_time is null or target_period_end is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('mercadopago-payment:' || target_payment_id, 2));

  select * into target_subscription
    from public.license_subscriptions
   where provider = 'mercadopago'
     and provider_subscription_id = target_subscription_id
     and offer_key = 'pro_monthly'
   order by created_at desc
   limit 1
   for update;

  if not found
     or target_subscription.amount_cents <> paid_amount_cents
     or target_subscription.currency <> 'BRL' then
    return false;
  end if;

  select * into matching_payment
    from public.license_payments
   where provider = 'mercadopago'
     and payment_type = 'payment'
     and provider_payment_id = target_payment_id
   for update;
  payment_exists := found;

  if payment_exists then
    if matching_payment.amount_cents <> paid_amount_cents
       or (matching_payment.subscription_id is not null and matching_payment.subscription_id <> target_subscription.id)
       or matching_payment.order_id is not null
       or matching_payment.status in ('refunded', 'charged_back') then
      return false;
    end if;
    if matching_payment.status = 'approved' then
      return target_subscription.status not in ('expired', 'refunded');
    end if;
    update public.license_payments
       set subscription_id = target_subscription.id,
           status = 'approved',
           paid_at = coalesce(paid_at, payment_time),
           updated_at = now()
     where id = matching_payment.id;
  else
    insert into public.license_payments (
      provider, provider_payment_id, payment_type, subscription_id,
      amount_cents, status, paid_at
    ) values (
      'mercadopago', target_payment_id, 'payment', target_subscription.id,
      paid_amount_cents, 'approved', payment_time
    ) on conflict (provider, payment_type, provider_payment_id) do nothing
    returning id into inserted_payment;

    if inserted_payment is null then
      select * into matching_payment
        from public.license_payments
       where provider = 'mercadopago'
         and payment_type = 'payment'
         and provider_payment_id = target_payment_id
       for update;
      if not found
         or matching_payment.amount_cents <> paid_amount_cents
         or matching_payment.subscription_id is not null and matching_payment.subscription_id <> target_subscription.id
         or matching_payment.order_id is not null
         or matching_payment.status in ('refunded', 'charged_back') then
        return false;
      end if;
      if matching_payment.status = 'approved' then
        return target_subscription.status not in ('expired', 'refunded');
      end if;
      update public.license_payments
         set subscription_id = target_subscription.id,
             status = 'approved',
             paid_at = coalesce(paid_at, payment_time),
             updated_at = now()
       where id = matching_payment.id;
    end if;
  end if;

  if target_subscription.status in ('expired', 'refunded') then
    return false;
  end if;

  update public.license_subscriptions
     set status = case when status = 'canceled' then 'canceled' else 'active' end,
         starts_at = coalesce(starts_at, payment_time),
         current_period_end = greatest(coalesce(current_period_end, target_period_end), target_period_end),
         trial_ends_at = null,
         updated_at = now()
   where id = target_subscription.id;

  return true;
end;
$$;

revoke all on function public.acm360_apply_recurring_payment(text, text, integer, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.acm360_apply_recurring_payment(text, text, integer, timestamptz, timestamptz) to service_role;

notify pgrst, 'reload schema';
