import { createClient, type User as SupabaseUser } from '@supabase/supabase-js'
import { ApiError, type AdminOverview, type Api, type Device, type License, type Member, type OfferKey, type PublicOffers, type User } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
) as string | undefined
// This ref is the one embedded by the SketchUp plugin candidate. Keeping the
// portal on the same project is what makes a portal account usable in SketchUp.
const pluginProjectRef = 'dqwrxsbekfeyzbzvnubg'

function projectRefFromUrl(value: string | undefined) {
  if (!value) return null
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return /^([a-z0-9]+)\.supabase\.co$/.exec(hostname)?.[1] ?? null
  } catch {
    return null
  }
}

function projectRefFromLegacyKey(value: string | undefined) {
  const payload = value?.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const claims = JSON.parse(atob(padded)) as { ref?: unknown }
    return typeof claims.ref === 'string' ? claims.ref : null
  } catch {
    return null
  }
}

function legacyKeyRole(value: string | undefined) {
  const payload = value?.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return (JSON.parse(atob(padded)) as { role?: unknown }).role
  } catch {
    return null
  }
}

const urlProjectRef = projectRefFromUrl(supabaseUrl)
const keyProjectRef = projectRefFromLegacyKey(supabaseAnonKey)
const privateKeyConfigured = Boolean(supabaseAnonKey?.startsWith('sb_secret_') || legacyKeyRole(supabaseAnonKey) === 'service_role')
const projectMismatch = Boolean(
  (supabaseUrl && urlProjectRef !== pluginProjectRef)
  || (keyProjectRef && keyProjectRef !== pluginProjectRef),
)

const client = supabaseUrl && supabaseAnonKey && !projectMismatch && !privateKeyConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

function configured() {
  if (privateKeyConfigured) {
    throw new ApiError('public_key_required', 'Use somente a chave pública anon ou publishable do Supabase no portal.')
  }
  if (projectMismatch) {
    throw new ApiError(
      'backend_project_mismatch',
      'O portal e o plugin estão apontando para projetos de licença diferentes. Configure no portal as credenciais públicas do mesmo projeto usado pelo plugin SketchUp.',
    )
  }
  if (!client) {
    throw new ApiError(
      'backend_not_configured',
      'O portal ainda não está conectado ao backend. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
    )
  }
  return client
}

function asUser(user: SupabaseUser): User {
  return {
    id: user.id,
    name: String(user.user_metadata.name ?? user.user_metadata.full_name ?? user.email?.split('@')[0] ?? 'Usuário'),
    email: user.email ?? '',
  }
}

function asApiError(error: { message: string; code?: string | null }) {
  return new ApiError(error.code ?? 'backend_error', error.message)
}

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await configured().functions.invoke<T>(name, { body })
  if (error) {
    const response = (error as { context?: Response }).context
    if (response instanceof Response) {
      const payload = await response.clone().json().catch(() => null) as { error?: string; message?: string } | null
      if (payload?.message) throw new ApiError(payload.error ?? 'backend_error', payload.message)
    }
    throw asApiError(error)
  }
  if (data === null) throw new ApiError('empty_response', 'O backend não retornou dados.')
  return data
}

export const supabaseApi: Api = {
  async getPublicOffers(): Promise<PublicOffers> {
    return await invoke<PublicOffers>('public-offers')
  },

  async getAdminOverview(): Promise<AdminOverview> {
    return await invoke<AdminOverview>('admin-overview')
  },

  async login(email, password) {
    const { data, error } = await configured().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw asApiError(error)
    return asUser(data.user)
  },

  async register(name, email, password) {
    const { data, error } = await configured().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          legal_terms_version: '2026-10-16',
          legal_privacy_version: '2026-10-16',
          legal_accepted_at: new Date().toISOString(),
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) throw asApiError(error)
    if (!data.user) {
      throw new ApiError('signup_failed', 'Não foi possível criar a conta. Tente novamente.')
    }
    if (!data.session) {
      throw new ApiError('email_confirmation_required', 'Conta criada. Confirme seu e-mail para entrar no portal.')
    }
    return asUser(data.user)
  },

  async logout() {
    const { error } = await configured().auth.signOut()
    if (error) throw asApiError(error)
  },

  async requestPasswordReset(email: string) {
    const { error } = await configured().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw asApiError(error)
  },

  async updatePassword(password: string) {
    const { error } = await configured().auth.updateUser({ password })
    if (error) throw asApiError(error)
  },

  async me() {
    const { data, error } = await configured().auth.getUser()
    if (error) {
      if (error.status === 401) return null
      throw asApiError(error)
    }
    return data.user ? asUser(data.user) : null
  },

  async getLicense(): Promise<License> {
    const result = await invoke<License>('account-summary')
    return { ...result, token: '' }
  },

  async listDevices(): Promise<Device[]> {
    const result = await invoke<{ devices: Device[] }>('devices-list')
    return result.devices
  },

  async listMembers(): Promise<Member[]> {
    const result = await invoke<{ members: Member[] }>('members-list')
    return result.members
  },

  async inviteMember(email: string): Promise<Member> {
    const result = await invoke<{ member: Member }>('members-invite', { email })
    return result.member
  },

  async removeMember(id: string) {
    await invoke('members-remove', { memberId: id })
  },

  async startCheckout(offer: OfferKey) {
    return await invoke<{ url: string }>('checkout-start', { offerKey: offer })
  },

  async cancelSubscription() {
    await invoke('billing-cancel')
  },

  async activateDevice() {
    throw new ApiError('plugin_activation_only', 'A máquina é ativada ao entrar na sua conta pelo GOACM no SketchUp.')
  },

  async revokeDevice(id) {
    await invoke('devices-revoke', { deviceId: id })
  },
}
