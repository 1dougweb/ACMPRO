import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './AuthShell'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const initials = (user?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo to="/app" />
          <nav aria-label="Principal">
            <NavLink to="/app" end id="nav-license">Licença</NavLink>
            <NavLink to="/app/devices" id="nav-devices">Dispositivos</NavLink>
            <NavLink to="/app/team" id="nav-team">Equipe</NavLink>
          </nav>
          <div className="user-menu" ref={ref}>
            <button id="user-menu-btn" className="avatar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
              {initials}
            </button>
            {open && (
              <div className="menu" role="menu">
                <div className="menu-head">
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                </div>
                <button id="logout-btn" role="menuitem" className="menu-item danger" onClick={async () => { await logout(); navigate('/login') }}>
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
