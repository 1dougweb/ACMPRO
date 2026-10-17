import { requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { verifiedEmail } from '../_shared/site-admin.ts'

type OfferKey = 'pro_monthly' | 'pro_annual'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)

  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)
  if (!verifiedEmail(ctx.user)) {
    return respond(req, { error: 'site_admin_required', message: 'Esta conta não está autorizada a acessar a administração.' }, 403)
  }

  try {
    const [accounts, activeLicenses, activeMembers, pendingOrders, recentAccounts, recentOrders] = await Promise.all([
      ctx.admin.from('license_accounts').select('id', { count: 'exact', head: true }),
      ctx.admin.from('license_subscriptions').select('id', { count: 'exact', head: true })
        .eq('status', 'active').gt('current_period_end', new Date().toISOString()),
      ctx.admin.from('license_members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ctx.admin.from('license_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ctx.admin.from('license_accounts').select('id,name,created_at').order('created_at', { ascending: false }).limit(8),
      ctx.admin.from('license_orders').select('id,offer_key,status,amount_cents,created_at')
        .order('created_at', { ascending: false }).limit(8),
    ])

    const results = [accounts, activeLicenses, activeMembers, pendingOrders, recentAccounts, recentOrders]
    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error

    const accountRows = recentAccounts.data ?? []
    const accountIds = accountRows.map((account) => account.id)
    const owners = accountIds.length
      ? await ctx.admin.from('license_members').select('account_id,email').in('account_id', accountIds)
        .eq('role', 'owner').eq('status', 'active')
      : { data: [], error: null }
    if (owners.error) throw owners.error
    const ownerEmails = new Map((owners.data ?? []).map((owner) => [owner.account_id, owner.email]))

    const orders = (recentOrders.data ?? []).filter((order) =>
      order.offer_key === 'pro_monthly' || order.offer_key === 'pro_annual',
    )

    return respond(req, {
      accountCount: accounts.count ?? 0,
      activeLicenseCount: activeLicenses.count ?? 0,
      activeMemberCount: activeMembers.count ?? 0,
      pendingOrderCount: pendingOrders.count ?? 0,
      recentAccounts: accountRows.map((account) => ({
        id: account.id,
        name: account.name,
        email: ownerEmails.get(account.id) ?? null,
        createdAt: account.created_at,
      })),
      recentOrders: orders.map((order) => ({
        id: order.id,
        offerKey: order.offer_key as OfferKey,
        status: order.status,
        amountCents: order.amount_cents,
        createdAt: order.created_at,
      })),
    })
  } catch (error) {
    console.error('admin-overview failed', errorMessage(error))
    return respond(req, { error: 'admin_overview_unavailable', message: 'Não foi possível carregar os dados administrativos.' }, 500)
  }
})
