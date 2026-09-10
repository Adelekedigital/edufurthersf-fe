import type { ApiError, MatchProfile, SearchInput, SearchResponse, ScholarshipDetail, Taxonomies } from './types'

const baseUrl = '/api/v1'
const taxonomyCacheKey = 'edufurther:taxonomies:v3'
const taxonomyCacheTtl = 60 * 60 * 1000
const searchCachePrefix = 'edufurther:search-response:'
const searchCacheTtl = 5 * 60 * 1000
let taxonomyRequest: Promise<Taxonomies> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOption(value: unknown): boolean {
  return isRecord(value) && typeof value.code === 'string' && typeof value.label === 'string'
}

function contractError(message: string): ApiError {
  const error = new Error(message) as ApiError
  error.code = 'INVALID_API_RESPONSE'
  return error
}

function parseTaxonomies(value: unknown): Taxonomies {
  if (!isRecord(value) || !['countries', 'destinations', 'degrees', 'fields', 'award_types', 'funding_types'].every((key) => Array.isArray(value[key]) && value[key].every(isOption))) {
    throw contractError('The search options returned by the backend are incompatible with this version of the app.')
  }
  return value as unknown as Taxonomies
}

function parseSearchResponse(value: unknown): SearchResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || (value.next_cursor !== null && typeof value.next_cursor !== 'string')) {
    throw contractError('The scholarship results returned by the backend are incompatible with this version of the app.')
  }
  for (const result of value.data) {
    if (!isRecord(result) || typeof result.name !== 'string' || typeof result.provider !== 'string' || typeof result.official_url !== 'string' || !Array.isArray(result.destinations)) {
      throw contractError('A scholarship result is missing fields required by the frontend.')
    }
  }
  return value as unknown as SearchResponse
}

function parseScholarshipDetail(value: unknown): ScholarshipDetail {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.provider !== 'string' || typeof value.official_url !== 'string' || !Array.isArray(value.destinations)) {
    throw contractError('The scholarship detail returned by the backend is incompatible with this version of the app.')
  }
  return value as unknown as ScholarshipDetail
}
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

function readCachedTaxonomies() {
  if (typeof window === 'undefined') return null
  try {
    const cached = JSON.parse(window.localStorage.getItem(taxonomyCacheKey) ?? 'null') as { cachedAt?: number; data?: unknown } | null
    if (cached?.cachedAt && Date.now() - cached.cachedAt < taxonomyCacheTtl && cached.data) return parseTaxonomies(cached.data)
  } catch {
    window.localStorage.removeItem(taxonomyCacheKey)
  }
  return null
}

export const getTaxonomies = async () => {
  if (taxonomyRequest) return taxonomyRequest
  const cached = readCachedTaxonomies()
  if (cached) return cached
  taxonomyRequest = request<unknown>('/taxonomies', { cache: 'no-store' }).then(parseTaxonomies).then((data) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(taxonomyCacheKey, JSON.stringify({ cachedAt: Date.now(), data }))
    return data
  }).finally(() => { taxonomyRequest = null })
  return taxonomyRequest
}

function readCachedSearch(searchId: string) {
  if (typeof window === 'undefined') return null
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(searchCachePrefix + searchId) ?? 'null') as { cachedAt?: number; data?: unknown } | null
    if (cached?.cachedAt && Date.now() - cached.cachedAt < searchCacheTtl && cached.data) return parseSearchResponse(cached.data)
  } catch {
    window.sessionStorage.removeItem(searchCachePrefix + searchId)
  }
  return null
}

export const cacheSearchResponse = (searchId: string, response: SearchResponse) => {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(searchCachePrefix + searchId, JSON.stringify({ cachedAt: Date.now(), data: response })) } catch { /* Storage may be unavailable. */ }
}

export const searchScholarships = async (input: SearchInput) => parseSearchResponse(await request<unknown>('/search', { method: 'POST', body: JSON.stringify(input), cache: 'no-store' }))
export const getSavedSearch = async (searchId: string) => {
  const cached = readCachedSearch(searchId)
  if (cached) return cached
  const response = parseSearchResponse(await request<unknown>('/search/' + encodeURIComponent(searchId), { cache: 'no-store' }))
  cacheSearchResponse(searchId, response)
  return response
}

export const getScholarshipDetail = async (identifier: string) => parseScholarshipDetail(await request<unknown>('/scholarships/' + encodeURIComponent(identifier), { cache: 'no-store' }))

export const getMatchExplanation = async (identifier: string, profile: MatchProfile) => parseScholarshipDetail(await request<unknown>('/scholarships/' + encodeURIComponent(identifier), { method: 'POST', body: JSON.stringify(profile), cache: 'no-store' }))
