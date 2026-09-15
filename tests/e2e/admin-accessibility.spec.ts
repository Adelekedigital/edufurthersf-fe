import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'

/** The dev server reads ADMIN_UI_PASSCODE from .env.local; the test process does not. */
function adminPasscode(): string {
  if (process.env.ADMIN_UI_PASSCODE) return process.env.ADMIN_UI_PASSCODE
  try {
    const line = readFileSync('.env.local', 'utf8')
      .split('\n')
      .find((entry) => entry.startsWith('ADMIN_UI_PASSCODE='))
    return line ? line.slice('ADMIN_UI_PASSCODE='.length).split('#')[0].trim() : ''
  } catch {
    return ''
  }
}

const taxonomies = {
  version: 'taxonomy-v3',
  countries: [{ code: 'NG', label: 'Nigeria' }, { code: 'GH', label: 'Ghana' }, { code: 'TZ', label: 'Tanzania, United Republic of' }],
  destinations: [{ code: 'GB', label: 'United Kingdom' }, { code: 'US', label: 'United States' }],
  degrees: [{ code: 'masters', label: "Master's" }, { code: 'mba', label: 'MBA' }, { code: 'doctorate', label: 'Doctorate' }],
  fields: [{ code: 'engineering', label: 'Engineering' }],
  award_types: [{ code: 'scholarship', label: 'Scholarship' }],
  funding_types: [{ code: 'fully_funded', label: 'Fully funded' }],
}

const reviewTask = {
  review_task_id: '11111111-1111-1111-1111-111111111111',
  reason: '', priority: 75, state: 'open',
  discovery_id: '22222222-2222-2222-2222-222222222222', revision_id: null, cycle_id: null,
  raw_title: 'Example Merit Scholarship',
  raw_excerpt: 'A long excerpt that the table clamps to two lines. '.repeat(20),
  source_url: 'https://example.edu/award',
  extracted_facts: { level_mentions: ['masters'], eligibility_phrase: 'international students', funding_mentions: ['$5,000'], deadline_mentions: ['March 15, 2027'] },
  draft_recommendation: { verdict: 'ambiguous', proposed_award_type: null, proposed_facts: { level_mentions: ['masters'], eligibility_phrase: 'international students', funding_mentions: ['$5,000'], deadline_mentions: ['March 15, 2027'] } },
  created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
}

const scholarship = {
  scholarship_id: '33333333-3333-3333-3333-333333333333',
  slug: 'example-award', name: 'Example Award', official_home_url: 'https://example.edu/',
  award_type: 'scholarship', lifecycle_state: 'published',
  provider_id: '44444444-4444-4444-4444-444444444444', provider_name: 'Example University',
  cycles: [{
    cycle_id: '55555555-5555-5555-5555-555555555555', provider_cycle_key: '2027-intake',
    applicant_segment: 'default', official_cycle_url: 'https://example.edu/apply',
    public_status: 'open_verified', evaluated_public_status: 'open_verified',
    status_valid_until: null, last_verified_at: '2026-09-12T00:00:00Z',
    facts: {}, is_auto_approved: false, auto_approval_score: null,
  }],
}

/** Variants chosen so every badge tone renders and gets audited: published +
 *  open_verified (positive), expected_to_reopen (warning), status_unknown
 *  (neutral), withdrawn (negative), needs_review (warning). */
const scholarshipVariants = [
  scholarship,
  {
    ...scholarship,
    scholarship_id: '66666666-6666-6666-6666-666666666666', name: 'Reopening Award', lifecycle_state: 'needs_review',
    cycles: [{ ...scholarship.cycles[0], cycle_id: '77777777-7777-7777-7777-777777777777', public_status: 'expected_to_reopen', evaluated_public_status: 'expected_to_reopen' }],
  },
  {
    ...scholarship,
    scholarship_id: '88888888-8888-8888-8888-888888888888', name: 'Pulled Award', lifecycle_state: 'withdrawn',
    cycles: [{ ...scholarship.cycles[0], cycle_id: '99999999-9999-9999-9999-999999999999', public_status: 'status_unknown', evaluated_public_status: 'status_unknown' }],
  },
]

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

async function mockAdminApi(page: Page) {
  await page.route('**/api/v1/taxonomies', (route) => route.fulfill(json(taxonomies)))
  await page.route('**/api/admin/reviews**', (route) => route.fulfill(json({
    data: [
      reviewTask,
      { ...reviewTask, review_task_id: 'aaaaaaaa-0000-0000-0000-000000000001', priority: 90, raw_title: 'Medium Priority Candidate' },
      { ...reviewTask, review_task_id: 'aaaaaaaa-0000-0000-0000-000000000002', priority: 100, raw_title: 'Low Priority Candidate' },
    ],
    open_count: 3,
  })))
  await page.route('**/api/admin/providers**', (route) => route.fulfill(json({ data: [{ provider_id: scholarship.provider_id, name: 'Example University', approved_domains: ['example.edu'], country: 'GBR' }] })))
  await page.route('**/api/admin/scholarships**', (route) => route.fulfill(json({ data: scholarshipVariants, total: scholarshipVariants.length })))
}

async function signIn(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Your name').fill('Test Reviewer')
  await page.getByLabel('Team passcode').fill(adminPasscode())
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin(?!\/login)/)
}

/** Only serious/critical, matching the existing public-site a11y assertion.
 *  Reports the offending selector and summary so a failure is actionable. */
async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page: page as any }).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const detail = serious.flatMap((v) => v.nodes.map((node) => `${v.id} [${node.target.join(' ')}] ${node.failureSummary?.replace(/\s+/g, ' ').trim()}`))
  expect(detail).toEqual([])
}

test.describe('admin accessibility', () => {
  test.skip(!adminPasscode(), 'ADMIN_UI_PASSCODE is not configured')

  test.beforeEach(async ({ page }) => {
    await mockAdminApi(page)
    await signIn(page)
  })

  test('sign-in page has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/login')
    await expectNoSeriousViolations(page)
  })

  test('review queue has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/reviews')
    await expect(page.getByRole('button', { name: 'Example Merit Scholarship' })).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('review decision modal has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    await expect(page.getByRole('radio', { name: 'Approve' })).toBeVisible()
    await page.getByRole('radio', { name: 'Approve' }).click()
    await expectNoSeriousViolations(page)
  })

  test('scholarships list has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await expect(page.getByText('Example Award')).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('publish modal has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Publish cycle' }).first().click()
    await expect(page.getByRole('combobox', { name: 'Add destinations' })).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})
