'use client'

import { useEffect, useRef, useState } from 'react'
import { Drawer, PanelActions, PanelBody } from './Drawer'
import { Badge, type BadgeTone } from './Badge'
import { PublishCycleForm } from './PublishCycleDrawer'
import { WithdrawForm } from './WithdrawForm'
import type { ScholarshipAdminRead, WithdrawResponse } from '../../app/admin/types'
import type { Taxonomies } from '../../app/types'

const BADGE_TONES: Record<string, BadgeTone> = {
  discovered: 'neutral',
  needs_review: 'warning',
  published: 'positive',
  withdrawn: 'negative',
  open_verified: 'positive',
  expected_to_reopen: 'warning',
  status_unknown: 'neutral',
}

function StateBadge({ value }: { value: string }) {
  return <Badge tone={BADGE_TONES[value] ?? 'neutral'}>{value.replace(/_/g, ' ')}</Badge>
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return 'never'
  const date = new Date(isoDate)
  return Number.isNaN(date.getTime()) ? 'never' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

type Mode = 'overview' | 'publish' | 'withdraw'

type ScholarshipDrawerProps = {
  scholarship: ScholarshipAdminRead
  reviewerName: string
  taxonomies: Taxonomies | null
  onClose: () => void
  onPublished: (scholarshipId: string, result: { cycle_id: string; lifecycle_state: string; public_status: string }) => void
  onWithdrawn: (scholarshipId: string, result: WithdrawResponse) => void
}

/** Everything about one scholarship, including what can be done to it.
 *
 * The list used to carry an Actions column, which meant the row had to be
 * wide enough for two buttons and the reviewer acted on a record they could
 * only see four columns of. Now the row opens this panel and the actions live
 * next to the detail they are a judgement about.
 *
 * One Drawer across all three modes on purpose: remounting per mode would
 * hand focus back to a button that no longer exists, so closing from the
 * publish form would never return focus to the row that opened it.
 */
export function ScholarshipDrawer({ scholarship, reviewerName, taxonomies, onClose, onPublished, onWithdrawn }: ScholarshipDrawerProps) {
  const [mode, setMode] = useState<Mode>('overview')
  const publishFieldRef = useRef<HTMLInputElement>(null)
  const withdrawFieldRef = useRef<HTMLTextAreaElement>(null)

  const withdrawn = scholarship.lifecycle_state === 'withdrawn'

  useEffect(() => {
    // Drawer only focuses on mount, so moving between modes needs its own
    // handoff into the form that just appeared.
    if (mode === 'publish') publishFieldRef.current?.focus()
    if (mode === 'withdraw') withdrawFieldRef.current?.focus()
  }, [mode])

  const lastVerified = scholarship.cycles
    .map((cycle) => cycle.last_verified_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null

  return (
    <Drawer title={scholarship.name} wide onClose={onClose}>
      {mode === 'overview' ? (
        <>
          {/* Nothing can be done to a withdrawn record, so it gets no action
              bar at all rather than two dead buttons to puzzle over. */}
          {withdrawn ? null : (
            <PanelActions>
              <button
                type="button"
                className="admin-auth-submit"
                disabled={!taxonomies}
                title={!taxonomies ? 'Waiting on taxonomy data to load…' : undefined}
                onClick={() => setMode('publish')}
              >
                Publish cycle
              </button>
              <button type="button" className="admin-danger-button" onClick={() => setMode('withdraw')}>Withdraw</button>
            </PanelActions>
          )}

          <PanelBody>
            {withdrawn ? (
              <p className="admin-panel-excerpt">This scholarship is withdrawn, so it and its cycles are hidden from public results.</p>
            ) : null}

            <dl className="admin-detail-list">
              <div>
                <dt>Lifecycle</dt>
                <dd><StateBadge value={scholarship.lifecycle_state} /></dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{scholarship.provider_name}</dd>
              </div>
              <div>
                <dt>Award type</dt>
                <dd>{scholarship.award_type.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt>Slug</dt>
                <dd><code>{scholarship.slug}</code></dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>{formatDate(lastVerified)}</dd>
              </div>
            </dl>

            {scholarship.official_home_url ? (
              <a href={scholarship.official_home_url} target="_blank" rel="noreferrer" className="admin-panel-source">Open the official page</a>
            ) : null}

            <section className="admin-form-section">
              <h3>Cycles ({scholarship.cycles.length})</h3>
              {scholarship.cycles.length === 0 ? (
                <p className="admin-status">No cycle published yet. Nothing from this scholarship reaches public results until one is.</p>
              ) : (
                <ul className="admin-cycle-detail-list">
                  {scholarship.cycles.map((cycle) => (
                    <li key={cycle.cycle_id}>
                      <div className="admin-cycle-detail-head">
                        <strong>{cycle.provider_cycle_key}</strong>
                        <StateBadge value={cycle.evaluated_public_status} />
                      </div>
                      <p className="admin-cell-excerpt">
                        {cycle.applicant_segment} · verified {formatDate(cycle.last_verified_at)}
                        {cycle.is_auto_approved ? ' · auto-approved' : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </PanelBody>
        </>
      ) : mode === 'publish' && taxonomies ? (
        <PublishCycleForm
          scholarshipId={scholarship.scholarship_id}
          officialHomeUrl={scholarship.official_home_url}
          taxonomies={taxonomies}
          heading="Publish a cycle"
          firstFieldRef={publishFieldRef}
          onCancel={() => setMode('overview')}
          onPublished={onPublished}
        />
      ) : (
        <WithdrawForm
          scholarshipId={scholarship.scholarship_id}
          reviewerName={reviewerName}
          firstFieldRef={withdrawFieldRef}
          onCancel={() => setMode('overview')}
          onWithdrawn={onWithdrawn}
        />
      )}
    </Drawer>
  )
}
