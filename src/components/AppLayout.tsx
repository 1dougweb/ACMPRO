import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { FolderKanban, GraduationCap, Users, CreditCard, User, ShieldCheck, LogOut, Download, Loader2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api'
import { isLicenseActive, type AdminOverview, type License, type LatestPluginRelease } from '../api/types'
import { Logo } from './AuthShell'
import ProfileModal from './ProfileModal'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null)
  const [adminChecked, setAdminChecked] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [license, setLicense] = useState<License | null>(null)
  const [licenseChecked, setLicenseChecked] = useState(false)
  const [pluginRelease, setPluginRelease] = useState<LatestPluginRelease | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const closeProfile = useCallback(() => setProfileOpen(false), [])

  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    let current = true
    void api.getAdminOverview().then((overview) => { if (current) setAdminOverview(overview) })
      .catch((error: unknown) => { if (current) setAdminError((error as Error).message) })
      .finally(() => { if (current) setAdminChecked(true) })
    
    void api.getLicense()
      .then((lic) => { if (current) setLicense(lic) })
      .catch(() => { if (current) setLicense(null) })
      .finally(() => { if (current) setLicenseChecked(true) })

    void api.getLatestPluginRelease().then((rel) => { if (current) setPluginRelease(rel) }).catch(() => { if (current) setPluginRelease(null) })

    return () => { current = false }
  }, [])

  const hasActivePlan = isLicenseActive(license)

  useEffect(() => {
    if (licenseChecked && !hasActivePlan) {
      if (location.pathname !== '/app/plans' && location.pathname !== '/app/admin') {
        navigate('/app/plans', { replace: true })
      }
    }
  }, [licenseChecked, hasActivePlan, location.pathname, navigate])

  const initials = (user?.name ?? '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  const closeMenu = () => setOpen(false)

  if (!licenseChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
        <Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', color: '#10b981' }} />
      </div>
    )
  }

  const isPlansOrAdmin = location.pathname === '/app/plans' || location.pathname.startsWith('/app/admin')
  if (!hasActivePlan && !isPlansOrAdmin) {
    return <Navigate to="/app/plans" replace />
  }

  return <>
    <header className="topbar">
      <div className="topbar-inner">
        <Logo to={hasActivePlan ? '/app' : '/app/plans'} />
        <nav aria-label="Principal">
          {hasActivePlan ? (
            <>
              <NavLink to="/app" end><FolderKanban size={15} /> Projetos</NavLink>
              <NavLink to="/app/training"><GraduationCap size={15} /> Treinamentos</NavLink>
              <NavLink to="/app/team"><Users size={15} /> Equipe</NavLink>
              <NavLink to="/app/plans"><CreditCard size={15} /> Assinatura</NavLink>
            </>
          ) : (
            <NavLink to="/app/plans"><CreditCard size={15} /> Assinatura</NavLink>
          )}
        </nav>
        <div className="user-menu" ref={ref}>
          <button id="user-menu-btn" className="avatar" aria-label={`Menu da conta de ${user?.name ?? ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{initials}</button>
          {open && <div className="menu" role="menu">
            <div className="menu-head"><strong>{user?.name}</strong><span>{user?.email}</span></div>
            {hasActivePlan && (
              <>
                <Link className="menu-item" role="menuitem" to="/app/training" onClick={closeMenu}><GraduationCap size={15} /> Treinamentos</Link>
                <Link className="menu-item" role="menuitem" to="/app/team" onClick={closeMenu}><Users size={15} /> Equipe e dispositivos</Link>
                <a
                  className="menu-item highlight"
                  role="menuitem"
                  href={pluginRelease?.downloadUrl || '#'}
                  download={pluginRelease?.fileName || `ACMGO-v${pluginRelease?.version || '1.1.45'}.rbz`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMenu}
                >
                  <Download size={15} /> Baixar Plugin {pluginRelease?.version ? `(v${pluginRelease.version})` : ''}
                </a>
                <div className="menu-divider" />
              </>
            )}
            <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); setProfileOpen(true) }}><User size={15} /> Meu Perfil</button>
            <Link className="menu-item" role="menuitem" to="/app/plans" onClick={closeMenu}><CreditCard size={15} /> {hasActivePlan ? 'Gerenciar assinatura' : 'Assinatura'}</Link>
            {adminOverview && <><div className="menu-divider" /><Link className="menu-item" role="menuitem" to="/app/admin" onClick={closeMenu}><ShieldCheck size={15} /> Administração</Link></>}
            <div className="menu-divider" />
            <button id="logout-btn" role="menuitem" className="menu-item danger" onClick={async () => { closeMenu(); await logout(); navigate('/login') }}><LogOut size={15} /> Sair</button>
          </div>}
        </div>
      </div>
    </header>
    <main className="container"><Outlet context={{ adminOverview, adminChecked, adminError, hasActivePlan, license }} /></main>
    {profileOpen && <ProfileModal onClose={closeProfile} />}
  </>
}
