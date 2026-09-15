import Link from 'next/link'

export default function AdminHomePage() {
  return (
    <main className="admin-placeholder">
      <h1>You&apos;re signed in.</h1>
      <p>
        <Link href="/admin/reviews">Go to the review queue</Link> or{' '}
        <Link href="/admin/scholarships">manage scholarships</Link>.
      </p>
    </main>
  )
}
