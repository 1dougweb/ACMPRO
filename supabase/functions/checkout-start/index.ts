import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { centsToAmount, mercadoPagoRequest, portalUrl, positiveIntegerEnv, webhookUrl } from '../_shared/mercadopago.ts'

interface Body { offerKey?: 'pro_monthly' | 'pro_annual' }
interface MercadoPagoCheckout {
  id: string
  init_point?: string
  sandbox_init_point?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)

  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const body = await req.json().catch(() => null) as Body | null
    const offer = body?.offerKey
    if (!offer || !['pro_monthly', 'pro_annual'].includes(offer)) {
      return respond(req, { error: 'bad_request', message: 'Escolha uma oferta válida.' }, 400)
    }

    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada.' }, 404)
    if (member.role !== 'owner') return respond(req, { error: 'owner_required', message: 'Somente o titular pode contratar ou alterar o plano.' }, 403)

    const monthlyCents = positiveIntegerEnv('MP_PRO_MONTHLY_AMOUNT_CENTS')
    const annualCents = positiveIntegerEnv('MP_PRO_ANNUAL_AMOUNT_CENTS')
    const amountCents = offer === 'pro_monthly' ? monthlyCents : annualCents
    if (!amountCents) {
      return respond(req, { error: 'offer_not_configured', message: offer === 'pro_annual'
        ? 'O valor anual ainda precisa ser configurado no backend conforme a oferta do site.'
        : 'O valor mensal ainda precisa ser configurado no backend.' }, 503)
    }

    const now = new Date().toISOString()
    const portalReturnUrl = portalUrl('/app?checkout=return')

    const { data: currentLicenses, error: licenseError } = await ctx.admin.from('license_subscriptions')
      .select('id,status,current_period_end')
      .eq('account_id', member.account_id)
      .in('status', ['active', 'past_due', 'canceled'])
      .gt('current_period_end', now)
      .limit(1)
    if (licenseError) throw licenseError
    if (currentLicenses?.length) {
      return respond(req, { error: 'subscription_exists', message: 'Sua licença Pro ainda está válida.' }, 409)
    }

    if (offer === 'pro_monthly') {
      const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { error: expireError } = await ctx.admin.from('license_subscriptions')
        .update({ status: 'expired', updated_at: now })
        .eq('account_id', member.account_id)
        .eq('provider', 'mercadopago')
        .eq('offer_key', 'pro_monthly')
        .eq('status', 'pending')
        .lt('created_at', staleBefore)
      if (expireError) throw expireError

      const { data: existing, error: existingError } = await ctx.admin
        .from('license_subscriptions')
        .select('id,checkout_url,status,provider_subscription_id,current_period_end,amount_cents')
        .eq('account_id', member.account_id)
        .eq('provider', 'mercadopago')
        .eq('offer_key', 'pro_monthly')
        .in('status', ['pending', 'active', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
      if (existingError) throw existingError
      const previous = existing?.[0]
      const previousPeriodIsValid = Boolean(previous?.current_period_end && new Date(previous.current_period_end).getTime() > Date.now())
      if ((previous?.status === 'active' || previous?.status === 'past_due') && previousPeriodIsValid) {
        return respond(req, { error: 'subscription_exists', message: 'Sua assinatura mensal já está ativa.' }, 409)
      }
      const reusePending = previous?.status === 'pending'
      if (reusePending && previous?.checkout_url) return respond(req, { url: previous.checkout_url })
      const checkoutAmountCents = reusePending ? previous?.amount_cents ?? amountCents : amountCents

      let subscriptionId = reusePending ? previous?.id as string : undefined
      if (!subscriptionId) {
        const { data: subscription, error: insertError } = await ctx.admin
          .from('license_subscriptions')
          .insert({
            account_id: member.account_id,
            provider: 'mercadopago',
            offer_key: offer,
            status: 'pending',
            amount_cents: amountCents,
            currency: 'BRL',
          })
          .select('id')
          .single()
        if (insertError) throw insertError
        subscriptionId = subscription.id
      }

      try {
        const checkout = await mercadoPagoRequest<MercadoPagoCheckout>('/preapproval', {
          method: 'POST',
          headers: { 'X-Idempotency-Key': subscriptionId! },
          body: JSON.stringify({
            reason: 'GOACM Pro mensal',
            external_reference: subscriptionId,
            payer_email: ctx.user.email,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: centsToAmount(checkoutAmountCents),
              currency_id: 'BRL',
              free_trial: { frequency: 7, frequency_type: 'days' },
            },
            back_url: portalReturnUrl,
            notification_url: webhookUrl(),
            status: 'pending',
          }),
        })
        const checkoutUrl = checkout.init_point ?? checkout.sandbox_init_point
        if (!checkout.id || !checkoutUrl) throw new Error('Mercado Pago did not return a subscription checkout URL.')
        const { error: updateError } = await ctx.admin.from('license_subscriptions').update({
          provider_subscription_id: checkout.id,
          checkout_url: checkoutUrl,
        }).eq('id', subscriptionId!)
        if (updateError) throw updateError
        return respond(req, { url: checkoutUrl })
      } catch (error) {
        await ctx.admin.from('license_subscriptions').update({ status: 'expired', updated_at: now }).eq('id', subscriptionId!)
        throw error
      }
    }

    const { error: expireOrdersError } = await ctx.admin.from('license_orders')
      .update({ status: 'expired', updated_at: now })
      .eq('account_id', member.account_id)
      .eq('provider', 'mercadopago')
      .eq('offer_key', offer)
      .eq('status', 'pending')
      .lt('expires_at', now)
    if (expireOrdersError) throw expireOrdersError

    const { data: openOrders, error: openOrdersError } = await ctx.admin.from('license_orders')
      .select('id,checkout_url,amount_cents')
      .eq('account_id', member.account_id)
      .eq('provider', 'mercadopago')
      .eq('offer_key', offer)
      .eq('status', 'pending')
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
    if (openOrdersError) throw openOrdersError
    const previousOrder = openOrders?.[0]
    if (previousOrder?.checkout_url) return respond(req, { url: previousOrder.checkout_url })
    const checkoutAmountCents = previousOrder?.amount_cents ?? amountCents

    let orderId = previousOrder?.id as string | undefined
    if (!orderId) {
      const { data: order, error: orderError } = await ctx.admin
        .from('license_orders')
        .insert({
          account_id: member.account_id,
          created_by: ctx.user.id,
          provider: 'mercadopago',
          offer_key: offer,
          status: 'pending',
          amount_cents: amountCents,
          currency: 'BRL',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (orderError) throw orderError
      orderId = order.id
    }

    try {
      const checkout = await mercadoPagoRequest<MercadoPagoCheckout>('/checkout/preferences', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': orderId! },
        body: JSON.stringify({
          items: [{
            id: 'goacm-pro-anual',
            title: 'GOACM Pro — plano anual',
            quantity: 1,
            currency_id: 'BRL',
            unit_price: centsToAmount(checkoutAmountCents),
          }],
          payer: { email: ctx.user.email },
          payment_methods: {
            default_payment_method_id: 'pix',
            excluded_payment_types: [
              { id: 'account_money' }, { id: 'atm' }, { id: 'credit_card' },
              { id: 'debit_card' }, { id: 'digital_currency' }, { id: 'prepaid_card' }, { id: 'ticket' },
            ],
          },
          external_reference: orderId,
          notification_url: webhookUrl(),
          back_urls: {
            success: portalReturnUrl,
            pending: portalReturnUrl,
            failure: `${portalUrl('/app')}?checkout=failed`,
          },
          auto_return: 'approved',
          expires: true,
          expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          metadata: { order_id: orderId, account_id: member.account_id },
        }),
      })
      const checkoutUrl = checkout.init_point ?? checkout.sandbox_init_point
      if (!checkout.id || !checkoutUrl) throw new Error('Mercado Pago did not return a preference checkout URL.')
      const { error: updateError } = await ctx.admin.from('license_orders').update({
        provider_checkout_id: checkout.id,
        checkout_url: checkoutUrl,
      }).eq('id', orderId!)
      if (updateError) throw updateError
      return respond(req, { url: checkoutUrl })
    } catch (error) {
      await ctx.admin.from('license_orders').update({ status: 'expired', updated_at: now }).eq('id', orderId!)
      throw error
    }
  } catch (error) {
    console.error('checkout-start failed', errorMessage(error))
    return respond(req, { error: 'checkout_start_failed', message: 'Não foi possível abrir o checkout agora.' }, 502)
  }
})
