import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import AuthShell from '../components/AuthShell'
import { usePageMeta } from '../lib/usePageMeta'

export default function ResetPassword() {
  usePageMeta('Definir nova senha', 'Escolha uma nova senha para sua conta ACMPRO.')
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('As senhas não correspondem.')
      return
    }
    setBusy(true)
    try {
      await api.updatePassword(password)
      navigate('/login', { replace: true, state: { notice: 'Senha atualizada. Entre com sua nova senha.' } })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Definir nova senha" subtitle="Use pelo menos oito caracteres.">
      <form onSubmit={(event) => void submit(event)}>
        <label className="field" htmlFor="new-password">Nova senha</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
        <label className="field" htmlFor="new-password-confirm">Repita a nova senha</label>
        <input id="new-password-confirm" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
        {error && <div className="alert" role="alert">{error}</div>}
        <button className="btn primary block" disabled={busy || password.length < 8 || !confirmation}>
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
      <p className="muted center"><Link to="/login">Voltar para entrar</Link></p>
    </AuthShell>
  )
}
