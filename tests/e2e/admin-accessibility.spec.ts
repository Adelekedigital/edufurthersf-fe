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
  // Shaped like real scraped excerpts: blank-line blocks, '###' markers and
  // a '[...]' omission, so the excerpt renderer is actually exercised.
  raw_excerpt: [
    'Intro paragraph that runs on for a while so the table has something to clamp to two lines. [...] Second scraped section after an omission.',
    '### Postgraduate',
    '### A heading so long that it is really a sentence the scraper mislabelled and should not be emphasised in the panel.',
    'Closing paragraph. Terms and conditions apply.',
  ].join('\n\n'),
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

  test('review decision panel has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    await expect(page.getByRole('radio', { name: 'Approve' })).toBeVisible()
    await page.getByRole('radio', { name: 'Approve' }).click()
    await expectNoSeriousViolations(page)
  })

  test('review panel renders scraped excerpts as readable blocks', async ({ page }) => {
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    const excerpt = page.locator('.admin-excerpt')
    await expect(excerpt).toBeVisible()

    // Scraper artefacts must not leak into the reviewer's view.
    await expect(excerpt).not.toContainText('###')
    await expect(excerpt).not.toContainText('[...]')

    // A short "###" line reads as a heading; a sentence-length one does not.
    await expect(excerpt.locator('.admin-excerpt-subhead')).toHaveText(['Postgraduate'])
    await expect(excerpt).toContainText('mislabelled and should not be emphasised')

    // The dropped section is marked rather than silently joined.
    await expect(excerpt.locator('.admin-excerpt-gap')).toHaveCount(1)

    // Bounded so the decision controls stay reachable.
    const box = await excerpt.boundingBox()
    expect(box!.height).toBeLessThanOrEqual(300)
  })

  test('review panel is non-modal: the queue stays readable and clickable', async ({ page }) => {
    await page.viewportSize()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    await expect(page.locator('.admin-drawer')).toBeVisible()

    // The row that is still in the list must remain reachable - that is the
    // whole reason this is a panel and not a modal.
    const otherRow = page.getByRole('button', { name: 'Low Priority Candidate' })
    await expect(otherRow).toBeVisible()
    const table = page.locator('.admin-table-wrap')
    const tableBox = await table.boundingBox()
    const drawerBox = await page.locator('.admin-drawer').boundingBox()
    expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(drawerBox!.x + 1)

    // Clicking straight through to another candidate swaps the panel.
    await otherRow.click()
    await expect(page.locator('.admin-drawer')).toContainText('Low Priority Candidate')
  })

  test('switching candidates does not carry the previous decision over', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    const reason = page.locator('.admin-drawer textarea')
    await reason.fill('Reason typed against the first candidate')
    await page.getByRole('radio', { name: 'Approve' }).click()

    await page.getByRole('button', { name: 'Low Priority Candidate' }).click()
    // Fresh candidate, fresh decision: reason cleared and back to Reject.
    await expect(page.locator('.admin-drawer textarea')).toHaveValue('')
    await expect(page.getByRole('radio', { name: 'Reject' })).toHaveAttribute('aria-checked', 'true')
  })

  test('review panel goes full width when there is no room beside the list', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 })
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    const drawer = page.locator('.admin-drawer')
    await expect(drawer).toBeVisible()
    const box = await drawer.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(700 - 2)
    // The queue must not keep reserving space it cannot use at this width.
    await expect(page.locator('.admin-review-queue')).toHaveCSS('margin-right', '0px')
  })

  test('escape closes the panel and returns focus to the row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/reviews')
    const trigger = page.getByRole('button', { name: 'Example Merit Scholarship' })
    await trigger.click()
    await expect(page.locator('.admin-drawer')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.admin-drawer')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('scholarships list has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await expect(page.getByText('Example Award')).toBeVisible()
    await expectNoSeriousViolations(page)
  })

  test('scholarship actions open side panels beside the list', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/admin/scholarships')

    await page.getByRole('button', { name: 'Publish cycle' }).first().click()
    const publishPanel = page.locator('.admin-drawer')
    await expect(publishPanel).toBeVisible()
    // Wider than the triage panel, and the table still sits clear of it.
    const publishBox = await publishPanel.boundingBox()
    expect(publishBox!.width).toBeGreaterThan(500)
    const tableBox = await page.locator('.admin-table-wrap').boundingBox()
    expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(publishBox!.x + 1)

    await page.keyboard.press('Escape')
    await expect(publishPanel).toHaveCount(0)

    await page.getByRole('button', { name: 'Withdraw' }).first().click()
    await expect(page.locator('.admin-drawer')).toBeVisible()
    await expect(page.locator('.admin-drawer')).toContainText('Withdraw')
  })

  test('reason box grows to fill the panel when rejecting', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    const reason = page.locator('.admin-drawer textarea')

    // Reject hides the approve fields, so the box should take up the slack.
    const rejecting = (await reason.boundingBox())!.height
    expect(rejecting).toBeGreaterThan(200)

    // Approve needs the room back for its own fields.
    await page.getByRole('radio', { name: 'Approve' }).click()
    await expect(page.locator('.admin-form-grid')).toBeVisible()
    const approving = (await reason.boundingBox())!.height
    expect(approving).toBeLessThan(rejecting)
    expect(approving).toBeGreaterThanOrEqual(60)
  })

  test('publish panel has no serious a11y violations', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Publish cycle' }).first().click()
    await expect(page.getByRole('combobox', { name: 'Add destinations' })).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})
