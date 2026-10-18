import { requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { mercadoPagoRequest } from '../_shared/mercadopago.ts'
import { verifiedEmail } from '../_shared/site-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)
  if (!verifiedEmail(ctx.user)) {
    return respond(req, { error: 'site_admin_required', message: 'Esta conta não está autorizada a acessar a administração.' }, 403)
  }

  try {
    const url = new URL(req.url)
    const body = (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as Record<string, any>
    const action = body.action || url.searchParams.get('action') || 'list'

    // 1. AÇÃO: Listar Pedidos
    if (action === 'list') {
      const statusFilter = (body.status || url.searchParams.get('status') || '').trim().toLowerCase()

      let query = ctx.admin.from('license_orders')
        .select('id, account_id, offer_key, status, amount_cents, currency, provider_checkout_id, paid_at, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (statusFilter && statusFilter !== 'todos') {
        query = query.eq('status', statusFilter)
      }

      const { data: orders, error: ordersError } = await query
      if (ordersError) throw ordersError

      const orderIds = (orders ?? []).map((o) => o.id)
      const accountIds = Array.from(new Set((orders ?? []).map((o) => o.account_id)))
      const [accountsRes, membersRes, paymentsRes] = await Promise.all([
        accountIds.length ? ctx.admin.from('license_accounts').select('id, name').in('id', accountIds) : { data: [], error: null },
        accountIds.length ? ctx.admin.from('license_members').select('account_id, email, role').in('account_id', accountIds).eq('role', 'owner') : { data: [], error: null },
        orderIds.length ? ctx.admin.from('license_payments').select('order_id, provider_payment_id').in('order_id', orderIds) : { data: [], error: null },
      ])

      const accountMap = new Map((accountsRes.data ?? []).map((a) => [a.id, a.name]))
      const ownerMap = new Map((membersRes.data ?? []).map((m) => [m.account_id, m.email]))
      const paymentMap = new Map((paymentsRes.data ?? []).map((p) => [p.order_id, p.provider_payment_id]))

      const result = (orders ?? []).map((order) => ({
        id: order.id,
        accountId: order.account_id,
        accountName: accountMap.get(order.account_id) ?? 'Conta',
        payerEmail: ownerMap.get(order.account_id) ?? '—',
        offerKey: order.offer_key,
        status: order.status,
        amountCents: order.amount_cents,
        currency: order.currency || 'BRL',
        providerPaymentId: paymentMap.get(order.id) || order.provider_checkout_id || null,
        paidAt: order.paid_at || null,
        createdAt: order.created_at,
      }))

      return respond(req, { success: true, orders: result })
    }

    // 2. AÇÃO: Reembolsar Pedido
    if (action === 'refund') {
      const { orderId } = body
      if (!orderId) return respond(req, { error: 'bad_request', message: 'ID do pedido não informado.' }, 400)

      const { data: order, error: orderFetchErr } = await ctx.admin.from('license_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderFetchErr || !order) {
        return respond(req, { error: 'not_found', message: 'Pedido não encontrado.' }, 404)
      }

      if (order.status === 'refunded') {
        return respond(req, { error: 'already_refunded', message: 'Este pedido já foi reembolsado anteriormente.' }, 400)
      }

      // Procura o provider_payment_id no registro de pagamentos
      const { data: payment } = await ctx.admin.from('license_payments')
        .select('provider_payment_id')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const targetPaymentId = payment?.provider_payment_id

      let refundResult: any = null
      if (targetPaymentId) {
        try {
          refundResult = await mercadoPagoRequest(`/v1/payments/${targetPaymentId}/refunds`, {
            method: 'POST',
            body: JSON.stringify({}),
          })
        } catch (mpErr) {
          console.error('Mercado Pago refund call failed:', errorMessage(mpErr))
        }
      }

      // Atualiza pedido para refunded
      const now = new Date().toISOString()
      const { error: updateErr } = await ctx.admin.from('license_orders')
        .update({
          status: 'refunded',
          updated_at: now,
        })
        .eq('id', orderId)
      if (updateErr) throw updateErr

      // Revoga / expira a assinatura vinculada
      await ctx.admin.from('license_subscriptions')
        .update({
          status: 'expired',
          updated_at: now,
        })
        .eq('account_id', order.account_id)
        .eq('status', 'active')

      return respond(req, {
        success: true,
        message: 'Pedido reembolsado e licença ajustada com sucesso.',
        refundId: refundResult?.id || null,
      })
    }

    return respond(req, { error: 'invalid_action', message: 'Ação não reconhecida.' }, 400)
  } catch (error) {
    console.error('admin-orders failed', errorMessage(error))
    return respond(req, { error: 'admin_orders_failed', message: errorMessage(error) || 'Erro ao processar pedidos.' }, 500)
  }
})
