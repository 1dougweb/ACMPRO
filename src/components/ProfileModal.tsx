import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await updateProfile({ name, phone }); setNotice('Perfil atualizado.') }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  const changePassword = async () => {
    if (password.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return }
    setBusy(true); setError(''); setNotice('')
    try { await api.updatePassword(password); setPassword(''); setShowPassword(false); setNotice('Senha alterada.') }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  const revoke = async (device: Device) => {
    if (!window.confirm(`Desconectar o computador “${device.name}”?`)) return
    setBusy(true); setError(''); setNotice('')
    try { await api.revokeDevice(device.id); setDevices((current) => current.filter((item) => item.id !== device.id)); setNotice('Computador desconectado.') }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <button className="modal-close" aria-label="Fechar perfil" onClick={onClose}>×</button>
      <div className="profile-modal-heading"><span className="profile-alert-icon" aria-hidden="true">!</span><div><h2 id="profile-title">Meu Perfil</h2><p className="muted">Gerencie suas informações pessoais e os dispositivos conectados.</p></div></div>
      {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="success" role="status">{notice}</div>}
      <form className="profile-form" onSubmit={(event) => void save(event)}>
        <label className="field">Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field">E-mail<input value={user?.email ?? ''} readOnly disabled /></label>
        <label className="field">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" /></label>
        <div className="profile-action-row"><div><strong>Senha</strong><span>Altere sua senha de acesso</span></div><button type="button" className="btn" onClick={() => setShowPassword((value) => !value)}>Alterar senha</button></div>
        {showPassword && <div className="password-change"><label className="field">Nova senha<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} /></label><button type="button" className="btn" disabled={busy || password.length < 8} onClick={() => void changePassword()}>Salvar nova senha</button></div>}
        <div className="profile-action-row"><div><strong>Assinatura</strong><span>{loading ? 'Carregando plano…' : license?.lifetime ? 'GOACM Lifetime ativo' : license?.status === 'active' ? 'Plano Pro ativo' : 'Consulte seu plano e pagamentos'}</span></div><Link className="btn" to="/app/plans" onClick={onClose}>Gerenciar assinatura</Link></div>
        <div className="profile-form-actions"><button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar perfil'}</button></div>
      </form>
      <section className="profile-devices">
        <div className="profile-devices-heading"><div><h3>Dispositivos autorizados</h3><p className="muted">Cada pessoa pode autorizar um computador para usar o plugin.</p></div><span className="device-count">{devices.length}/1</span></div>
        {loading ? <p className="empty">Carregando dispositivos…</p> : devices.length === 0 ? <p className="empty">Nenhum computador autorizado nesta conta.</p> : devices.map((device) => <article className="profile-device" key={device.id}><div className="device-monitor" aria-hidden="true">▣</div><div className="profile-device-info"><strong>{device.name}</strong><span>Conectado em {new Date(device.lastSeen).toLocaleDateString('pt-BR')}</span><small>Último uso: {new Date(device.lastSeen).toLocaleString('pt-BR')}</small></div><button type="button" className="btn danger sm" disabled={busy} onClick={() => void revoke(device)}>Desconectar</button></article>)}
        <p className="hint">Para trocar de máquina, desconecte a atual e entre no GOACM pelo SketchUp no novo computador.</p>
      </section>
    </section>
  </div>
}
