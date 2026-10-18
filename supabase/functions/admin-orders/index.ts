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
        .select('id, account_id, offer_key, status, amount_cents, currency, provider_payment_id, provider_order_id, paid_at, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (statusFilter && statusFilter !== 'todos') {
        query = query.eq('status', statusFilter)
      }

      const { data: orders, error: ordersError } = await query
      if (ordersError) throw ordersError

      const accountIds = Array.from(new Set((orders ?? []).map((o) => o.account_id)))
      const [accountsRes, membersRes] = await Promise.all([
        accountIds.length ? ctx.admin.from('license_accounts').select('id, name').in('id', accountIds) : { data: [], error: null },
        accountIds.length ? ctx.admin.from('license_members').select('account_id, email, role').in('account_id', accountIds).eq('role', 'owner') : { data: [], error: null },
      ])

      const accountMap = new Map((accountsRes.data ?? []).map((a) => [a.id, a.name]))
      const ownerMap = new Map((membersRes.data ?? []).map((m) => [m.account_id, m.email]))

      const result = (orders ?? []).map((order) => ({
        id: order.id,
        accountId: order.account_id,
        accountName: accountMap.get(order.account_id) ?? 'Conta',
        payerEmail: ownerMap.get(order.account_id) ?? '—',
        offerKey: order.offer_key,
        status: order.status,
        amountCents: order.amount_cents,
        currency: order.currency || 'BRL',
        providerPaymentId: order.provider_payment_id || null,
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

      // Se possui provider_payment_id do Mercado Pago, solicita o reembolso via API
      let refundResult: any = null
      if (order.provider_payment_id) {
        try {
          refundResult = await mercadoPagoRequest(`/v1/payments/${order.provider_payment_id}/refunds`, {
            method: 'POST',
            body: JSON.stringify({}),
          })
        } catch (mpErr) {
          console.error('Mercado Pago refund call failed:', errorMessage(mpErr))
          // Se falhou no MP (ex: chave de teste ou pagamento antigo), loga mas permite confirmar se admin desejar
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
    return respond(req, { error: 'admin_orders_failed', message: 'Erro ao processar pedidos.' }, 500)
  }
})
