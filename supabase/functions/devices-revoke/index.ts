import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)

  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const body = await req.json().catch(() => null) as { deviceId?: string } | null
    if (!body?.deviceId || !/^[0-9a-f-]{36}$/i.test(body.deviceId)) {
      return respond(req, { error: 'bad_request', message: 'Identificador de dispositivo inválido.' }, 400)
    }

    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada.' }, 404)
    const { data: device, error: deviceError } = await ctx.admin
      .from('license_devices')
      .select('id,member_id')
      .eq('id', body.deviceId)
      .eq('account_id', member.account_id)
      .is('revoked_at', null)
      .maybeSingle()
    if (deviceError) throw deviceError
    if (!device) return respond(req, { error: 'not_found', message: 'Dispositivo não encontrado.' }, 404)
    if (member.role !== 'owner' && device.member_id !== member.id) {
      return respond(req, { error: 'forbidden', message: 'Você só pode revogar suas próprias máquinas.' }, 403)
    }

    const { error } = await ctx.admin.from('license_devices').update({ revoked_at: new Date().toISOString() }).eq('id', device.id)
    if (error) throw error
    return respond(req, { ok: true })
  } catch (error) {
    console.error('devices-revoke failed', errorMessage(error))
    return respond(req, { error: 'devices_revoke_failed', message: 'Não foi possível revogar o dispositivo.' }, 500)
  }
})
