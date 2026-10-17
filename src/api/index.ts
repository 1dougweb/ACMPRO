import { mockApi } from './mockApi'
import { supabaseApi } from './supabaseApi'
import type { Api } from './types'

const mode = import.meta.env.VITE_API as string | undefined

// Demo data is only the development default. A production build never falls
// back to browser storage when its backend setting is missing.
const selectedMode = mode ?? (import.meta.env.DEV ? 'mock' : 'supabase')

if (selectedMode !== 'mock' && selectedMode !== 'supabase') {
  // VITE_* values are embedded in browser builds, so never echo the bad value:
  // an operator may accidentally paste a credential into the mode selector.
  throw new Error('VITE_API inválido. Use somente "mock" ou "supabase".')
}

export const api: Api = selectedMode === 'mock' ? mockApi : supabaseApi
export * from './types'
