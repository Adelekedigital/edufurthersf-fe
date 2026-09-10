import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const taxonomies = {
  version: 'taxonomy-v1',
  countries: [{ code: 'NG', label: 'Nigeria' }, { code: 'GH', label: 'Ghana' }],
  destinations: [{ code: 'CA', label: 'Canada' }, { code: 'FR', label: 'France' }],
  degrees: [{ code: 'masters', label: "Master's degree" }, { code: 'mba', label: 'Master of Business Administration (MBA)' }, { code: 'doctorate', label: 'Doctoral Programme (PhD)' }],
  fields: [{ code: 'health_and_medical_sciences', label: 'Health and Medical Sciences' }],
  award_types: [{ code: 'scholarship', label: 'Scholarship' }],
  funding_types: [{ code: 'fully_funded', label: 'Fully funded' }],
}

async function mockApi(page: Page, body: object, status = 200, headers: Record<string, string> = {}) {
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status, headers: { 'Content-Type': 'application/problem+json', 'Access-Control-Expose-Headers': 'Retry-After', ...headers }, body: JSON.stringify(body) }))
}

function makeScholarship(id: string, overrides: Record<string, unknown> = {}) {
  return { scholarship_id: id, cycle_id: `${id}-cycle`, name: `Award ${id}`, provider: 'Edufurther Foundation', award_type: 'scholarship', destinations: ['CA'], status: 'open', status_detail: 'open', fit: 'confirmed', official_url: 'https://example.com/award', last_verified_at: '2026-08-01T00:00:00Z', provider_country: 'NG', funding_type: 'fully_funded', degree_levels: ['masters'], deadline_at: '2026-12-31T00:00:00Z', deadline_precision: 'date', ...overrides }
}

test('renders the accessible search shell on mobile', async ({ page }) => {
  await mockApi(page, { data: [], next_cursor: null, meta: {} })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /find scholarships that fit you/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /find (my )?scholarships/i })).toBeEnabled()
  const results = await new AxeBuilder({ page: page as any }).analyze()
  expect(results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([])
})

test('validates required fields and preserves the form', async ({ page }) => {
  await mockApi(page, { data: [], next_cursor: null, meta: {} })
  await page.goto('/')
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page.getByText('Select your country of origin.')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Search for your country of origin' })).toHaveValue('')
})

test('renders results and unsupported destination warnings', async ({ page }) => {
  await mockApi(page, { data: [{ scholarship_id: 'sch-1', cycle_id: 'cycle-1', name: 'Future Health Award', provider: 'Edufurther Foundation', award_type: 'scholarship', destinations: ['CA'], status: 'open', status_detail: 'open', fit: 'confirmed', official_url: 'https://example.com/award', last_verified_at: '2026-08-01T00:00:00Z', provider_country: 'NG', funding_type: 'fully_funded', degree_levels: ['masters'], deadline_at: '2026-12-31T00:00:00Z', deadline_precision: 'date' }], next_cursor: null, meta: { warnings: ['no_verified_coverage:FR'] } })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page.getByRole('heading', { name: /future health award/i })).toBeVisible()
  await expect(page.getByText(/Edufurther Foundation - Nigeria/i)).toBeVisible()
  await expect(page.getByText('Fully funded')).toBeVisible()
  await expect(page.getByText('By December 31, 2026')).toBeVisible()
  await expect(page.getByText(/verified coverage for FR/i)).toBeVisible()
})

test('shows retry guidance for rate limits', async ({ page }) => {
  await mockApi(page, { detail: 'Search rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' }, 429, { 'Retry-After': '60' })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page.locator('.form-alert.is-error[role="alert"]')).toContainText(/try again in 60 seconds/i)
})

test('opens and closes the country list and supports arrow navigation', async ({ page }) => {
  await mockApi(page, { data: [], next_cursor: null, meta: {} })
  await page.goto('/')
  const country = page.getByRole('combobox', { name: 'Search for your country of origin' })
  const options = page.locator('#search-for-your-country-of-origin-options')
  await expect(options).toBeHidden()
  await country.click()
  await expect(options).toBeVisible()
  await country.click()
  await expect(options).toBeHidden()
  await country.click()
  await country.press('ArrowDown')
  await expect(country).toHaveAttribute('aria-activedescendant', /-NG$/)
  await country.press('Enter')
  await expect(country).toHaveValue('Nigeria')
  await expect(options).toBeHidden()
})

