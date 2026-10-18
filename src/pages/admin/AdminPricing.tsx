import { useEffect, useState, type FormEvent } from 'react'
import {
  Tag,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  Zap,
  Info,
} from 'lucide-react'
import { api } from '../../api'
import type { AdminPricingSettings } from '../../api/types'
import { usePageMeta } from '../../lib/usePageMeta'

export default function AdminPricing() {
  usePageMeta('Admin • Preços & Ofertas', 'Gerenciamento de valores dos planos.')
  const [pricing, setPricing] = useState<AdminPricingSettings | null>(null)
  const [monthlyInput, setMonthlyInput] = useState('')
  const [annualInput, setAnnualInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const loadSettings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.adminGetSettings()
      setPricing(res.pricing)
      setMonthlyInput((res.pricing.monthlyAmountCents / 100).toFixed(2))
      setAnnualInput((res.pricing.annualAmountCents / 100).toFixed(2))
    } catch (err: unknown) {
      setError((err as Error).message || 'Falha ao carregar preços.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess('')
    setError('')

    const monthlyCents = Math.round(parseFloat(monthlyInput.replace(',', '.')) * 100)
    const annualCents = Math.round(parseFloat(annualInput.replace(',', '.')) * 100)

    if (isNaN(monthlyCents) || monthlyCents <= 0) {
      setError('Informe um valor mensal válido.')
      setSaving(false)
      return
    }

    if (isNaN(annualCents) || annualCents <= 0) {
      setError('Informe um valor anual válido.')
      setSaving(false)
      return
    }

    try {
      await api.adminUpdatePricing(monthlyCents, annualCents)
      setSuccess('Preços atualizados com sucesso! Os novos valores já estão ativos na página pública e no checkout.')
      await loadSettings()
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao salvar novos preços.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Gestão de Preços e Ofertas</h1>
          <p>Altere os preços das assinaturas Pro diretamente pelo painel, sem necessidade de alterar código ou reiniciar servidores.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#10b981' }}>
          <Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Carregando configurações de preços…</p>
        </div>
      ) : (
        <div style={{ maxWidth: 760 }}>
          {success && (
            <div className="admin-card" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', padding: 16 }}>
              <p style={{ color: '#34d399', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} /> {success}
              </p>
            </div>
          )}

          {error && (
            <div className="admin-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', padding: 16 }}>
              <p style={{ color: '#f87171', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} /> {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-card">
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag size={18} style={{ color: '#10b981' }} /> Planos Vigentes
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
              {/* Pro Mensal */}
              <div style={{ background: 'var(--bg)', padding: 20, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--brand-dark)', fontWeight: 600 }}>
                  <CreditCard size={18} /> Plano Pro Mensal
                </div>
                <div className="admin-form-group">
                  <label htmlFor="price-monthly">Valor Mensal (R$)</label>
                  <input
                    id="price-monthly"
                    type="text"
                    value={monthlyInput}
                    onChange={(e) => setMonthlyInput(e.target.value)}
                    placeholder="97.00"
                    required
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Cobrança recorrente no cartão pelo Mercado Pago.</small>
                </div>
              </div>

              {/* Pro Anual */}
              <div style={{ background: 'var(--bg)', padding: 20, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#d97706', fontWeight: 600 }}>
                  <Zap size={18} /> Plano Pro Anual
                </div>
                <div className="admin-form-group">
                  <label htmlFor="price-annual">Valor Anual (R$)</label>
                  <input
                    id="price-annual"
                    type="text"
                    value={annualInput}
                    onChange={(e) => setAnnualInput(e.target.value)}
                    placeholder="970.00"
                    required
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>Pagamento anual à vista (Pix ou cartão) por 12 meses.</small>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={14} />
                Última alteração por: <strong>{pricing?.updatedBy || 'Sistema'}</strong>
                {pricing?.updatedAt && (
                  <span>em {new Date(pricing.updatedAt).toLocaleString('pt-BR')}</span>
                )}
              </div>

              <button type="submit" className="admin-btn primary" disabled={saving}>
                <Save size={16} /> {saving ? 'Salvando…' : 'Salvar Novos Preços'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
