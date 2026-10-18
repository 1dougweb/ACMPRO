import { requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { positiveIntegerEnv } from '../_shared/mercadopago.ts'
import { verifiedEmail } from '../_shared/site-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const ctx = await requestContext(req)
  if (!ctx) return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)
  if (!verifiedEmail(ctx.user)) {
    return respond(req, { error: 'site_admin_required', message: 'Esta conta não está autorizada a acessar a administração.' }, 403)
  }

  try {
    const url = new URL(req.url)
    const body = (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as Record<string, any>
    const action = body.action || url.searchParams.get('action') || 'get'

    // 1. AÇÃO: Obter Configurações e Diagnóstico de Ambiente
    if (action === 'get') {
      // Ler preços do banco com fallback para variáveis de ambiente
      const { data: pricingRow } = await ctx.admin.from('license_pricing_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle()

      const envMonthly = positiveIntegerEnv('MP_PRO_MONTHLY_AMOUNT_CENTS') || 9700
      const envAnnual = positiveIntegerEnv('MP_PRO_ANNUAL_AMOUNT_CENTS') || 97000

      const pricing = {
        monthlyAmountCents: pricingRow?.monthly_amount_cents ?? envMonthly,
        annualAmountCents: pricingRow?.annual_amount_cents ?? envAnnual,
        updatedAt: pricingRow?.updated_at ?? null,
        updatedBy: pricingRow?.updated_by ?? 'Padrão do Sistema',
      }

      // Diagnóstico das variáveis de ambiente (com mascaramento seguro)
      const mpToken = Deno.env.get('MP_ACCESS_TOKEN') || ''
      const mpWebhook = Deno.env.get('MP_WEBHOOK_SECRET') || ''
      const mpSeller = Deno.env.get('MP_SELLER_ID') || ''
      const siteAdmins = Deno.env.get('SITE_ADMIN_EMAILS') || ''
      const edKey = Deno.env.get('ENTITLEMENT_ED25519_PRIVATE_KEY') || ''
      const suKey = Deno.env.get('GOACM_LICENSE_SIGNING_PRIVATE_KEY') || ''
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''

      const mask = (val: string) => {
        if (!val) return 'Não configurado'
        if (val.length <= 8) return '••••••••'
        return val.slice(0, 4) + '••••••••' + val.slice(-4)
      }

      const env = {
        mercadoPago: {
          configured: Boolean(mpToken),
          mode: mpToken.startsWith('TEST-') ? 'Sandbox / Testes' : mpToken.startsWith('APP_USR-') ? 'Produção' : Boolean(mpToken) ? 'Ativo' : 'Não configurado',
          tokenPreview: mask(mpToken),
          webhookConfigured: Boolean(mpWebhook),
          sellerIdConfigured: Boolean(mpSeller),
        },
        security: {
          licenseSigningKey: Boolean(suKey),
          entitlementKey: Boolean(edKey),
          adminEmails: siteAdmins ? siteAdmins.split(',').map((e) => e.trim()).filter(Boolean) : [],
        },
        system: {
          supabaseUrl: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, '') : 'Conectado',
          databaseConnected: true,
          nodeEnv: Deno.env.get('DENO_ENV') || 'production',
        },
      }

      return respond(req, { success: true, pricing, env })
    }

    // 2. AÇÃO: Atualizar Preços
    if (action === 'update-pricing') {
      const monthlyAmountCents = Number(body.monthlyAmountCents)
      const annualAmountCents = Number(body.annualAmountCents)

      if (!monthlyAmountCents || monthlyAmountCents <= 0 || !annualAmountCents || annualAmountCents <= 0) {
        return respond(req, { error: 'bad_request', message: 'Valores mensais e anuais devem ser maiores que zero.' }, 400)
      }

      const { data, error } = await ctx.admin.from('license_pricing_config')
        .upsert({
          id: 1,
          monthly_amount_cents: monthlyAmountCents,
          annual_amount_cents: annualAmountCents,
          updated_at: new Date().toISOString(),
          updated_by: ctx.user.email || 'Admin',
        }, { onConflict: 'id' })
        .select()
        .single()

      if (error) throw error

      return respond(req, {
        success: true,
        message: 'Preços atualizados com sucesso.',
        pricing: {
          monthlyAmountCents: data.monthly_amount_cents,
          annualAmountCents: data.annual_amount_cents,
          updatedAt: data.updated_at,
          updatedBy: data.updated_by,
        },
      })
    }

    return respond(req, { error: 'invalid_action', message: 'Ação não reconhecida.' }, 400)
  } catch (error) {
    console.error('admin-settings failed', errorMessage(error))
    return respond(req, { error: 'admin_settings_failed', message: 'Erro ao processar configurações de administração.' }, 500)
  }
})
