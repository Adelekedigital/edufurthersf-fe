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
    // Shaped like a real published cycle: everything entered at publish time
    // comes back as taxonomy codes, which is what the panel has to resolve.
    facts: {
      destinations: ['GB'],
      levels: ['masters', 'doctorate'],
      origin_mode: 'restricted', origins: ['NG', 'GH'],
      field_mode: 'all', fields: [],
      funding_type: 'fully_funded',
      deadline_at: '2027-03-15T00:00:00+00:00', deadline_precision: 'date',
      evidence_fresh: true, expected_reopen_month: 10,
      eligibility_note: 'Open to international students only.',
      programme_names: [],
    },
    is_auto_approved: false, auto_approval_score: null,
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
    // Published as open, since re-evaluated against its deadline - the drift
    // a reviewer opens the panel to find.
    cycles: [{ ...scholarship.cycles[0], cycle_id: '77777777-7777-7777-7777-777777777777', public_status: 'open_verified', evaluated_public_status: 'expected_to_reopen' }],
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

  test('the list has no actions column and the row opens a panel that does', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/admin/scholarships')

    await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0)
    // Nothing actionable in the row itself beyond the link into the panel.
    await expect(page.getByRole('button', { name: 'Publish cycle' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Withdraw' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Example Award' }).click()
    const panel = page.locator('.admin-drawer')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Publish cycle' })).toBeEnabled()
    await expect(panel.getByRole('button', { name: 'Withdraw' })).toBeEnabled()
    // The row it belongs to is marked, since the actions no longer sit in it.
    await expect(page.locator('tr.admin-row-active')).toContainText('Example Award')

    // The table still sits clear of the panel rather than under it.
    const panelBox = await panel.boundingBox()
    expect(panelBox!.width).toBeGreaterThan(500)
    const tableBox = await page.locator('.admin-table-wrap').boundingBox()
    expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(panelBox!.x + 1)
  })

  test('the panel shows what was actually published, as labels not codes', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Example Award' }).click()
    const detail = page.locator('.admin-cycle-detail')
    await expect(detail).toBeVisible()

    // Everything entered at publish time, resolved through the taxonomy.
    await expect(detail).toContainText('United Kingdom')
    await expect(detail).toContainText("Master's, Doctorate")
    await expect(detail).toContainText('Nigeria, Ghana')
    await expect(detail).toContainText('All fields')
    await expect(detail).toContainText('Fully funded')
    await expect(detail).toContainText('October')
    await expect(detail).toContainText('Open to international students only.')
    await expect(detail).toContainText('Marked current at publish')

    // Raw codes are what a reviewer cannot check against a source page.
    const text = (await detail.textContent()) ?? ''
    for (const code of ['fully_funded', 'expected_reopen_month', 'origin_mode', 'evidence_fresh']) {
      expect(text).not.toContain(code)
    }
  })

  test('the panel flags a cycle whose live status has drifted from what was published', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Reopening Award' }).click()
    await expect(page.locator('.admin-cycle-detail')).toContainText('open verified (now showing as expected to reopen)')

    // Close first: below the breakpoint the panel covers the list, so the next
    // row is not clickable underneath it.
    await page.keyboard.press('Escape')
    await expect(page.locator('.admin-drawer')).toHaveCount(0)

    // The unchanged case should not claim a drift.
    await page.getByRole('button', { name: 'Example Award' }).click()
    await expect(page.locator('.admin-cycle-detail')).not.toContainText('now showing as')
  })

  test('publishing carries the last cycle forward instead of starting blank', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Example Award' }).click()
    await page.getByRole('button', { name: 'Publish cycle' }).click()

    const panel = page.locator('.admin-drawer')
    await expect(panel.getByLabel('Applicant segment')).toHaveValue('default')
    await expect(panel.getByLabel('Official cycle URL')).toHaveValue('https://example.edu/apply')
    await expect(panel.getByLabel('Public status')).toHaveValue('open_verified')
    await expect(panel.getByLabel('Expected reopen month (optional)')).toHaveValue('10')
    await expect(panel.getByLabel('Eligibility note (optional)')).toHaveValue('Open to international students only.')
    await expect(panel.locator('.admin-multiselect').first()).toContainText('United Kingdom')
    await expect(panel.getByLabel('Applicant origin restriction')).toHaveValue('restricted')
    await expect(panel).toContainText('Nigeria')

    // The freshness claims are not inherited: nobody has re-checked yet.
    await expect(panel.getByLabel('Last verified at (optional)')).toHaveValue('')
    await expect(panel.getByLabel('Evidence is current as of today')).not.toBeChecked()
    await expect(panel.locator('.admin-panel-note')).toContainText('2027-intake')
  })

  test('the carried-over cycle key is shown but must be changed before publishing', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Example Award' }).click()
    await page.getByRole('button', { name: 'Publish cycle' }).click()
    const panel = page.locator('.admin-drawer')
    const key = panel.getByLabel('Provider cycle key')

    // Shown, so the reviewer can see what the last cycle was called...
    await expect(key).toHaveValue('2027-intake')
    // ...but a reused key is a 409 from the backend, so it is caught here.
    await expect(key).toHaveAttribute('aria-invalid', 'true')
    await expect(panel.getByText('a cycle cannot reuse one')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Publish' })).toBeDisabled()

    await key.fill('2028-intake')
    await expect(key).not.toHaveAttribute('aria-invalid', 'true')
    await expect(panel.getByText('a cycle cannot reuse one')).toHaveCount(0)
  })

  test('a cycle can be edited in place and sends only what changed', async ({ page }) => {
    const patches: { method: string; url: string; body: unknown }[] = []
    await page.route('**/api/admin/scholarships/*/cycles/*', async (route) => {
      patches.push({
        method: route.request().method(),
        url: route.request().url(),
        body: route.request().postDataJSON(),
      })
      await route.fulfill(json({
        scholarship_id: scholarship.scholarship_id,
        cycle_id: scholarship.cycles[0].cycle_id,
        lifecycle_state: 'published',
        public_status: 'open_verified',
      }))
    })

    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Example Award' }).click()
    await page.getByRole('button', { name: 'Edit 2027-intake' }).click()

    const panel = page.locator('.admin-drawer')
    // Editing keeps the cycle's own key, unlike carrying one forward.
    await expect(panel.getByLabel('Provider cycle key')).toHaveValue('2027-intake')
    await expect(panel.getByLabel('Provider cycle key')).not.toHaveAttribute('aria-invalid', 'true')
    // Nothing has changed yet, so there is nothing to save.
    await expect(panel.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await expect(panel.locator('.admin-panel-note')).toContainText('Nothing changed yet')

    await panel.getByLabel('Expected reopen month (optional)').selectOption('9')
    await expect(panel.locator('.admin-panel-note')).toContainText('1 field changed')
    await panel.getByRole('button', { name: 'Save changes' }).click()

    await expect.poll(() => patches.length).toBe(1)
    expect(patches[0].method).toBe('PATCH')
    // Only the edited field travels: the backend's audit entry names the
    // fields that moved, so sending everything would make it meaningless.
    expect(patches[0].body).toEqual({ expected_reopen_month: 9 })
  })

  test('a withdrawn cycle offers no edit', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Pulled Award' }).click()
    await expect(page.locator('.admin-cycle-detail')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Edit/ })).toHaveCount(0)
  })

  test('a withdrawn scholarship shows no actions at all', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Pulled Award' }).click()
    const panel = page.locator('.admin-drawer')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Publish cycle' })).toHaveCount(0)
    await expect(panel.getByRole('button', { name: 'Withdraw' })).toHaveCount(0)
    await expect(panel.locator('.admin-panel-actions')).toHaveCount(0)
    await expect(panel).toContainText('hidden from public results')
  })

  test('panel actions stay in view without scrolling the publish form', async ({ page }) => {
    // Short enough that the four-section publish form definitely overflows.
    await page.setViewportSize({ width: 1600, height: 700 })
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Example Award' }).click()
    await page.getByRole('button', { name: 'Publish cycle' }).click()

    const actions = page.locator('.admin-panel-actions')
    const body = page.locator('.admin-panel-body')
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible()

    // Actions sit above the scrolling region, not after the form.
    const actionsBox = (await actions.boundingBox())!
    const bodyBox = (await body.boundingBox())!
    expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(bodyBox.y + 1)

    // Scrolling the form to the bottom leaves the buttons exactly where they were.
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    await body.evaluate((el) => { el.scrollTop = el.scrollHeight })
    expect((await actions.boundingBox())!.y).toBeCloseTo(actionsBox.y, 0)
    await expect(page.getByRole('button', { name: 'Publish' })).toBeInViewport()
  })

  test('cancelling a scholarship action returns to the panel, not the list', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Example Award' }).click()
    await page.getByRole('button', { name: 'Withdraw' }).click()
    await expect(page.getByRole('textbox', { name: 'Reason' })).toBeFocused()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.admin-drawer')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish cycle' })).toBeVisible()
  })

  test('adding a provider picks a country from the list instead of typing a code', async ({ page }) => {
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    await page.getByRole('radio', { name: 'Approve' }).click()
    await page.getByRole('button', { name: 'Add a new provider' }).click()

    await expect(page.getByLabel('Country (optional, 2-3 letter code)')).toHaveCount(0)
    const country = page.getByRole('combobox', { name: 'Provider country' })
    await country.fill('Tanz')
    await page.getByRole('option', { name: 'Tanzania, United Republic of' }).click()
    await expect(country).toHaveValue('Tanzania, United Republic of')
  })

  test('the provider combobox matches the admin fields beside it', async ({ page }) => {
    // Only meaningful where the filter row lays out in one line; it wraps on
    // mobile, where the two fields are legitimately on separate rows.
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/scholarships')
    const provider = page.getByRole('combobox', { name: 'Provider' })
    const lifecycle = page.getByLabel('Lifecycle state')
    const providerBox = (await provider.boundingBox())!
    const lifecycleBox = (await lifecycle.boundingBox())!
    // Was the finder's 48px hero input dropped into a row of ~38px selects.
    expect(Math.abs(providerBox.height - lifecycleBox.height)).toBeLessThanOrEqual(2)
    expect(Math.abs(providerBox.y - lifecycleBox.y)).toBeLessThanOrEqual(2)
  })

  test('reason box is sized for the view, not stretched to fill the panel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    const reason = page.locator('.admin-drawer textarea')
    const panelHeight = (await page.locator('.admin-drawer').boundingBox())!.height

    // Rejecting makes the reason the only input, so it gets a taller box -
    // but a bounded one, not the full height of the panel.
    const rejecting = (await reason.boundingBox())!.height
    expect(rejecting).toBeGreaterThan(120)
    expect(rejecting).toBeLessThan(panelHeight / 2)

    // Approving gives the room back to the fields that need it.
    await page.getByRole('radio', { name: 'Approve' }).click()
    await expect(page.locator('.admin-form-grid')).toBeVisible()
    const approving = (await reason.boundingBox())!.height
    expect(approving).toBeLessThan(rejecting)
    expect(approving).toBeGreaterThanOrEqual(60)
  })

  test('clicking inside the provider field does not hijack the provider search box', async ({ page }) => {
    await page.goto('/admin/reviews')
    await page.getByRole('button', { name: 'Example Merit Scholarship' }).click()
    await page.getByRole('radio', { name: 'Approve' }).click()

    // The field wraps a search box, a button and that button's form. As a
    // <label> it forwarded every click inside it to the search box.
    const providerSearch = page.getByRole('combobox', { name: 'Provider', exact: true })
    await page.getByRole('button', { name: 'Add a new provider' }).click()
    await expect(providerSearch).toHaveAttribute('aria-expanded', 'false')
    await expect(providerSearch).not.toBeFocused()

    await page.getByLabel('Provider name').fill('New University')
    await expect(page.getByLabel('Provider name')).toHaveValue('New University')
  })

  test('scholarship panel has no serious a11y violations in either mode', async ({ page }) => {
    await page.goto('/admin/scholarships')
    await page.getByRole('button', { name: 'Example Award' }).click()
    await expect(page.locator('.admin-detail-list').first()).toBeVisible()
    await expectNoSeriousViolations(page)

    await page.getByRole('button', { name: 'Publish cycle' }).click()
    await expect(page.getByRole('combobox', { name: 'Add destinations' })).toBeVisible()
    await expectNoSeriousViolations(page)
  })
})
