import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { getAccessibleProject, hasActiveProjectLicense, projectRequestContext } from '../_shared/project-auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)
  const ctx = await projectRequestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    if (!await hasActiveProjectLicense(ctx)) return respond(req, { error: 'subscription_required', message: 'Uma licença ativa é necessária.' }, 403)
    const body = await req.json().catch(() => null) as { projectId?: unknown } | null
    const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
    const project = projectId ? await getAccessibleProject(ctx, projectId) : null
    if (!project) return respond(req, { error: 'project_not_found', message: 'Este projeto não existe nesta equipe.' }, 404)

    const [{ data: publications, error: publicationsError }, { data: parts, error: partsError }] = await Promise.all([
      ctx.admin.from('license_project_publications')
        .select('id,revision,message,model_name,author_name,status,metrics,datasets,parts_summary,activity,artifacts,created_at,published_at')
        .eq('project_id', project.id).eq('account_id', ctx.membership.account_id)
        .order('revision', { ascending: false }).limit(50),
      ctx.admin.from('license_project_parts')
        .select('id,name,width_mm,height_mm,quantity,created_at')
        .eq('project_id', project.id).eq('account_id', ctx.membership.account_id)
        .order('created_at', { ascending: false }).limit(250),
    ])
    if (publicationsError ?? partsError) throw publicationsError ?? partsError
    return respond(req, { project, publications: publications ?? [], parts: parts ?? [] })
  } catch (error) {
    console.error('project-details failed', errorMessage(error))
    return respond(req, { error: 'project_details_failed', message: 'Não foi possível carregar os detalhes do projeto.' }, 500)
  }
})
