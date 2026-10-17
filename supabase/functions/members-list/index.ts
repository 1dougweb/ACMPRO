import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)
  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada.' }, 404)
    const { data, error } = await ctx.admin.from('license_members')
      .select('id,email,display_name,role,status,created_at')
      .eq('account_id', member.account_id)
      .in('status', ['active', 'invited'])
      .order('created_at', { ascending: true })
    if (error) throw error
    return respond(req, { members: (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.display_name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    })) })
  } catch (error) {
    console.error('members-list failed', errorMessage(error))
    return respond(req, { error: 'members_list_failed', message: 'Não foi possível carregar a equipe.' }, 500)
  }
})
