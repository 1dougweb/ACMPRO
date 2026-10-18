import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Server,
  Lock,
  Loader2,
} from 'lucide-react'
import { api } from '../../api'
import type { AdminEnvDiagnosis } from '../../api/types'
import { usePageMeta } from '../../lib/usePageMeta'

export default function AdminEnv() {
  usePageMeta('Admin • Variáveis & Ambiente', 'Diagnóstico de conexões e variáveis de ambiente.')
  const [env, setEnv] = useState<AdminEnvDiagnosis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEnv = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.adminGetSettings()
      setEnv(res.env)
    } catch (err: unknown) {
      setError((err as Error).message || 'Falha ao verificar ambiente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEnv()
  }, [])

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Variáveis de Ambiente & Diagnóstico</h1>
          <p>Verificação de integridade dos serviços integrados, chaves de API e assinaturas de segurança.</p>
        </div>
        <button className="admin-btn" onClick={() => void loadEnv()}>
          Recarregar Diagnóstico
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#10b981' }}>
          <Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Executando diagnóstico de conexões…</p>
        </div>
      ) : error || !env ? (
        <div className="admin-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <p style={{ color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {error || 'Não foi possível ler variáveis.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* Mercado Pago */}
          <div className="admin-card">
            <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} style={{ color: '#0284c7' }} /> Integração Mercado Pago
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Token de Acesso (MP_ACCESS_TOKEN)</span>
                <span className={`admin-badge ${env.mercadoPago.configured ? 'active' : 'expired'}`}>
                  {env.mercadoPago.configured ? 'Configurado' : 'Ausente'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Modo de Operação</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {env.mercadoPago.mode}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Visualização Mascarada</span>
                <code style={{ fontSize: 12, color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: 4, border: '1px solid #bae6fd' }}>{env.mercadoPago.tokenPreview}</code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Chave Webhook (MP_WEBHOOK_SECRET)</span>
                <span className={`admin-badge ${env.mercadoPago.webhookConfigured ? 'active' : 'pending'}`}>
                  {env.mercadoPago.webhookConfigured ? 'Ativa' : 'Pendente'}
                </span>
              </div>
            </div>
          </div>

          {/* Segurança & Licenciamento */}
          <div className="admin-card">
            <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} style={{ color: '#059669' }} /> Segurança e Licenças Offline
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Chave Ed25519 de Licença</span>
                <span className={`admin-badge ${env.security.entitlementKey ? 'active' : 'pending'}`}>
                  {env.security.entitlementKey ? 'Configurada' : 'Pendente'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Assinador GOACM Plugin</span>
                <span className={`admin-badge ${env.security.licenseSigningKey ? 'active' : 'pending'}`}>
                  {env.security.licenseSigningKey ? 'Configurado' : 'Pendente'}
                </span>
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Administradores Autorizados (SITE_ADMIN_EMAILS):</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {env.security.adminEmails.map((email) => (
                    <span key={email} style={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 4, color: 'var(--text)', fontWeight: 500 }}>
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Infraestrutura Supabase */}
          <div className="admin-card" style={{ gridColumn: '1 / -1' }}>
            <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={18} style={{ color: '#7c3aed' }} /> Infraestrutura e Proteção de Segredos
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>
              Por segurança, chaves de produção completas (privadas e tokens de pagamentos) nunca são expostas ao navegador. Para alterar credenciais do Mercado Pago ou chaves de webhook, utilize o painel de <strong>Project Settings → Edge Functions Secrets</strong> no Supabase.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
              <CheckCircle2 size={18} style={{ color: '#059669' }} />
              <span style={{ color: 'var(--text)' }}>Banco de Dados Supabase Conectado • Host: <strong>{env.system.supabaseUrl}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
