import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'
import { errorMessage, preflight, respond } from './http.ts'

const EMBEDDED_CLIENT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAnLSxm4K8uqZgeEy3a2EVCmKBYwGfZpOr1Ljwoec0J2c=
-----END PUBLIC KEY-----`
const OFFLINE_WINDOW_SECONDS = 48 * 60 * 60

export interface PluginContext {
  user: User
  admin: SupabaseClient
  accessToken: string
  membership: {
    id: string
    account_id: string
    email: string
    display_name: string | null
    role: string
    status: string
  }
  machineId: string
  deviceId: string
}

export function clients() {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) throw new Error('Supabase runtime is not configured.')
  return {
    auth: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  }
}

export function bearer(req: Request) {
  const value = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(value)
  return match?.[1] ?? null
}

export async function findMembership(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from('license_members')
    .select('id,account_id,email,display_name,role,status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function activeSubscription(admin: SupabaseClient, accountId: string) {
  const { data: entitlement, error: entitlementError } = await admin.from('license_account_entitlements')
    .select('entitlement')
    .eq('account_id', accountId)
    .eq('entitlement', 'lifetime')
    .maybeSingle()
  if (entitlementError) throw entitlementError
  if (entitlement) {
    return { id: null, offer_key: 'pro_lifetime', status: 'active', current_period_end: null, lifetime: true }
  }

  const now = new Date()
  const { data, error } = await admin.from('license_subscriptions')
    .select('id,offer_key,status,current_period_end')
    .eq('account_id', accountId)
    .in('status', ['active', 'past_due', 'canceled'])
    .gt('current_period_end', now.toISOString())
    .order('current_period_end', { ascending: false })
    .limit(1)
  if (error) throw error
  const subscription = data?.[0]
  if (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() <= now.getTime()) return null
  return subscription
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let different = 0
  for (let i = 0; i < left.length; i++) different |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return different === 0
}

export function randomDeviceSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const value of bytes) binary += String.fromCharCode(value)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function activateDevice(
  admin: SupabaseClient,
  membership: { id: string; account_id: string },
  machineId: string,
  machineName: string,
) {
  const secret = randomDeviceSecret()
  const secretHash = await sha256Hex(secret)
  const { data: deviceId, error } = await admin.rpc('license_activate_device_with_secret', {
    target_account_id: membership.account_id,
    target_member_id: membership.id,
    target_machine_id: machineId,
    target_name: machineName.slice(0, 100),
    target_secret_hash: secretHash,
  })
  if (error) throw error
  return { id: String(deviceId), secret }
}

export async function validateDevice(
  admin: SupabaseClient,
  membership: { id: string; account_id: string },
  machineId: string,
  deviceSecret: string,
) {
  if (!machineId || machineId.length > 255 || !deviceSecret) return null
  const { data: device, error: deviceError } = await admin.from('license_devices')
    .select('id,secret_hash')
    .eq('account_id', membership.account_id)
    .eq('member_id', membership.id)
    .eq('machine_id', machineId)
    .is('revoked_at', null)
    .maybeSingle()
  if (deviceError) throw deviceError
  if (!device?.secret_hash) return null

  const presentedHash = await sha256Hex(deviceSecret)
  if (!constantTimeEqual(device.secret_hash, presentedHash)) return null
  const { error: touchError } = await admin.from('license_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id)
  if (touchError) throw touchError
  return device.id as string
}

export async function authenticatePluginRequest(req: Request): Promise<PluginContext | null> {
  const accessToken = bearer(req)
  const machineId = req.headers.get('x-device-id')?.trim() ?? ''
  const deviceSecret = req.headers.get('x-device-secret') ?? ''
  if (!accessToken || !machineId || !deviceSecret || machineId.length > 255) return null

  const { auth, admin } = clients()
  const { data, error } = await auth.auth.getUser(accessToken)
  if (error || !data.user) return null
  const membership = await findMembership(admin, data.user.id)
  if (!membership) return null
  const deviceId = await validateDevice(admin, membership, machineId, deviceSecret)
  if (!deviceId) return null
  return { user: data.user, admin, accessToken, membership, machineId, deviceId }
}

function pemBytes(pem: string) {
  const base64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function entitlementSigningKey() {
  const privatePem = Deno.env.get('ENTITLEMENT_ED25519_PRIVATE_KEY')?.replace(/\\n/g, '\n')
  if (!privatePem) throw new Error('entitlement_signing_key_missing')
  const privateKey = await crypto.subtle.importKey('pkcs8', pemBytes(privatePem), { name: 'Ed25519' }, false, ['sign'])
  const publicKey = await crypto.subtle.importKey('spki', pemBytes(EMBEDDED_CLIENT_PUBLIC_KEY), { name: 'Ed25519' }, false, ['verify'])
  const challenge = new TextEncoder().encode('SketchUp plugin entitlement key-pair check v1')
  const signature = await crypto.subtle.sign('Ed25519', privateKey, challenge)
  if (!await crypto.subtle.verify('Ed25519', publicKey, signature, challenge)) {
    throw new Error('entitlement_signing_key_mismatch')
  }
  return privateKey
}

function base64url(bytes: Uint8Array) {
  let binary = ''
  for (const value of bytes) binary += String.fromCharCode(value)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function issueEntitlement(machineId: string, subscriptionEnd: string | null, now = Math.floor(Date.now() / 1000)) {
  const exp = subscriptionEnd
    ? Math.min(Math.floor(new Date(subscriptionEnd).getTime() / 1000), now + OFFLINE_WINDOW_SECONDS)
    : now + OFFLINE_WINDOW_SECONDS
  const payload = new TextEncoder().encode(JSON.stringify({ mid: machineId, sub: true, tier: 'pro', iat: now, exp }))
  const key = await entitlementSigningKey()
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', key, payload))
  return `${base64url(payload)}.${base64url(signature)}`
}

export async function pluginLicenseState(ctx: PluginContext) {
  const subscription = await activeSubscription(ctx.admin, ctx.membership.account_id)
  const now = Math.floor(Date.now() / 1000)
  if (!subscription) {
    return { subscribed: false, sub_active: false, tier: 'free', subscription_end: null, server_now: now }
  }
  return {
    subscribed: true,
    sub_active: true,
    tier: 'pro',
    subscription_end: subscription.current_period_end,
    server_now: now,
    entitlement: await issueEntitlement(ctx.machineId, subscription.current_period_end, now),
  }
}

export function pluginUser(user: User, membership: { display_name: string | null; email: string }) {
  return {
    id: user.id,
    name: String(user.user_metadata.name ?? user.user_metadata.full_name ?? membership.display_name ?? membership.email.split('@')[0]),
    email: membership.email || user.email || '',
  }
}

export function deviceLimitResponse(req: Request, error: unknown) {
  const message = errorMessage(error)
  if (message.includes('device_limit_reached')) {
    return respond(req, {
      success: false,
      error: 'DEVICE_LIMIT_EXCEEDED',
      code: 'DEVICE_LIMIT_EXCEEDED',
      message: 'Cada pessoa pode autorizar um computador. Revogue o computador anterior no portal para trocar de máquina.',
    }, 403)
  }
  return null
}

export { errorMessage, preflight, respond }
