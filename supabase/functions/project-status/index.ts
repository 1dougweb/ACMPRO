import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { getAccessibleProject, hasActiveProjectLicense, projectRequestContext } from '../_shared/project-auth.ts'

const statuses = ['rascunho', 'em_producao', 'concluido'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)
  const ctx = await projectRequestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    if (!await hasActiveProjectLicense(ctx)) return respond(req, { error: 'subscription_required', message: 'Uma licença ativa é necessária.' }, 403)
    const body = await req.json().catch(() => null) as { projectId?: unknown; status?: unknown } | null
    const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
    const status = typeof body?.status === 'string' ? body.status : ''
    if (!projectId || !statuses.includes(status as typeof statuses[number])) {
      return respond(req, { error: 'invalid_project_status', message: 'Escolha um projeto e uma etapa válidos.' }, 400)
    }
    const project = await getAccessibleProject(ctx, projectId)
    if (!project) return respond(req, { error: 'project_not_found', message: 'Este projeto não existe nesta equipe.' }, 404)

    const { data, error } = await ctx.admin.from('license_projects').update({ status, updated_at: new Date().toISOString() })
      .eq('id', projectId).eq('account_id', ctx.membership.account_id)
      .select('id,name,customer_name,status,created_at,updated_at,last_publication_at').single()
    if (error) throw error
    return respond(req, { project: data })
  } catch (error) {
    console.error('project-status failed', errorMessage(error))
    return respond(req, { error: 'project_status_failed', message: 'Não foi possível atualizar a etapa do projeto.' }, 500)
  }
})
