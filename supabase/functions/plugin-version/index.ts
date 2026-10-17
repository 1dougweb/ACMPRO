import { createClient } from 'npm:@supabase/supabase-js@2'
import { requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { verifiedEmail } from '../_shared/site-admin.ts'

const DEFAULT_FALLBACK_VERSION = '1.1.38'
const DEFAULT_DOWNLOAD_URL = 'https://acmgo.vercel.app/'
const STORAGE_BUCKET = 'plugin-releases'

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw new Error('Supabase runtime is not configured.')
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const url = new URL(req.url)
  const admin = getAdminClient()

  // 1. GET: Retorna a versão mais recente para o SketchUp ou lista para o admin
  if (req.method === 'GET') {
    try {
      const listAll = url.searchParams.get('list') === 'true'

      if (listAll) {
        const ctx = await requestContext(req)
        if (!ctx || !verifiedEmail(ctx.user)) {
          return respond(req, { error: 'site_admin_required' }, 403)
        }

        const { data, error } = await admin
          .from('license_plugin_releases')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) {
          console.warn('Erro ao listar releases:', error.message)
          return respond(req, { success: true, releases: [] })
        }

        return respond(req, { success: true, releases: data ?? [] })
      }

      // Consulta a versão ativa mais recente
      const { data, error } = await admin
        .from('license_plugin_releases')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error || !data) {
        return respond(req, {
          success: true,
          version: DEFAULT_FALLBACK_VERSION,
          download_url: DEFAULT_DOWNLOAD_URL,
          notes: 'Versão estável oficial do GOACM.',
          min_sketchup_version: '2021',
          mandatory: false,
          released_at: new Date().toISOString(),
        })
      }

      return respond(req, {
        success: true,
        version: data.version,
        download_url: data.file_url,
        notes: data.notes || '',
        file_name: data.file_name,
        file_size_bytes: data.file_size_bytes,
        sha256: data.sha256,
        min_sketchup_version: data.min_sketchup_version || '2021',
        mandatory: Boolean(data.is_mandatory),
        released_at: data.created_at,
      })
    } catch (err) {
      console.error('Falha ao obter versão do plugin:', errorMessage(err))
      return respond(req, {
        success: true,
        version: DEFAULT_FALLBACK_VERSION,
        download_url: DEFAULT_DOWNLOAD_URL,
        notes: 'Versão estável padrão.',
      })
    }
  }

  // 2. POST: Apenas Site Admins (ou chave autorizada) podem publicar e registrar versões
  if (req.method === 'POST') {
    const isDirectKey = req.headers.get('x-publish-key') === 'goacm-release-sync-2026'
    let userId: string | null = null

    if (!isDirectKey) {
      const ctx = await requestContext(req)
      if (!ctx) return respond(req, { error: 'unauthorized' }, 401)
      if (!verifiedEmail(ctx.user)) {
        return respond(req, { error: 'site_admin_required' }, 403)
      }
      userId = ctx.user.id
    }

    try {
      const body = await req.json()
      const action = body.action || 'register'

      // Garante que o bucket 'plugin-releases' exista
      try {
        await admin.storage.createBucket(STORAGE_BUCKET, { public: true })
      } catch {
        // bucket já pode existir
      }

      // Publicação direta em base64 (CLI ou script)
      if (action === 'publish_base64') {
        const {
          version,
          notes,
          file_name,
          file_base64,
          min_sketchup_version,
          is_mandatory,
        } = body

        if (!version || !file_base64) {
          return respond(req, { error: 'invalid_payload', message: 'Versão e arquivo são obrigatórios.' }, 400)
        }

        const binaryStr = atob(file_base64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i)
        }

        const fileName = String(file_name || `GOACM-${version}.rbz`).replace(/[^a-zA-Z0-9._-]/g, '_')
        const objectPath = `releases/${Date.now()}_${fileName}`

        const { error: uploadErr } = await admin.storage
          .from(STORAGE_BUCKET)
          .upload(objectPath, bytes, { contentType: 'application/octet-stream', upsert: true })

        if (uploadErr) throw uploadErr

        const { data: pubData } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath)

        const { data: inserted, error: insertErr } = await admin
          .from('license_plugin_releases')
          .insert({
            version: String(version).trim(),
            notes: String(notes || '').trim(),
            file_url: pubData.publicUrl,
            file_name: fileName,
            file_size_bytes: bytes.length,
            sha256: '',
            min_sketchup_version: String(min_sketchup_version || '2021'),
            is_mandatory: Boolean(is_mandatory),
            is_active: true,
            created_by: userId,
          })
          .select()
          .single()

        if (insertErr) throw insertErr

        return respond(req, { success: true, release: inserted })
      }

      // Solicitação de URL assinada para upload do arquivo .rbz
      if (action === 'get_upload_url') {
        const fileName = String(body.file_name || `GOACM-${body.version || Date.now()}.rbz`).replace(/[^a-zA-Z0-9._-]/g, '_')
        const objectPath = `releases/${Date.now()}_${fileName}`

        const { data: uploadData, error: uploadErr } = await admin.storage
          .from(STORAGE_BUCKET)
          .createSignedUploadUrl(objectPath)

        if (uploadErr || !uploadData) {
          throw uploadErr ?? new Error('Falha ao gerar URL de upload')
        }

        const { data: pubData } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath)

        return respond(req, {
          success: true,
          upload_url: uploadData.signedUrl,
          public_url: pubData.publicUrl,
          object_path: objectPath,
        })
      }

      // Registro da release no banco de dados
      if (action === 'register') {
        const {
          version,
          notes,
          file_url,
          file_name,
          file_size_bytes,
          sha256,
          min_sketchup_version,
          is_mandatory,
        } = body

        if (!version || !file_url) {
          return respond(req, { error: 'invalid_payload', message: 'Versão e URL do arquivo são obrigatórias.' }, 400)
        }

        const { data: inserted, error: insertErr } = await admin
          .from('license_plugin_releases')
          .insert({
            version: String(version).trim(),
            notes: String(notes || '').trim(),
            file_url: String(file_url).trim(),
            file_name: String(file_name || ''),
            file_size_bytes: Number(file_size_bytes) || 0,
            sha256: String(sha256 || ''),
            min_sketchup_version: String(min_sketchup_version || '2021'),
            is_mandatory: Boolean(is_mandatory),
            is_active: true,
            created_by: ctx.user.id,
          })
          .select()
          .single()

        if (insertErr) throw insertErr

        return respond(req, { success: true, release: inserted })
      }

      return respond(req, { error: 'unknown_action' }, 400)
    } catch (err) {
      console.error('Falha na operação de release do plugin:', errorMessage(err))
      return respond(req, { error: 'release_operation_failed', message: errorMessage(err) }, 500)
    }
  }

  return respond(req, { error: 'method_not_allowed' }, 405)
})
