import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)
  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const body = await req.json().catch(() => null) as { memberId?: string } | null
    if (!body?.memberId || !/^[0-9a-f-]{36}$/i.test(body.memberId)) {
      return respond(req, { error: 'bad_request', message: 'Identificador de acesso inválido.' }, 400)
    }
    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada.' }, 404)
    if (member.role !== 'owner') return respond(req, { error: 'owner_required', message: 'Somente o titular pode remover acessos.' }, 403)

    const { data: target, error: targetError } = await ctx.admin.from('license_members')
      .select('id,role,status')
      .eq('id', body.memberId)
      .eq('account_id', member.account_id)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target || target.role === 'owner' || target.status === 'removed') {
      return respond(req, { error: 'not_found', message: 'Acesso não encontrado.' }, 404)
    }

    const now = new Date().toISOString()
    const { error: revokeError } = await ctx.admin.from('license_devices')
      .update({ revoked_at: now })
      .eq('member_id', target.id)
      .is('revoked_at', null)
    if (revokeError) throw revokeError

    const { error: removeError } = await ctx.admin.from('license_members')
      .update({ status: 'removed' })
      .eq('id', target.id)
    if (removeError) throw removeError
    return respond(req, { ok: true })
  } catch (error) {
    console.error('members-remove failed', errorMessage(error))
    return respond(req, { error: 'members_remove_failed', message: 'Não foi possível remover este acesso.' }, 500)
  }
})
