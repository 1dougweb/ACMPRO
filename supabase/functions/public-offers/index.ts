import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { positiveIntegerEnv } from '../_shared/mercadopago.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)
  if (req.method !== 'POST') return respond(req, { error: 'method_not_allowed' }, 405)

  try {
    const monthlyAmountCents = positiveIntegerEnv('MP_PRO_MONTHLY_AMOUNT_CENTS')
    const annualAmountCents = positiveIntegerEnv('MP_PRO_ANNUAL_AMOUNT_CENTS')
    if (!monthlyAmountCents || !annualAmountCents) {
      return respond(req, { error: 'offers_unavailable', message: 'As ofertas ainda não estão configuradas.' }, 503)
    }
    return respond(req, { monthlyAmountCents, annualAmountCents, monthlyTrialDays: 7 })
  } catch (error) {
    console.error('public-offers failed', errorMessage(error))
    return respond(req, { error: 'offers_unavailable', message: 'Não foi possível carregar as ofertas.' }, 500)
  }
})
