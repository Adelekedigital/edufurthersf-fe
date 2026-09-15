import { cookies } from 'next/headers'
import { ReviewQueueTable } from '../../../components/admin/ReviewQueueTable'
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '../session'

export const metadata = {
  title: 'Review queue | Edufurther',
}

export default async function ReviewsPage() {
  const cookieStore = await cookies()
  const session = verifySessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  // proxy.ts already guarantees a valid session reaches this page; session is
  // re-read here only to get the reviewer's name for attributing decisions.
  const reviewerName = session?.name ?? 'Unknown reviewer'

  return <ReviewQueueTable reviewerName={reviewerName} />
}
