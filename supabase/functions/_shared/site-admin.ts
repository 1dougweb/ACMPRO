export function isSiteAdmin(email: string | null | undefined) {
  if (!email) return false
  const allowlist = (Deno.env.get('SITE_ADMIN_EMAILS') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.trim().toLowerCase())
}

export function verifiedEmail(user: { email?: string | null; email_confirmed_at?: string | null }) {
  return Boolean(user.email && user.email_confirmed_at && isSiteAdmin(user.email))
}
