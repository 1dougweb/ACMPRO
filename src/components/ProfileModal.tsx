import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  KeyRound,
  CreditCard,
  Laptop,
  Trash2,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
} from 'lucide-react'
import { api, type Device, type License } from '../api'
import { useAuth } from '../auth/AuthContext'

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [devices, setDevices] = useState<Device[]>([])
  const [license, setLicense] = useState<License | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let mounted = true
    void Promise.all([api.listDevices(), api.getLicense()]).then(([nextDevices, nextLicense]) => {
      if (!mounted) return
      setDevices(nextDevices.filter((device) => !device.memberEmail || device.memberEmail.toLowerCase() === user?.email.toLowerCase()))
      setLicense(nextLicense)
    }).catch((err: unknown) => { if (mounted) setError((err as Error).message) }).finally(() => { if (mounted) setLoading(false) })
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => { mounted = false; document.removeEventListener('keydown', closeOnEscape) }
  }, [onClose, user?.email])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateProfile({ name, phone })
      setNotice('Perfil atualizado com sucesso.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async () => {
    if (password.length < 8) {
      setError('Use uma senha com pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.updatePassword(password)
      setPassword('')
      setShowPassword(false)
      setNotice('Senha alterada com sucesso.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (device: Device) => {
    if (!window.confirm(`Desconectar o computador “${device.name}”?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.revokeDevice(device.id)
      setDevices((current) => current.filter((item) => item.id !== device.id))
      setNotice('Computador desconectado.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button className="modal-close" aria-label="Fechar perfil" onClick={onClose}>
          <X size={16} />
        </button>
        <div className="profile-modal-heading">
          <span className="profile-alert-icon" aria-hidden="true">
            <UserCheck size={14} />
          </span>
          <div>
            <h2 id="profile-title">Meu Perfil</h2>
            <p className="muted">Gerencie suas informações pessoais e os dispositivos conectados.</p>
          </div>
        </div>
        {error && <div className="alert" role="alert"><AlertTriangle size={15} /> {error}</div>}
        {notice && <div className="success" role="status"><CheckCircle2 size={15} /> {notice}</div>}
        <form className="profile-form" onSubmit={(event) => void save(event)}>
          <label className="field">Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label className="field">E-mail<input value={user?.email ?? ''} readOnly disabled /></label>
          <label className="field">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" /></label>
          <div className="profile-action-row">
            <div><strong>Senha</strong><span>Altere sua senha de acesso</span></div>
            <button type="button" className="btn" onClick={() => setShowPassword((value) => !value)}>
              <KeyRound size={13} /> Alterar senha
            </button>
          </div>
          {showPassword && (
            <div className="password-change">
              <label className="field">
                Nova senha
                <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} />
              </label>
              <button type="button" className="btn" disabled={busy || password.length < 8} onClick={() => void changePassword()}>
                Salvar nova senha
              </button>
            </div>
          )}
          <div className="profile-action-row">
            <div>
              <strong>Assinatura</strong>
              <span>{loading ? 'Carregando plano…' : license?.lifetime ? 'GOACM Lifetime ativo' : license?.status === 'active' ? 'Plano Pro ativo' : 'Consulte seu plano e pagamentos'}</span>
            </div>
            <Link className="btn" to="/app/plans" onClick={onClose}>
              <CreditCard size={13} /> Gerenciar assinatura
            </Link>
          </div>
          <div className="profile-form-actions">
            <button className="btn primary" disabled={busy}>
              <Save size={15} /> {busy ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </div>
        </form>
        {(() => {
          const hasActivePlan = Boolean(
            license && (
              license.lifetime ||
              license.status === 'active' ||
              (license.plan !== 'free' && license.status !== 'expired' && license.status !== 'suspended')
            )
          )
          if (!hasActivePlan) {
            return (
              <section className="profile-devices">
                <div className="profile-devices-heading">
                  <div>
                    <h3>Dispositivos autorizados</h3>
                    <p className="muted">Conecte seu computador no plugin SketchUp com sua conta.</p>
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <Laptop size={30} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Nenhum plano ativo</p>
                  <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Assine um plano para autorizar computadores e utilizar o plugin GOACM no SketchUp.</p>
                  <Link className="btn primary sm" to="/app/plans" onClick={onClose}>
                    <CreditCard size={14} /> Escolher plano
                  </Link>
                </div>
              </section>
            )
          }

          return (
            <section className="profile-devices">
              <div className="profile-devices-heading">
                <div>
                  <h3>Dispositivos autorizados</h3>
                  <p className="muted">Cada pessoa pode autorizar um computador para usar o plugin.</p>
                </div>
                <span className="device-count">{devices.length}/1</span>
              </div>
              {loading ? (
                <p className="empty">Carregando dispositivos…</p>
              ) : devices.length === 0 ? (
                <p className="empty">Nenhum computador autorizado nesta conta.</p>
              ) : (
                devices.map((device) => (
                  <article className="profile-device" key={device.id}>
                    <div className="device-monitor" aria-hidden="true">
                      <Laptop size={22} />
                    </div>
                    <div className="profile-device-info">
                      <strong>{device.name}</strong>
                      <span>Conectado em {new Date(device.lastSeen).toLocaleDateString('pt-BR')}</span>
                      <small>Último uso: {new Date(device.lastSeen).toLocaleString('pt-BR')}</small>
                    </div>
                    <button type="button" className="btn danger sm" disabled={busy} onClick={() => void revoke(device)}>
                      <Trash2 size={12} /> Desconectar
                    </button>
                  </article>
                ))
              )}
              <p className="hint">Para trocar de máquina, desconecte a atual e entre no GOACM pelo SketchUp no novo computador.</p>
            </section>
          )
        })()}
      </section>
    </div>
  )
}
