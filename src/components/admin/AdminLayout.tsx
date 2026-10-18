import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Tag,
  Cpu,
  Package,
  ArrowLeft,
  LogOut,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { api } from '../../api'
import type { License } from '../../api/types'
import './admin.css'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [license, setLicense] = useState<License | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.getLicense()
      .then((lic) => {
        if (active) setLicense(lic)
      })
      .catch(() => {
        if (active) setLicense(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--brand)' }}>
        <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  // Se o usuário logado não for site admin, bloqueia o acesso
  if (!license?.isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 36, borderRadius: 12, maxWidth: 440, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          <ShieldAlert size={42} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h2 style={{ color: '#0f172a', marginBottom: 8, fontSize: 20 }}>Acesso Restrito ao Administrador</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            Sua conta ({user?.email}) não possui privilégios de administrador do sistema GOACM.
          </p>
          <Link to="/app" className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
            <ArrowLeft size={16} /> Voltar ao Portal
          </Link>
        </div>
      </div>
    )
  }

  // Mapear breadcrumb
  const currentPath = location.pathname
  const pageName =
    currentPath.endsWith('/users') ? 'Usuários & Licenças' :
    currentPath.endsWith('/orders') ? 'Pedidos & Reembolsos' :
    currentPath.endsWith('/pricing') ? 'Preços & Ofertas' :
    currentPath.endsWith('/env') ? 'Variáveis & Diagnóstico' :
    currentPath.endsWith('/plugins') ? 'Releases do Plugin' :
    'Visão Geral'

  return (
    <div className="admin-shell">
      {/* Sidebar Lateral */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Link to="/app/admin" className="admin-sidebar-brand">
            <img src="/logo-acmgo.svg" alt="ACMGO" />
          </Link>
          <span className="admin-sidebar-badge">
            <CheckCircle2 size={12} /> Admin Console
          </span>
        </div>

        <nav className="admin-nav" aria-label="Menu Administrativo">
          <NavLink to="/app/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} /> Visão Geral
          </NavLink>
          <NavLink to="/app/admin/users" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Users size={18} /> Usuários & Licenças
          </NavLink>
          <NavLink to="/app/admin/orders" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard size={18} /> Pedidos & Reembolsos
          </NavLink>
          <NavLink to="/app/admin/pricing" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Tag size={18} /> Preços & Ofertas
          </NavLink>
          <NavLink to="/app/admin/env" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Cpu size={18} /> Variáveis & Ambiente
          </NavLink>
          <NavLink to="/app/admin/plugins" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Package size={18} /> Releases do Plugin
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/app" className="admin-sidebar-link">
            <ArrowLeft size={16} /> Voltar ao Portal
          </Link>
          <button
            className="admin-sidebar-link"
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-breadcrumbs">
            <span>Admin</span>
            <span>/</span>
            <strong>{pageName}</strong>
          </div>

          <div className="admin-header-actions">
            <span className="admin-status-pill">
              <span className="admin-status-dot" /> Sistema Operacional
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user?.email}</span>
              <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                {(user?.name ?? user?.email ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
