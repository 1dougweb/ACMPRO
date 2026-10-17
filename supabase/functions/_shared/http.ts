export function corsHeaders(req: Request) {
  const origin = req.headers.get('origin')
  const allowed = (Deno.env.get('GOACM_PORTAL_ORIGINS') ?? Deno.env.get('ACM360_PORTAL_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const isLocalDev = Boolean(origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  const isAllowed = !origin || isLocalDev || allowed.includes(origin)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-device-secret, x-client, accept-language',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && isAllowed) headers['Access-Control-Allow-Origin'] = origin
  return { headers, allowed: isAllowed }
}

export function respond(req: Request, body: unknown, status = 200) {
  const cors = corsHeaders(req)
  if (!cors.allowed) return new Response('Origin not allowed', { status: 403 })
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors.headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export function preflight(req: Request) {
  const cors = corsHeaders(req)
  return cors.allowed
    ? new Response('ok', { headers: cors.headers })
    : new Response('Origin not allowed', { status: 403 })
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro interno.'
}
