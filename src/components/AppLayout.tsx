import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api'
import type { AdminOverview } from '../api/types'
import { Logo } from './AuthShell'
import ProfileModal from './ProfileModal'

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
            <Link className="menu-item" role="menuitem" to="/app/training" onClick={closeMenu}>Treinamentos</Link>
            <Link className="menu-item" role="menuitem" to="/app/team" onClick={closeMenu}>Equipe e dispositivos</Link>
            <div className="menu-divider" />
            <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); setProfileOpen(true) }}>Meu Perfil</button>
            <Link className="menu-item" role="menuitem" to="/app/plans" onClick={closeMenu}>Gerenciar assinatura</Link>
            {adminOverview && <><div className="menu-divider" /><Link className="menu-item" role="menuitem" to="/app/admin" onClick={closeMenu}>Administração</Link></>}
            <div className="menu-divider" />
            <button id="logout-btn" role="menuitem" className="menu-item danger" onClick={async () => { closeMenu(); await logout(); navigate('/login') }}>Sair</button>
          </div>}
        </div>
      </div>
    </header>
    <main className="container"><Outlet context={{ adminOverview, adminChecked, adminError }} /></main>
    {profileOpen && <ProfileModal onClose={closeProfile} />}
  </>
}
