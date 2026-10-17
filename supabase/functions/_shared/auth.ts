import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

export interface RequestContext {
  user: User
  admin: SupabaseClient
}

export async function requestContext(req: Request): Promise<RequestContext | null> {
  const authorization = req.headers.get('authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !url || !anonKey || !serviceKey) return null

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { user: data.user, admin }
}

export async function accountMembership(ctx: RequestContext) {
  const { data, error } = await ctx.admin
    .from('license_members')
    .select('id,account_id,email,display_name,role,status')
    .eq('user_id', ctx.user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data
}
