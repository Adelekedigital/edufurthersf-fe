import { NextResponse } from 'next/server'
import { ADMIN_LOGIN_PATH, SESSION_COOKIE_NAME } from '../../../admin/session'

export async function POST() {
  // Relative Location for the same reason as the login route: it resolves
  // against the request's own origin, so the host-scoped session cookie is
  // never dropped by a redirect to a different hostname.
  const response = new NextResponse(null, { status: 303, headers: { Location: ADMIN_LOGIN_PATH } })
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
