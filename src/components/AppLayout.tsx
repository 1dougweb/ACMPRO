import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FolderKanban, GraduationCap, Users, CreditCard, User, ShieldCheck, LogOut } from 'lucide-react'
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
          <NavLink to="/app" end><FolderKanban size={15} /> Projetos</NavLink>
          <NavLink to="/app/training"><GraduationCap size={15} /> Treinamentos</NavLink>
          <NavLink to="/app/team"><Users size={15} /> Equipe</NavLink>
          <NavLink to="/app/plans"><CreditCard size={15} /> Assinatura</NavLink>
        </nav>
        <div className="user-menu" ref={ref}>
          <button id="user-menu-btn" className="avatar" aria-label={`Menu da conta de ${user?.name ?? ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{initials}</button>
          {open && <div className="menu" role="menu">
            <div className="menu-head"><strong>{user?.name}</strong><span>{user?.email}</span></div>
            <Link className="menu-item" role="menuitem" to="/app/training" onClick={closeMenu}><GraduationCap size={15} /> Treinamentos</Link>
            <Link className="menu-item" role="menuitem" to="/app/team" onClick={closeMenu}><Users size={15} /> Equipe e dispositivos</Link>
            <div className="menu-divider" />
            <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); setProfileOpen(true) }}><User size={15} /> Meu Perfil</button>
            <Link className="menu-item" role="menuitem" to="/app/plans" onClick={closeMenu}><CreditCard size={15} /> Gerenciar assinatura</Link>
            {adminOverview && <><div className="menu-divider" /><Link className="menu-item" role="menuitem" to="/app/admin" onClick={closeMenu}><ShieldCheck size={15} /> Administração</Link></>}
            <div className="menu-divider" />
            <button id="logout-btn" role="menuitem" className="menu-item danger" onClick={async () => { closeMenu(); await logout(); navigate('/login') }}><LogOut size={15} /> Sair</button>
          </div>}
        </div>
      </div>
    </header>
    <main className="container"><Outlet context={{ adminOverview, adminChecked, adminError }} /></main>
    {profileOpen && <ProfileModal onClose={closeProfile} />}
  </>
}