test('includes an active Somewhere else country in target_countries', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], next_cursor: null, meta: {} }) })
  })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByText('Somewhere else', { exact: true }).click()
  await page.getByRole('combobox', { name: 'Search for another destination country' }).click()
  await page.getByRole('option', { name: 'Ghana' }).click()
  await page.getByRole('combobox', { name: 'Search for another destination country' }).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Master of Business Administration (MBA)' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect.poll(() => requestBody?.target_countries).toEqual(['GH', 'NG'])
  await expect.poll(() => requestBody?.program_levels).toEqual(['masters', 'mba'])
})
test('loads scholarship detail and separates personalized guidance from eligibility notes', async ({ page }) => {
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ scholarship_id: 'sch-1', cycle_id: 'cycle-1', name: 'Future Health Award', provider: 'Edufurther Foundation', award_type: 'scholarship', destinations: ['CA'], status: 'open', status_detail: 'open', fit: 'confirmed', official_url: 'https://example.com/award', last_verified_at: '2026-08-01T00:00:00Z', provider_country: 'NG', funding_type: 'fully_funded', degree_levels: ['masters'], field_names: ['Health and Medical Sciences'], programme_names: ['MSc Human Health'], deadline_at: '2026-12-31T00:00:00Z', deadline_precision: 'date', eligibility_note: 'Applicants must meet the official nationality requirements.', caveats: ['Review the provider criteria before applying.'] }], next_cursor: null, meta: {} }) }))
  await page.route('**/api/v1/scholarships/sch-1', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scholarship_id: 'sch-1', cycle_id: 'cycle-1', name: 'Future Health Award', provider: 'Edufurther Foundation', official_url: 'https://example.com/award', destinations: ['CA'], status: 'open', status_detail: 'open', fit: 'confirmed', last_verified_at: '2026-08-01T00:00:00Z', provider_country: 'NG', funding_type: 'fully_funded', degree_levels: ['masters'], field_names: ['Health and Medical Sciences'], programme_names: ['MSc Human Health'], deadline_at: '2026-12-31T00:00:00Z', deadline_precision: 'date', eligibility_note: 'Applicants must meet the official nationality requirements.', caveats: ['Review the provider criteria before applying.'], match_explanation: 'This opportunity matches your selected study level and destination.' }) }))
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await page.getByRole('button', { name: /view details/i }).click()
  await expect(page.getByRole('heading', { name: 'Why this may fit' })).toBeVisible()
  await expect(page.getByText('This opportunity matches your selected study level and destination.')).toBeVisible()
  await expect(page.getByText('Health and Medical Sciences', { exact: true })).toBeVisible()
  await expect(page.getByText('MSc Human Health', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Eligibility note' })).toBeVisible()
  await expect(page.getByText('Applicants must meet the official nationality requirements.', { exact: true })).toBeVisible()
})

test('renders short, long and missing eligibility notes correctly in the modal', async ({ page }) => {
  const shortNote = 'Open to eligible applicants.'
  const longNote = 'Applicants must meet strict nationality, academic performance, and financial need requirements as detailed on the official provider website, and should prepare supporting documents well in advance of the published deadline.'
  const scenarios: { searchId: string; scholarshipId: string; note: string | undefined }[] = [
    { searchId: 'search-note-short', scholarshipId: 'sch-note-short', note: shortNote },
    { searchId: 'search-note-long', scholarshipId: 'sch-note-long', note: longNote },
    { searchId: 'search-note-none', scholarshipId: 'sch-note-none', note: undefined },
  ]
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  for (const scenario of scenarios) {
    const result = makeScholarship(scenario.scholarshipId, { eligibility_note: scenario.note })
    const searchResponse = { data: [result], next_cursor: null, meta: { search_id: scenario.searchId, response_id: scenario.searchId + '-response', warnings: [] } }
    await page.route(`**/api/v1/search/${scenario.searchId}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchResponse) }))
    await page.route(`**/api/v1/scholarships/${scenario.scholarshipId}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) }))
    await page.goto(`/search/${scenario.searchId}?scholarship=${scenario.scholarshipId}`)
    await expect(page.getByRole('dialog').getByRole('heading', { name: `Award ${scenario.scholarshipId}` })).toBeVisible()
    await expect(page.getByText(scenario.note ?? 'Eligibility information is not available for this opportunity yet.', { exact: true })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  }
})

