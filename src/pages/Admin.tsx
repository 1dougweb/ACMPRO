import { useOutletContext } from 'react-router-dom'
import {
  Users,
  KeyRound,
  UserCheck,
  Clock,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
} from 'lucide-react'
import type { AdminOverview } from '../api/types'
import { formatBRL } from '../lib/formatMoney'
import { usePageMeta } from '../lib/usePageMeta'

interface AdminOutletContext {
  adminOverview: AdminOverview | null
  adminChecked: boolean
  adminError: string
}

const offerLabels = { pro_monthly: 'Pro mensal', pro_annual: 'Pro anual' }
const orderStatusLabels: Record<string, string> = {
  pending: 'Pendente', paid: 'Pago', canceled: 'Cancelado', expired: 'Expirado', refunded: 'Reembolsado',
}

export default function Admin() {
  usePageMeta('Administração', 'Resumo das contas e pagamentos do portal GOACM.')
  const { adminOverview, adminChecked, adminError } = useOutletContext<AdminOutletContext>()

  if (!adminChecked) return <div className="splash"><div className="spinner" /></div>
  if (!adminOverview) {
    return (
      <section className="card admin-denied" role="alert">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={26} style={{ color: 'var(--danger)' }} />
          Acesso administrativo indisponível
        </h1>
        <p className="muted">{adminError || 'Esta conta não está autorizada a acessar a administração.'}</p>
      </section>
    )
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="label">Portal GOACM</p>
          <h1 className="page-title">Administração</h1>
          <p className="muted">Resumo das contas e dos pagamentos recentes.</p>
        </div>
        <span className="badge active">
          <ShieldCheck size={13} /> Acesso autorizado
        </span>
      </div>

      <section className="admin-stats" aria-label="Resumo do portal">
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} /> Contas
          </span>
          <strong>{adminOverview.accountCount}</strong>
        </article>
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <KeyRound size={12} /> Licenças ativas
          </span>
          <strong>{adminOverview.activeLicenseCount}</strong>
        </article>
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <UserCheck size={12} /> Pessoas ativas
          </span>
          <strong>{adminOverview.activeMemberCount}</strong>
        </article>
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={12} /> Pedidos pendentes
          </span>
          <strong>{adminOverview.pendingOrderCount}</strong>
        </article>
      </section>

      <section className="card">
        <div className="card-row">
          <div>
            <h2>Contas recentes</h2>
            <p className="muted">Titular e data de criação.</p>
          </div>
        </div>
        {adminOverview.recentAccounts.length === 0 ? (
          <p className="empty">Ainda não há contas cadastradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>E-mail do titular</th>
                  <th>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {adminOverview.recentAccounts.map((account) => (
                  <tr key={account.id}>
                    <td><strong>{account.name || 'Conta GOACM'}</strong></td>
                    <td>{account.email ?? 'Não disponível'}</td>
                    <td>{new Date(account.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div>
          <h2>Pedidos recentes</h2>
          <p className="muted">O acesso à licença é liberado pelo webhook confirmado do Mercado Pago.</p>
        </div>
        {adminOverview.recentOrders.length === 0 ? (
          <p className="empty">Ainda não há pedidos.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {adminOverview.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard size={13} style={{ color: 'var(--brand)' }} />
                        {offerLabels[order.offerKey]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${order.status === 'paid' ? 'active' : order.status === 'pending' ? 'pending' : 'expired'}`}>
                        {orderStatusLabels[order.status] ?? order.status}
                      </span>
                    </td>
                    <td><strong>{formatBRL(order.amountCents)}</strong></td>
                    <td>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
