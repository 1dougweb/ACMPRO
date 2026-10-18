import { useEffect, useState } from 'react'
import {
  Search,
  Filter,
  Laptop,
  Trash2,
  Edit,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { api } from '../../api'
import type { AdminAccountItem } from '../../api/types'
import { usePageMeta } from '../../lib/usePageMeta'

export default function AdminUsers() {
  usePageMeta('Admin • Usuários & Licenças', 'Gerencie contas, licenças e dispositivos.')
  const [users, setUsers] = useState<AdminAccountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Estado do Modal de Edição
  const [selectedUser, setSelectedUser] = useState<AdminAccountItem | null>(null)
  const [editLifetime, setEditLifetime] = useState(false)
  const [editStatus, setEditStatus] = useState('active')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editSeatLimit, setEditSeatLimit] = useState(3)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [saveError, setSaveError] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.adminListUsers(search, statusFilter)
      setUsers(data)
    } catch (err: unknown) {
      setError((err as Error).message || 'Falha ao listar usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const openEditModal = (user: AdminAccountItem) => {
    setSelectedUser(user)
    setEditLifetime(user.isLifetime)
    setEditStatus(user.status === 'none' ? 'active' : user.status)
    setEditExpiresAt(user.expiresAt ? user.expiresAt.split('T')[0] : '')
    setEditSeatLimit(user.seatLimit || 3)
    setSaveSuccess('')
    setSaveError('')
  }

  const handleSaveLicense = async () => {
    if (!selectedUser) return
    setSaving(true)
    setSaveSuccess('')
    setSaveError('')
    try {
      await api.adminUpdateLicense({
        accountId: selectedUser.id,
        lifetime: editLifetime,
        status: editStatus,
        expiresAt: editExpiresAt ? new Date(editExpiresAt + 'T23:59:59Z').toISOString() : undefined,
        seatLimit: editSeatLimit,
      })
      setSaveSuccess('Licença atualizada com sucesso!')
      await loadUsers()
      setTimeout(() => {
        setSelectedUser(null)
      }, 1000)
    } catch (err: unknown) {
      setSaveError((err as Error).message || 'Erro ao salvar alterações.')
    } finally {
      setSaving(false)
    }
  }

  const handleRevokeDevice = async (deviceId: string) => {
    if (!window.confirm('Tem certeza que deseja revogar este computador? O usuário precisará logar novamente.')) return
    try {
      await api.adminRevokeDevice(deviceId)
      // Atualiza localmente
      if (selectedUser) {
        setSelectedUser({
          ...selectedUser,
          devices: selectedUser.devices.filter((d) => d.id !== deviceId),
          activeDevicesCount: Math.max(0, selectedUser.activeDevicesCount - 1),
        })
      }
      await loadUsers()
    } catch (err: unknown) {
      alert((err as Error).message || 'Erro ao revogar dispositivo.')
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Gerenciamento de Usuários e Licenças</h1>
          <p>Consulte contas cadastradas, altere status de assinaturas e gerencie computadores vinculados.</p>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="admin-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
            <Search size={18} style={{ color: '#64748b' }} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Buscar por nome da conta, e-mail ou ID…"
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
              <option value="active">Ativos</option>
              <option value="lifetime">Vitalício (Lifetime)</option>
              <option value="pending">Pagamento pendente</option>
              <option value="expired">Expirados</option>
            </select>
            <button className="admin-btn" onClick={() => void loadUsers()}>
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

      {/* Tabela de Usuários */}
      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#10b981' }}>
            <Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Consultando contas…</p>
          </div>
        ) : !users.length ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            Nenhum usuário encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="admin-table-container" style={{ border: 'none', borderRadius: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Conta / Titular</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Validade</th>
                  <th>Máquinas</th>
                  <th>Membros</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <strong>{u.name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.ownerEmail}</div>
                      </div>
                    </td>
                    <td>
                      {u.isLifetime ? (
                        <span className="admin-badge lifetime"><Sparkles size={11} /> Lifetime</span>
                      ) : (
                        <span>{u.plan}</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-badge ${u.status}`}>
                        {u.status === 'active' ? 'Ativo' : u.status === 'pending' ? 'Pendente' : u.status === 'expired' ? 'Expirado' : u.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {u.isLifetime ? 'Sem expiração' : u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: u.activeDevicesCount > 0 ? 'var(--brand-dark)' : 'var(--muted)' }}>
                        <Laptop size={14} /> {u.activeDevicesCount} / {u.seatLimit}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{u.membersCount}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="admin-btn primary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => openEditModal(u)}
                      >
                        <Edit size={13} /> Gerenciar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Gestão da Licença */}
      {selectedUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Gerenciar Conta: {selectedUser.name}</h3>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                onClick={() => setSelectedUser(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-modal-body">
              {saveSuccess && (
                <div style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', color: 'var(--brand-dark)', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} /> {saveSuccess}
                </div>
              )}
              {saveError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} /> {saveError}
                </div>
              )}

              <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ color: 'var(--muted)' }}>Titular da Conta:</div>
                <strong style={{ color: '#0f172a' }}>{selectedUser.ownerEmail}</strong>
              </div>

              {/* Concessão de Lifetime */}
              <div style={{ padding: '12px 14px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editLifetime}
                    onChange={(e) => setEditLifetime(e.target.checked)}
                  />
                  <div>
                    <strong style={{ color: '#7e22ce', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={14} /> Conceder Licença Vitalícia (Lifetime)
                    </strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Não expira e dá acesso ilimitado sem renovação.
                    </div>
                  </div>
                </label>
              </div>

              {/* Status e Validade caso não seja Lifetime */}
              {!editLifetime && (
                <>
                  <div className="admin-form-group">
                    <label>Status da Licença</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                      <option value="active">Ativo (Acesso Liberado)</option>
                      <option value="pending">Pendente (Aguardando Pagamento)</option>
                      <option value="suspended">Suspenso</option>
                      <option value="expired">Expirado</option>
                    </select>
                  </div>

                  <div className="admin-form-group">
                    <label>Data de Validade (Vencimento)</label>
                    <input
                      type="date"
                      value={editExpiresAt}
                      onChange={(e) => setEditExpiresAt(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="admin-form-group">
                <label>Limite de Computadores Autorizados (Assentos)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={editSeatLimit}
                  onChange={(e) => setEditSeatLimit(Number(e.target.value))}
                />
              </div>

              {/* Seção de Máquinas Conectadas */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                  Dispositivos Ativos ({selectedUser.devices.length})
                </label>
                {!selectedUser.devices.length ? (
                  <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Nenhum computador registrado no SketchUp.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedUser.devices.map((dev) => (
                      <div
                        key={dev.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            <Laptop size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                            {dev.platform || 'Computador'} • SketchUp {dev.sketchupVersion || '—'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            ID: {dev.machineId ? dev.machineId.slice(0, 16) + '…' : '—'}
                          </div>
                        </div>
                        <button
                          className="btn danger sm"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => void handleRevokeDevice(dev.id)}
                        >
                          <Trash2 size={12} /> Revogar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn" onClick={() => setSelectedUser(null)}>
                Cancelar
              </button>
              <button className="admin-btn primary" disabled={saving} onClick={handleSaveLicense}>
                {saving ? 'Salvando…' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
