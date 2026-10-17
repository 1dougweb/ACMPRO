import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import AuthShell from '../components/AuthShell'
import { usePageMeta } from '../lib/usePageMeta'

export default function ForgotPassword() {
  usePageMeta('Recuperar senha', 'Receba um link para redefinir sua senha ACMPRO.')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para o e-mail da sua conta.">
      {sent ? (
        <div className="success" role="status">Se a conta existir, você receberá um e-mail com as próximas instruções.</div>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <label className="field" htmlFor="reset-email">E-mail</label>
          <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {error && <div className="alert" role="alert">{error}</div>}
          <button className="btn primary block" disabled={busy || !email.trim()}>{busy ? 'Enviando…' : 'Enviar link'}</button>
        </form>
      )}
      <p className="muted center"><Link to="/login">Voltar para entrar</Link></p>
    </AuthShell>
  )
}
