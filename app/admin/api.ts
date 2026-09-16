import type {
  AdminApiError,
  BulkReviewDecisionItem,
  BulkReviewDecisionResponse,
  ProviderCreateRequest,
  ProviderListResponse,
  ProviderRead,
  PublishCycleRequest,
  UpdateCycleRequest,
  PublishCycleResponse,
  ReviewDecisionRequest,
  ReviewDecisionResponse,
  ReviewQueueResponse,
  ScholarshipAdminListResponse,
  ScholarshipFilters,
  WithdrawRequest,
  WithdrawResponse,
} from './types'

const baseUrl = '/api/admin'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function contractError(message: string): AdminApiError {
  const error = new Error(message) as AdminApiError
  error.code = 'INVALID_API_RESPONSE'
  return error
}

function parseReviewQueueResponse(value: unknown): ReviewQueueResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || typeof value.open_count !== 'number') {
    throw contractError('The review queue returned by the backend is incompatible with this version of the app.')
  }
  for (const task of value.data) {
    if (!isRecord(task) || typeof task.review_task_id !== 'string' || typeof task.reason !== 'string' || typeof task.priority !== 'number' || typeof task.state !== 'string' || typeof task.created_at !== 'string') {
      throw contractError('A review task is missing fields required by the frontend.')
    }
  }
  return value as unknown as ReviewQueueResponse
}

function parseReviewDecisionResponse(value: unknown): ReviewDecisionResponse {
  if (!isRecord(value) || typeof value.review_task_id !== 'string' || typeof value.decision !== 'string') {
    throw contractError('The review decision response is incompatible with this version of the app.')
  }
  return value as unknown as ReviewDecisionResponse
}

function parseBulkReviewDecisionResponse(value: unknown): BulkReviewDecisionResponse {
  if (!isRecord(value) || !Array.isArray(value.results)) {
    throw contractError('The bulk review decision response is incompatible with this version of the app.')
  }
  for (const result of value.results) {
    if (!isRecord(result) || typeof result.review_task_id !== 'string' || typeof result.success !== 'boolean') {
      throw contractError('A bulk review decision result is missing fields required by the frontend.')
    }
  }
  return value as unknown as BulkReviewDecisionResponse
}

function isProvider(value: unknown): value is ProviderRead {
  return isRecord(value) && typeof value.provider_id === 'string' && typeof value.name === 'string' && Array.isArray(value.approved_domains)
}

function parseProviderListResponse(value: unknown): ProviderListResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || !value.data.every(isProvider)) {
    throw contractError('The provider list returned by the backend is incompatible with this version of the app.')
  }
  return value as unknown as ProviderListResponse
}

function parseProvider(value: unknown): ProviderRead {
  if (!isProvider(value)) {
    throw contractError('The provider returned by the backend is incompatible with this version of the app.')
  }
  return value
}

function parseScholarshipAdminListResponse(value: unknown): ScholarshipAdminListResponse {
  if (!isRecord(value) || !Array.isArray(value.data) || typeof value.total !== 'number') {
    throw contractError('The scholarship list returned by the backend is incompatible with this version of the app.')
  }
  for (const scholarship of value.data) {
    if (!isRecord(scholarship) || typeof scholarship.scholarship_id !== 'string' || typeof scholarship.name !== 'string' || typeof scholarship.lifecycle_state !== 'string' || !Array.isArray(scholarship.cycles)) {
      throw contractError('A scholarship is missing fields required by the frontend.')
    }
  }
  return value as unknown as ScholarshipAdminListResponse
}

function parsePublishCycleResponse(value: unknown): PublishCycleResponse {
  if (!isRecord(value) || typeof value.scholarship_id !== 'string' || typeof value.cycle_id !== 'string') {
    throw contractError('The publish response is incompatible with this version of the app.')
  }
  return value as unknown as PublishCycleResponse
}

function parseWithdrawResponse(value: unknown): WithdrawResponse {
  if (!isRecord(value) || typeof value.scholarship_id !== 'string' || typeof value.lifecycle_state !== 'string') {
    throw contractError('The withdraw response is incompatible with this version of the app.')
  }
  return value as unknown as WithdrawResponse
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))
    const error = new Error(problem.detail ?? 'Something went wrong. Please try again.') as AdminApiError
    error.code = problem.code
    throw error
  }
  return response.json() as Promise<T>
}

export const getReviewQueue = async (state: 'open' | 'resolved' = 'open', offset = 0) =>
  parseReviewQueueResponse(await request<unknown>(`/reviews?state=${state}&offset=${offset}`, { cache: 'no-store' }))

export const decideReview = async (reviewTaskId: string, payload: ReviewDecisionRequest) =>
  parseReviewDecisionResponse(await request<unknown>(`/reviews/${encodeURIComponent(reviewTaskId)}/decision`, { method: 'POST', body: JSON.stringify(payload), cache: 'no-store' }))

export const bulkDecideReviews = async (decisions: BulkReviewDecisionItem[]) =>
  parseBulkReviewDecisionResponse(await request<unknown>('/reviews/bulk-decision', { method: 'POST', body: JSON.stringify({ decisions }), cache: 'no-store' }))

export const getProviders = async () =>
  parseProviderListResponse(await request<unknown>('/providers', { cache: 'no-store' }))

export const createProvider = async (payload: ProviderCreateRequest) =>
  parseProvider(await request<unknown>('/providers', { method: 'POST', body: JSON.stringify(payload), cache: 'no-store' }))

export const getScholarships = async (filters: ScholarshipFilters = {}, offset = 0) => {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.lifecycle_state) params.set('lifecycle_state', filters.lifecycle_state)
  if (filters.provider_id) params.set('provider_id', filters.provider_id)
  if (filters.public_status) params.set('public_status', filters.public_status)
  if (offset) params.set('offset', String(offset))
  const query = params.toString()
  return parseScholarshipAdminListResponse(await request<unknown>(`/scholarships${query ? `?${query}` : ''}`, { cache: 'no-store' }))
}

export const publishCycle = async (scholarshipId: string, payload: PublishCycleRequest) =>
  parsePublishCycleResponse(await request<unknown>(`/scholarships/${encodeURIComponent(scholarshipId)}/publish`, { method: 'POST', body: JSON.stringify(payload), cache: 'no-store' }))

export const withdrawScholarship = async (scholarshipId: string, payload: WithdrawRequest) =>
  parseWithdrawResponse(await request<unknown>(`/scholarships/${encodeURIComponent(scholarshipId)}/withdraw`, { method: 'POST', body: JSON.stringify(payload), cache: 'no-store' }))

/** Correct a live cycle. Partial by design: send only what changed, so two
 *  reviewers touching different fields do not overwrite each other and the
 *  backend's audit entry names the fields that actually moved. */
export const updateCycle = async (scholarshipId: string, cycleId: string, payload: UpdateCycleRequest) =>
  parsePublishCycleResponse(await request<unknown>(
    `/scholarships/${encodeURIComponent(scholarshipId)}/cycles/${encodeURIComponent(cycleId)}`,
    { method: 'PATCH', body: JSON.stringify(payload), cache: 'no-store' },
  ))
