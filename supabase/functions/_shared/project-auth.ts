import { accountMembership, requestContext, type RequestContext } from './auth.ts'
import { activeSubscription, authenticatePluginRequest, type PluginContext } from './sketchup-license.ts'

type Membership = NonNullable<Awaited<ReturnType<typeof accountMembership>>>
export interface ProjectRequestContext {
  user: RequestContext['user']
  admin: RequestContext['admin']
  membership: Membership
}

export async function projectRequestContext(req: Request): Promise<ProjectRequestContext | null> {
  const deviceBound = req.headers.has('x-device-id') || req.headers.has('x-device-secret')
  if (deviceBound) {
    const plugin: PluginContext | null = await authenticatePluginRequest(req)
    if (!plugin) return null
    return { user: plugin.user, admin: plugin.admin, membership: plugin.membership as Membership }
  }

  const context = await requestContext(req)
  if (!context) return null
  const membership = await accountMembership(context)
  if (!membership) return null
  return { ...context, membership }
}

export async function hasActiveProjectLicense(ctx: ProjectRequestContext) {
  return Boolean(await activeSubscription(ctx.admin, ctx.membership.account_id))
}

export async function getAccessibleProject(ctx: ProjectRequestContext, projectId: string) {
  const { data, error } = await ctx.admin.from('license_projects')
    .select('id,account_id,created_by,name,customer_name,status,created_at,updated_at,last_publication_at')
    .eq('id', projectId)
    .eq('account_id', ctx.membership.account_id)
    .maybeSingle()
  if (error) throw error
  return data
}
