'use client'

import { useRef, useState, type Ref } from 'react'
import { publishCycle, updateCycle } from '../../app/admin/api'
import { Drawer, PanelActions, PanelBody } from './Drawer'
import type { AdminApiError, DeadlinePrecision, FieldMode, OriginMode, PublicStatusValue, PublishCycleRequest, PublishPrefill, ScholarshipCycleAdminRead, UpdateCycleRequest } from '../../app/admin/types'
import type { Option, Taxonomies } from '../../app/types'
import { MultiSelectCombobox } from './MultiSelectCombobox'

function toIsoOrUndefined(localDateTime: string): string | undefined {
  if (!localDateTime) return undefined
  const date = new Date(localDateTime)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** ISO instant -> the "YYYY-MM-DDTHH:mm" a datetime-local input accepts.
 *  Local time, to round-trip with toIsoOrUndefined above. */
function toDateTimeInput(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function seedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback
}

/** The keys whose value differs, as a partial request body.
 *
 * Compared as JSON so the array fields (destinations, levels, origins,
 * fields, programme_names) compare by contents rather than by identity -
 * they are rebuilt on every render, so every one of them would otherwise
 * read as changed. */
function diffPayload(before: PublishCycleRequest, after: PublishCycleRequest): UpdateCycleRequest {
  const changed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(after)) {
    const previous = before[key as keyof PublishCycleRequest]
    if (JSON.stringify(value) !== JSON.stringify(previous)) changed[key] = value
  }
  return changed as UpdateCycleRequest
}

/** Codes the current taxonomy still publishes. A code that has since been
 *  retired would leave the combobox visually empty while still passing the
 *  "length" submit check, then fail as a 422 - the same trap the review
 *  draft's level_mentions set. */
