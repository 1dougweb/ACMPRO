import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  KeyRound,
  UserCheck,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  CreditCard,
  Receipt,
  BarChart3,
  Tag,
  Package,
  AlertTriangle,
  Loader2,
  Target,
} from 'lucide-react'
import { api } from '../../api'
import type { AdminOverview as IAdminOverview } from '../../api/types'
import { formatBRL } from '../../lib/formatMoney'
import { usePageMeta } from '../../lib/usePageMeta'

export default function AdminOverview() {
  usePageMeta('Admin • Visão Geral', 'Resumo de métricas, crescimento e faturamento da plataforma.')
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
        <p style={{ color: 'var(--muted)' }}>Carregando dados operacionais e financeiros…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="admin-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
        <p style={{ color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error || 'Falha ao carregar métricas.'}
        </p>
      </div>
    )
  }

  const fin = data.financials ?? {
    totalRevenueCents: 0,
    monthRevenueCents: 0,
    prevMonthRevenueCents: 0,
    revenueGrowthPct: 0,
    monthlyRevenueShareCents: 0,
    annualRevenueShareCents: 0,
    averageTicketCents: 0,
    estimatedMrrCents: 0,
  }

  const grw = data.growth ?? {
    monthNewAccounts: 0,
    prevMonthNewAccounts: 0,
    accountsGrowthPct: 0,
    conversionRatePct: 0,
    history: [],
  }

  // Acha o maior faturamento mensal do histórico para normalizar as barras do gráfico
  const maxMonthRev = Math.max(...grw.history.map((h) => h.revenueCents), 1)

  // Porcentagem de share do plano anual vs mensal
  const totalShare = fin.monthlyRevenueShareCents + fin.annualRevenueShareCents
  const monthlySharePct = totalShare > 0 ? Math.round((fin.monthlyRevenueShareCents / totalShare) * 100) : 50
  const annualSharePct = totalShare > 0 ? 100 - monthlySharePct : 50

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Visão Geral da Plataforma</h1>
          <p>Acompanhamento executivo de faturamento, ritmo de crescimento de usuários e operações ativas.</p>
        </div>

        {fin.revenueGrowthPct !== 0 && (
          <div className={`admin-growth-badge ${fin.revenueGrowthPct >= 0 ? 'positive' : 'negative'}`} style={{ padding: '6px 12px', fontSize: 13 }}>
            {fin.revenueGrowthPct >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            <span>{fin.revenueGrowthPct >= 0 ? '+' : ''}{fin.revenueGrowthPct}% faturamento este mês</span>
          </div>
        )}
      </div>

      {/* ========================================================
          1. SEÇÃO DE GANHOS E FATURAMENTO (FINANCEIRO)
          ======================================================== */}
      <div className="admin-section-header">
        <h2><DollarSign size={18} style={{ color: '#10b981' }} /> Desempenho Financeiro & Ganhos</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Atualizado com transações do Mercado Pago</span>
      </div>

      <div className="admin-kpi-grid">
        {/* Receita Total */}
        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Receita Total Bruta</span>
            <div className="admin-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="admin-kpi-value">{formatBRL(fin.totalRevenueCents)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: -4 }}>
            <span className={`admin-growth-badge ${fin.revenueGrowthPct >= 0 ? 'positive' : 'neutral'}`}>
              {fin.revenueGrowthPct >= 0 ? `+${fin.revenueGrowthPct}%` : `${fin.revenueGrowthPct}%`}
            </span>
            <span>vs mês anterior</span>
          </div>
        </div>

        {/* Faturamento do Mês Atual */}
        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Faturamento deste Mês</span>
            <div className="admin-kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#0284c7' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="admin-kpi-value" style={{ color: '#0284c7' }}>{formatBRL(fin.monthRevenueCents)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Mês anterior: <strong>{formatBRL(fin.prevMonthRevenueCents)}</strong>
          </div>
        </div>

        {/* MRR Estimado */}
        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>MRR Estimado (Mensal)</span>
            <div className="admin-kpi-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className="admin-kpi-value">{formatBRL(fin.estimatedMrrCents)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Base recorrente ativa de assinantes
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Ticket Médio por Venda</span>
            <div className="admin-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#b45309' }}>
              <Receipt size={18} />
            </div>
          </div>
          <div className="admin-kpi-value">{formatBRL(fin.averageTicketCents)}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Planos Pro Mensal / Pro Anual
          </div>
        </div>
      </div>

      {/* ========================================================
          2. SEÇÃO DE CRESCIMENTO E AQUISIÇÃO DE CLIENTES
          ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginBottom: 26 }}>
        {/* Gráfico de Evolução dos Últimos 6 Meses */}
        <div className="admin-card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={17} style={{ color: '#10b981' }} /> Evolução do Faturamento (Últimos 6 Meses)
            </h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Receita aprovada</span>
          </div>

          <div className="admin-bar-chart">
            {grw.history.map((item, idx) => {
              const heightPct = maxMonthRev > 0 ? Math.max(6, Math.round((item.revenueCents / maxMonthRev) * 100)) : 6
              return (
                <div key={idx} className="admin-bar-col">
                  <div
                    className="admin-bar-pillar"
                    style={{ height: `${heightPct}%` }}
                  >
                    <div className="admin-bar-tooltip">
                      <div>{item.month}</div>
                      <div>{formatBRL(item.revenueCents)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{item.ordersCount} pedidos • {item.newAccounts} contas</div>
                    </div>
                  </div>
                  <span className="admin-bar-label">{item.month}</span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
            <span>Total dos 6 meses: <strong>{formatBRL(fin.totalRevenueCents)}</strong></span>
            <span>Passe o mouse nas barras para detalhes</span>
          </div>
        </div>

        {/* Métricas de Crescimento e Conversão */}
        <div className="admin-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={17} style={{ color: '#0284c7' }} /> Indicadores de Crescimento & Conversão
              </h3>
              <span className={`admin-growth-badge ${grw.accountsGrowthPct >= 0 ? 'positive' : 'negative'}`}>
                {grw.accountsGrowthPct >= 0 ? `+${grw.accountsGrowthPct}%` : `${grw.accountsGrowthPct}%`} contas
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Novas Contas este Mês</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{grw.monthNewAccounts}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Mês anterior: {grw.prevMonthNewAccounts}</div>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Taxa de Conversão</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#047857' }}>{grw.conversionRatePct}%</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Contas pagantes / Total</div>
              </div>
            </div>

            {/* Divisão de Receita por Oferta */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                <span>Divisão de Planos: Mensal vs Anual</span>
                <span>{monthlySharePct}% Mensal • {annualSharePct}% Anual</span>
              </div>
              <div className="admin-progress-split">
                <div className="admin-progress-segment" style={{ width: `${monthlySharePct}%`, background: '#10b981' }} title={`Mensal: ${formatBRL(fin.monthlyRevenueShareCents)}`} />
                <div className="admin-progress-segment" style={{ width: `${annualSharePct}%`, background: '#f59e0b' }} title={`Anual: ${formatBRL(fin.annualRevenueShareCents)}`} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                <span>Pro Mensal: <strong>{formatBRL(fin.monthlyRevenueShareCents)}</strong></span>
                <span>Pro Anual: <strong>{formatBRL(fin.annualRevenueShareCents)}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Precisa alterar valores dos planos?</span>
            <Link to="/app/admin/pricing" className="admin-btn" style={{ padding: '4px 10px', fontSize: 12 }}>
              <Tag size={13} /> Ajustar Preços
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. SEÇÃO DE OPERAÇÃO DA PLATAFORMA (USUÁRIOS & LICENÇAS)
          ======================================================== */}
      <div className="admin-section-header">
        <h2><Users size={18} style={{ color: '#0284c7' }} /> Operações & Base Instalada</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Cadastros, licenças ativas e assentos</span>
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Total de Contas</span>
            <div className="admin-kpi-icon"><Users size={18} /></div>
          </div>
          <div className="admin-kpi-value">{data.accountCount}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Empresas e profissionais registrados
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Licenças Ativas</span>
            <div className="admin-kpi-icon" style={{ color: '#047857' }}><KeyRound size={18} /></div>
          </div>
          <div className="admin-kpi-value" style={{ color: '#047857' }}>{data.activeLicenseCount}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Com acesso liberado ao plugin
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Membros em Equipes</span>
            <div className="admin-kpi-icon"><UserCheck size={18} /></div>
          </div>
          <div className="admin-kpi-value">{data.activeMemberCount}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Usuários adicionais habilitados
          </div>
        </div>

        <div className="admin-kpi">
          <div className="admin-kpi-top">
            <span>Pedidos Pendentes</span>
            <div className="admin-kpi-icon" style={{ color: '#b45309' }}><Clock size={18} /></div>
          </div>
          <div className="admin-kpi-value" style={{ color: data.pendingOrderCount > 0 ? '#b45309' : '#0f172a' }}>
            {data.pendingOrderCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>
            Aguardando compensação Pix/Cartão
          </div>
        </div>
      </div>

      {/* ========================================================
          4. ATALHOS RÁPIDOS DE GESTÃO
          ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        <Link to="/app/admin/users" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-kpi-icon"><Users size={18} /></div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>Gerenciar Usuários</strong>
              <small style={{ color: 'var(--muted)' }}>Alterar planos e revogar máquinas</small>
            </div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>

        <Link to="/app/admin/orders" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-kpi-icon"><TrendingUp size={18} /></div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>Pedidos e Reembolsos</strong>
              <small style={{ color: 'var(--muted)' }}>Transações e estornos do Mercado Pago</small>
            </div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>

        <Link to="/app/admin/pricing" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="admin-kpi-icon"><Tag size={18} /></div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>Tabela de Preços</strong>
              <small style={{ color: 'var(--muted)' }}>Ajustar valores do Pro Mensal/Anual</small>
            </div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>

        <Link to="/app/admin/plugins" className="admin-card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: '#0f172a', marginBottom: 0 }}>
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

      {/* ========================================================
          5. TABELAS DE ÚLTIMAS ATIVIDADES
          ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Contas Recentes */}
        <div className="admin-card" style={{ marginBottom: 0 }}>
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
                {!data.recentAccounts.length ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhuma conta encontrada.</td></tr>
                ) : (
                  data.recentAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td><strong>{acc.name}</strong></td>
                      <td style={{ color: 'var(--muted)' }}>{acc.email || '—'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {new Date(acc.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pedidos Recentes */}
        <div className="admin-card" style={{ marginBottom: 0 }}>
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
                {!data.recentOrders.length ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Nenhum pedido recente.</td></tr>
                ) : (
                  data.recentOrders.map((ord) => (
                    <tr key={ord.id}>
                      <td>{ord.offerKey === 'pro_annual' ? 'Pro Anual' : 'Pro Mensal'}</td>
                      <td><strong>{formatBRL(ord.amountCents)}</strong></td>
                      <td>
                        <span className={`admin-badge ${ord.status}`}>
                          {ord.status === 'paid' ? 'Pago' : ord.status === 'pending' ? 'Pendente' : ord.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                        {new Date(ord.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
