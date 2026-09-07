import { NextRequest, NextResponse } from 'next/server'

const backendBaseUrl = process.env.EDUFURTHER_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://edufurthersf-be-dev.up.railway.app/api/v1'

const allowedRoutes = new Set(['taxonomies', 'search'])

function isAllowedRoute(path: string[]) {
  return (path.length === 1 && allowedRoutes.has(path[0])) ||
    (path.length === 2 && ['scholarships', 'search'].includes(path[0]) && Boolean(path[1]))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, params)
}

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params
  const route = path.join('/')
  if (!isAllowedRoute(path)) {
    return NextResponse.json({ detail: 'Route not found.' }, { status: 404 })
  }

  const headers = new Headers({ Accept: request.headers.get('accept') ?? 'application/json' })
  const cookie = request.headers.get('cookie')
  if (cookie) headers.set('Cookie', cookie)
  if (request.method === 'POST') headers.set('Content-Type', request.headers.get('content-type') ?? 'application/json')

  const response = await fetch(`${backendBaseUrl}/${route}`, {
    method: request.method,
    headers,
    body: request.method === 'POST' ? await request.text() : undefined,
    cache: 'no-store',
  })

  const responseHeaders = new Headers()
  const contentType = response.headers.get('content-type')
  const retryAfter = response.headers.get('retry-after')
  if (contentType) responseHeaders.set('Content-Type', contentType)
  if (retryAfter) responseHeaders.set('Retry-After', retryAfter)
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = getSetCookie ? getSetCookie.call(response.headers) : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie') as string] : [])
  for (const setCookie of setCookies) responseHeaders.append('Set-Cookie', setCookie)

  return new NextResponse(response.body, { status: response.status, headers: responseHeaders })
}