function seedCodes(value: unknown, available: Option[]): string[] {
  if (!Array.isArray(value)) return []
  const known = new Set(available.map((option) => option.code))
  return value.filter((code): code is string => typeof code === 'string' && known.has(code))
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type PublishCycleFormProps = {
  scholarshipId: string
  officialHomeUrl?: string
  taxonomies: Taxonomies
  prefill?: PublishPrefill
  /** An existing cycle to carry forward, so publishing the next one is not a
   *  full retype of the last. */
  seedFrom?: ScholarshipCycleAdminRead
  /** The cycle being corrected in place. Set this and the form saves changes
   *  back to that cycle instead of publishing a new one. */
  editing?: ScholarshipCycleAdminRead
  /** Heading for the body when the panel title is the scholarship rather than the action. */
  heading?: string
  firstFieldRef?: Ref<HTMLInputElement>
  onCancel: () => void
  onPublished: (scholarshipId: string, result: { cycle_id: string; lifecycle_state: string; public_status: string }) => void
}

/** The publish-a-cycle form, without a panel around it.
 *
 * Split from the panel because it is reached two ways: straight from a
 * scholarship (inside that scholarship's panel, alongside withdraw) and from
 * the "publish now" prompt after approving a review, which has no panel of
 * its own. See PublishCycleDrawer below for the standalone case. */
export function PublishCycleForm({ scholarshipId, officialHomeUrl, taxonomies, prefill, seedFrom, editing, heading, firstFieldRef, onCancel, onPublished }: PublishCycleFormProps) {
  const source = editing ?? seedFrom
  const facts: Record<string, unknown> = source?.facts ?? {}

  const [providerCycleKey, setProviderCycleKey] = useState(() => seedString(source?.provider_cycle_key))
  const [applicantSegment, setApplicantSegment] = useState(() => seedString(source?.applicant_segment, 'default'))
  const [officialCycleUrl, setOfficialCycleUrl] = useState(() => seedString(source?.official_cycle_url, officialHomeUrl ?? ''))
  const [publicStatus, setPublicStatus] = useState<PublicStatusValue | ''>(() => (source?.public_status ?? '') as PublicStatusValue | '')
  const [statusValidUntil, setStatusValidUntil] = useState(() => toDateTimeInput(source?.status_valid_until))
  // Carried forward only when editing. On a new cycle these two are claims
  // that someone checked the source today, and copying the last cycle's
  // values would assert verification work that has not happened; on an edit
  // they are the cycle's own record, and blanking them would destroy it.
  const [lastVerifiedAt, setLastVerifiedAt] = useState(() => (editing ? toDateTimeInput(editing.last_verified_at) : ''))
  const [destinations, setDestinations] = useState<string[]>(() => seedCodes(facts.destinations, taxonomies.destinations))
  // The extractor emits level_mentions from its own keyword list, which does
  // not always intersect the degree taxonomy - "bachelors" is a real possible
  // mention but is not a published degree code. Keeping an unmatched code
  // would leave the select visually empty while still passing the
  // "levels.length" submit check, so it would fail as a 422 on publish.
  const [levels, setLevels] = useState<string[]>(() => (
    source ? seedCodes(facts.levels, taxonomies.degrees) : seedCodes(prefill?.levels, taxonomies.degrees)
  ))
  const [originMode, setOriginMode] = useState<OriginMode>(() => (facts.origin_mode as OriginMode) ?? 'unknown')
  const [origins, setOrigins] = useState<string[]>(() => seedCodes(facts.origins, taxonomies.countries))
  const [fieldMode, setFieldMode] = useState<FieldMode>(() => (facts.field_mode as FieldMode) ?? 'unknown')
  const [fields, setFields] = useState<string[]>(() => seedCodes(facts.fields, taxonomies.fields))
  const [programmeNames, setProgrammeNames] = useState(() => (
    Array.isArray(facts.programme_names) ? facts.programme_names.filter((item): item is string => typeof item === 'string').join(', ') : ''
  ))
  const [evidenceFresh, setEvidenceFresh] = useState(() => (editing ? facts.evidence_fresh === true : false))
  const [deadlineAt, setDeadlineAt] = useState(() => toDateTimeInput(facts.deadline_at))
  const [deadlinePrecision, setDeadlinePrecision] = useState<DeadlinePrecision>(() => (facts.deadline_precision as DeadlinePrecision) ?? 'date')
  const [deadlineTimezone, setDeadlineTimezone] = useState(() => seedString(facts.deadline_timezone))
  const [eligibilityNote, setEligibilityNote] = useState(() => seedString(facts.eligibility_note, prefill?.eligibilityNote ?? ''))
  const [expectedReopenMonth, setExpectedReopenMonth] = useState(() => (
    typeof facts.expected_reopen_month === 'number' ? String(facts.expected_reopen_month) : ''
  ))
  const [fundingType, setFundingType] = useState(() => {
    const code = seedString(facts.funding_type)
    return taxonomies.funding_types.some((option) => option.code === code) ? code : ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildPayload = (): PublishCycleRequest => ({
    provider_cycle_key: providerCycleKey.trim(),
    applicant_segment: applicantSegment.trim() || 'default',
    official_cycle_url: officialCycleUrl.trim(),
    public_status: publicStatus as PublicStatusValue,
    status_valid_until: toIsoOrUndefined(statusValidUntil) ?? null,
    last_verified_at: toIsoOrUndefined(lastVerifiedAt) ?? null,
    destinations,
    levels,
    origin_mode: originMode,
    origins: originMode === 'restricted' ? origins : [],
    field_mode: fieldMode,
    fields: fieldMode === 'restricted' ? fields : [],
    programme_names: programmeNames.split(',').map((item) => item.trim()).filter(Boolean),
    evidence_fresh: evidenceFresh,
    deadline_at: toIsoOrUndefined(deadlineAt) ?? null,
    deadline_precision: deadlinePrecision,
    deadline_timezone: deadlineTimezone.trim() || null,
    eligibility_note: eligibilityNote.trim() || null,
    expected_reopen_month: expectedReopenMonth ? Number(expectedReopenMonth) : null,
    funding_type: fundingType || null,
  })

  // The form starts seeded, so the payload built on mount is what the cycle
  // already says. Diffing against it is what keeps the PATCH partial - two
  // reviewers touching different fields do not overwrite each other, and the
  // backend's audit entry names the fields that actually moved instead of
  // every field on every save. Held in state, not a ref: it is read during
  // render, and a lazy initialiser is what captures it exactly once.
  const [baseline] = useState(buildPayload)

  const changes = editing ? diffPayload(baseline, buildPayload()) : null
  const changeCount = changes ? Object.keys(changes).length : 0

  // Only meaningful when carrying a cycle forward: that publishes a second
  // cycle, and the backend rejects a duplicate key with a 409. Editing the
  // cycle in place keeps its own key, so the check does not apply there.
  const duplicateCycleKey = Boolean(
    seedFrom && !editing && providerCycleKey.trim() === seedFrom.provider_cycle_key
  )

  const canSubmit = Boolean(
    providerCycleKey.trim() && !duplicateCycleKey && officialCycleUrl.trim() && publicStatus && destinations.length && levels.length &&
    (originMode !== 'restricted' || origins.length) && (fieldMode !== 'restricted' || fields.length) &&
    (!editing || changeCount > 0)
  )

  const submit = async () => {
    if (!canSubmit || submitting || !publicStatus) return
    setSubmitting(true)
    setError(null)
    try {
      const result = editing && changes
        ? await updateCycle(scholarshipId, editing.cycle_id, changes)
        : await publishCycle(scholarshipId, buildPayload())
      onPublished(scholarshipId, result)
    } catch (submitError) {
      const apiError = submitError as AdminApiError
      setError(apiError.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderMultiSelect = (options: Option[], values: string[], onChange: (values: string[]) => void, label: string) => (
    <MultiSelectCombobox options={options} values={values} onChange={onChange} label={label} />
  )

  return (
    <>
      <PanelActions>
        <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="button" className="admin-auth-submit" onClick={submit} disabled={!canSubmit || submitting}>
          {submitting
            ? (editing ? 'Saving…' : 'Publishing…')
            : (editing ? 'Save changes' : 'Publish')}
        </button>
      </PanelActions>

      <PanelBody>
        {heading ? <h3 className="admin-panel-heading">{heading}</h3> : null}

        {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}

        {editing ? (
          <p className="admin-panel-note">
            Editing <strong>{editing.provider_cycle_key}</strong> in place — this is live, so a change here is what applicants see next.
            {changeCount > 0
              ? ` ${changeCount} ${changeCount === 1 ? 'field' : 'fields'} changed; only those are saved.`
              : ' Nothing changed yet.'}
          </p>
        ) : seedFrom ? (
          <p className="admin-panel-note">
            Carried over from <strong>{seedFrom.provider_cycle_key}</strong>. This publishes a <em>new</em> cycle rather than changing
            that one, so give it its own key. Re-check the source before saving — the verification date and evidence box are left blank
            on purpose, since nobody has checked yet.
          </p>
        ) : null}

        <section className="admin-form-section">
          <h3>Cycle identity</h3>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Provider cycle key</span>
              <input
                ref={firstFieldRef}
                type="text"
                value={providerCycleKey}
                onChange={(event) => setProviderCycleKey(event.target.value)}
                placeholder="e.g. 2027-intake"
                aria-invalid={duplicateCycleKey || undefined}
                aria-describedby={duplicateCycleKey ? 'cycle-key-hint' : undefined}
              />
              {duplicateCycleKey ? (
                <span className="admin-hint admin-hint-warning" id="cycle-key-hint">
                  This is the key it was copied from. Change it — a cycle cannot reuse one.
                </span>
              ) : null}
            </label>
            <label className="admin-field">
              <span>Applicant segment</span>
              <input type="text" value={applicantSegment} onChange={(event) => setApplicantSegment(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Official cycle URL</span>
              <input type="url" value={officialCycleUrl} onChange={(event) => setOfficialCycleUrl(event.target.value)} placeholder="https://" />
            </label>
          </div>
        </section>

        <section className="admin-form-section">
          <h3>Status</h3>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Public status</span>
              <select value={publicStatus} onChange={(event) => setPublicStatus(event.target.value as PublicStatusValue)}>
                <option value="">Select…</option>
                <option value="open_verified">Open (verified)</option>
                <option value="expected_to_reopen">Expected to reopen</option>
                <option value="status_unknown">Status unknown</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Status valid until (optional)</span>
              <input type="datetime-local" value={statusValidUntil} onChange={(event) => setStatusValidUntil(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Last verified at (optional)</span>
              <input type="datetime-local" value={lastVerifiedAt} onChange={(event) => setLastVerifiedAt(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Expected reopen month (optional)</span>
              <select value={expectedReopenMonth} onChange={(event) => setExpectedReopenMonth(event.target.value)}>
                <option value="">Not specified</option>
                {MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </label>
            <label className="admin-field admin-field-checkbox">
              <input type="checkbox" checked={evidenceFresh} onChange={(event) => setEvidenceFresh(event.target.checked)} />
              <span>Evidence is current as of today</span>
            </label>
          </div>
        </section>

        <section className="admin-form-section">
          <h3>Eligibility</h3>
          <div className="admin-form-grid">
            <div className="admin-field">
              <span className="admin-field-label">Destinations (countries this cycle admits study in)</span>
              {renderMultiSelect(taxonomies.destinations, destinations, setDestinations, 'destinations')}
            </div>
            <div className="admin-field">
              <span className="admin-field-label">Degree levels</span>
              {renderMultiSelect(taxonomies.degrees, levels, setLevels, 'degree levels')}
            </div>
            <label className="admin-field">
              <span>Field of study restriction</span>
              <select value={fieldMode} onChange={(event) => setFieldMode(event.target.value as FieldMode)}>
                <option value="unknown">Unknown</option>
                <option value="all">All fields</option>
                <option value="restricted">Restricted to specific fields</option>
              </select>
            </label>
            {fieldMode === 'restricted' ? (
              <div className="admin-field">
                <span className="admin-field-label">Fields</span>
                {renderMultiSelect(taxonomies.fields, fields, setFields, 'fields')}
              </div>
            ) : null}
            <label className="admin-field">
              <span>Applicant origin restriction</span>
              <select value={originMode} onChange={(event) => setOriginMode(event.target.value as OriginMode)}>
                <option value="unknown">Unknown</option>
                <option value="unrestricted">Open to all origins</option>
                <option value="restricted">Restricted to specific origins</option>
              </select>
            </label>
            {originMode === 'restricted' ? (
              <div className="admin-field">
                <span className="admin-field-label">Eligible origin countries</span>
                {renderMultiSelect(taxonomies.countries, origins, setOrigins, 'origin countries')}
              </div>
            ) : null}
            <label className="admin-field">
              <span>Programme / source names (comma-separated, optional)</span>
              <input type="text" value={programmeNames} onChange={(event) => setProgrammeNames(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Funding type (optional)</span>
              <select value={fundingType} onChange={(event) => setFundingType(event.target.value)}>
                <option value="">Not specified</option>
                {taxonomies.funding_types.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
              {prefill?.fundingMentions?.length ? <span className="admin-hint">Mentioned in source: {prefill.fundingMentions.join(', ')}</span> : null}
            </label>
          </div>
        </section>

        <section className="admin-form-section">
          <h3>Deadline (optional)</h3>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Deadline</span>
              <input type="datetime-local" value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} />
              {prefill?.deadlineMentions?.length ? <span className="admin-hint">Mentioned in source: {prefill.deadlineMentions.join(', ')}</span> : null}
            </label>
            {deadlineAt ? (
              <>
                <label className="admin-field">
                  <span>Precision</span>
                  <select value={deadlinePrecision} onChange={(event) => setDeadlinePrecision(event.target.value as DeadlinePrecision)}>
                    <option value="date">Date only</option>
                    <option value="datetime">Exact date and time</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span>Timezone (IANA, e.g. America/New_York)</span>
                  <input type="text" value={deadlineTimezone} onChange={(event) => setDeadlineTimezone(event.target.value)} />
                </label>
              </>
            ) : null}
          </div>
        </section>

        <label className="admin-field">
          <span>Eligibility note (optional)</span>
          <textarea value={eligibilityNote} onChange={(event) => setEligibilityNote(event.target.value)} rows={3} />
        </label>
      </PanelBody>
    </>
  )
}

type PublishCycleDrawerProps = Omit<PublishCycleFormProps, 'heading' | 'firstFieldRef' | 'onCancel'> & {
  scholarshipName: string
  onClose: () => void
}

/** Publishing on its own, for the "publish now" prompt after an approval -
 * there is no scholarship panel open in that flow to host the form. */
export function PublishCycleDrawer({ scholarshipName, onClose, ...formProps }: PublishCycleDrawerProps) {
  const providerCycleKeyRef = useRef<HTMLInputElement>(null)

  return (
    <Drawer title={`Publish a cycle for ${scholarshipName}`} wide initialFocusRef={providerCycleKeyRef} onClose={onClose}>
      <PublishCycleForm {...formProps} firstFieldRef={providerCycleKeyRef} onCancel={onClose} />
    </Drawer>
  )
}
