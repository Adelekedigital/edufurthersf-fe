export type Option = { code: string; label: string }
export type Taxonomies = {
  version: string
  countries: Option[]
  destinations: Option[]
  degrees: Option[]
  fields: Option[]
  narrow_fields?: Option[]
  award_types: Option[]
  funding_types: Option[]
}
export type Scholarship = {
  scholarship_id: string
  cycle_id: string
  name: string
  provider: string
  award_type: string
  status: 'open_verified' | 'expected_to_reopen' | 'status_unknown'
  status_detail: 'open' | 'closing_soon' | 'likely_to_reopen' | 'opening_soon' | 'status_unknown'
  fit: 'confirmed' | 'possible'
  official_url: string
  last_verified_at: string | null
  eligibility_note?: string | null
  field_names?: string[]
  destinations: string[]
  deadline_at?: string | null
  deadline_precision?: 'date' | 'datetime' | null
  degree_levels?: string[]
  expected_reopen_month?: number | null
  funding_type?: string | null
  provider_country?: string | null
  caveats?: string[]
}
export type SearchResponse = { data: Scholarship[]; next_cursor: string | null; meta: { search_id?: string; response_id?: string; warnings?: string[]; confirmed_counts?: Record<string, number>; possible_match_count?: number; evaluated_at?: string }; filters?: SearchInput }
export type SearchInput = { origin_country: string; program_level: string; target_countries: string[]; field?: string; limit: number; cursor?: string }
export type MatchProfile = { origin_country: string; program_level: string; field?: string }
export type ScholarshipDetail = Scholarship & { status_valid_until?: string | null; facts?: Record<string, unknown>; match_explanation?: string | null }
export type ApiError = Error & { code?: string; retryAfter?: number; fields?: Record<string, string[]> }
