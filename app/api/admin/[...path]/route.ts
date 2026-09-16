import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from '../../../admin/session'

const backendBaseUrl = process.env.EDUFURTHER_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://edufurthersf-be-dev.up.railway.app/api/v1'

// Only the admin routes this UI actually uses. Everything else under
// /internal/* (jobs, feed import, sources, auto-approval audits) stays out
// of reach here even though the shared service token would technically work
// for some of it - this proxy should not become a backdoor into admin
// surfaces this UI doesn't implement yet.
function isAllowedAdminRoute(method: string, path: string[]): boolean {
  // path is everything after /api/admin/ - this route's own [...path] segment
  // has already consumed "admin", so entries here do NOT repeat it. The
  // backend URL these map onto (built in forward()) does still include it:
  // /internal/admin/<path>.
  if (path.length === 1 && path[0] === 'reviews') return method === 'GET'
  if (path.length === 2 && path[0] === 'reviews' && path[1] === 'bulk-decision') return method === 'POST'
  if (path.length === 3 && path[0] === 'reviews' && path[2] === 'decision') return method === 'POST'
  if (path.length === 1 && path[0] === 'scholarships') return method === 'GET'
  if (path.length === 3 && path[0] === 'scholarships' && (path[2] === 'publish' || path[2] === 'withdraw')) return method === 'POST'
  if (path.length === 4 && path[0] === 'scholarships' && path[2] === 'cycles') return method === 'PATCH'
  if (path.length === 1 && path[0] === 'providers') return method === 'GET' || method === 'POST'
  return false
}

/** Methods that carry a request body, so forward() knows to read and pass one. */
const BODY_METHODS = new Set(['POST', 'PATCH'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, params)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, params)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(request, params)
}

async function forward(request: NextRequest, params: Promise<{ path: string[] }>) {
  const session = verifySessionCookieValue(request.cookies.get(SESSION_COOKIE_NAME)?.value)
  if (!session) {
    return NextResponse.json({ detail: 'Admin session required.' }, { status: 401 })
  }

  const { path } = await params
  if (!isAllowedAdminRoute(request.method, path)) {
    return NextResponse.json({ detail: 'Route not found.' }, { status: 404 })
  }

  const token = process.env.INTERNAL_SERVICE_TOKEN
  if (!token) {
    return NextResponse.json({ detail: 'Admin proxy is not configured.' }, { status: 500 })
  }

  const headers = new Headers({ Accept: request.headers.get('accept') ?? 'application/json' })
  headers.set('X-Service-Token', token)
  const sendsBody = BODY_METHODS.has(request.method)
  if (sendsBody) headers.set('Content-Type', request.headers.get('content-type') ?? 'application/json')

  const response = await fetch(`${backendBaseUrl}/internal/admin/${path.join('/')}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: sendsBody ? await request.text() : undefined,
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  const contentType = response.headers.get('content-type')
  if (contentType) responseHeaders.set('Content-Type', contentType)

  return new NextResponse(response.body, { status: response.status, headers: responseHeaders })
}
