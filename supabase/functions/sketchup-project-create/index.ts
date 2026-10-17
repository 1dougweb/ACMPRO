import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { hasActiveProjectLicense, projectRequestContext } from '../_shared/project-auth.ts'

interface Body { name?: unknown; customerName?: unknown; customer_name?: unknown }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'method_not_allowed' }, 405)

  const ctx = await projectRequestContext(req)
  if (!ctx) return respond(req, { success: false, error: 'unauthorized', message: 'Entre novamente no GOACM.' }, 401)

  try {
    if (!await hasActiveProjectLicense(ctx)) return respond(req, { success: false, error: 'subscription_required', message: 'Uma licença ativa é necessária para criar projetos.' }, 403)
    const body = await req.json().catch(() => null) as Body | null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const customerName = typeof (body?.customerName ?? body?.customer_name) === 'string'
      ? String(body?.customerName ?? body?.customer_name).trim()
      : ''
    if (!name || name.length > 160 || customerName.length > 160) {
      return respond(req, { success: false, error: 'invalid_project', message: 'Informe um nome de projeto com até 160 caracteres.' }, 400)
    }

    const { data, error } = await ctx.admin.from('license_projects').insert({
      account_id: ctx.membership.account_id,
      created_by: ctx.user.id,
      name,
      customer_name: customerName,
      status: 'rascunho',
    }).select('id,name,customer_name,status,created_at,updated_at,last_publication_at').single()
    if (error) throw error
    return respond(req, { success: true, project: data })
  } catch (error) {
    console.error('sketchup-project-create failed', errorMessage(error))
    return respond(req, { success: false, error: 'project_create_failed', message: 'Não foi possível criar o projeto.' }, 500)
  }
})
