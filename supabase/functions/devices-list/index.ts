import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)

  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada.' }, 404)
    let query = ctx.admin
      .from('license_devices')
      .select('id,name,machine_id,last_seen_at,member:license_members!inner(email,display_name)')
      .eq('account_id', member.account_id)
      .is('revoked_at', null)
    if (member.role !== 'owner') query = query.eq('member_id', member.id)
    const { data, error } = await query.order('last_seen_at', { ascending: false })
    if (error) throw error

    const devices = (data ?? []).map((device) => ({
      id: device.id,
      name: device.name,
      machineId: device.machine_id,
      lastSeen: device.last_seen_at,
      memberName: device.member?.display_name ?? null,
      memberEmail: device.member?.email ?? null,
    }))
    return respond(req, { devices })
  } catch (error) {
    console.error('devices-list failed', errorMessage(error))
    return respond(req, { error: 'devices_list_failed', message: 'Não foi possível carregar os dispositivos.' }, 500)
  }
})
