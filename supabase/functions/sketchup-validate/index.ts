import { authenticatePluginRequest, errorMessage, pluginLicenseState, preflight, respond } from '../_shared/sketchup-license.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'GET') return respond(req, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const ctx = await authenticatePluginRequest(req)
    if (!ctx) return respond(req, { success: false, error: 'DEVICE_NOT_AUTHORIZED' }, 403)
    return respond(req, { success: true, ...(await pluginLicenseState(ctx)) })
  } catch (error) {
    const message = errorMessage(error)
    if (message === 'entitlement_signing_key_missing' || message === 'entitlement_signing_key_mismatch') {
      return respond(req, { success: false, error: 'LICENSE_SIGNING_KEY_NOT_CONFIGURED' }, 503)
    }
    console.error('sketchup-validate failed', message)
    return respond(req, { success: false, error: 'LICENSE_VALIDATION_FAILED' }, 500)
  }
})
