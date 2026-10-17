import { clients, activeSubscription, activateDevice, deviceLimitResponse, errorMessage, findMembership, issueEntitlement, pluginUser, preflight, respond } from '../_shared/sketchup-license.ts'

interface Body {
  email?: string
  password?: string
  device?: { machine_id?: string; machine_name?: string; os_info?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const body = await req.json().catch(() => null) as Body | null
    const email = body?.email?.trim().toLowerCase() ?? ''
    const password = body?.password
    const machineId = body?.device?.machine_id?.trim() ?? ''
    const machineName = body?.device?.machine_name?.trim().slice(0, 100) || 'SketchUp'
    if (!email || !password || !machineId || machineId.length < 16 || machineId.length > 255) {
      return respond(req, { success: false, error: 'BAD_REQUEST', message: 'E-mail, senha e identificador da máquina são obrigatórios.' }, 400)
    }

    const { auth, admin } = clients()
    const { data, error } = await auth.auth.signInWithPassword({ email, password })
    if (error?.code === 'email_not_confirmed') {
      return respond(req, { success: false, error: 'EMAIL_NOT_VERIFIED', message: 'Confirme seu e-mail antes de entrar no SketchUp.' }, 403)
    }
    if (error || !data.user || !data.session) {
      return respond(req, { success: false, error: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' }, 401)
    }

    const membership = await findMembership(admin, data.user.id)
    if (!membership) {
      return respond(req, { success: false, error: 'ACCOUNT_NOT_LINKED', message: 'Esta conta não está vinculada a uma equipe ativa.' }, 403)
    }
    const subscription = await activeSubscription(admin, membership.account_id)
    if (!subscription) {
      return respond(req, { success: false, error: 'SUBSCRIPTION_REQUIRED', message: 'Sua assinatura Pro está inativa. Renove pelo portal.' }, 403)
    }

    const now = Math.floor(Date.now() / 1000)
    const entitlement = await issueEntitlement(machineId, subscription.current_period_end, now)
    const device = await activateDevice(admin, membership, machineId, machineName)
    return respond(req, {
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      refresh_expires_at: null,
      user: pluginUser(data.user, membership),
      device: { secret: device.secret, device_id: device.id },
      subscribed: true,
      sub_active: true,
      tier: 'pro',
      subscription_end: subscription.current_period_end,
      entitlement,
      server_now: now,
    })
  } catch (error) {
    const limit = deviceLimitResponse(req, error)
    if (limit) return limit
    const message = errorMessage(error)
    if (message === 'entitlement_signing_key_missing' || message === 'entitlement_signing_key_mismatch') {
      return respond(req, { success: false, error: 'LICENSE_SIGNING_KEY_NOT_CONFIGURED', message: 'A assinatura segura da licença ainda não está configurada.' }, 503)
    }
    console.error('sketchup-auth failed', message)
    return respond(req, { success: false, error: 'LOGIN_FAILED', message: 'Não foi possível validar a licença agora.' }, 500)
  }
})
