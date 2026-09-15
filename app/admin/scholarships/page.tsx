import { cookies } from 'next/headers'
import { ScholarshipsTable } from '../../../components/admin/ScholarshipsTable'
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '../session'

export const metadata = {
  title: 'Scholarships | Edufurther',
}

export default async function ScholarshipsPage() {
  const cookieStore = await cookies()
  const session = verifySessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  const reviewerName = session?.name ?? 'Unknown reviewer'

  return <ScholarshipsTable reviewerName={reviewerName} />
}
