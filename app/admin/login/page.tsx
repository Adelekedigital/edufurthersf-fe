export const metadata = {
  title: 'Admin sign in | Edufurther',
}

type SearchParams = { next?: string; error?: string }

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { next, error } = await searchParams
  const nextPath = next && next.startsWith('/admin') ? next : '/admin'

  return (
    <main className="admin-auth-page">
      <form className="admin-auth-card" action="/api/admin/login" method="POST">
        <h1 className="admin-auth-title">Internal review sign in</h1>
        <p className="admin-auth-subtitle">For Edufurther team members verifying scholarship listings.</p>

        {error ? <p className="admin-auth-error" role="alert">Incorrect passcode, or your name is missing.</p> : null}

        <label className="admin-field">
          <span>Your name</span>
          <input type="text" name="name" autoComplete="name" required maxLength={100} />
        </label>

        <label className="admin-field">
          <span>Team passcode</span>
          <input type="password" name="passcode" autoComplete="current-password" required />
        </label>

        <input type="hidden" name="next" value={nextPath} />

        <button type="submit" className="admin-auth-submit">Sign in</button>
      </form>
    </main>
  )
}
