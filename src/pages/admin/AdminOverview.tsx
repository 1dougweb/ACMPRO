import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  KeyRound,
  UserCheck,
  Clock,
  ArrowRight,
  TrendingUp,
  Tag,
  Package,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { api } from '../../api'
import type { AdminOverview as IAdminOverview } from '../../api/types'
import { formatBRL } from '../../lib/formatMoney'
import { usePageMeta } from '../../lib/usePageMeta'

export default function AdminOverview() {
  usePageMeta('Admin • Visão Geral', 'Resumo de métricas e atividades da plataforma.')
  const [data, setData] = useState<IAdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.getAdminOverview()
      .then((res) => {
        if (active) setData(res)
      })
      .catch((err: unknown) => {
        if (active) setError((err as Error).message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: '#10b981' }}>
        <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--muted)' }}>Carregando dados operacionais…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="admin-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
        <p style={{ color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> {error || 'Falha ao carregar métricas.'}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Visão Geral da Plataforma</h1>
          <p>Métricas de assinaturas, usuários registrados e histórico de pagamentos.</p>
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Total de Contas</span>
            <div className="admin-kpi-icon"><Users size={18} /></div>
          </div>
          <div className="admin-kpi-value">{data.accountCount}</div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Licenças Ativas</span>
            <div className="admin-kpi-icon"><KeyRound size={18} /></div>
          </div>
          <div className="admin-kpi-value">{data.activeLicenseCount}</div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Membros em Equipes</span>
            <div className="admin-kpi-icon"><UserCheck size={18} /></div>
          </div>
          <div className="admin-kpi-value">{data.activeMemberCount}</div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Pedidos Pendentes</span>
            <div className="admin-kpi-icon" style={{ color: '#f59e0b' }}><Clock size={18} /></div>
          </div>
          <div className="admin-kpi-value">{data.pendingOrderCount}</div>
        </div>
      </div>

      {/* Atalhos Rápidos de Gestão */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <Link to="/app/admin/users" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-kpi-icon"><Users size={18} /></div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>Gerenciar Usuários</strong>
              <small style={{ color: 'var(--muted)' }}>Alterar planos e revogar máquinas</small>
            </div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>

        <Link to="/app/admin/orders" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-kpi-icon"><TrendingUp size={18} /></div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>Pedidos e Reembolsos</strong>
              <small style={{ color: 'var(--muted)' }}>Transações e estornos do Mercado Pago</small>
            </div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>

        <Link to="/app/admin/pricing" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-kpi-icon"><Tag size={18} /></div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>Tabela de Preços</strong>
              <small style={{ color: 'var(--muted)' }}>Ajustar valores do Pro Mensal/Anual</small>
            </div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>

        <Link to="/app/admin/plugins" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-kpi-icon"><Package size={18} /></div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>Releases do Plugin</strong>
              <small style={{ color: 'var(--muted)' }}>Fazer upload de nova versão .rbz</small>
            </div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>
      </div>

      {/* Tabelas de Últimas Atividades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Contas Recentes */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Contas Registradas Recentemente</h3>
            <Link to="/app/admin/users" style={{ fontSize: 13, color: '#10b981', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAccounts.map((acc) => (
                  <tr key={acc.id}>
                    <td><strong>{acc.name}</strong></td>
                    <td style={{ color: 'var(--muted)' }}>{acc.email || '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(acc.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pedidos Recentes */}
        <div className="admin-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Pedidos Recentes</h3>
            <Link to="/app/admin/orders" style={{ fontSize: 13, color: '#10b981', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td>{ord.offerKey === 'pro_annual' ? 'Pro Anual' : 'Pro Mensal'}</td>
                    <td><strong>{formatBRL(ord.amountCents)}</strong></td>
                    <td>
                      <span className={`admin-badge ${ord.status}`}>
                        {ord.status === 'paid' ? 'Pago' : ord.status === 'pending' ? 'Pendente' : ord.status}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>
                      {new Date(ord.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
