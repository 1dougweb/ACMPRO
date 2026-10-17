import { authenticatePluginRequest, errorMessage, preflight, respond } from '../_shared/sketchup-license.ts'

interface Body { locale?: string }
const locales = new Set(['pt-BR', 'en', 'es'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const ctx = await authenticatePluginRequest(req)
    if (!ctx) return respond(req, { success: false, error: 'DEVICE_NOT_AUTHORIZED' }, 403)
    const body = await req.json().catch(() => null) as Body | null
    if (!body?.locale || !locales.has(body.locale)) return respond(req, { success: false, error: 'INVALID_LOCALE' }, 400)
    const { error } = await ctx.admin.from('license_members')
      .update({ preferred_locale: body.locale })
      .eq('id', ctx.membership.id)
    if (error) throw error
    return respond(req, { success: true, server_now: Math.floor(Date.now() / 1000) })
  } catch (error) {
    console.error('sketchup-locale failed', errorMessage(error))
    return respond(req, { success: false, error: 'LOCALE_UPDATE_FAILED' }, 500)
  }
})
