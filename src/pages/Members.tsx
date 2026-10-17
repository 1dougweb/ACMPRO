import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type License, type Member } from '../api'
import { usePageMeta } from '../lib/usePageMeta'

const statusLabel = { active: 'Ativo', invited: 'Convite enviado', removed: 'Removido' } satisfies Record<Member['status'], string>

export default function Members() {
  usePageMeta('Equipe', 'Convide e gerencie os acessos da equipe GOACM.')
  const [members, setMembers] = useState<Member[]>([])
  const [license, setLicense] = useState<License | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    const [nextMembers, nextLicense] = await Promise.all([api.listMembers(), api.getLicense()])
    setMembers(nextMembers)
    setLicense(nextLicense)
  }, [])

  useEffect(() => {
    void refresh().catch((err: unknown) => setError((err as Error).message))
  }, [refresh])

  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await api.inviteMember(email)
      setEmail('')
      setNotice('Convite enviado. O acesso será ativado quando a pessoa confirmar o e-mail.')
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (member: Member) => {
    if (!window.confirm(`Remover ${member.email} da equipe? Os dispositivos dessa pessoa serão revogados.`)) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await api.removeMember(member.id)
      setNotice('Acesso removido e dispositivos revogados.')
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!license && !error) return <div className="splash"><div className="spinner" /></div>
  if (!license) return <div className="alert" role="alert">{error}</div>

  const used = members.filter((member) => member.status === 'active' || member.status === 'invited').length
  const owner = license.role === 'owner'
  const seatLimit = license.seatLimit === undefined ? 3 : license.seatLimit
  const canInvite = owner && license.status === 'active' && (seatLimit === null || used < seatLimit)
  const seatLabel = seatLimit === null ? 'Ilimitado' : seatLimit

  return (
    <>
      <h1 className="page-title">Equipe</h1>
      <p className="muted">{license.lifetime
        ? owner ? 'Sua licença é vitalícia. Adicione as pessoas que poderão usar o plugin.' : 'Esta licença é vitalícia; somente o titular pode gerenciar os acessos.'
        : 'Gerencie até três acessos: o titular e mais duas pessoas.'}</p>
      {error && <div className="alert" role="alert">{error}</div>}
      {notice && <div className="success" role="status">{notice}</div>}

      <section className="card">
        <div className="card-row">
          <div>
            <h2>Acessos da licença</h2>
            <p className="muted">Convites pendentes também ocupam um acesso.</p>
          </div>
          <span className="badge active">{used} / {seatLabel}</span>
        </div>

        {owner && license.status !== 'active' && <p className="hint">Uma licença Pro ativa é necessária para convidar membros.</p>}
        {!owner && <p className="hint">Somente o titular da licença pode enviar e remover convites.</p>}
        {owner && (
          <form className="inline-form" onSubmit={(event) => void invite(event)}>
            <input
              type="email"
              aria-label="E-mail do novo membro"
              placeholder="email@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={!canInvite || busy}
            />
            <button className="btn primary" disabled={!canInvite || busy || !email.trim()}>
              {busy ? 'Aguarde…' : 'Enviar convite'}
            </button>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Pessoas</h2>
        {members.length === 0 ? (
          <p className="empty">Nenhum acesso encontrado.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Nome / e-mail</th><th>Perfil</th><th>Status</th><th /></tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name || member.email}<small className="table-subtitle">{member.name ? member.email : ''}</small></td>
                  <td>{member.role === 'owner' ? 'Titular' : 'Membro'}</td>
                  <td>{statusLabel[member.status]}</td>
                  <td className="right">{owner && member.role !== 'owner' && (
                    <button className="btn danger sm" disabled={busy} onClick={() => void remove(member)}>Remover</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
