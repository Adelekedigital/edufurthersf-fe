import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const taxonomies = {
  version: 'taxonomy-v1',
  countries: [{ code: 'NG', label: 'Nigeria' }, { code: 'GH', label: 'Ghana' }],
  destinations: [{ code: 'CA', label: 'Canada' }, { code: 'FR', label: 'France' }],
  degrees: [{ code: 'masters', label: "Master's" }, { code: 'doctorate', label: 'PhD' }],
  fields: [{ code: 'health_and_welfare', label: 'Health and welfare' }],
  award_types: [{ code: 'scholarship', label: 'Scholarship' }],
  funding_types: [{ code: 'fully_funded', label: 'Fully funded' }],
}

async function mockApi(page: Page, body: object, status = 200, headers: Record<string, string> = {}) {
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(taxonomies) }))
  await page.route('**/api/v1/search', (route) => route.fulfill({ status, headers: { 'Content-Type': 'application/problem+json', 'Access-Control-Expose-Headers': 'Retry-After', ...headers }, body: JSON.stringify(body) }))
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
  await mockApi(page, { data: [{ scholarship_id: 'sch-1', cycle_id: 'cycle-1', name: 'Future Health Award', provider: 'Edufurther Foundation', award_type: 'scholarship', destinations: ['CA'], status: 'open_verified', status_detail: 'open', fit: 'confirmed', official_url: 'https://example.com/award', last_verified_at: '2026-08-01T00:00:00Z', provider_country: 'NG', funding_type: 'fully_funded', degree_levels: ['masters'], deadline_at: '2026-12-31T00:00:00Z', deadline_precision: 'date' }], next_cursor: null, meta: { warnings: ['no_verified_coverage:FR'] } })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Search for your country of origin' }).fill('Niger')
  await page.getByRole('option', { name: 'Nigeria' }).click()
  await page.getByRole('radio', { name: "Master's degree (MSc)" }).last().check()
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
  await page.getByRole('radio', { name: "Master's degree (MSc)" }).last().check()
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
  await page.getByRole('radio', { name: "Master's degree (MSc)" }).last().check()
  await page.getByRole('button', { name: /find (my )?scholarships/i }).click()
  await expect.poll(() => requestBody?.target_countries).toEqual(['GH', 'NG'])
})