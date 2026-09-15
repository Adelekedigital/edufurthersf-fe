export type AdminApiError = Error & { code?: string }

export type ReviewTaskSummary = {
  review_task_id: string
  reason: string
  priority: number
  state: string
  discovery_id: string | null
  revision_id: string | null
  cycle_id: string | null
  raw_title: string | null
  raw_excerpt: string | null
  source_url: string | null
  extracted_facts: Record<string, unknown> | null
  draft_recommendation: Record<string, unknown> | null
  created_at: string
}

export type ReviewQueueResponse = {
  data: ReviewTaskSummary[]
  open_count: number
}

export type ReviewDecision = 'approve' | 'reject'

export type ReviewDecisionRequest = {
  decision: ReviewDecision
  provider_id?: string | null
  canonical_name?: string | null
  official_home_url?: string | null
  slug?: string | null
  award_type?: string | null
  reason: string
}

export type ReviewDecisionResponse = {
  review_task_id: string
  decision: string
  scholarship_id: string | null
}

export type BulkReviewDecisionItem = ReviewDecisionRequest & { review_task_id: string }

export type BulkReviewDecisionResult = {
  review_task_id: string
  success: boolean
  decision: string
  scholarship_id: string | null
  error: string | null
}

export type BulkReviewDecisionResponse = {
  results: BulkReviewDecisionResult[]
}

export type ProviderRead = {
  provider_id: string
  name: string
  approved_domains: string[]
  country: string | null
}

export type ProviderListResponse = {
  data: ProviderRead[]
}

export type ProviderCreateRequest = {
  name: string
  approved_domains: string[]
  country?: string | null
}

export type ScholarshipCycleAdminRead = {
  cycle_id: string
  provider_cycle_key: string
  applicant_segment: string
  official_cycle_url: string
  public_status: string
  evaluated_public_status: string
  status_valid_until: string | null
  last_verified_at: string | null
  facts: Record<string, unknown>
  is_auto_approved: boolean
  auto_approval_score: number | null
}

export type ScholarshipAdminRead = {
  scholarship_id: string
  slug: string
  name: string
  official_home_url: string
  award_type: string
  lifecycle_state: string
  provider_id: string
  provider_name: string
  cycles: ScholarshipCycleAdminRead[]
}

export type ScholarshipAdminListResponse = {
  data: ScholarshipAdminRead[]
  total: number
}

export type ScholarshipFilters = {
  q?: string
  lifecycle_state?: string
  provider_id?: string
  public_status?: string
}

export type OriginMode = 'restricted' | 'unrestricted' | 'unknown'
export type FieldMode = 'restricted' | 'all' | 'unknown'
export type DeadlinePrecision = 'date' | 'datetime'
export type PublicStatusValue = 'open_verified' | 'expected_to_reopen' | 'status_unknown'

export type PublishCycleRequest = {
  provider_cycle_key: string
  applicant_segment: string
  official_cycle_url: string
  public_status: PublicStatusValue
  status_valid_until?: string | null
  last_verified_at?: string | null
  destinations: string[]
  levels: string[]
  origin_mode: OriginMode
  origins: string[]
  field_mode: FieldMode
  fields: string[]
  programme_names: string[]
  evidence_fresh: boolean
  deadline_at?: string | null
  deadline_precision: DeadlinePrecision
  deadline_timezone?: string | null
  eligibility_note?: string | null
  expected_reopen_month?: number | null
  funding_type?: string | null
}

export type PublishCycleResponse = {
  scholarship_id: string
  cycle_id: string
  lifecycle_state: string
  public_status: string
}

export type WithdrawRequest = {
  reason: string
}

export type WithdrawResponse = {
  scholarship_id: string
  lifecycle_state: string
  withdrawn_cycles: number
}

export type PublishPrefill = {
  levels?: string[]
  eligibilityNote?: string
  fundingMentions?: string[]
  deadlineMentions?: string[]
}
