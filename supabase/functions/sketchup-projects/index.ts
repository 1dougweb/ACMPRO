import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { hasActiveProjectLicense, projectRequestContext } from '../_shared/project-auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (!['GET', 'POST'].includes(req.method)) return respond(req, { error: 'method_not_allowed' }, 405)

  try {
    const ctx = await projectRequestContext(req)
    if (!ctx) return respond(req, { success: false, error: 'unauthorized', message: 'Entre novamente no GOACM.' }, 401)
    if (!await hasActiveProjectLicense(ctx)) return respond(req, { success: false, error: 'subscription_required', message: 'Uma licença ativa é necessária para consultar projetos.' }, 403)

    const { data, error } = await ctx.admin.from('license_projects')
      .select('id,name,customer_name,status,created_at,updated_at,last_publication_at')
      .eq('account_id', ctx.membership.account_id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return respond(req, { success: true, projects: data ?? [] })
  } catch (error) {
    console.error('sketchup-projects failed', errorMessage(error))
    return respond(req, { success: false, error: 'projects_list_failed', message: 'Não foi possível carregar os projetos.' }, 500)
  }
})
