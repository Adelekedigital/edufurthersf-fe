import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE_NAME = 'admin_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000

export const ADMIN_HOME_PATH = '/admin'
export const ADMIN_LOGIN_PATH = '/admin/login'

type SessionPayload = { name: string; exp: number }

/** Resolve a `next` redirect target, falling back to the admin home.
 *
 * Rejects anything outside /admin so this can never redirect off-site, and
 * rejects the login path itself - otherwise signing in (or arriving already
 * signed in) at `/admin/login?next=/admin/login` bounces in a loop.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || value.startsWith('//')) return ADMIN_HOME_PATH
  // Guard the prefix boundary: "/adminsomething" must not pass as an admin path.
  if (value !== ADMIN_HOME_PATH && !value.startsWith(`${ADMIN_HOME_PATH}/`)) return ADMIN_HOME_PATH
  if (value === ADMIN_LOGIN_PATH || value.startsWith(`${ADMIN_LOGIN_PATH}?`)) return ADMIN_HOME_PATH
  return value
}

function secret(): string {
  const value = process.env.ADMIN_UI_PASSCODE
  if (!value) throw new Error('ADMIN_UI_PASSCODE is not configured')
  return value
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function createSessionCookieValue(name: string): string {
  const payload: SessionPayload = { name, exp: Date.now() + SESSION_TTL_MS }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifySessionCookieValue(value: string | undefined): SessionPayload | null {
  if (!value) return null
  const separatorIndex = value.lastIndexOf('.')
  if (separatorIndex === -1) return null
  const encoded = value.slice(0, separatorIndex)
  const signature = value.slice(separatorIndex + 1)
  if (!encoded || !signature || !timingSafeStringEqual(signature, sign(encoded))) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.name !== 'string' || !payload.name) return null
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
