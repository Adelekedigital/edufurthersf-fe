import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_LOGIN_PATH, SESSION_COOKIE_NAME, safeNextPath, verifySessionCookieValue } from './app/admin/session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = verifySessionCookieValue(request.cookies.get(SESSION_COOKIE_NAME)?.value)

  if (pathname === ADMIN_LOGIN_PATH) {
    // Already signed in - send them on instead of showing the form again.
    if (session) {
      return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url))
    }
    return NextResponse.next()
  }

  if (session) return NextResponse.next()

  const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
