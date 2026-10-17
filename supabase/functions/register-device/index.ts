import { clients, activeSubscription, activateDevice, bearer, deviceLimitResponse, errorMessage, findMembership, preflight, respond } from '../_shared/sketchup-license.ts'

interface Body {
  machine_id?: string
  machine_name?: string
  os_info?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const accessToken = bearer(req)
    const body = await req.json().catch(() => null) as Body | null
    const machineId = body?.machine_id?.trim() ?? ''
    if (!accessToken || !machineId || machineId.length < 16 || machineId.length > 255 || req.headers.get('x-device-id') !== machineId) {
      return respond(req, { success: false, error: 'BAD_REQUEST' }, 400)
    }
    const { auth, admin } = clients()
    const { data, error } = await auth.auth.getUser(accessToken)
    if (error || !data.user) return respond(req, { success: false, error: 'UNAUTHORIZED' }, 401)
    const membership = await findMembership(admin, data.user.id)
    if (!membership) return respond(req, { success: false, error: 'DEVICE_NOT_AUTHORIZED' }, 403)
    const subscription = await activeSubscription(admin, membership.account_id)
    if (!subscription) return respond(req, { success: false, error: 'SUBSCRIPTION_REQUIRED' }, 403)

    const device = await activateDevice(admin, membership, machineId, body?.machine_name?.trim() || 'SketchUp')
    return respond(req, {
      success: true,
      device: { secret: device.secret, device_id: device.id },
      server_now: Math.floor(Date.now() / 1000),
    })
  } catch (error) {
    const limit = deviceLimitResponse(req, error)
    if (limit) return limit
    console.error('register-device failed', errorMessage(error))
    return respond(req, { success: false, error: 'DEVICE_REGISTRATION_FAILED', message: 'Não foi possível autorizar este computador.' }, 500)
  }
})
