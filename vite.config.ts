import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const pluginProjectRef = 'frjycxogwpondoaqlfwm'

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
  const selectedApi = env.VITE_API ?? (mode === 'development' ? 'mock' : 'supabase')
  const publicKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  if (!['mock', 'supabase'].includes(selectedApi)) {
    throw new Error('Build interrompido: VITE_API deve ser "supabase".')
  }
  if (mode === 'production' && selectedApi !== 'supabase') {
    throw new Error('Build de produção interrompido: configure o backend Supabase.')
  }
  if (process.env.VERCEL === '1') {
    let projectRef = ''
    let secureProjectUrl = false
    try {
      const parsed = new URL(env.VITE_SUPABASE_URL ?? '')
      projectRef = parsed.hostname.split('.')[0]
      secureProjectUrl = parsed.protocol === 'https:'
    } catch {
      // A mensagem abaixo não expõe valores informados no ambiente.
    }
    const claims = keyClaims(publicKey)
    const publicKeyValid = publicKey.startsWith('sb_publishable_')
      || (claims?.role === 'anon' && claims.ref === pluginProjectRef)
    if (selectedApi !== 'supabase' || !publicKeyValid || !secureProjectUrl || projectRef !== pluginProjectRef) {
      throw new Error('Build interrompido: configure VITE_API, a URL do projeto do plugin e a chave pública anon/publishable na Vercel.')
    }
  }

  return { plugins: [react()] }
})
