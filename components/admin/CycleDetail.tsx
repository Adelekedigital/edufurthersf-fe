'use client'

import { Badge, type BadgeTone } from './Badge'
import type { ScholarshipCycleAdminRead } from '../../app/admin/types'
import type { Option, Taxonomies } from '../../app/types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const STATUS_TONES: Record<string, BadgeTone> = {
  open_verified: 'positive',
  expected_to_reopen: 'warning',
  status_unknown: 'neutral',
}

function labelFor(options: Option[], code: string): string {
  // Falls back to the raw code rather than hiding it: a code with no label is
  // a taxonomy mismatch worth seeing, not something to silently swallow.
  return options.find((option) => option.code === code)?.label ?? code
}

function labelList(options: Option[], codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  return codes.filter((code): code is string => typeof code === 'string').map((code) => labelFor(options, code))
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function formatDateTime(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

/** One row of the cycle read-out. Skipped entirely when there is nothing to
 *  show, so an unset optional field does not read as an empty one. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === '' || (Array.isArray(children) && children.length === 0)) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Restriction rows read as a sentence rather than mode + list: "Restricted"
 *  next to an empty list is the 422 the publish form already guards against,
 *  and "All fields" with a list would be contradictory. */
function restriction(mode: unknown, names: string[], allLabel: string): string | null {
  if (mode === 'all' || mode === 'unrestricted') return allLabel
  if (mode === 'restricted') return names.length ? names.join(', ') : 'Restricted, but no list recorded'
  if (mode === 'unknown') return 'Not known'
  return names.length ? names.join(', ') : null
}

/** Everything recorded for one published cycle.
 *
 * The list row and the panel header only carry a cycle's identity, so a
 * reviewer could see that something was published but not what was published
 * - no destinations, levels, deadline or eligibility. Those all live in
 * `facts`, as taxonomy codes; they are resolved to labels here because "FR"
 * and "stipend_only" are not what a reviewer is checking against the source.
 */
export function CycleDetail({ cycle, taxonomies }: { cycle: ScholarshipCycleAdminRead; taxonomies: Taxonomies | null }) {
  const facts = cycle.facts ?? {}
  const empty: Option[] = []
  const destinations = labelList(taxonomies?.destinations ?? empty, facts.destinations)
  const levels = labelList(taxonomies?.degrees ?? empty, facts.levels)
  const origins = labelList(taxonomies?.countries ?? empty, facts.origins)
  const fields = labelList(taxonomies?.fields ?? empty, facts.fields)
  const programmeNames = Array.isArray(facts.programme_names) ? facts.programme_names.filter((item): item is string => typeof item === 'string') : []
  const fundingType = text(facts.funding_type)
  const reopenMonth = typeof facts.expected_reopen_month === 'number' ? MONTHS[facts.expected_reopen_month - 1] : null
  const deadline = formatDateTime(facts.deadline_at)
  const declaredStatus = cycle.public_status
  const evaluatedStatus = cycle.evaluated_public_status

  return (
    <li className="admin-cycle-detail">
      <div className="admin-cycle-detail-head">
        <strong>{cycle.provider_cycle_key}</strong>
        <Badge tone={STATUS_TONES[evaluatedStatus] ?? 'neutral'}>{evaluatedStatus.replace(/_/g, ' ')}</Badge>
      </div>

      <dl className="admin-detail-list">
        {/* The backend re-evaluates status against the deadline and validity
            window, so what was entered and what is live can differ. Showing
            both is the point of a review view. */}
        {declaredStatus !== evaluatedStatus ? (
          <Row label="Published as">{declaredStatus.replace(/_/g, ' ')} (now showing as {evaluatedStatus.replace(/_/g, ' ')})</Row>
        ) : null}
        <Row label="Applicant segment">{cycle.applicant_segment}</Row>
        <Row label="Cycle URL">
          <a href={cycle.official_cycle_url} target="_blank" rel="noreferrer">{cycle.official_cycle_url}</a>
        </Row>
        <Row label="Destinations">{destinations.join(', ')}</Row>
        <Row label="Degree levels">{levels.join(', ')}</Row>
        <Row label="Fields">{restriction(facts.field_mode, fields, 'All fields')}</Row>
        <Row label="Applicant origins">{restriction(facts.origin_mode, origins, 'Open to all origins')}</Row>
        <Row label="Funding">{fundingType ? labelFor(taxonomies?.funding_types ?? empty, fundingType) : null}</Row>
        <Row label="Deadline">{deadline ? `${deadline}${facts.deadline_precision === 'datetime' ? ' (exact time)' : ''}${text(facts.deadline_timezone) ? ` ${facts.deadline_timezone}` : ''}` : null}</Row>
        <Row label="Expected reopen">{reopenMonth}</Row>
        <Row label="Status valid until">{formatDateTime(cycle.status_valid_until)}</Row>
        <Row label="Last verified">{formatDateTime(cycle.last_verified_at)}</Row>
        <Row label="Evidence">{facts.evidence_fresh === true ? 'Marked current at publish' : facts.evidence_fresh === false ? 'Not marked current' : null}</Row>
        <Row label="Programme names">{programmeNames.join(', ')}</Row>
        <Row label="Eligibility note">{text(facts.eligibility_note)}</Row>
        <Row label="Auto-approved">{cycle.is_auto_approved ? `Yes${cycle.auto_approval_score === null ? '' : ` (score ${cycle.auto_approval_score})`}` : null}</Row>
      </dl>
    </li>
  )
}
