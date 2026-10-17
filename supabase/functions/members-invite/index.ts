import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { portalUrl } from '../_shared/mercadopago.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)
  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const body = await req.json().catch(() => null) as { email?: string } | null
    const email = body?.email?.trim().toLowerCase()
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(req, { error: 'bad_request', message: 'Informe um e-mail válido.' }, 400)
    }
    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada.' }, 404)
    if (member.role !== 'owner') return respond(req, { error: 'owner_required', message: 'Somente o titular pode gerenciar os acessos.' }, 403)
    if (email === ctx.user.email?.toLowerCase()) return respond(req, { error: 'owner_email', message: 'O e-mail do titular já ocupa um acesso.' }, 409)

    const { data: subscription, error: subscriptionError } = await ctx.admin.from('license_subscriptions')
      .select('id,status,current_period_end')
      .eq('account_id', member.account_id)
      .in('status', ['active', 'past_due', 'canceled'])
      .order('current_period_end', { ascending: false, nullsFirst: false })
      .limit(1)
    if (subscriptionError) throw subscriptionError
    const currentLicense = subscription?.[0]
    if (!currentLicense?.current_period_end || new Date(currentLicense.current_period_end).getTime() <= Date.now()) {
      return respond(req, { error: 'active_license_required', message: 'A equipe fica disponível enquanto a licença Pro estiver ativa.' }, 403)
    }

    const { data: foundUsers, error: userLookupError } = await ctx.admin.rpc('acm360_user_by_email', { target_email: email })
    if (userLookupError) throw userLookupError
    const existingUser = foundUsers?.[0] as { user_id: string; email_confirmed: boolean } | undefined
    const isConfirmed = Boolean(existingUser?.email_confirmed)

    const { data: invited, error: inviteError } = await ctx.admin.from('license_members').insert({
      account_id: member.account_id,
      user_id: isConfirmed ? existingUser?.user_id : null,
      email,
      display_name: null,
      role: 'member',
      status: isConfirmed ? 'active' : 'invited',
      invited_at: new Date().toISOString(),
      joined_at: isConfirmed ? new Date().toISOString() : null,
    }).select('id,email,display_name,role,status,created_at').single()
    if (inviteError) {
      if (inviteError.code === '23505') return respond(req, { error: 'member_exists', message: 'Este e-mail já está em uma equipe ou possui um convite pendente.' }, 409)
      if (inviteError.code === '23514') return respond(req, { error: 'seat_limit', message: 'Os três acessos disponíveis já estão ocupados.' }, 409)
      throw inviteError
    }

    if (!isConfirmed) {
      const { error: mailError } = await ctx.admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: portalUrl('/login'),
        data: {
          name: email.split('@')[0],
          license_member_invitation_id: invited.id,
        },
      })
      if (mailError) {
        await ctx.admin.from('license_members').delete().eq('id', invited.id)
        console.error('members-invite email failed', mailError.message)
        return respond(req, { error: 'invite_email_failed', message: 'O convite não pôde ser enviado. Verifique o serviço de e-mail do portal.' }, 502)
      }
    }

    return respond(req, { member: {
      id: invited.id,
      email: invited.email,
      name: invited.display_name,
      role: invited.role,
      status: invited.status,
      createdAt: invited.created_at,
    } }, 201)
  } catch (error) {
    console.error('members-invite failed', errorMessage(error))
    return respond(req, { error: 'members_invite_failed', message: 'Não foi possível convidar este acesso.' }, 500)
  }
})
