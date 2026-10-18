import { requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
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

    // 1. AÇÃO: Listar Usuários e Contas
    if (action === 'list') {
      const search = (body.search || url.searchParams.get('search') || '').trim().toLowerCase()
      const statusFilter = (body.status || url.searchParams.get('status') || '').trim().toLowerCase()

      // Buscar contas
      let accountQuery = ctx.admin.from('license_accounts')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      const { data: accounts, error: accountError } = await accountQuery
      if (accountError) throw accountError

      const accountIds = (accounts ?? []).map((acc) => acc.id)
      if (!accountIds.length) {
        return respond(req, { success: true, accounts: [] })
      }

      // Buscar dados agregados das contas
      const [membersRes, subsRes, entitlementsRes, devicesRes, ordersRes] = await Promise.all([
        ctx.admin.from('license_members').select('id, account_id, user_id, email, display_name, role, status, created_at').in('account_id', accountIds),
        ctx.admin.from('license_subscriptions').select('id, account_id, offer_key, status, current_period_end, trial_ends_at, provider, amount_cents').in('account_id', accountIds).order('current_period_end', { ascending: false, nullsFirst: false }),
        ctx.admin.from('license_account_entitlements').select('account_id, entitlement, seat_limit').in('account_id', accountIds),
        ctx.admin.from('license_devices').select('id, account_id, machine_id, platform, sketchup_version, revoked_at, last_seen_at').in('account_id', accountIds).is('revoked_at', null),
        ctx.admin.from('license_orders').select('id, account_id, offer_key, status, amount_cents, created_at').in('account_id', accountIds).order('created_at', { ascending: false }),
      ])

      const membersByAccount = new Map<string, any[]>()
      for (const m of membersRes.data ?? []) {
        const list = membersByAccount.get(m.account_id) ?? []
        list.push(m)
        membersByAccount.set(m.account_id, list)
      }

      const subsByAccount = new Map<string, any[]>()
      for (const s of subsRes.data ?? []) {
        const list = subsByAccount.get(s.account_id) ?? []
        list.push(s)
        subsByAccount.set(s.account_id, list)
      }

      const entitlementsByAccount = new Map<string, any>()
      for (const e of entitlementsRes.data ?? []) {
        entitlementsByAccount.set(e.account_id, e)
      }

      const devicesByAccount = new Map<string, any[]>()
      for (const d of devicesRes.data ?? []) {
        const list = devicesByAccount.get(d.account_id) ?? []
        list.push(d)
        devicesByAccount.set(d.account_id, list)
      }

      const ordersByAccount = new Map<string, any[]>()
      for (const o of ordersRes.data ?? []) {
        const list = ordersByAccount.get(o.account_id) ?? []
        list.push(o)
        ordersByAccount.set(o.account_id, list)
      }

      const now = Date.now()

      let result = accounts.map((acc) => {
        const members = membersByAccount.get(acc.id) ?? []
        const owner = members.find((m) => m.role === 'owner') || members[0]
        const subs = subsByAccount.get(acc.id) ?? []
        const entitlement = entitlementsByAccount.get(acc.id)
        const isLifetime = entitlement?.entitlement === 'lifetime'

        const currentSub = subs.find((s) =>
          s.current_period_end && new Date(s.current_period_end).getTime() > now && ['active', 'past_due', 'canceled'].includes(s.status)
        )
        const pendingSub = subs.find((s) => s.status === 'pending')
        const activeSub = currentSub || pendingSub || subs[0]

        const devices = devicesByAccount.get(acc.id) ?? []
        const orders = ordersByAccount.get(acc.id) ?? []

        let computedStatus: string = 'none'
        if (isLifetime) computedStatus = 'active'
        else if (currentSub) computedStatus = currentSub.status === 'past_due' ? 'past_due' : 'active'
        else if (pendingSub || orders.some((o) => o.status === 'pending')) computedStatus = 'pending'
        else if (subs.length) computedStatus = 'expired'

        return {
          id: acc.id,
          name: acc.name,
          createdAt: acc.created_at,
          ownerEmail: owner?.email ?? '—',
          ownerName: owner?.display_name ?? owner?.name ?? null,
          status: computedStatus,
          isLifetime,
          plan: isLifetime ? 'Lifetime' : activeSub?.offer_key === 'pro_annual' ? 'Pro Anual' : activeSub?.offer_key === 'pro_monthly' ? 'Pro Mensal' : 'Free',
          offerKey: activeSub?.offer_key ?? null,
          expiresAt: isLifetime ? null : currentSub?.current_period_end ?? null,
          seatLimit: isLifetime ? entitlement?.seat_limit ?? 3 : 3,
          membersCount: members.length,
          activeDevicesCount: devices.length,
          devices: devices.map((d) => ({
            id: d.id,
            machineId: d.machine_id,
            platform: d.platform,
            sketchupVersion: d.sketchup_version,
            lastSeenAt: d.last_seen_at,
          })),
          recentOrders: orders.slice(0, 3),
        }
      })

      // Filtragem por busca
      if (search) {
        result = result.filter((item) =>
          item.name.toLowerCase().includes(search) ||
          item.ownerEmail.toLowerCase().includes(search) ||
          item.id.toLowerCase().includes(search)
        )
      }

      // Filtragem por status
      if (statusFilter && statusFilter !== 'todos') {
        if (statusFilter === 'lifetime') {
          result = result.filter((item) => item.isLifetime)
        } else {
          result = result.filter((item) => item.status === statusFilter)
        }
      }

      return respond(req, { success: true, accounts: result })
    }

    // 2. AÇÃO: Alterar Licença do Usuário
    if (action === 'update-license') {
      const { accountId, lifetime, status, expiresAt, seatLimit } = body
      if (!accountId) return respond(req, { error: 'bad_request', message: 'ID da conta não informado.' }, 400)

      // Atualizar / conceder / revogar Lifetime
      if (lifetime === true) {
        const { error: entError } = await ctx.admin.from('license_account_entitlements')
          .upsert({
            account_id: accountId,
            entitlement: 'lifetime',
            seat_limit: Number(seatLimit) || 3,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'account_id' })
        if (entError) throw entError
      } else if (lifetime === false) {
        await ctx.admin.from('license_account_entitlements')
          .delete()
          .eq('account_id', accountId)
          .eq('entitlement', 'lifetime')
      }

      // Atualizar status / expiração da assinatura
      if (status || expiresAt) {
        const { data: existingSubs } = await ctx.admin.from('license_subscriptions')
          .select('id')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(1)

        const subId = existingSubs?.[0]?.id

        const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
        if (status) updateData.status = status
        if (expiresAt) updateData.current_period_end = new Date(expiresAt).toISOString()

        if (subId) {
          const { error: subErr } = await ctx.admin.from('license_subscriptions')
            .update(updateData)
            .eq('id', subId)
          if (subErr) throw subErr
        } else {
          // Criar assinatura manual
          const { error: insertErr } = await ctx.admin.from('license_subscriptions')
            .insert({
              account_id: accountId,
              provider: 'manual_admin',
              offer_key: 'pro_annual',
              status: status || 'active',
              amount_cents: 0,
              currency: 'BRL',
              current_period_end: expiresAt ? new Date(expiresAt).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            })
          if (insertErr) throw insertErr
        }
      }

      return respond(req, { success: true, message: 'Licença do usuário atualizada com sucesso.' })
    }

    // 3. AÇÃO: Revogar Dispositivo
    if (action === 'revoke-device') {
      const { deviceId } = body
      if (!deviceId) return respond(req, { error: 'bad_request', message: 'ID do dispositivo não informado.' }, 400)

      const { error: devError } = await ctx.admin.from('license_devices')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', deviceId)
      if (devError) throw devError

      return respond(req, { success: true, message: 'Dispositivo revogado com sucesso.' })
    }

    return respond(req, { error: 'invalid_action', message: 'Ação não reconhecida.' }, 400)
  } catch (error) {
    console.error('admin-users failed', errorMessage(error))
    return respond(req, { error: 'admin_users_failed', message: 'Erro ao processar ação de administração de usuários.' }, 500)
  }
})
