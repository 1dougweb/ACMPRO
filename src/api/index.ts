import { mockApi } from './mockApi'
import { supabaseApi } from './supabaseApi'
import type { Api } from './types'

declare const __API_MODE__: string

// The Vite config fixes this at build time. Production always targets Supabase;
// mock data is available only to local development.
const selectedMode = __API_MODE__

if (selectedMode !== 'mock' && selectedMode !== 'supabase') {
  // VITE_* values are embedded in browser builds, so never echo the bad value:
  // an operator may accidentally paste a credential into the mode selector.
  throw new Error('VITE_API inválido. Use somente "mock" ou "supabase".')
}

export const api: Api = selectedMode === 'mock' ? mockApi : supabaseApi
export * from './types'
