import { useOutletContext } from 'react-router-dom'
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
    return <section className="card admin-denied" role="alert">
      <h1 className="page-title">Acesso administrativo indisponível</h1>
      <p className="muted">{adminError || 'Esta conta não está autorizada a acessar a administração.'}</p>
    </section>
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="label">Portal GOACM</p>
          <h1 className="page-title">Administração</h1>
          <p className="muted">Resumo das contas e dos pagamentos recentes.</p>
        </div>
        <span className="badge active">Acesso autorizado</span>
      </div>

      <section className="admin-stats" aria-label="Resumo do portal">
        <article className="card"><span className="label">Contas</span><strong>{adminOverview.accountCount}</strong></article>
        <article className="card"><span className="label">Licenças ativas</span><strong>{adminOverview.activeLicenseCount}</strong></article>
        <article className="card"><span className="label">Pessoas ativas</span><strong>{adminOverview.activeMemberCount}</strong></article>
        <article className="card"><span className="label">Pedidos pendentes</span><strong>{adminOverview.pendingOrderCount}</strong></article>
      </section>

      <section className="card">
        <div className="card-row">
          <div><h2>Contas recentes</h2><p className="muted">Titular e data de criação.</p></div>
        </div>
        {adminOverview.recentAccounts.length === 0 ? <p className="empty">Ainda não há contas cadastradas.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Conta</th><th>E-mail do titular</th><th>Criada em</th></tr></thead>
              <tbody>{adminOverview.recentAccounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name || 'Conta GOACM'}</td>
                  <td>{account.email ?? 'Não disponível'}</td>
                  <td>{new Date(account.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div><h2>Pedidos recentes</h2><p className="muted">O acesso à licença é liberado pelo webhook confirmado do Mercado Pago.</p></div>
        {adminOverview.recentOrders.length === 0 ? <p className="empty">Ainda não há pedidos.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Plano</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
              <tbody>{adminOverview.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>{offerLabels[order.offerKey]}</td>
                  <td>{orderStatusLabels[order.status] ?? order.status}</td>
                  <td>{formatBRL(order.amountCents)}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
