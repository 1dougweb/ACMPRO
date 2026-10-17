import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link className="logo" aria-label="ACMGO" to={to}>
      <img src="/logo-acmgo.svg" alt="ACMGO" />
    </Link>
  )
}

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Logo />
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </main>
  )
}
