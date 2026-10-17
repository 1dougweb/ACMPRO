import { accountMembership, requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { verifiedEmail } from '../_shared/site-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)

  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)

  try {
    const member = await accountMembership(ctx)
    if (!member) return respond(req, { error: 'account_missing', message: 'A conta ainda não está vinculada. Confirme o e-mail de cadastro.' }, 404)

    const [{ data: account, error: accountError }, { data: subscriptions, error: subscriptionError }, { data: orders, error: orderError }, { data: members, error: membersError }, { count: deviceCount, error: devicesError }, { data: entitlement, error: entitlementError }] = await Promise.all([
      ctx.admin.from('license_accounts').select('id,name').eq('id', member.account_id).single(),
      ctx.admin.from('license_subscriptions').select('id,offer_key,status,current_period_end,trial_ends_at,provider_subscription_id,cancel_at_period_end').eq('account_id', member.account_id).order('current_period_end', { ascending: false, nullsFirst: false }).limit(20),
      ctx.admin.from('license_orders').select('id').eq('account_id', member.account_id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).limit(1),
      ctx.admin.from('license_members').select('id,status').eq('account_id', member.account_id).in('status', ['active', 'invited']),
      ctx.admin.from('license_devices').select('id', { count: 'exact', head: true }).eq('account_id', member.account_id).is('revoked_at', null),
      ctx.admin.from('license_account_entitlements').select('entitlement,seat_limit').eq('account_id', member.account_id).eq('entitlement', 'lifetime').maybeSingle(),
    ])
    const error = accountError ?? subscriptionError ?? orderError ?? membersError ?? devicesError ?? entitlementError
    if (error) throw error

    const lifetime = entitlement?.entitlement === 'lifetime'
    const currentSubscription = subscriptions?.find((item) =>
      item.current_period_end !== null
      && new Date(item.current_period_end).getTime() > Date.now()
      && ['active', 'past_due', 'canceled'].includes(item.status),
    )
    const pendingSubscription = subscriptions?.find((item) => item.status === 'pending')
    const subscription = currentSubscription ?? pendingSubscription ?? subscriptions?.[0]
    const expiresAt = lifetime ? null : subscription?.current_period_end ?? null
    const hasSubscription = lifetime || Boolean(currentSubscription)
    const hasPendingOrder = Boolean(orders?.length)
    const status = lifetime
      ? 'active'
      : currentSubscription?.status === 'past_due'
        ? 'past_due'
        : currentSubscription
          ? 'active'
          : subscription?.status === 'paused'
            ? 'suspended'
            : pendingSubscription || hasPendingOrder
              ? 'pending'
              : subscriptions?.length ? 'expired' : 'none'
    const activeMembers = (members ?? []).filter((item) => item.status === 'active').length
    const deviceLimit = activeMembers

    return respond(req, {
      account: { id: account.id, name: account.name },
      role: member.role,
      offerKey: lifetime ? null : currentSubscription?.offer_key ?? pendingSubscription?.offer_key ?? null,
      plan: lifetime || subscription ? 'pro' : 'free',
      status,
      hasSubscription,
      lifetime,
      isAdmin: verifiedEmail(ctx.user),
      cancellable: !lifetime && Boolean(currentSubscription?.provider_subscription_id && currentSubscription.offer_key === 'pro_monthly' && currentSubscription.status !== 'canceled'),
      cancelAtPeriodEnd: !lifetime && (currentSubscription?.status === 'canceled' || currentSubscription?.cancel_at_period_end === true),
      expiresAt,
      trialEndsAt: lifetime ? null : currentSubscription?.trial_ends_at ?? null,
      deviceLimit,
      seatLimit: lifetime ? entitlement?.seat_limit ?? null : 3,
      seatsUsed: members?.length ?? 0,
      devicesUsed: deviceCount ?? 0,
    })
  } catch (error) {
    console.error('account-summary failed', errorMessage(error))
    return respond(req, { error: 'account_summary_failed', message: 'Não foi possível carregar os dados da conta.' }, 500)
  }
})
