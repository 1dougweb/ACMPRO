import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, PLAN_LABELS, type Device, type License, type PublicOffers } from '../api'
import { isOfferKey } from '../api/types'
import { formatBRL } from '../lib/formatMoney'
import { usePageMeta } from '../lib/usePageMeta'

export default function Dashboard() {
  usePageMeta('Licença', 'Plano, validade, equipe e dispositivos da sua licença ACMPRO.')
  const [license, setLicense] = useState<License | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [offers, setOffers] = useState<PublicOffers | null>(null)
  const [offersError, setOffersError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutRequested = useRef(false)
  const requestedOffer = searchParams.get('offer')
  const checkoutResult = searchParams.get('checkout')

  const refresh = useCallback(async () => {
    const [currentLicense, currentDevices] = await Promise.all([api.getLicense(), api.listDevices()])
    setLicense(currentLicense)
    setDevices(currentDevices)
  }, [])

  useEffect(() => {
    void refresh().catch((err: unknown) => setError((err as Error).message))
  }, [refresh])

  useEffect(() => {
    void api.getPublicOffers().then(setOffers).catch(() => setOffersError(true))
  }, [])

  useEffect(() => {
    if (checkoutResult !== 'return' && checkoutResult !== 'failed') return
    if (checkoutResult === 'return') {
      setNotice('Retorno recebido. A licença será liberada assim que o Mercado Pago confirmar a autorização da assinatura ou o pagamento.')
    } else {
      setError('O checkout não foi concluído. Você pode tentar novamente pelo painel.')
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('checkout')
    setSearchParams(nextParams, { replace: true })
  }, [checkoutResult, searchParams, setSearchParams])

  const checkout = useCallback(async (offer: 'pro_monthly' | 'pro_annual') => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.startCheckout(offer)
      window.location.assign(result.url)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!requestedOffer) return
    if (!isOfferKey(requestedOffer)) {
      setSearchParams({}, { replace: true })
      return
    }
    if (!license || checkoutRequested.current) return
    checkoutRequested.current = true
    setSearchParams({}, { replace: true })
    if (license.role !== 'owner') {
      setError('A contratação do plano é feita pelo titular da conta.')
      return
    }
    if (license.hasSubscription ?? license.status === 'active') {
      setNotice('Sua licença já está ativa.')
      return
    }
    void checkout(requestedOffer)
  }, [checkout, license, requestedOffer, setSearchParams])

  const cancel = async () => {
    if (!window.confirm('Deseja cancelar a renovação automática da assinatura mensal?')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.cancelSubscription()
      setNotice(license?.trialEndsAt && new Date(license.trialEndsAt).getTime() > Date.now()
        ? 'Assinatura cancelada. Seu teste continua até o fim do período grátis, sem cobrança mensal.'
        : 'Assinatura cancelada. O acesso permanece até o fim do período já pago.')
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const refreshStatus = async () => {
    setBusy(true)
    setError('')
    try {
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!license && !error) return <div className="splash"><div className="spinner" /></div>
  if (!license) return <div className="alert" role="alert">{error}</div>

  const hasSubscription = license.hasSubscription ?? license.status === 'active'
  const days = license.expiresAt
    ? Math.max(0, Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / 864e5))
    : null
  const trialIsActive = Boolean(license.trialEndsAt && new Date(license.trialEndsAt).getTime() > Date.now())
  const deviceLimit = license.deviceLimit
  const devicesUsed = license.devicesUsed ?? devices.length
  const usage = deviceLimit ? Math.min(100, (devicesUsed / deviceLimit) * 100) : 0
  const statusLabels = {
    active: trialIsActive ? 'Teste grátis' : 'Ativa', expired: 'Expirada', suspended: 'Suspensa',
    past_due: 'Pagamento pendente', pending: 'Aguardando pagamento', none: 'Sem assinatura',
  } satisfies Record<License['status'], string>

  return (
    <>
      <h1 className="page-title">Minha licença</h1>
      <p className="muted">Acompanhe sua assinatura, os acessos da equipe e as máquinas autorizadas.</p>

      {error && <div className="alert" role="alert">{error}</div>}
      {notice && <div className="success" role="status">{notice}</div>}

      <div className="grid">
        <section className="card">
          <div className="card-row">
            <span className="label">Plano</span>
            <span className={`badge ${license.status}`}>{statusLabels[license.status]}</span>
          </div>
          <div className="big">{hasSubscription ? PLAN_LABELS[license.plan] : license.status === 'pending' ? 'Pro' : '—'}</div>
          <div className="stat-row">
            <div><span className="label">Validade</span><strong>{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString('pt-BR') : '—'}</strong></div>
            <div><span className="label">Dias restantes</span><strong>{days ?? '—'}</strong></div>
          </div>
          {trialIsActive && <p className="hint">Seu teste grátis termina em {new Date(license.trialEndsAt!).toLocaleDateString('pt-BR')}. A primeira cobrança mensal acontece depois dessa data.</p>}
          {license.cancelAtPeriodEnd && <p className="hint">A renovação foi cancelada. O acesso permanece até {trialIsActive ? 'o fim do teste grátis' : 'a data de validade'}.</p>}
        </section>

        <section className="card">
          <span className="label">Dispositivos</span>
          <div className="big">{devicesUsed}<small> / {deviceLimit ?? '—'}</small></div>
          {deviceLimit !== null && <div className="bar" role="progressbar" aria-valuenow={devicesUsed} aria-valuemax={deviceLimit}>
            <div className="bar-fill" style={{ width: `${usage}%` }} />
          </div>}
          <p className="hint">Cada pessoa ativa pode autorizar 1 computador. Troque de máquina revogando a anterior.</p>
        </section>

        <section className="card">
          <span className="label">Acessos da equipe</span>
          <div className="big">{license.seatsUsed ?? '—'}<small> / {license.seatLimit ?? 3}</small></div>
          <p className="hint">Titular e até dois membros; cada pessoa ativa usa 1 computador.</p>
        </section>
      </div>

      <section className="card activation-card">
        <div>
          <h2>{hasSubscription ? 'Use o ACMPRO no SketchUp' : license.status === 'pending' ? 'Pagamento em processamento' : 'Ative sua licença ACMPRO'}</h2>
          <p className="muted">{hasSubscription
            ? 'Entre no plugin do SketchUp com o mesmo e-mail e senha usados neste portal. A licença é emitida pelo servidor e não precisa ser copiada.'
            : license.status === 'pending'
              ? 'A liberação acontece depois que o Mercado Pago confirmar a autorização da assinatura. Durante o teste grátis, a cobrança ainda não foi feita; atualize esta página em instantes.'
              : 'Escolha o plano atual do ACMPRO. Depois da confirmação do Mercado Pago, use no SketchUp o mesmo e-mail e senha desta conta.'}</p>
        </div>
        {!hasSubscription && license.role === 'owner' && (
          <div className="checkout-actions">
            {license.status === 'pending' && <button className="btn" disabled={busy} onClick={() => void refreshStatus()}>
              {busy ? 'Atualizando…' : 'Atualizar status do pagamento'}
            </button>}
            <button className="btn primary" disabled={busy || !offers} onClick={() => void checkout('pro_monthly')}>
              {busy ? 'Abrindo checkout…' : offers ? `${offers.monthlyTrialDays ? `Começar ${offers.monthlyTrialDays} dias grátis · ` : 'Assinar mensal · '}${formatBRL(offers.monthlyAmountCents)}/mês` : offersError ? 'Preço indisponível' : 'Carregando preço…'}
            </button>
            <button className="btn" disabled={busy || !offers?.annualAmountCents} onClick={() => void checkout('pro_annual')}>
              {busy ? 'Abrindo checkout…' : offers?.annualAmountCents ? `Comprar anual · ${formatBRL(offers.annualAmountCents)} via Pix` : offersError ? 'Pix anual indisponível' : 'Carregando preço anual…'}
            </button>
            {offersError && <p className="hint">Não foi possível carregar os preços. Atualize a página para tentar novamente.</p>}
          </div>
        )}
        {hasSubscription && license.cancellable && license.role === 'owner' && (
          <button className="btn danger" disabled={busy} onClick={() => void cancel()}>
            Cancelar renovação
          </button>
        )}
        {license.role === 'member' && !hasSubscription && <p className="hint">A contratação do plano é feita pelo titular da conta.</p>}
      </section>
    </>
  )
}
