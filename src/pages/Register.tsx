import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UserPlus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { usePageMeta } from '../lib/usePageMeta'
import AuthShell from '../components/AuthShell'
import { isOfferKey } from '../api/types'

const PENDING_OFFER_KEY = 'acm360_pending_offer_v1'

const schema = z.object({
  name: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
  legalAcceptance: z.boolean().refine((accepted) => accepted, 'Aceite os Termos de Uso e a Política de Privacidade.'),
})
type Form = z.infer<typeof schema>

export default function Register() {
  usePageMeta('Criar conta', 'Crie sua conta para gerenciar sua licença GOACM.')
  const { register: signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedOffer = isOfferKey(searchParams.get('offer')) ? searchParams.get('offer') : null
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (v: Form) => {
    setError('')
    setNotice('')
    sessionStorage.removeItem(PENDING_OFFER_KEY)
    if (requestedOffer) sessionStorage.setItem(PENDING_OFFER_KEY, requestedOffer)
    try {
      await signUp(v.name, v.email, v.password)
      sessionStorage.removeItem(PENDING_OFFER_KEY)
      navigate(requestedOffer ? `/app/plans?offer=${requestedOffer}` : '/app/plans', { replace: true })
    } catch (e) {
      const message = e as Error & { code?: string }
      if (message.code === 'email_confirmation_required') setNotice(message.message)
      else setError(message.message)
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Crie seu acesso para ativar e gerenciar a licença GOACM.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="field" htmlFor="reg-name">Nome</label>
        <input id="reg-name" autoComplete="name" placeholder="Seu nome" {...register('name')} />
        {errors.name && <p className="err">{errors.name.message}</p>}

        <label className="field" htmlFor="reg-email">E-mail</label>
        <input id="reg-email" type="email" autoComplete="email" placeholder="voce@exemplo.com" {...register('email')} />
        {errors.email && <p className="err">{errors.email.message}</p>}

        <label className="field" htmlFor="reg-password">Senha</label>
        <input id="reg-password" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...register('password')} />
        {errors.password && <p className="err">{errors.password.message}</p>}

        <label className="legal-consent" htmlFor="reg-legal">
          <input id="reg-legal" type="checkbox" {...register('legalAcceptance')} />
          <span>Li e aceito os <Link to="/terms">Termos de Uso</Link> e a <Link to="/privacy">Política de Privacidade</Link>.</span>
        </label>
        {errors.legalAcceptance && <p className="err">{errors.legalAcceptance.message}</p>}

        {error && <div className="alert" role="alert"><AlertTriangle size={15} /> {error}</div>}
        {notice && <div className="success" role="status"><CheckCircle2 size={15} /> {notice}</div>}

        <button id="reg-submit" className="btn primary block" disabled={isSubmitting}>
          <UserPlus size={15} /> {isSubmitting ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
      <p className="muted center">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthShell>
  )
}
