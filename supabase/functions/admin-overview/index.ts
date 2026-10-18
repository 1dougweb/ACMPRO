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
    const [
      accounts,
      activeLicenses,
      lifetimeEntitlements,
      activeMembers,
      pendingOrders,
      recentAccounts,
      recentOrders,
      allOrders,
      allAccounts,
      allSubscriptions,
    ] = await Promise.all([
      ctx.admin.from('license_accounts').select('id', { count: 'exact', head: true }),
      ctx.admin.from('license_subscriptions').select('account_id')
        .eq('status', 'active').gt('current_period_end', new Date().toISOString()),
      ctx.admin.from('license_account_entitlements').select('account_id').eq('entitlement', 'lifetime'),
      ctx.admin.from('license_members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ctx.admin.from('license_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ctx.admin.from('license_accounts').select('id,name,created_at').order('created_at', { ascending: false }).limit(8),
      ctx.admin.from('license_orders').select('id,offer_key,status,amount_cents,created_at')
        .order('created_at', { ascending: false }).limit(8),
      ctx.admin.from('license_orders').select('id,offer_key,status,amount_cents,paid_at,created_at'),
      ctx.admin.from('license_accounts').select('id,created_at'),
      ctx.admin.from('license_subscriptions').select('account_id,status,current_period_end'),
    ])

    const results = [accounts, activeLicenses, lifetimeEntitlements, activeMembers, pendingOrders, recentAccounts, recentOrders]
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
    const activeAccountIds = new Set([
      ...(activeLicenses.data ?? []).map((license) => license.account_id),
      ...(lifetimeEntitlements.data ?? []).map((entitlement) => entitlement.account_id),
    ])

    // ==========================================
    // Cálculos Financeiros e Crescimento da Plataforma
    // ==========================================
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const startOfMonth = new Date(currentYear, currentMonth, 1)
    const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1)
    const endOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999)

    const ordersList = allOrders.data ?? []
    const paidOrders = ordersList.filter((o) => o.status === 'paid')

    let totalRevenueCents = 0
    let monthRevenueCents = 0
    let prevMonthRevenueCents = 0
    let monthlyRevenueShareCents = 0
    let annualRevenueShareCents = 0

    for (const o of paidOrders) {
      const amount = o.amount_cents || 0
      totalRevenueCents += amount

      if (o.offer_key === 'pro_monthly') {
        monthlyRevenueShareCents += amount
      } else if (o.offer_key === 'pro_annual') {
        annualRevenueShareCents += amount
      }

      const orderDate = new Date(o.paid_at || o.created_at)
      if (orderDate >= startOfMonth) {
        monthRevenueCents += amount
      } else if (orderDate >= startOfPrevMonth && orderDate <= endOfPrevMonth) {
        prevMonthRevenueCents += amount
      }
    }

    const revenueGrowthPct = prevMonthRevenueCents > 0
      ? Math.round(((monthRevenueCents - prevMonthRevenueCents) / prevMonthRevenueCents) * 100)
      : (monthRevenueCents > 0 ? 100 : 0)

    const averageTicketCents = paidOrders.length > 0
      ? Math.round(totalRevenueCents / paidOrders.length)
      : 0

    // Contas e crescimento de clientes
    const accountsList = allAccounts.data ?? []
    let monthNewAccounts = 0
    let prevMonthNewAccounts = 0

    for (const acc of accountsList) {
      const accDate = new Date(acc.created_at)
      if (accDate >= startOfMonth) {
        monthNewAccounts++
      } else if (accDate >= startOfPrevMonth && accDate <= endOfPrevMonth) {
        prevMonthNewAccounts++
      }
    }

    const accountsGrowthPct = prevMonthNewAccounts > 0
      ? Math.round(((monthNewAccounts - prevMonthNewAccounts) / prevMonthNewAccounts) * 100)
      : (monthNewAccounts > 0 ? 100 : 0)

    const totalAccountsCount = accounts.count ?? accountsList.length
    const conversionRatePct = totalAccountsCount > 0
      ? Math.min(100, Math.round((activeAccountIds.size / totalAccountsCount) * 1000) / 10)
      : 0

    const activeSubs = (allSubscriptions.data ?? []).filter((s) => s.status === 'active')
    const estimatedMrrCents = activeSubs.length > 0
      ? activeSubs.length * 9700
      : (activeAccountIds.size > 0 ? activeAccountIds.size * 9700 : monthRevenueCents)

    // Histórico dos últimos 6 meses para visualização gráfica
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const history = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1)
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      const label = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`

      const monthOrders = paidOrders.filter((o) => {
        const od = new Date(o.paid_at || o.created_at)
        return od >= mStart && od <= mEnd
      })

      const monthRev = monthOrders.reduce((acc, o) => acc + (o.amount_cents || 0), 0)
      const monthAccs = accountsList.filter((a) => {
        const ad = new Date(a.created_at)
        return ad >= mStart && ad <= mEnd
      }).length

      history.push({
        month: label,
        revenueCents: monthRev,
        ordersCount: monthOrders.length,
        newAccounts: monthAccs,
      })
    }

    return respond(req, {
      accountCount: accounts.count ?? 0,
      activeLicenseCount: activeAccountIds.size,
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
      financials: {
        totalRevenueCents,
        monthRevenueCents,
        prevMonthRevenueCents,
        revenueGrowthPct,
        monthlyRevenueShareCents,
        annualRevenueShareCents,
        averageTicketCents,
        estimatedMrrCents,
      },
      growth: {
        monthNewAccounts,
        prevMonthNewAccounts,
        accountsGrowthPct,
        conversionRatePct,
        history,
      },
    })
  } catch (error) {
    console.error('admin-overview failed', errorMessage(error))
    return respond(req, { error: 'admin_overview_unavailable', message: errorMessage(error) || 'Não foi possível carregar os dados administrativos.' }, 500)
  }
})
