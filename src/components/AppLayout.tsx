import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api'
import type { AdminOverview } from '../api/types'
import { Logo } from './AuthShell'
import ProfileModal from './ProfileModal'

type MenuIconName = 'training' | 'team' | 'profile' | 'plans' | 'admin' | 'logout'

function MenuIcon({ name }: { name: MenuIconName }) {
  const common = { className: 'menu-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const shapes: Record<MenuIconName, ReactNode> = {
    training: <><path d="m3 8 9-4 9 4-9 4-9-4Z" /><path d="M7 10v5c3 2 7 2 10 0v-5M21 8v6" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1.3A4.7 4.7 0 0 1 8.2 13h1.6a4.7 4.7 0 0 1 4.7 4.7V19M16 5.5a3 3 0 0 1 0 5.8M17 13.5a4.2 4.2 0 0 1 3.5 4.2V19" /></>,
    profile: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20v-1.5a7 7 0 0 1 14 0V20" /></>,
    plans: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 10h18M7 15h4" /></>,
    admin: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 8h3v3H8zM14 8h2M14 11h2M8 15h8" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></>,
  }
  return <svg {...common}>{shapes[name]}</svg>
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null)
  const [adminChecked, setAdminChecked] = useState(false)
  const [adminError, setAdminError] = useState('')
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
    return () => { current = false }
  }, [])

  const initials = (user?.name ?? '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  const closeMenu = () => setOpen(false)

  return <>
    <header className="topbar">
      <div className="topbar-inner">
        <Logo to="/app" />
        <nav aria-label="Principal">
          <NavLink to="/app" end>Projetos</NavLink>
          <NavLink to="/app/training">Treinamentos</NavLink>
          <NavLink to="/app/team">Equipe</NavLink>
          <NavLink to="/app/plans">Assinatura</NavLink>
        </nav>
        <div className="user-menu" ref={ref}>
          <button id="user-menu-btn" className="avatar" aria-label={`Menu da conta de ${user?.name ?? ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{initials}</button>
          {open && <div className="menu" role="menu">
            <div className="menu-head"><strong>{user?.name}</strong><span>{user?.email}</span></div>
            <Link className="menu-item" role="menuitem" to="/app/training" onClick={closeMenu}><MenuIcon name="training" />Treinamentos</Link>
            <Link className="menu-item" role="menuitem" to="/app/team" onClick={closeMenu}><MenuIcon name="team" />Equipe</Link>
            <div className="menu-divider" />
            <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); setProfileOpen(true) }}><MenuIcon name="profile" />Meu Perfil</button>
            <Link className="menu-item" role="menuitem" to="/app/plans" onClick={closeMenu}><MenuIcon name="plans" />Gerenciar assinatura</Link>
            {adminOverview && <><div className="menu-divider" /><Link className="menu-item" role="menuitem" to="/app/admin" onClick={closeMenu}><MenuIcon name="admin" />Administração</Link></>}
            <div className="menu-divider" />
            <button id="logout-btn" role="menuitem" className="menu-item danger" onClick={async () => { closeMenu(); await logout(); navigate('/login') }}><MenuIcon name="logout" />Sair</button>
          </div>}
        </div>
      </div>
    </header>
    <main className="container"><Outlet context={{ adminOverview, adminChecked, adminError }} /></main>
    {profileOpen && <ProfileModal onClose={closeProfile} />}
  </>
}
