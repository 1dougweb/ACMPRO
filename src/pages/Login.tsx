import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usePageMeta } from '../lib/usePageMeta'
import AuthShell from '../components/AuthShell'
import { isOfferKey } from '../api/types'

const PENDING_OFFER_KEY = 'acm360_pending_offer_v1'

const schema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})
type Form = z.infer<typeof schema>

export default function Login() {
  usePageMeta('Entrar', 'Acesse sua conta e gerencie sua licença e dispositivos.')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [notice] = useState((location.state as { notice?: string } | null)?.notice ?? '')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (v: Form) => {
    setError('')
    try {
      await login(v.email, v.password)
      const pendingOffer = sessionStorage.getItem(PENDING_OFFER_KEY)
      if (isOfferKey(pendingOffer)) {
        sessionStorage.removeItem(PENDING_OFFER_KEY)
        navigate(`/app?offer=${pendingOffer}`, { replace: true })
      } else {
        navigate((location.state as { from?: string } | null)?.from ?? '/app', { replace: true })
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Entre para gerenciar sua licença.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="field" htmlFor="login-email">E-mail</label>
        <input id="login-email" type="email" autoComplete="email" placeholder="voce@exemplo.com" {...register('email')} />
        {errors.email && <p className="err">{errors.email.message}</p>}

        <label className="field" htmlFor="login-password">Senha</label>
        <input id="login-password" type="password" autoComplete="current-password" placeholder="Sua senha" {...register('password')} />
        {errors.password && <p className="err">{errors.password.message}</p>}
        <p className="muted auth-helper"><Link to="/forgot-password">Esqueci minha senha</Link></p>

        {error && <div className="alert" role="alert"><AlertTriangle size={15} /> {error}</div>}
        {notice && <div className="success" role="status"><CheckCircle2 size={15} /> {notice}</div>}

        <button id="login-submit" className="btn primary block" disabled={isSubmitting}>
          <LogIn size={15} /> {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="muted center">
        Não tem conta? <Link to="/register">Criar conta</Link>
      </p>
    </AuthShell>
  )
}
