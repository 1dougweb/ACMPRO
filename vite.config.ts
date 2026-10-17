import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const pluginProjectRef = 'dqwrxsbekfeyzbzvnubg'
function keyClaims(value: string | undefined) {
  const payload = value?.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { ref?: string; role?: string }
  } catch {
    return null
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Production builds always target Supabase. This ignores stale Vercel values
  // such as VITE_API=mock without embedding them in the browser bundle.
  const selectedApi = mode === 'production' ? 'supabase' : env.VITE_API ?? 'mock'
  // Prefer Vercel's injected build environment, with dotenv as the local fallback.
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || ''
  const publicKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || ''

  if (!['mock', 'supabase'].includes(selectedApi)) {
    throw new Error('Build interrompido: VITE_API deve ser "supabase".')
  }
  if (process.env.VERCEL === '1') {
    const issues: string[] = []
    let parsedUrl: URL | null = null
    try {
      if (supabaseUrl) parsedUrl = new URL(supabaseUrl)
    } catch {
      // Report only which variable is invalid; never echo environment values.
    }

    if (!supabaseUrl) {
      issues.push('VITE_SUPABASE_URL ausente')
    } else if (parsedUrl?.protocol !== 'https:' || parsedUrl.hostname !== `${pluginProjectRef}.supabase.co`) {
      issues.push('VITE_SUPABASE_URL não corresponde ao projeto Supabase usado pelo plugin')
    }

    const claims = keyClaims(publicKey)
    if (!publicKey) {
      issues.push('VITE_SUPABASE_ANON_KEY ausente')
    } else if (publicKey.startsWith('sb_secret_') || claims?.role === 'service_role') {
      issues.push('VITE_SUPABASE_ANON_KEY contém uma chave privada; use a chave pública anon/publishable')
    } else if (!publicKey.startsWith('sb_publishable_')
      && !(claims?.role === 'anon' && claims.ref === pluginProjectRef)) {
      issues.push('VITE_SUPABASE_ANON_KEY não é uma chave pública válida do projeto do plugin')
    }

    if (selectedApi !== 'supabase') issues.push('VITE_API deve ser supabase')
    if (issues.length) {
      throw new Error(`Configuração Supabase inválida na Vercel: ${issues.join('; ')}. Confira as variáveis de Production.`)
    }
  }

  return {
    plugins: [react()],
    define: { __API_MODE__: JSON.stringify(selectedApi) },
  }
})
