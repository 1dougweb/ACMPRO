import { createClient } from 'npm:@supabase/supabase-js@2'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { positiveIntegerEnv } from '../_shared/mercadopago.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (!['GET', 'POST'].includes(req.method)) return respond(req, { error: 'method_not_allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    let monthlyAmountCents = positiveIntegerEnv('MP_PRO_MONTHLY_AMOUNT_CENTS') || 9700
    let annualAmountCents = positiveIntegerEnv('MP_PRO_ANNUAL_AMOUNT_CENTS') || 97000

    if (url && anonKey) {
      const client = createClient(url, anonKey)
      const { data } = await client.from('license_pricing_config').select('monthly_amount_cents, annual_amount_cents').eq('id', 1).maybeSingle()
      if (data?.monthly_amount_cents) monthlyAmountCents = data.monthly_amount_cents
      if (data?.annual_amount_cents) annualAmountCents = data.annual_amount_cents
    }

    return respond(req, { monthlyAmountCents, annualAmountCents, monthlyTrialDays: 0 })
  } catch (error) {
    console.error('public-offers failed', errorMessage(error))
    return respond(req, { error: 'offers_unavailable', message: 'Não foi possível carregar as ofertas.' }, 500)
  }
})
