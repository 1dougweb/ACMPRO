import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { mercadoPagoRequest } from '../_shared/mercadopago.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)
  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada.' }, 404)
    if (member.role !== 'owner') return respond(req, { error: 'owner_required', message: 'Somente o titular pode cancelar a assinatura.' }, 403)
    const { data: subscription, error } = await ctx.admin.from('license_subscriptions')
      .select('id,provider_subscription_id,status')
      .eq('account_id', member.account_id)
      .eq('provider', 'mercadopago')
      .eq('offer_key', 'pro_monthly')
      .in('status', ['active', 'past_due', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    const current = subscription?.[0]
    if (!current?.provider_subscription_id) {
      return respond(req, { error: 'subscription_not_found', message: 'Não há assinatura mensal para cancelar.' }, 404)
    }

    await mercadoPagoRequest(`/preapproval/${encodeURIComponent(current.provider_subscription_id)}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'canceled' }),
    })
    const { error: updateError } = await ctx.admin.from('license_subscriptions').update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', current.id)
    if (updateError) throw updateError
    return respond(req, { ok: true })
  } catch (error) {
    console.error('billing-cancel failed', errorMessage(error))
    return respond(req, { error: 'billing_cancel_failed', message: 'Não foi possível cancelar a assinatura.' }, 502)
  }
})
