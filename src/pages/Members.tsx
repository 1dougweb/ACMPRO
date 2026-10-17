import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Users, UserPlus, Laptop, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api, type Device, type License, type Member, type PreferredLocale } from '../api'
import { usePageMeta } from '../lib/usePageMeta'

const statusLabel = { active: 'Ativo', invited: 'Convite enviado', removed: 'Removido' } satisfies Record<Member['status'], string>

export default function Members() {
  usePageMeta('Equipe e dispositivos', 'Gerencie as pessoas e máquinas vinculadas à sua licença GOACM.')
  const [members, setMembers] = useState<Member[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [license, setLicense] = useState<License | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [locale, setLocale] = useState<PreferredLocale>('pt-BR')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const refreshSequence = useRef(0)

  const refresh = useCallback(async () => {
    const requestId = ++refreshSequence.current
    const [membersResult, devicesResult, licenseResult] = await Promise.allSettled([
      api.listMembers(),
      api.listDevices(),
      api.getLicense(),
    ])
    if (requestId !== refreshSequence.current) return

    const errors: string[] = []
    if (membersResult.status === 'fulfilled') setMembers(membersResult.value)
    else errors.push(`Membros: ${(membersResult.reason as Error)?.message ?? 'não foi possível carregar a equipe.'}`)
    if (devicesResult.status === 'fulfilled') setDevices(devicesResult.value)
    else errors.push(`Dispositivos: ${(devicesResult.reason as Error)?.message ?? 'não foi possível carregar os computadores.'}`)
    if (licenseResult.status === 'fulfilled') setLicense(licenseResult.value)
    else errors.push(`Licença: ${(licenseResult.reason as Error)?.message ?? 'não foi possível carregar a licença.'}`)
    setError(errors.join(' '))
  }, [])

  useEffect(() => {
    void refresh()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const interval = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      refreshSequence.current += 1
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refresh])

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    try {
      await api.inviteMember(email, { name, preferredLocale: locale })
      setName(''); setEmail(''); setLocale('pt-BR')
      setNotice('Convite enviado por e-mail. A pessoa poderá definir a própria senha para entrar no plugin GOACM.')
      await refresh()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  const remove = async (member: Member) => {
    if (!window.confirm(`Remover ${member.email} da equipe? Os dispositivos dessa pessoa serão revogados.`)) return
    setError(''); setNotice(''); setBusy(true)
    try { await api.removeMember(member.id); setNotice('Acesso removido e dispositivos revogados.'); await refresh() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  const revoke = async (device: Device) => {
    if (!window.confirm(`Revogar o acesso de “${device.name}”?`)) return
    setError(''); setNotice(''); setBusy(true)
    try { await api.revokeDevice(device.id); setNotice('Dispositivo desconectado.'); await refresh() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  if (!license && !error) return <div className="splash"><div className="spinner" /></div>

  const activeMembers = members.filter((member) => member.status === 'active').length
  const used = members.filter((member) => member.status === 'active' || member.status === 'invited').length
  const owner = license?.role === 'owner' || members.some((member) => member.role === 'owner')
  const unlimited = Boolean(license?.lifetime)
  const seatLimit = license?.seatLimit === undefined ? 3 : license.seatLimit
  const canInvite = Boolean(license && owner && (unlimited || (license.status === 'active' && (seatLimit === null || used < seatLimit))))

  return <div className="team-page">
    <div className="team-heading"><div><h1 className="page-title">Minha <span>Equipe</span></h1><p className="muted">Gerencie as pessoas e dispositivos vinculados à sua conta.</p></div></div>
    {error && <div className="alert" role="alert"><AlertCircle size={15} /> {error}</div>}{notice && <div className="success" role="status"><CheckCircle2 size={15} /> {notice}</div>}

    <section className="card team-summary"><div className="team-summary-icon" aria-hidden="true"><Users size={20} /></div><div><strong>{license ? `Projetistas ativos: ${activeMembers}${unlimited ? ' · Ilimitado' : ` de ${seatLimit ?? 'Ilimitado'}`}` : `Projetistas ativos: ${activeMembers}`}</strong><span>{license ? `${used} acesso(s) utilizado(s), incluindo convites pendentes.` : 'Não foi possível carregar os detalhes da licença.'}</span></div></section>

    <section className="card team-members-card"><div className="section-card-heading"><div><h2><Users size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--brand)' }} />Membros da Equipe</h2><p className="muted">Pessoas vinculadas à sua conta GOACM.</p></div><span className="badge active">{license ? `${used} ${unlimited ? 'acessos' : `/ ${seatLimit ?? '∞'} acessos`}` : `${members.length} pessoas`}</span></div>
      {members.length === 0 ? <p className="empty">Nenhum membro adicionado ainda.</p> : <div className="team-member-list">{members.map((member) => <article className="team-member-row" key={member.id}><div className="member-avatar" aria-hidden="true">{(member.name || member.email).slice(0, 1).toUpperCase()}</div><div className="team-member-info"><strong>{member.name || member.email}</strong><span>{member.email}</span></div><span className="member-role">{member.role === 'owner' ? 'Titular' : statusLabel[member.status]}</span>{owner && member.role !== 'owner' && <button className="btn danger sm" disabled={busy} onClick={() => void remove(member)}><Trash2 size={12} /> Remover</button>}</article>)}</div>}
    </section>

    <section className="card team-invite-card"><div className="section-card-heading"><div><h2><UserPlus size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--brand)' }} />Convidar Projetista</h2><p className="muted">A pessoa recebe um e-mail para definir a própria senha. Depois, usa esse e-mail e senha no plugin SketchUp; o acesso Pro vem da sua licença.</p></div></div>
      {owner ? <form className="invite-form" onSubmit={(event) => void invite(event)}><label className="field">Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do projetista" required disabled={!canInvite || busy} /></label><label className="field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" required disabled={!canInvite || busy} /></label><label className="field invite-locale">Idioma do convidado<select value={locale} onChange={(event) => setLocale(event.target.value as PreferredLocale)} disabled={!canInvite || busy}><option value="pt-BR">BR Português (Brasil)</option><option value="en">English</option><option value="es">Español</option></select></label><button className="btn primary" disabled={!canInvite || busy}><UserPlus size={14} /> {busy ? 'Enviando…' : 'Enviar convite'}</button>{!canInvite && <p className="hint">{!license ? 'Não foi possível verificar a licença. Os convites estão bloqueados até os dados serem carregados.' : unlimited ? 'Não foi possível convidar neste momento.' : 'Uma licença Pro ativa e um acesso disponível são necessários para convidar.'}</p>}</form> : <p className="hint">Somente o titular da licença pode enviar e remover convites.</p>}
    </section>

    <section className="card team-devices-card"><div className="section-card-heading"><div><h2><Laptop size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--brand)' }} />Dispositivos da Equipe</h2><p className="muted">Computadores com o plugin SketchUp autorizado. Cada pessoa pode usar um computador.</p></div><span className="badge none">{devices.length} conectado(s)</span></div>
      {devices.length === 0 ? <p className="empty">Nenhum computador autorizado encontrado. O registro acontece quando a pessoa entra no plugin GOACM pelo SketchUp.</p> : <div className="table-wrap"><table className="table team-device-table"><thead><tr><th>Membro</th><th>Máquina</th><th>Último uso</th><th>Ações</th></tr></thead><tbody>{devices.map((device) => <tr key={device.id}><td><strong>{device.memberName || 'Membro da equipe'}</strong><small className="table-subtitle">{device.memberEmail || ''}</small></td><td>{device.name}</td><td>{new Date(device.lastSeen).toLocaleString('pt-BR')}</td><td className="right"><button className="btn danger sm" disabled={busy} onClick={() => void revoke(device)}><Trash2 size={12} /> Revogar acesso</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
