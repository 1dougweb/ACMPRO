import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CreditCard,
  Sparkles,
  Zap,
  Check,
  HelpCircle,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Users,
} from 'lucide-react'
import { api, isLicenseActive, PLAN_LABELS, type License, type PublicOffers } from '../api'
import { formatBRL } from '../lib/formatMoney'
import { usePageMeta } from '../lib/usePageMeta'

export default function Plans() {
  usePageMeta('Gerenciar assinatura', 'Consulte sua licença e gerencie a assinatura GOACM.')
  const [license, setLicense] = useState<License | null>(null)
  const [offers, setOffers] = useState<PublicOffers | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    const [current, prices] = await Promise.all([api.getLicense(), api.getPublicOffers().catch(() => null)])
    setLicense(current)
    setOffers(prices)
  }, [])

  useEffect(() => {
    void refresh().catch((err: unknown) => setError((err as Error).message)).finally(() => setLoading(false))
  }, [refresh])

  const checkout = async (offer: 'pro_monthly' | 'pro_annual') => {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.startCheckout(offer)
      window.location.assign(result.url)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Deseja cancelar a renovação automática?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.cancelSubscription()
      setNotice('A renovação foi cancelada. O acesso continua até o fim do período já pago.')
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  if (loading) return <div className="splash"><div className="spinner" /></div>
  if (!license) return <section className="card"><h1 className="page-title">Gerenciar assinatura</h1><div className="alert" role="alert"><AlertTriangle size={16} /> {error || 'Não foi possível carregar sua licença.'}</div></section>

  const active = isLicenseActive(license)
  const status = license.lifetime ? 'Vitalícia' : license.status === 'active' ? 'Ativa' : license.status === 'pending' ? 'Pagamento pendente' : license.status === 'expired' ? 'Expirada' : 'Sem assinatura ativa'

  return <div className="plans-page">
    <div className="plans-heading">
      <div>
        <p className="label">Conta GOACM</p>
        <h1 className="page-title">Gerenciar assinatura</h1>
        <p className="muted">Consulte seu plano, validade e opções de pagamento.</p>
      </div>
      {active && (
        <Link className="btn" to="/app">
          <ArrowLeft size={14} /> Voltar aos projetos
        </Link>
      )}
    </div>
    {error && <div className="alert" role="alert"><AlertTriangle size={16} /> {error}</div>}
    {notice && <div className="success" role="status"><CheckCircle2 size={16} /> {notice}</div>}

    <section className="card subscription-current">
      <div>
        <span className="label">Plano atual</span>
        <h2>{license.lifetime ? 'GOACM Lifetime' : active ? PLAN_LABELS[license.plan] : 'GOACM Pro'}</h2>
        <p className="muted">{license.lifetime ? 'Acesso vitalício, sem renovação.' : license.expiresAt ? `Válido até ${new Date(license.expiresAt).toLocaleDateString('pt-BR')}.` : 'Sua conta e o plugin SketchUp usam o mesmo acesso.'}</p>
      </div>
      <div className="subscription-status">
        <span className={`badge ${active || license.lifetime ? 'active' : license.status}`}>
          <Check size={12} /> {status}
        </span>
        {license.lifetime && license.role === 'owner' && <p className="hint">O titular administra os membros na área Equipe.</p>}
      </div>
      {!license.lifetime && license.cancellable && license.role === 'owner' && (
        <button className="btn danger" disabled={busy} onClick={() => void cancel()}>
          {busy ? 'Aguarde…' : 'Cancelar renovação'}
        </button>
      )}
    </section>

    {!license.lifetime && <>
      <div className="plans-section-title">
        <div>
          <h2>Opções GOACM Pro</h2>
          <p className="muted">Escolha a periodicidade para continuar usando o plugin.</p>
        </div>
      </div>
      <section className="plans-options">
        <article className="card plan-option">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CreditCard size={12} /> Cobrança mensal
          </span>
          <h3>Pro Mensal</h3>
          <div className="plan-option-price">{offers ? formatBRL(offers.monthlyAmountCents) : '—'}<small> / mês</small></div>
          <p className="muted">Renovação automática pelo Mercado Pago. Cancele quando quiser.</p>
          {offers?.monthlyTrialDays ? <p className="plan-note">Inclui {offers.monthlyTrialDays} dias de teste grátis.</p> : <p className="plan-note">Pagamento recorrente via Mercado Pago.</p>}
          <button className="btn primary" disabled={busy || !offers || active || license.role !== 'owner'} onClick={() => void checkout('pro_monthly')}>
            <CreditCard size={15} /> {busy ? 'Abrindo…' : active ? license.offerKey === 'pro_monthly' ? 'Plano atual' : 'Licença já ativa' : 'Escolher mensal'}
          </button>
        </article>
        <article className="card plan-option plan-option-featured">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--brand-dark)' }}>
            <Zap size={12} /> Pagamento anual
          </span>
          <h3>Pro Anual</h3>
          <div className="plan-option-price">{offers?.annualAmountCents ? formatBRL(offers.annualAmountCents) : 'R$ 970'}<small> / ano</small></div>
          <p className="muted">Pagamento anual à vista, com acesso por 12 meses.</p>
          <p className="plan-note">Pix ou cartão, conforme as opções disponíveis no Mercado Pago.</p>
          <button className="btn primary" disabled={busy || !offers?.annualAmountCents || active || license.role !== 'owner'} onClick={() => void checkout('pro_annual')}>
            <Sparkles size={15} /> {busy ? 'Abrindo…' : active ? license.offerKey === 'pro_annual' ? 'Plano atual' : 'Licença já ativa' : 'Escolher anual'}
          </button>
        </article>
      </section>
      {license.role !== 'owner' && <p className="hint">Somente o titular da licença pode alterar o plano ou iniciar uma compra.</p>}
      {!offers && <p className="hint">Os preços não foram carregados. Atualize a página para tentar novamente.</p>}
    </>}
    <section className="card plans-help">
      <h2><HelpCircle size={17} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6, color: 'var(--brand)' }} />Precisa de ajuda?</h2>
      <p className="muted">Se houver uma divergência no status do pagamento, atualize a página alguns instantes após a confirmação do Mercado Pago.</p>
      {active && (
        <Link to="/app/team" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} /> Gerenciar equipe e dispositivos
        </Link>
      )}
    </section>
  </div>
}
