import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '../api'
import { isLicenseActive } from '../api/types'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let mounted = true

    async function handleAuth() {
      // 1. Check if Supabase or OAuth provider redirected with an error in search or hash
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const search = typeof window !== 'undefined' ? window.location.search : ''
      const searchParams = new URLSearchParams(search)
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

      const oauthError = searchParams.get('error') || hashParams.get('error')
      const oauthDesc = searchParams.get('error_description') || hashParams.get('error_description') || ''

      if (oauthError) {
        let userFacingError = 'Apenas usuários que já criaram uma conta podem acessar com o Google. Por favor, cadastre-se primeiro.'
        if (oauthDesc.toLowerCase().includes('cancelled') || oauthDesc.toLowerCase().includes('canceled')) {
          userFacingError = 'Login com o Google foi cancelado.'
        }
        if (mounted) {
          navigate('/login', {
            replace: true,
            state: { error: userFacingError },
          })
        }
        return
      }

      // 2. Allow Supabase auth client a moment to pick up session from URL
      try {
        let user = await api.me()
        if (!user) {
          for (let i = 0; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 400))
            user = await api.me()
            if (user) break
          }
        }

        if (!user) {
          if (mounted) navigate('/login', { replace: true })
          return
        }

        // 3. Verify if user has an existing account/license
        let hasAccount = false
        let hasActivePlan = false
        try {
          const license = await api.getLicense()
          if (license && (license.role || license.status !== 'none' || license.plan)) {
            hasAccount = true
            hasActivePlan = isLicenseActive(license)
          }
        } catch (err: unknown) {
          const msg = (err as Error).message || ''
          const errCode = (err as { code?: string }).code || ''
          if (errCode === 'account_missing' || msg.includes('account_missing')) {
            hasAccount = false
          } else if (!msg.includes('unauthorized')) {
            // Transient edge failure, allow existing user through
            hasAccount = true
          }
        }

        if (!hasAccount) {
          await api.logout()
          if (mounted) {
            navigate('/login', {
              replace: true,
              state: {
                error: 'Apenas usuários que já criaram uma conta podem acessar com o Google. Por favor, cadastre-se primeiro.',
              },
            })
          }
          return
        }

        // Successfully authenticated with prior account
        if (mounted) {
          navigate(hasActivePlan ? '/app' : '/app/plans', { replace: true })
        }
      } catch (err: unknown) {
        if (mounted) {
          const message = (err as Error).message || 'Falha ao autenticar com Google.'
          setErrorMsg(message)
          setTimeout(() => navigate('/login', { replace: true }), 3000)
        }
      }
    }

    void handleAuth()

    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
        {errorMsg ? (
          <p style={{ color: '#ef4444' }}>{errorMsg}</p>
        ) : (
          <>
            <Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', color: '#10b981', margin: '0 auto 12px' }} />
            <p>Conectando ao ACMGO com sua conta Google…</p>
          </>
        )}
      </div>
    </div>
  )
}
