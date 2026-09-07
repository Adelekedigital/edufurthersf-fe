import type { ApiError, SearchInput, SearchResponse, Taxonomies } from './types'

// Keep browser requests same-origin. The Next.js route handler proxies them
// to the backend, avoiding browser CORS restrictions.
const baseUrl = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))
    const error = new Error(problem.detail ?? 'Something went wrong. Please try again.') as ApiError
    error.code = problem.code; error.fields = problem.errors?.fields
    error.retryAfter = Number(response.headers.get('Retry-After')) || undefined
    throw error
  }
  return response.json() as Promise<T>
}

export const getTaxonomies = () => request<Taxonomies>('/taxonomies', { cache: 'no-store' })
export const searchScholarships = (input: SearchInput) => request<SearchResponse>('/search', { method: 'POST', body: JSON.stringify(input), cache: 'no-store' })