test('persists results by search ID and falls back to the backend after cache expiry', async ({ page }) => {
  let postCount = 0
  let replayCount = 0
  const response = { data: [], next_cursor: null, meta: { search_id: 'search-1', response_id: 'response-1', warnings: [] }, filters: { origin_country: 'NG', target_countries: ['CA'], program_levels: ['masters'], limit: 20 } }
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => { postCount += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }) })
  await page.route('**/api/v1/search/search-1', (route) => { replayCount += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }) })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect.poll(() => postCount).toBe(1)
  await expect(page).toHaveURL(/\/search\/search-1$/)
  await expect(page.getByRole('heading', { name: /find a match yet/i })).toBeVisible()
  await page.evaluate(() => {
    const key = 'edufurther:search-response:v3:search-1'
    const cached = JSON.parse(sessionStorage.getItem(key) ?? '{}')
    cached.cachedAt = 0
    sessionStorage.setItem(key, JSON.stringify(cached))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: /find a match yet/i })).toBeVisible()
  expect(postCount).toBe(1)
  expect(replayCount).toBe(1)
})
test('preserves all criteria when refining a saved search', async ({ page }) => {
  const response = { data: [], next_cursor: null, meta: { search_id: 'search-refine', response_id: 'response-refine', warnings: [] }, filters: { origin_country: 'NG', target_countries: ['CA', 'GH'], program_levels: ['masters'], field: 'health_and_medical_sciences', limit: 20 } }
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }))
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByText('Somewhere else', { exact: true }).click()
  await page.getByRole('combobox', { name: 'Search for another destination country' }).click()
  await page.getByRole('option', { name: 'Ghana' }).click()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('combobox', { name: 'What do you want to study?' }).selectOption('health_and_medical_sciences')
  await page.getByRole('radio', { name: "Bachelor's degree" }).check()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page).toHaveURL(/\/search\/search-refine$/)
  await page.getByRole('button', { name: /refine my search/i }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('combobox', { name: 'Search for your country of origin' })).toHaveValue('Nigeria')
  await expect(page.getByRole('checkbox', { name: 'Canada' })).toBeChecked()
  await expect(page.getByText('Somewhere else', { exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.country-selection', { hasText: 'Ghana' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'What do you want to study?' })).toHaveValue('health_and_medical_sciences')
  await expect(page.getByRole('radio', { name: "Bachelor's degree" })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: "Master's degree" })).toBeChecked()
})

test('preserves multiple Somewhere else countries when refining a saved search', async ({ page }) => {
  const response = { data: [], next_cursor: null, meta: { search_id: 'search-multi-refine', response_id: 'response-multi-refine', warnings: [] }, filters: { origin_country: 'NG', target_countries: ['NG', 'GH'], program_levels: ['masters'], limit: 20 } }
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }))
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByText('Somewhere else', { exact: true }).click()
  await page.getByRole('combobox', { name: 'Search for another destination country' }).click()
  await page.getByRole('option', { name: 'Ghana' }).click()
  await page.getByRole('combobox', { name: 'Search for another destination country' }).click()
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page).toHaveURL(/\/search\/search-multi-refine$/)
  await page.getByRole('button', { name: /refine my search/i }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('combobox', { name: 'Search for your country of origin' })).toHaveValue('Nigeria')
  await expect(page.getByText('Somewhere else', { exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.country-selection', { hasText: 'Ghana' })).toBeVisible()
  await expect(page.locator('.country-selection', { hasText: 'Nigeria' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: "Master's degree" })).toBeChecked()
})

test('excludes a country already selected as a primary destination from the Somewhere else picker without crashing', async ({ page }) => {
  const overlappingTaxonomies = { ...taxonomies, countries: [...taxonomies.countries, { code: 'CA', label: 'Canada' }] }
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overlappingTaxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], next_cursor: null, meta: {} }) }))
  await page.goto('/')
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByText('Somewhere else', { exact: true }).click()
  const otherCountryBox = page.getByRole('combobox', { name: 'Search for another destination country' })
  await otherCountryBox.click()
  await expect(page.getByRole('option', { name: 'Canada' })).toHaveCount(0)
  await otherCountryBox.fill('Canada')
  // Typing a query that matches only an already-excluded country used to crash the whole app
  // (activeIndex pointed at an empty filtered list). Confirm the app is still alive and correctly
  // shows no matches, rather than a Next.js client-side-exception error page.
  await expect(page.getByText('No country found')).toBeVisible()
  await expect(page.getByText(/application error/i)).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: 'Canada' })).toBeChecked()
})

