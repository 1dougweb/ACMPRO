import { useEffect, useState } from 'react'
import {
  Search,
  Filter,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { api } from '../../api'
import type { AdminOrderDetail } from '../../api/types'
import { formatBRL } from '../../lib/formatMoney'
import { usePageMeta } from '../../lib/usePageMeta'

export default function AdminOrders() {
  usePageMeta('Admin • Pedidos & Reembolsos', 'Histórico de transações e estornos.')
  const [orders, setOrders] = useState<AdminOrderDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [search, setSearch] = useState('')

  // Modal de Reembolso
  const [orderToRefund, setOrderToRefund] = useState<AdminOrderDetail | null>(null)
  const [refunding, setRefunding] = useState(false)
  const [refundSuccess, setRefundSuccess] = useState('')
  const [refundError, setRefundError] = useState('')

  const loadOrders = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.adminListOrders(statusFilter)
      setOrders(data)
    } catch (err: unknown) {
      setError((err as Error).message || 'Falha ao listar pedidos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [statusFilter])

  const handleRefund = async () => {
    if (!orderToRefund) return
    setRefunding(true)
    setRefundSuccess('')
    setRefundError('')
    try {
      await api.adminRefundOrder(orderToRefund.id)
      setRefundSuccess('Reembolso concluído! A assinatura foi expirada e o status atualizado para Reembolsado.')
      await loadOrders()
      setTimeout(() => {
        setOrderToRefund(null)
      }, 1500)
    } catch (err: unknown) {
      setRefundError((err as Error).message || 'Erro ao processar reembolso.')
    } finally {
      setRefunding(false)
    }
  }

  const filteredOrders = orders.filter((o) =>
    o.accountName.toLowerCase().includes(search.toLowerCase()) ||
    o.payerEmail.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Sumário de Pedidos e Faturamento</h1>
          <p>Consulte transações realizadas pelo Mercado Pago e gerencie reembolsos de assinaturas.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="admin-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
            <Search size={18} style={{ color: '#64748b' }} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Buscar por e-mail, conta ou ID do pedido…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={16} style={{ color: '#64748b' }} />
            <select
              className="admin-search-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="todos">Todos os status</option>
              <option value="paid">Pagos</option>
              <option value="pending">Pendentes</option>
              <option value="refunded">Reembolsados</option>
              <option value="canceled">Cancelados</option>
            </select>
            <button className="admin-btn" onClick={() => void loadOrders()}>
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <p style={{ color: '#f87171' }}><AlertCircle size={16} /> {error}</p>
        </div>
      )}

      {/* Tabela de Pedidos */}
      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#10b981' }}>
            <Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Carregando pedidos…</p>
          </div>
        ) : !filteredOrders.length ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
            Nenhum pedido encontrado.
          </div>
        ) : (
          <div className="admin-table-container" style={{ border: 'none', borderRadius: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID do Pedido</th>
                  <th>Cliente</th>
                  <th>Oferta</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data do Pagamento</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td>
                      <code style={{ fontSize: 11, color: '#94a3b8', background: '#0f172a', padding: '2px 6px', borderRadius: 4 }}>
                        {ord.id.slice(0, 13)}…
                      </code>
                    </td>
                    <td>
                      <div>
                        <strong>{ord.accountName}</strong>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{ord.payerEmail}</div>
                      </div>
                    </td>
                    <td>
                      {ord.offerKey === 'pro_annual' ? 'Pro Anual' : 'Pro Mensal'}
                    </td>
                    <td>
                      <strong>{formatBRL(ord.amountCents)}</strong>
                    </td>
                    <td>
                      <span className={`admin-badge ${ord.status}`}>
                        {ord.status === 'paid' ? 'Pago' : ord.status === 'pending' ? 'Pendente' : ord.status === 'refunded' ? 'Reembolsado' : ord.status}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>
                      {ord.paidAt ? new Date(ord.paidAt).toLocaleString('pt-BR') : new Date(ord.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {ord.status === 'paid' && (
                        <button
                          className="admin-btn danger"
                          style={{ padding: '5px 11px', fontSize: 12 }}
                          onClick={() => {
                            setOrderToRefund(ord)
                            setRefundSuccess('')
                            setRefundError('')
                          }}
                        >
                          <RotateCcw size={12} /> Reembolsar
                        </button>
                      )}
                      {ord.status === 'refunded' && (
                        <span style={{ fontSize: 12, color: '#f87171' }}>Reembolsado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Reembolso */}
      {orderToRefund && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Confirmar Reembolso</h3>
              <button
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setOrderToRefund(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              {refundSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} /> {refundSuccess}
                </div>
              )}
              {refundError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} /> {refundError}
                </div>
              )}

              <p style={{ color: '#cbd5e1', fontSize: 14, margin: 0 }}>
                Você está prestes a reembolsar o seguinte pedido:
              </p>

              <div style={{ padding: '14px 16px', background: '#0f172a', borderRadius: 8, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div><strong>Cliente:</strong> {orderToRefund.accountName} ({orderToRefund.payerEmail})</div>
                <div><strong>Valor a Estornar:</strong> {formatBRL(orderToRefund.amountCents)}</div>
                <div><strong>Plano:</strong> {orderToRefund.offerKey === 'pro_annual' ? 'Pro Anual' : 'Pro Mensal'}</div>
                {orderToRefund.providerPaymentId && (
                  <div style={{ color: '#94a3b8' }}>ID Pagamento Mercado Pago: {orderToRefund.providerPaymentId}</div>
                )}
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, fontSize: 12, color: '#fca5a5' }}>
                ⚠️ O sistema enviará o pedido de estorno à API do Mercado Pago e cancelará imediatamente a licença de acesso do usuário. Esta ação não pode ser desfeita.
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn" onClick={() => setOrderToRefund(null)}>
                Cancelar
              </button>
              <button className="admin-btn danger" disabled={refunding} onClick={handleRefund}>
                {refunding ? 'Processando Reembolso…' : 'Confirmar e Estornar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
