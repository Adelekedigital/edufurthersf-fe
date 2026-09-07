export type Option = { code: string; label: string }
export type Taxonomies = { version: string; countries: Option[]; destinations: Option[]; degrees: Option[]; fields: Option[]; award_types: Option[] }
export type Scholarship = {
  scholarship_id: string; cycle_id: string; name: string; provider: string; award_type: string
  status: 'open_verified' | 'expected_to_reopen' | 'status_unknown'
  status_detail: 'open' | 'closing_soon' | 'likely_to_reopen' | 'opening_soon' | 'status_unknown'
  fit: 'confirmed' | 'possible'; destinations: string[]; official_url: string; last_verified_at: string | null
  eligibility_note?: string; caveats?: string[]
}
export type SearchResponse = { data: Scholarship[]; next_cursor: string | null; meta: { warnings?: string[]; confirmed_counts?: Record<string, number>; possible_match_count?: number; evaluated_at?: string } }
export type SearchInput = { origin_country: string; program_level: string; target_countries: string[]; field?: string; limit: number; cursor?: string }
export type ApiError = Error & { code?: string; retryAfter?: number; fields?: Record<string, string[]> }
