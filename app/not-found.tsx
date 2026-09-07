import Link from 'next/link'

export default function NotFound() {
  return <main className="not-found"><p className="eyebrow">Page not found</p><h1>That page moved on.</h1><Link className="text-link" href="/">Back to the Scholarship Finder</Link></main>
}
