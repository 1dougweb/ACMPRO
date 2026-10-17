const encoder = new TextEncoder()

export async function mercadoPagoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!accessToken) throw new Error('Mercado Pago access token is not configured.')

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    await response.text().catch(() => '')
    console.error('Mercado Pago API request failed', response.status)
    throw new Error(`Mercado Pago API returned ${response.status}.`)
  }
  const raw = await response.text()
  return raw ? JSON.parse(raw) as T : undefined as T
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export async function verifyMercadoPagoSignature(req: Request, dataId: string) {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET')
  const signatureHeader = req.headers.get('x-signature')
  const requestId = req.headers.get('x-request-id')
  if (!secret || !signatureHeader || !requestId || !dataId) return false

  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const separator = part.indexOf('=')
    return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
  }))
  const timestamp = parts.ts
  const receivedHash = parts.v1?.toLowerCase()
  if (!timestamp || !receivedHash || !/^[a-f0-9]{64}$/.test(receivedHash)) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest))
  const expectedHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return constantTimeEqual(expectedHash, receivedHash)
}

export function webhookUrl() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) throw new Error('Supabase URL is not configured.')
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mercadopago-webhook`
}

export function portalUrl(path: string) {
  const configured = Deno.env.get('GOACM_PORTAL_URL') ?? Deno.env.get('ACM360_PORTAL_URL')
  if (!configured) throw new Error('GOACM portal origin is not configured.')
  return `${configured.replace(/\/$/, '')}${path}`
}

export function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2))
}

export function amountToCents(amount: number | string) {
  const parsed = Number(amount)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function positiveIntegerEnv(key: string, fallback?: number) {
  const raw = Deno.env.get(key)
  if (!raw && fallback !== undefined) return fallback
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}
