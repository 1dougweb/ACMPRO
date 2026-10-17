import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { getAccessibleProject, hasActiveProjectLicense, projectRequestContext } from '../_shared/project-auth.ts'

interface IncomingPart {
  name?: unknown
  width?: unknown
  height?: unknown
  quantity?: unknown
  cut_lines?: unknown
  fold_lines?: unknown
  dxf_content?: unknown
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'method_not_allowed' }, 405)
  const ctx = await projectRequestContext(req)
  if (!ctx) return respond(req, { success: false, error: 'unauthorized', message: 'Entre novamente no GOACM.' }, 401)

  try {
    if (!await hasActiveProjectLicense(ctx)) return respond(req, { success: false, error: 'subscription_required', message: 'Uma licença ativa é necessária para enviar peças.' }, 403)
    const body = await req.json().catch(() => null) as { project_id?: unknown; parts?: unknown } | null
    const projectId = typeof body?.project_id === 'string' ? body.project_id : ''
    const parts = Array.isArray(body?.parts) ? body.parts as IncomingPart[] : []
    if (!projectId || parts.length === 0 || parts.length > 500) {
      return respond(req, { success: false, error: 'invalid_parts_batch', message: 'O projeto ou a lista de peças é inválido.' }, 400)
    }
    const project = await getAccessibleProject(ctx, projectId)
    if (!project) return respond(req, { success: false, error: 'project_not_found', message: 'Este projeto não existe nesta equipe.' }, 404)

    const rows = []
    for (const part of parts) {
      const name = typeof part.name === 'string' ? part.name.trim() : ''
      const width = Number(part.width)
      const height = Number(part.height)
      const quantity = Number(part.quantity ?? 1)
      const dxf = typeof part.dxf_content === 'string' ? part.dxf_content : null
      if (!name || name.length > 200 || !Number.isFinite(width) || width <= 0
          || !Number.isFinite(height) || height <= 0 || !Number.isInteger(quantity) || quantity < 1) {
        return respond(req, { success: false, error: 'invalid_part', message: 'Uma das peças tem nome, medida ou quantidade inválida.' }, 400)
      }
      if (dxf && dxf.length > 2_000_000) {
        return respond(req, { success: false, error: 'dxf_too_large', message: 'Um arquivo DXF excedeu o limite aceito.' }, 413)
      }
      rows.push({
        account_id: ctx.membership.account_id,
        project_id: projectId,
        submitted_by: ctx.user.id,
        name,
        width_mm: width,
        height_mm: height,
        quantity,
        cut_lines: part.cut_lines ?? [],
        fold_lines: part.fold_lines ?? [],
        dxf_content: dxf,
      })
    }

    const { data: created, error } = await ctx.admin.from('license_project_parts').insert(rows)
      .select('id,name,width_mm,height_mm,quantity,created_at')
    if (error) throw error
    const { error: updateError } = await ctx.admin.from('license_projects')
      .update({ updated_at: new Date().toISOString() }).eq('id', projectId).eq('account_id', ctx.membership.account_id)
    if (updateError) throw updateError

    return respond(req, {
      success: true,
      total_parts: created?.length ?? rows.length,
      total_quantity: rows.reduce((total, item) => total + item.quantity, 0),
      created: created?.length ?? rows.length,
      failed: [],
    }, 201)
  } catch (error) {
    console.error('sketchup-parts-batch failed', errorMessage(error))
    return respond(req, { success: false, error: 'parts_batch_failed', message: 'Não foi possível salvar as peças deste lote.' }, 500)
  }
})
