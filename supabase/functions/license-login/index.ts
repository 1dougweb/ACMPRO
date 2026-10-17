import { createClient } from 'npm:@supabase/supabase-js@2'
import { importPKCS8, SignJWT } from 'npm:jose@6'
import { errorMessage, preflight, respond } from '../_shared/http.ts'

interface Body {
  email?: string
  password?: string
  machineId?: string
  machineName?: string
}

function clients() {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) throw new Error('Supabase credentials are not configured.')
  return {
    auth: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)

  try {
    const body = await req.json().catch(() => null) as Body | null
    const email = body?.email?.trim().toLowerCase()
    const password = body?.password
    const machineId = body?.machineId?.trim()
    const machineName = body?.machineName?.trim().slice(0, 100) || 'SketchUp'
    if (!email || !password || !machineId || machineId.length > 255) {
      return respond(req, { error: 'bad_request', message: 'E-mail, senha e identificador da máquina são obrigatórios.' }, 400)
    }

    const deviceLimitPerPerson = 1
    const privatePem = (Deno.env.get('GOACM_LICENSE_SIGNING_PRIVATE_KEY')
      ?? Deno.env.get('ACM360_LICENSE_SIGNING_PRIVATE_KEY'))?.replace(/\\n/g, '\n')
    if (!privatePem) {
      return respond(req, { error: 'license_server_not_configured', message: 'A ativação ainda depende da configuração de licença do GOACM.' }, 503)
    }
    let signingKey
    try {
      signingKey = await importPKCS8(privatePem, 'RS256')
    } catch {
      return respond(req, { error: 'license_signing_key_invalid', message: 'A chave de assinatura da licença não está configurada corretamente.' }, 503)
    }

    const { auth, admin } = clients()
    const { data: authData, error: authError } = await auth.auth.signInWithPassword({ email, password })
    if (authError?.code === 'email_not_confirmed') {
      return respond(req, { error: 'email_not_verified', message: 'Confirme seu e-mail antes de entrar no GOACM no SketchUp.' }, 403)
    }
    if (authError || !authData.user) {
      return respond(req, { error: 'invalid_credentials', message: 'E-mail ou senha inválidos.' }, 401)
    }

    const { data: membership, error: membershipError } = await admin.from('license_members')
      .select('id,account_id,email,display_name,status')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!membership) return respond(req, { error: 'account_not_linked', message: 'Esta conta ainda não está vinculada a uma equipe GOACM ativa.' }, 403)

    const now = Date.now()
    const [{ data: subscriptions, error: subscriptionError }, { data: lifetimeEntitlement, error: entitlementError }] = await Promise.all([
      admin.from('license_subscriptions')
        .select('id,offer_key,status,current_period_end')
        .eq('account_id', membership.account_id)
        .in('status', ['active', 'past_due', 'canceled'])
        .gt('current_period_end', new Date(now).toISOString())
        .order('current_period_end', { ascending: false })
        .limit(1),
      admin.from('license_account_entitlements')
        .select('account_id')
        .eq('account_id', membership.account_id)
        .eq('entitlement', 'lifetime')
        .maybeSingle(),
    ])
    if (subscriptionError ?? entitlementError) throw subscriptionError ?? entitlementError
    const subscription = subscriptions?.[0]
    const isLifetime = Boolean(lifetimeEntitlement)
    if (!isLifetime && (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() <= now)) {
      return respond(req, { error: 'subscription_required', message: 'Sua assinatura Pro está inativa. Renove pelo portal GOACM.' }, 403)
    }

    // The legacy SketchUp login receives a short-lived token; lifetime access is
    // revalidated on the next login instead of embedding a non-revocable token.
    const expiresAt = isLifetime ? new Date(Date.now() + 48 * 60 * 60 * 1000) : new Date(subscription!.current_period_end!)
    const token = await new SignJWT({ plan: 'pro', dev: deviceLimitPerPerson, grace_days: 7, mid: machineId })
      .setProtectedHeader({
        alg: 'RS256',
        kid: Deno.env.get('GOACM_LICENSE_KEY_ID') ?? Deno.env.get('ACM360_LICENSE_KEY_ID') ?? 'goacm-license-v1',
      })
      .setSubject(authData.user.id)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(signingKey)

    const { data: deviceId, error: deviceError } = await admin.rpc('acm360_activate_device', {
      target_account_id: membership.account_id,
      target_member_id: membership.id,
      target_machine_id: machineId,
      target_name: machineName,
      device_limit: deviceLimitPerPerson,
    })
    if (deviceError) {
      if (deviceError.code === '23514' && deviceError.message.includes('device_limit_reached')) {
        return respond(req, { error: 'device_limit', message: 'Cada pessoa pode autorizar um computador. Revogue o computador anterior no portal para trocar de máquina.' }, 403)
      }
      throw deviceError
    }

    return respond(req, {
      token,
      user: {
        name: String(authData.user.user_metadata.name ?? authData.user.user_metadata.full_name ?? membership.display_name ?? email.split('@')[0]),
        email,
      },
      plan: 'pro',
      expiresAt: expiresAt.toISOString(),
      deviceId,
    })
  } catch (error) {
    console.error('license-login failed', errorMessage(error))
    return respond(req, { error: 'license_login_failed', message: 'Não foi possível validar a licença agora.' }, 500)
  }
})
