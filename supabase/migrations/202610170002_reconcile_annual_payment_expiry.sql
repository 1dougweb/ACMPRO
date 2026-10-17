-- Records approved annual payments for reconciliation but only grants access
-- when the payment was approved within the order's original payment window.
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
  existing_payment public.license_payments%rowtype;
  payment_exists boolean := false;
  inserted_payment uuid;
  period_start timestamptz;
begin
  select * into existing_payment
    from public.license_payments
   where provider = 'mercadopago'
     and payment_type = 'payment'
     and provider_payment_id = target_payment_id
   for update;
  payment_exists := found;

  select * into target_order
    from public.license_orders
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

  insert into public.license_payments (
    provider, provider_payment_id, payment_type, order_id,
    amount_cents, status, paid_at
  ) values (
    'mercadopago', target_payment_id, 'payment', target_order.id,
    paid_amount_cents, 'approved', payment_time
  ) on conflict (provider, payment_type, provider_payment_id) do nothing
  returning id into inserted_payment;

  if inserted_payment is null then
    select * into existing_payment
      from public.license_payments
     where provider = 'mercadopago'
       and payment_type = 'payment'
       and provider_payment_id = target_payment_id
     for update;
    return found and coalesce(existing_payment.order_id = target_order.id
       and existing_payment.amount_cents = paid_amount_cents
       and existing_payment.status = 'approved'
       and target_order.status = 'paid', false);
  end if;

  -- A delayed webhook can arrive after the order is marked expired even when
  -- payment was approved in time. Late approvals stay in the ledger for review.
  if target_order.status not in ('pending', 'expired', 'canceled')
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
