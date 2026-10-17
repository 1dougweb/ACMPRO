import { authenticatePluginRequest, errorMessage, preflight, respond } from '../_shared/sketchup-license.ts'

interface Body { machine_id?: string; refresh_token?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const ctx = await authenticatePluginRequest(req)
    const body = await req.json().catch(() => null) as Body | null
    if (!ctx || !body?.refresh_token || body.machine_id !== ctx.machineId) {
      return respond(req, { success: false, error: 'DEVICE_NOT_AUTHORIZED' }, 403)
    }
    const { error } = await ctx.admin.auth.admin.signOut(ctx.accessToken, 'local')
    if (error) console.warn('sketchup-revoke could not revoke the local session')
    return respond(req, { success: true })
  } catch (error) {
    console.error('sketchup-revoke failed', errorMessage(error))
    return respond(req, { success: false, error: 'REVOKE_FAILED' }, 500)
  }
})
