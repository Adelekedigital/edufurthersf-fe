import { cookies } from 'next/headers'
import Link from 'next/link'
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from './session'
import './admin.css'

export const metadata = {
  title: 'Internal review | Edufurther',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = verifySessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value)

  if (!session) {
    // The login page itself renders under this layout but proxy.ts lets it
    // through without a session - nothing to show in the header yet.
    return <div className="admin-shell">{children}</div>
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <span className="admin-header-title">Edufurther internal review</span>
        <nav className="admin-nav">
          <Link href="/admin/reviews">Review queue</Link>
          <Link href="/admin/scholarships">Scholarships</Link>
        </nav>
        <div className="admin-header-actions">
          <span className="admin-header-name">Signed in as {session.name}</span>
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className="admin-signout">Sign out</button>
          </form>
        </div>
      </header>
      <div className="admin-content">{children}</div>
    </div>
  )
}
