import { createClient } from 'npm:@supabase/supabase-js@2'
import { errorMessage, respond } from '../_shared/http.ts'
import { amountToCents, mercadoPagoRequest, verifyMercadoPagoSignature } from '../_shared/mercadopago.ts'

interface Notification {
  id?: string | number
  type?: string
  action?: string
  data?: { id?: string | number }
}
interface Payment {
  id: number | string
  status: string
  status_detail?: string
  transaction_amount: number | string
  currency_id?: string
  external_reference?: string
  date_approved?: string
  preapproval_id?: string
  transaction_amount_refunded?: number | string
}
interface Invoice {
  id: number | string
  status?: string
  summarized?: string
  preapproval_id?: string
  transaction_amount?: number | string
  debit_date?: string
  payment?: { id?: number | string; status?: string; status_detail?: string }
}
interface Preapproval {
  id: string
  status: string
  init_point?: string
  next_payment_date?: string
  external_reference?: string
  auto_recurring?: {
    free_trial?: { frequency?: number; frequency_type?: string }
  }
}
interface Chargeback {
  payments?: Array<string | number | { id?: string | number }>
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase service credentials are not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

interface PaymentRelation {
  orderId: string | null
  subscriptionId: string | null
  amountCents: number
}

async function paymentRelation(
  admin: ReturnType<typeof adminClient>,
  externalReference?: string,
  preapprovalId?: string,
): Promise<PaymentRelation | null> {
  if (isUuid(externalReference)) {
    const { data: order, error: orderError } = await admin.from('license_orders')
      .select('id,amount_cents')
      .eq('id', externalReference)
      .eq('provider', 'mercadopago')
      .eq('offer_key', 'pro_annual')
      .maybeSingle()
    if (orderError) throw orderError
    if (order) return { orderId: order.id, subscriptionId: null, amountCents: order.amount_cents }

    const { data: subscription, error: subscriptionError } = await admin.from('license_subscriptions')
      .select('id,amount_cents')
      .eq('id', externalReference)
      .eq('provider', 'mercadopago')
      .eq('offer_key', 'pro_monthly')
      .maybeSingle()
    if (subscriptionError) throw subscriptionError
    if (subscription) return { orderId: null, subscriptionId: subscription.id, amountCents: subscription.amount_cents }
  }

  for (const reference of [externalReference, preapprovalId]) {
    if (!reference) continue
    const { data: subscription, error } = await admin.from('license_subscriptions')
      .select('id,amount_cents')
      .eq('provider', 'mercadopago')
      .eq('provider_subscription_id', reference)
      .eq('offer_key', 'pro_monthly')
      .maybeSingle()
    if (error) throw error
    if (subscription) return { orderId: null, subscriptionId: subscription.id, amountCents: subscription.amount_cents }
  }

  return null
}

async function processPayment(admin: ReturnType<typeof adminClient>, id: string) {
  const payment = await mercadoPagoRequest<Payment>(`/v1/payments/${encodeURIComponent(id)}`)
  return processPaymentResource(admin, payment)
}

async function processPaymentResource(
  admin: ReturnType<typeof adminClient>,
  payment: Payment,
  preapprovalFallback?: string,
  paymentTimeFallback?: string,
) {
  if (payment.currency_id !== 'BRL') throw new Error('Unexpected Mercado Pago payment currency.')
  const preapprovalId = payment.preapproval_id ?? preapprovalFallback

  if (payment.status === 'approved' && isUuid(payment.external_reference)) {
    const { data: order, error } = await admin.from('license_orders')
      .select('id,offer_key,amount_cents,provider,status')
      .eq('id', payment.external_reference)
      .eq('provider', 'mercadopago')
      .maybeSingle()
    if (error) throw error

    if (order?.offer_key === 'pro_annual' && order.amount_cents === amountToCents(payment.transaction_amount)) {
      const { data: applied, error: applyError } = await admin.rpc('acm360_apply_annual_payment', {
        target_order_id: order.id,
        target_payment_id: String(payment.id),
        paid_amount_cents: amountToCents(payment.transaction_amount),
        payment_time: payment.date_approved ?? new Date().toISOString(),
      })
      if (applyError) throw applyError
      return applied ? 'processed' : 'ignored'
    }
  }

  if (payment.status === 'approved') {
    const relation = await paymentRelation(admin, payment.external_reference, preapprovalId)
    if (relation?.subscriptionId) {
      return processMonthlyPayment(admin, relation.subscriptionId, payment, paymentTimeFallback)
    }
  }

  let relation: PaymentRelation | null = null
  let stateRecorded = false
  let orderStateUpdated = false
  if (['refunded', 'charged_back', 'rejected', 'pending', 'cancelled', 'expired'].includes(payment.status)) {
    relation = await paymentRelation(admin, payment.external_reference, preapprovalId)
  }

  if (['refunded', 'charged_back', 'rejected', 'pending'].includes(payment.status)) {
    if (!relation) return 'ignored'
    const amountCents = amountToCents(payment.transaction_amount)
    if (amountCents !== relation.amountCents) return 'ignored'

    const { data: recorded, error } = await admin.rpc('acm360_reconcile_payment_state', {
      target_payment_id: String(payment.id),
      target_state: payment.status,
      paid_amount_cents: amountCents,
      target_order_id: relation.orderId,
      target_subscription_id: relation.subscriptionId,
      payment_time: payment.date_approved ?? null,
    })
    if (error) throw error
    stateRecorded = Boolean(recorded)
  }

  if (['rejected', 'cancelled', 'expired'].includes(payment.status) && relation?.orderId
      && amountToCents(payment.transaction_amount) === relation.amountCents) {
    const nextStatus = payment.status === 'expired' ? 'expired' : 'canceled'
    const { data: orders, error } = await admin.from('license_orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', relation.orderId)
      .eq('provider', 'mercadopago')
      .eq('status', 'pending')
      .select('id')
    if (error) throw error
    orderStateUpdated = Boolean(orders?.length)
  }

  if (['refunded', 'charged_back', 'rejected', 'pending'].includes(payment.status)) {
    return stateRecorded ? 'processed' : 'ignored'
  }
  return orderStateUpdated ? 'processed' : 'ignored'
}

async function processMonthlyPayment(
  admin: ReturnType<typeof adminClient>,
  subscriptionId: string,
  payment: Payment,
  paymentTimeFallback?: string,
) {
  const { data: subscription, error } = await admin.from('license_subscriptions')
    .select('id,amount_cents,provider_subscription_id')
    .eq('id', subscriptionId)
    .eq('provider', 'mercadopago')
    .eq('offer_key', 'pro_monthly')
    .maybeSingle()
  if (error) throw error
  if (!subscription?.provider_subscription_id) return 'ignored'

  const amountCents = amountToCents(payment.transaction_amount)
  if (amountCents !== subscription.amount_cents) throw new Error('Recurring payment amount does not match the subscription.')

  const preapproval = await mercadoPagoRequest<Preapproval>(`/preapproval/${encodeURIComponent(subscription.provider_subscription_id)}`)
  const paidAt = payment.date_approved ?? paymentTimeFallback ?? new Date().toISOString()
  const periodEnd = preapproval.next_payment_date ?? new Date(new Date(paidAt).setMonth(new Date(paidAt).getMonth() + 1)).toISOString()

  const { data: applied, error: applyError } = await admin.rpc('acm360_apply_recurring_payment', {
    target_subscription_id: subscription.provider_subscription_id,
    target_payment_id: String(payment.id),
    paid_amount_cents: amountCents,
    payment_time: paidAt,
    target_period_end: periodEnd,
  })
  if (applyError) throw applyError
  return applied ? 'processed' : 'ignored'
}

async function processPreapproval(admin: ReturnType<typeof adminClient>, id: string) {
  const preapproval = await mercadoPagoRequest<Preapproval>(`/preapproval/${encodeURIComponent(id)}`)
  const { data: subscription, error } = await admin.from('license_subscriptions')
    .select('id,status')
    .eq('provider', 'mercadopago')
    .eq('provider_subscription_id', preapproval.id)
    .maybeSingle()
  if (error) throw error
  if (!subscription) return 'ignored'

  let status: string | null = null
  let trialUpdate: Record<string, unknown> = {}
  if (['cancelled', 'canceled'].includes(preapproval.status)) status = 'canceled'
  else if (preapproval.status === 'paused') status = 'paused'
  else if (preapproval.status === 'pending') status = 'pending'
  else if (preapproval.status === 'authorized' && subscription.status !== 'active') {
    const trial = preapproval.auto_recurring?.free_trial
    if (trial?.frequency_type === 'days' && trial.frequency === 7) {
      const trialEndsAt = preapproval.next_payment_date
        ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      status = 'active'
      trialUpdate = {
        starts_at: new Date().toISOString(),
        current_period_end: trialEndsAt,
        trial_ends_at: trialEndsAt,
      }
    } else {
      status = 'pending'
    }
  }

  if (status) {
    const { error: updateError } = await admin.from('license_subscriptions').update({
      status,
      canceled_at: status === 'canceled' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      ...trialUpdate,
    }).eq('id', subscription.id)
    if (updateError) throw updateError
  }
  return 'processed'
}

async function processAuthorizedPayment(admin: ReturnType<typeof adminClient>, id: string) {
  const invoice = await mercadoPagoRequest<Invoice>(`/authorized_payments/${encodeURIComponent(id)}`)
  const subscriptionId = invoice.preapproval_id
  const payment = invoice.payment
  if (!subscriptionId) return 'ignored'

  if (payment?.id === undefined) return 'ignored'
  const currentPayment = await mercadoPagoRequest<Payment>(`/v1/payments/${encodeURIComponent(String(payment.id))}`)
  if (currentPayment.currency_id !== 'BRL') throw new Error('Unexpected Mercado Pago payment currency.')
  if (currentPayment.preapproval_id && currentPayment.preapproval_id !== subscriptionId) return 'ignored'
  return processPaymentResource(admin, currentPayment, subscriptionId, invoice.debit_date)
}

async function processChargeback(admin: ReturnType<typeof adminClient>, id: string) {
  const sellerId = Deno.env.get('MP_SELLER_ID')
  if (!sellerId) throw new Error('Mercado Pago seller ID is not configured for chargeback notifications.')
  const chargeback = await mercadoPagoRequest<Chargeback>(`/v1/chargebacks/${encodeURIComponent(id)}`, {
    headers: { 'X-Caller-Id': sellerId },
  })
  const paymentIds = (chargeback.payments ?? []).map((payment) =>
    typeof payment === 'object' ? payment.id : payment,
  ).filter((paymentId): paymentId is string | number => paymentId !== undefined)

  let anyProcessed = false
  for (const paymentId of paymentIds) {
    const payment = await mercadoPagoRequest<Payment>(`/v1/payments/${encodeURIComponent(String(paymentId))}`)
    if (payment.status === 'charged_back') {
      const outcome = await processPayment(admin, String(payment.id))
      anyProcessed = anyProcessed || outcome === 'processed'
    }
  }
  return anyProcessed ? 'processed' : 'ignored'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = await req.json().catch(() => null) as Notification | null
  const url = new URL(req.url)
  const type = body?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
  const resourceId = String(body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '')
  if (!type || !resourceId) return new Response('Invalid notification', { status: 400 })

  const signatureValid = await verifyMercadoPagoSignature(req, resourceId)
  if (!signatureValid) return new Response('Invalid signature', { status: 401 })

  try {
    const admin = adminClient()
    const eventId = String(body?.id ?? `${type}:${resourceId}:${body?.action ?? 'update'}`)
    const { error: upsertError } = await admin.from('license_webhook_events').upsert({
      provider: 'mercadopago',
      provider_event_id: eventId,
      event_type: type,
      resource_id: resourceId,
      processing_status: 'received',
    }, { onConflict: 'provider,provider_event_id', ignoreDuplicates: true })
    if (upsertError) throw upsertError

    const { data: event, error: eventError } = await admin.from('license_webhook_events')
      .select('processing_status')
      .eq('provider', 'mercadopago')
      .eq('provider_event_id', eventId)
      .single()
    if (eventError) throw eventError
    if (event.processing_status === 'processed' || event.processing_status === 'ignored') {
      return respond(req, { received: true })
    }

    let outcome: 'processed' | 'ignored' = 'ignored'
    if (type === 'payment') outcome = await processPayment(admin, resourceId) as 'processed' | 'ignored'
    else if (type === 'subscription_preapproval') outcome = await processPreapproval(admin, resourceId) as 'processed' | 'ignored'
    else if (type === 'subscription_authorized_payment') outcome = await processAuthorizedPayment(admin, resourceId) as 'processed' | 'ignored'
    else if (type === 'topic_chargebacks_wh') outcome = await processChargeback(admin, resourceId) as 'processed' | 'ignored'

    const { error: finishError } = await admin.from('license_webhook_events').update({
      processing_status: outcome,
      processed_at: new Date().toISOString(),
    }).eq('provider', 'mercadopago').eq('provider_event_id', eventId)
    if (finishError) throw finishError
    return respond(req, { received: true })
  } catch (error) {
    console.error('mercadopago-webhook failed', errorMessage(error))
    return new Response('Webhook processing failed', { status: 500 })
  }
})
