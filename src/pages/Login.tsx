import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usePageMeta } from '../lib/usePageMeta'
import AuthShell from '../components/AuthShell'
import { api } from '../api'
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
  const locationState = location.state as { error?: string; notice?: string; from?: string } | null
  const [error, setError] = useState(locationState?.error ?? '')
  const [notice] = useState(locationState?.notice ?? '')
  const [googleLoading, setGoogleLoading] = useState(false)
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
        navigate(`/app/plans?offer=${pendingOffer}`, { replace: true })
      } else {
        const lic = await api.getLicense().catch(() => null)
        const hasActivePlan = Boolean(
          lic && (lic.lifetime || lic.status === 'active' || (lic.plan !== 'free' && lic.status !== 'expired' && lic.status !== 'suspended'))
        )
        if (!hasActivePlan) {
          navigate('/app/plans', { replace: true })
        } else {
          navigate(locationState?.from ?? '/app', { replace: true })
        }
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await api.loginWithGoogle()
    } catch (e) {
      setError((e as Error).message || 'Falha ao conectar com o Google.')
      setGoogleLoading(false)
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

        <button id="login-submit" className="btn primary block" disabled={isSubmitting || googleLoading}>
          <LogIn size={15} /> {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="auth-separator">
          <span>ou</span>
        </div>

        <button
          type="button"
          id="google-login-btn"
          className="btn block google-btn"
          disabled={isSubmitting || googleLoading}
          onClick={handleGoogleLogin}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {googleLoading ? 'Conectando ao Google…' : 'Entrar com Google'}
        </button>
      </form>
      <p className="muted center">
        Não tem conta? <Link to="/register">Criar conta</Link>
      </p>
    </AuthShell>
  )
}
