import { clients, activeSubscription, errorMessage, findMembership, issueEntitlement, pluginUser, preflight, respond, validateDevice } from '../_shared/sketchup-license.ts'

interface Body { refresh_token?: string; machine_id?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const body = await req.json().catch(() => null) as Body | null
    const refreshToken = body?.refresh_token ?? ''
    const machineId = body?.machine_id?.trim() ?? ''
    if (!refreshToken || !machineId || req.headers.get('x-device-id') !== machineId) {
      return respond(req, { success: false, error: 'INVALID_REFRESH' }, 401)
    }

    const { auth, admin } = clients()
    const { data, error } = await auth.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.user || !data.session) {
      return respond(req, { success: false, error: 'INVALID_REFRESH', message: 'A sessão expirou. Entre novamente.' }, 401)
    }

    const membership = await findMembership(admin, data.user.id)
    if (!membership) return respond(req, { success: false, error: 'DEVICE_NOT_AUTHORIZED' }, 403)
    const deviceId = await validateDevice(admin, membership, machineId, req.headers.get('x-device-secret') ?? '')
    if (!deviceId) {
      return respond(req, { success: false, error: 'DEVICE_NOT_AUTHORIZED', message: 'Este computador não está autorizado.' }, 403)
    }

    const subscription = await activeSubscription(admin, membership.account_id)
    const now = Math.floor(Date.now() / 1000)
    if (!subscription) {
      return respond(req, {
        success: true,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        refresh_expires_at: null,
        user: pluginUser(data.user, membership),
        subscribed: false,
        sub_active: false,
        tier: 'free',
        subscription_end: null,
        server_now: now,
      })
    }
    const entitlement = await issueEntitlement(machineId, subscription.current_period_end, now)
    return respond(req, {
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      refresh_expires_at: null,
      user: pluginUser(data.user, membership),
      subscribed: true,
      sub_active: true,
      tier: 'pro',
      subscription_end: subscription.current_period_end,
      entitlement,
      server_now: now,
    })
  } catch (error) {
    const message = errorMessage(error)
    if (message === 'entitlement_signing_key_missing' || message === 'entitlement_signing_key_mismatch') {
      return respond(req, { success: false, error: 'LICENSE_SIGNING_KEY_NOT_CONFIGURED' }, 503)
    }
    console.error('sketchup-refresh failed', message)
    return respond(req, { success: false, error: 'REFRESH_FAILED' }, 500)
  }
})
