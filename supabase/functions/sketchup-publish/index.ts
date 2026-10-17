import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { getAccessibleProject, hasActiveProjectLicense, projectRequestContext } from '../_shared/project-auth.ts'

const bucket = 'goacm-project-artifacts'
type ArtifactInput = { kind?: unknown; file_name?: unknown; size_bytes?: unknown; sha256?: unknown; content_type?: unknown }

function safeFileName(value: unknown) {
  const raw = typeof value === 'string' ? value.split(/[\\/]/).pop() ?? '' : ''
  const safe = raw.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^\.+/, '').slice(0, 140)
  return safe || 'arquivo.bin'
}

function text(value: unknown, limit = 500) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { success: false, error: 'method_not_allowed' }, 405)
  const ctx = await projectRequestContext(req)
  if (!ctx) return respond(req, { success: false, error: 'unauthorized', message: 'Entre novamente no GOACM.' }, 401)

  try {
    if (!await hasActiveProjectLicense(ctx)) return respond(req, { success: false, error: 'subscription_required', message: 'Uma licença ativa é necessária para publicar.' }, 403)
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const action = text(body?.action, 20)

    if (action === 'list') {
      const projectId = text(body?.project_id, 80)
      const project = projectId ? await getAccessibleProject(ctx, projectId) : null
      if (!project) return respond(req, { success: false, error: 'project_not_found', message: 'Este projeto não existe nesta equipe.' }, 404)
      const { data, error } = await ctx.admin.from('license_project_publications')
        .select('id,revision,created_at,published_at,author_name,message,status,datasets')
        .eq('project_id', projectId).eq('account_id', ctx.membership.account_id)
        .order('revision', { ascending: false }).limit(100)
      if (error) throw error
      const publications = (data ?? []).map((item) => ({
        id: item.id,
        seq: item.revision,
        created_at: item.published_at ?? item.created_at,
        author_name: item.author_name,
        message: item.message,
        status: item.status,
        datasets: item.datasets,
      }))
      return respond(req, { success: true, publications })
    }

    if (action === 'init') {
      const projectId = text(body?.project_id, 80)
      const project = projectId ? await getAccessibleProject(ctx, projectId) : null
      if (!project) return respond(req, { success: false, error: 'project_not_found', message: 'Este projeto não existe nesta equipe.' }, 404)
      const inputs = Array.isArray(body?.artifacts) ? body.artifacts as ArtifactInput[] : []
      if (inputs.length > 20) return respond(req, { success: false, error: 'too_many_artifacts', message: 'Uma publicação pode incluir até 20 arquivos.' }, 400)

      const artifactMeta = inputs.map((item, index) => {
        const fileName = safeFileName(item.file_name)
        const size = Number(item.size_bytes ?? 0)
        if (!Number.isSafeInteger(size) || size < 0 || size > 50 * 1024 * 1024) throw new Error('invalid_artifact_size')
        return {
          kind: text(item.kind, 40) || 'other',
          file_name: fileName,
          size_bytes: size,
          sha256: text(item.sha256, 64),
          content_type: text(item.content_type, 120) || 'application/octet-stream',
          object_path: '',
          upload_index: index,
        }
      })

      let publication: { id: string; revision: number } | null = null
      for (let attempt = 0; attempt < 4 && !publication; attempt++) {
        const { data: latest, error: latestError } = await ctx.admin.from('license_project_publications')
          .select('revision').eq('project_id', projectId).order('revision', { ascending: false }).limit(1).maybeSingle()
        if (latestError) throw latestError
        const revision = (latest?.revision ?? 0) + 1
        const { data, error } = await ctx.admin.from('license_project_publications').insert({
          account_id: ctx.membership.account_id,
          project_id: projectId,
          author_user_id: ctx.user.id,
          author_name: text(ctx.user.user_metadata.name ?? ctx.user.user_metadata.full_name ?? ctx.user.email, 160),
          revision,
          message: text(body?.message, 1000),
          model_name: text(body?.model_name, 200),
          plugin_version: text(body?.plugin_version, 60) || null,
          sketchup_version: text(body?.sketchup_version, 60) || null,
          parts_summary: body?.parts_summary ?? {},
          activity: body?.activity ?? [],
          metrics: body?.metrics ?? {},
          datasets: body?.datasets ?? [],
          artifacts: artifactMeta,
          status: 'pending',
        }).select('id,revision').single()
        if (!error) publication = data
        else if (error.code !== '23505' || attempt === 3) throw error
      }
      if (!publication) throw new Error('publication_create_failed')

      const uploads = []
      try {
        for (let index = 0; index < artifactMeta.length; index++) {
          const artifact = artifactMeta[index]
          const objectPath = `${ctx.membership.account_id}/${projectId}/${publication.id}/${index}-${artifact.file_name}`
          const { data, error } = await ctx.admin.storage.from(bucket).createSignedUploadUrl(objectPath)
          if (error || !data?.signedUrl) throw error ?? new Error('signed_upload_url_missing')
          artifact.object_path = objectPath
          const baseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const uploadUrl = data.signedUrl.startsWith('http') ? data.signedUrl : `${baseUrl}${data.signedUrl}`
          uploads.push({ file_name: artifact.file_name, upload_url: uploadUrl })
        }
        const { error: artifactUpdateError } = await ctx.admin.from('license_project_publications')
          .update({ artifacts: artifactMeta }).eq('id', publication.id).eq('account_id', ctx.membership.account_id)
        if (artifactUpdateError) throw artifactUpdateError
      } catch (error) {
        await ctx.admin.from('license_project_publications').delete().eq('id', publication.id)
        throw error
      }
      return respond(req, { success: true, publication_id: publication.id, seq: publication.revision, uploads })
    }

    if (action === 'finalize') {
      const publicationId = text(body?.publication_id, 80)
      if (!publicationId) return respond(req, { success: false, error: 'publication_required', message: 'Identificador de publicação inválido.' }, 400)
      const { data: publication, error: publicationError } = await ctx.admin.from('license_project_publications')
        .select('id,project_id,revision,status,artifacts')
        .eq('id', publicationId).eq('account_id', ctx.membership.account_id).maybeSingle()
      if (publicationError) throw publicationError
      if (!publication) return respond(req, { success: false, error: 'publication_not_found', message: 'Publicação não encontrada.' }, 404)

      const artifacts = Array.isArray(publication.artifacts) ? publication.artifacts as Array<{ file_name: string; object_path: string }> : []
      if (publication.status !== 'published' && artifacts.length) {
        const folder = `${ctx.membership.account_id}/${publication.project_id}/${publication.id}`
        const { data: objects, error: objectsError } = await ctx.admin.storage.from(bucket).list(folder, { limit: 100 })
        if (objectsError) throw objectsError
        const present = new Set((objects ?? []).map((object) => object.name))
        const missing = artifacts.filter((artifact) => !present.has(artifact.object_path.split('/').pop() ?? ''))
        if (missing.length) return respond(req, { success: false, error: 'artifacts_incomplete', missing: missing.map((item) => item.file_name) }, 409)
      }

      const now = new Date().toISOString()
      const { error: finishError } = await ctx.admin.from('license_project_publications')
        .update({ status: 'published', published_at: now }).eq('id', publication.id).eq('account_id', ctx.membership.account_id)
      if (finishError) throw finishError
      const { error: projectError } = await ctx.admin.from('license_projects')
        .update({ updated_at: now, last_publication_at: now }).eq('id', publication.project_id).eq('account_id', ctx.membership.account_id)
      if (projectError) throw projectError
      return respond(req, { success: true, publication_id: publication.id, seq: publication.revision })
    }

    return respond(req, { success: false, error: 'invalid_action', message: 'Ação de publicação inválida.' }, 400)
  } catch (error) {
    console.error('sketchup-publish failed', errorMessage(error))
    return respond(req, { success: false, error: 'publication_failed', message: 'Não foi possível concluir a operação de publicação.' }, 500)
  }
})
