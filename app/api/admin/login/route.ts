import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_LOGIN_PATH, createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, safeNextPath, timingSafeStringEqual } from '../../../admin/session'

/** Redirect to a same-origin path without naming the origin.
 *
 * NextResponse.redirect() needs an absolute URL, and building one from
 * request.url pins the response to whatever host that reports - which is not
 * always the host the request arrived on (reaching the dev server on
 * 127.0.0.1 yields a localhost redirect). The session cookie is host-scoped,
 * so that mismatch drops it and bounces the user straight back to sign-in.
 * A relative Location is resolved by the browser against the request URL, so
 * it is always the right origin, proxies included.
 */
function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } })
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const name = String(form.get('name') ?? '').trim()
  const passcode = String(form.get('passcode') ?? '')
  const next = safeNextPath(String(form.get('next') ?? ''))

  const expected = process.env.ADMIN_UI_PASSCODE
  const passcodeValid = Boolean(expected) && timingSafeStringEqual(passcode, expected as string)

  if (!passcodeValid || !name) {
    const params = new URLSearchParams({ error: '1', next })
    return redirectTo(`${ADMIN_LOGIN_PATH}?${params.toString()}`)
  }

  const response = redirectTo(next)
  response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(name), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return response
}