test('removes a Somewhere else country once it is also checked as a primary destination', async ({ page }) => {
  const overlappingTaxonomies = { ...taxonomies, countries: [...taxonomies.countries, { code: 'CA', label: 'Canada' }] }
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overlappingTaxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], next_cursor: null, meta: {} }) }))
  await page.goto('/')
  await page.getByText('Somewhere else', { exact: true }).click()
  await page.getByRole('combobox', { name: 'Search for another destination country' }).click()
  await page.getByRole('option', { name: 'Canada' }).click()
  await expect(page.locator('.country-selection', { hasText: 'Canada' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await expect(page.locator('.country-selection', { hasText: 'Canada' })).toHaveCount(0)
})

test('shows scholarship card data immediately while detail and explanation requests are delayed', async ({ page }) => {
  const result = makeScholarship('sch-delay', { eligibility_note: 'Applicants must meet the official nationality requirements.' })
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [result], next_cursor: null, meta: { search_id: 'search-delay', response_id: 'response-delay', warnings: [] } }) }))
  await page.route('**/api/v1/scholarships/sch-delay', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    if (route.request().method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...result, match_explanation: 'This opportunity matches your selected study level and destination.' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await page.getByRole('button', { name: /view details/i }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Award sch-delay' })).toBeVisible()
  await expect(page.getByText('Checking this opportunity against your answers')).toBeVisible()
  await expect(page.getByText('This opportunity matches your selected study level and destination.')).toBeVisible()
})

test('supports modal deep link and refresh', async ({ page }) => {
  const result = makeScholarship('sch-deep', { eligibility_note: 'Applicants must meet the official nationality requirements.' })
  const searchResponse = { data: [result], next_cursor: null, meta: { search_id: 'search-deep', response_id: 'response-deep', warnings: [] } }
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search/search-deep', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchResponse) }))
  await page.route('**/api/v1/scholarships/sch-deep', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) }))

  await page.goto('/search/search-deep?scholarship=sch-deep')
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Award sch-deep' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Award sch-deep' })).toBeVisible()
  await expect(page).toHaveURL(/\?scholarship=sch-deep$/)
  await page.getByRole('button', { name: 'Close scholarship details' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/search\/search-deep$/)
})

test('supports browser back/forward around a click-opened modal, with a single history step on close', async ({ page }) => {
  const result = makeScholarship('sch-nav', { eligibility_note: 'Applicants must meet the official nationality requirements.' })
  const searchResponse = { data: [result], next_cursor: null, meta: { search_id: 'search-nav', response_id: 'response-nav', warnings: [] } }
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchResponse) }))
  await page.route('**/api/v1/scholarships/sch-nav', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) }))

  // Closing after a click-open should be a single "back" step, not a wasted duplicate history entry.
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page).toHaveURL(/\/search\/search-nav$/)
  await page.getByRole('button', { name: /view details/i }).click()
  await expect(page).toHaveURL(/\?scholarship=sch-nav$/)
  await page.getByRole('button', { name: 'Close scholarship details' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/search\/search-nav$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: /find scholarships that fit you/i })).toBeVisible()

  // Forward restores the results, and browser back (not just the close button) also closes a freshly-opened modal.
  await page.goForward()
  await expect(page).toHaveURL(/\/search\/search-nav$/)
  await page.getByRole('button', { name: /view details/i }).click()
  await expect(page).toHaveURL(/\?scholarship=sch-nav$/)
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/search\/search-nav$/)
})

test('renders no raw HTML entities or mojibake text', async ({ page }) => {
  const result = makeScholarship('sch-clean', { eligibility_note: undefined })
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [result], next_cursor: null, meta: { warnings: ['no_verified_coverage:FR'] } }) }))
  const forbidden = ['&apos;', '&hellip;', '&mdash;', '&rarr;', '&times;', '&#', 'â€', 'Ã¢']
  await page.goto('/')
  const formText = await page.locator('body').innerText()
  for (const marker of forbidden) expect(formText).not.toContain(marker)
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page.getByRole('heading', { name: 'Award sch-clean' })).toBeVisible()
  const resultsText = await page.locator('body').innerText()
  for (const marker of forbidden) expect(resultsText).not.toContain(marker)
})

test('keeps consistent card section padding with varied result content and avoids horizontal overflow on mobile', async ({ page }) => {
  const results = [
    makeScholarship('sch-short'),
    makeScholarship('sch-long', { name: 'A Very Long Scholarship Award Name That Should Wrap Across Several Lines On A Narrow Mobile Screen Without Breaking The Card Layout', destinations: ['CA', 'FR'], degree_levels: ['masters', 'mba', 'doctorate'], fit: 'possible' }),
    makeScholarship('sch-fallback', { deadline_at: null, degree_levels: undefined, funding_type: undefined }),
  ]
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: results, next_cursor: null, meta: {} }) }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page.getByRole('heading', { name: 'Award sch-fallback' })).toBeVisible()
  await expect(page.getByText('Possible match - not yet fully confirmed')).toBeVisible()
  const paddings = await page.locator('.result-card .card-section').evaluateAll((elements) => elements.map((element) => getComputedStyle(element).padding))
  expect(paddings.length).toBeGreaterThan(0)
  expect(new Set(paddings).size).toBe(1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('shows a loading panel instead of stale content during search navigation', async ({ page }) => {
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], next_cursor: null, meta: { search_id: 'search-loading', response_id: 'response-loading', warnings: [] } }) })
  })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('checkbox', { name: "Master's degree" }).check()
  await page.getByRole('checkbox', { name: 'Canada' }).check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Finding scholarships' })).toBeVisible()
  await expect(page.locator('.form-panel')).toHaveCount(0)
  await expect(page.locator('.results-panel')).toHaveCount(0)
})
