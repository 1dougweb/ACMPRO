const JSON_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

function send(res, status, body) {
  return res.status(status).setHeader('Cache-Control', JSON_HEADERS['Cache-Control']).json(body)
}

function readBody(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return null }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

export default async function handler(req, res) {
  for (const [name, value] of Object.entries(JSON_HEADERS)) res.setHeader(name, value)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'method_not_allowed', message: 'Use POST para entrar no ACMPRO.' })
  }

  const body = readBody(req.body)
  if (!body) return send(res, 400, { error: 'bad_request', message: 'JSON inválido.' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !anonKey) {
    return send(res, 503, {
      error: 'license_server_not_configured',
      message: 'A ativação do ACMPRO ainda não está configurada.',
    })
  }

  let endpoint
  try {
    const project = new URL(supabaseUrl)
    if (project.protocol !== 'https:' && project.hostname !== 'localhost' && project.hostname !== '127.0.0.1') {
      throw new Error('HTTPS is required.')
    }
    endpoint = new URL('/functions/v1/license-login', project).toString()
  } catch {
    return send(res, 503, {
      error: 'license_server_not_configured',
      message: 'A configuração do servidor de ativação está inválida.',
    })
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const text = await upstream.text()
    let result
    try { result = JSON.parse(text) } catch {
      result = { error: 'license_server_unavailable', message: 'Não foi possível validar a licença agora.' }
    }
    return send(res, upstream.status, result)
  } catch {
    return send(res, 502, {
      error: 'license_server_unavailable',
      message: 'Não foi possível conectar ao servidor de licenças ACMPRO.',
    })
  }
}
