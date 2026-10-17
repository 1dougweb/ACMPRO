import { useCallback, useEffect, useState, type FormEvent } from 'react'
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

  const refresh = useCallback(async () => {
    const [nextMembers, nextDevices, nextLicense] = await Promise.all([api.listMembers(), api.listDevices(), api.getLicense()])
    setMembers(nextMembers); setDevices(nextDevices); setLicense(nextLicense)
  }, [])

  useEffect(() => { void refresh().catch((err: unknown) => setError((err as Error).message)) }, [refresh])

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
  if (!license) return <div className="alert" role="alert">{error}</div>

  const activeMembers = members.filter((member) => member.status === 'active').length
  const used = members.filter((member) => member.status === 'active' || member.status === 'invited').length
  const owner = license.role === 'owner'
  const unlimited = Boolean(license.lifetime)
  const seatLimit = license.seatLimit === undefined ? 3 : license.seatLimit
  const canInvite = owner && (unlimited || (license.status === 'active' && (seatLimit === null || used < seatLimit)))

  return <div className="team-page">
    <div className="team-heading"><div><h1 className="page-title">Minha <span>Equipe</span></h1><p className="muted">Gerencie as pessoas e dispositivos vinculados à sua conta.</p></div></div>
    {error && <div className="alert" role="alert">{error}</div>}{notice && <div className="success" role="status">{notice}</div>}

    <section className="card team-summary"><div className="team-summary-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1.3A4.7 4.7 0 0 1 8.2 13h1.6a4.7 4.7 0 0 1 4.7 4.7V19M16 5.5a3 3 0 0 1 0 5.8M17 13.5a4.2 4.2 0 0 1 3.5 4.2V19" /></svg></div><div><strong>Projetistas ativos: {activeMembers}{unlimited ? ' · Ilimitado' : ` de ${seatLimit ?? 'Ilimitado'}`}</strong><span>{used} acesso(s) utilizado(s), incluindo convites pendentes.</span></div></section>

    <section className="card team-members-card"><div className="section-card-heading"><div><h2>Membros da Equipe</h2><p className="muted">Pessoas vinculadas à sua conta GOACM.</p></div><span className="badge active">{used} {unlimited ? 'acessos' : `/ ${seatLimit ?? '∞'} acessos`}</span></div>
      {members.length === 0 ? <p className="empty">Nenhum membro adicionado ainda.</p> : <div className="team-member-list">{members.map((member) => <article className="team-member-row" key={member.id}><div className="member-avatar" aria-hidden="true">{(member.name || member.email).slice(0, 1).toUpperCase()}</div><div className="team-member-info"><strong>{member.name || member.email}</strong><span>{member.email}</span></div><span className="member-role">{member.role === 'owner' ? 'Titular' : statusLabel[member.status]}</span>{owner && member.role !== 'owner' && <button className="btn danger sm" disabled={busy} onClick={() => void remove(member)}>Remover</button>}</article>)}</div>}
    </section>

    <section className="card team-invite-card"><div className="section-card-heading"><div><h2>Convidar Projetista</h2><p className="muted">A pessoa recebe um e-mail para definir a própria senha. Depois, usa esse e-mail e senha no plugin SketchUp; o acesso Pro vem da sua licença.</p></div></div>
      {owner ? <form className="invite-form" onSubmit={(event) => void invite(event)}><label className="field">Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do projetista" required disabled={!canInvite || busy} /></label><label className="field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" required disabled={!canInvite || busy} /></label><label className="field invite-locale">Idioma do convidado<select value={locale} onChange={(event) => setLocale(event.target.value as PreferredLocale)} disabled={!canInvite || busy}><option value="pt-BR">BR Português (Brasil)</option><option value="en">English</option><option value="es">Español</option></select></label><button className="btn primary" disabled={!canInvite || busy}>{busy ? 'Enviando…' : 'Enviar convite'}</button>{!canInvite && <p className="hint">{unlimited ? 'Não foi possível convidar neste momento.' : 'Uma licença Pro ativa e um acesso disponível são necessários para convidar.'}</p>}</form> : <p className="hint">Somente o titular da licença pode enviar e remover convites.</p>}
    </section>

    <section className="card team-devices-card"><div className="section-card-heading"><div><h2>Dispositivos da Equipe</h2><p className="muted">Computadores com o plugin SketchUp autorizado. Cada pessoa pode usar um computador.</p></div><span className="badge none">{devices.length} conectado(s)</span></div>
      {devices.length === 0 ? <p className="empty">Nenhum dispositivo conectado ainda.</p> : <div className="table-wrap"><table className="table team-device-table"><thead><tr><th>Membro</th><th>Máquina</th><th>Último uso</th><th>Ações</th></tr></thead><tbody>{devices.map((device) => <tr key={device.id}><td><strong>{device.memberName || 'Membro da equipe'}</strong><small className="table-subtitle">{device.memberEmail || ''}</small></td><td>{device.name}</td><td>{new Date(device.lastSeen).toLocaleString('pt-BR')}</td><td className="right"><button className="btn danger sm" disabled={busy} onClick={() => void revoke(device)}>Revogar acesso</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
