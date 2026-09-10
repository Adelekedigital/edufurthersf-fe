import type { ApiError, MatchProfile, SearchInput, SearchResponse, ScholarshipDetail, Taxonomies } from './types'

const baseUrl = '/api/v1'
export const CONTRACT_VERSION = 'v3'
const taxonomyCacheKey = `edufurther:taxonomies:${CONTRACT_VERSION}`
const taxonomyCacheTtl = 60 * 60 * 1000
const searchCachePrefix = `edufurther:search-response:${CONTRACT_VERSION}:`
export const searchCacheTtl = 5 * 60 * 1000
export const modalCacheKey = (searchId: string, scholarshipId: string) => `edufurther:modal:${CONTRACT_VERSION}:${searchId}:${scholarshipId}`
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

export function parseSearchInput(value: unknown): SearchInput {
  if (!isRecord(value) || typeof value.origin_country !== 'string' || !Array.isArray(value.program_levels) || !value.program_levels.every((item) => typeof item === 'string') || !Array.isArray(value.target_countries) || !value.target_countries.every((item) => typeof item === 'string') || typeof value.limit !== 'number' || (value.field !== undefined && typeof value.field !== 'string') || (value.cursor !== undefined && typeof value.cursor !== 'string')) {
    throw contractError('The saved search filters are incompatible with this version of the app.')
  }
  return value as unknown as SearchInput
}

function parseSearchResponse(value: unknown): SearchResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || (value.next_cursor !== null && typeof value.next_cursor !== 'string')) {
    throw contractError('The scholarship results returned by the backend are incompatible with this version of the app.')
  }
  for (const result of value.data) {
    if (!isRecord(result) || typeof result.name !== 'string' || typeof result.provider !== 'string' || typeof result.official_url !== 'string' || !Array.isArray(result.destinations) || typeof result.status !== 'string' || typeof result.status_detail !== 'string') {
      throw contractError('A scholarship result is missing fields required by the frontend.')
    }
  }
  if (value.filters !== undefined) {
    try { parseSearchInput(value.filters) } catch { value.filters = undefined }
  }
  return value as unknown as SearchResponse
}

export function parseScholarshipDetail(value: unknown): ScholarshipDetail {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.provider !== 'string' || typeof value.official_url !== 'string' || !Array.isArray(value.destinations) || typeof value.status !== 'string' || typeof value.status_detail !== 'string') {
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

export function readVersionedCache<T>(storage: Storage, key: string, ttlMs: number, parse: (value: unknown) => T): T | null {
  try {
    const cached = JSON.parse(storage.getItem(key) ?? 'null') as { cachedAt?: number; data?: unknown } | null
    if (cached?.cachedAt && Date.now() - cached.cachedAt < ttlMs && cached.data) return parse(cached.data)
  } catch {
    storage.removeItem(key)
  }
  return null
}

export function writeVersionedCache(storage: Storage, key: string, data: unknown) {
  try { storage.setItem(key, JSON.stringify({ cachedAt: Date.now(), data })) } catch { /* Storage may be unavailable. */ }
}

function readCachedTaxonomies() {
  if (typeof window === 'undefined') return null
  return readVersionedCache(window.localStorage, taxonomyCacheKey, taxonomyCacheTtl, parseTaxonomies)
}

export const getTaxonomies = async () => {
  if (taxonomyRequest) return taxonomyRequest
  const cached = readCachedTaxonomies()
  if (cached) return cached
  taxonomyRequest = request<unknown>('/taxonomies', { cache: 'no-store' }).then(parseTaxonomies).then((data) => {
    if (typeof window !== 'undefined') writeVersionedCache(window.localStorage, taxonomyCacheKey, data)
    return data
  }).finally(() => { taxonomyRequest = null })
  return taxonomyRequest
}

function readCachedSearch(searchId: string) {
  if (typeof window === 'undefined') return null
  return readVersionedCache(window.sessionStorage, searchCachePrefix + searchId, searchCacheTtl, parseSearchResponse)
}

export const cacheSearchResponse = (searchId: string, response: SearchResponse) => {
  if (typeof window === 'undefined') return
  writeVersionedCache(window.sessionStorage, searchCachePrefix + searchId, response)
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
