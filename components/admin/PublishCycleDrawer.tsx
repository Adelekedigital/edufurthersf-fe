'use client'

import { useRef, useState, type Ref } from 'react'
import { publishCycle } from '../../app/admin/api'
import { Drawer, PanelActions, PanelBody } from './Drawer'
import type { AdminApiError, DeadlinePrecision, FieldMode, OriginMode, PublicStatusValue, PublishPrefill, ScholarshipCycleAdminRead } from '../../app/admin/types'
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
export function PublishCycleForm({ scholarshipId, officialHomeUrl, taxonomies, prefill, seedFrom, heading, firstFieldRef, onCancel, onPublished }: PublishCycleFormProps) {
  const facts: Record<string, unknown> = seedFrom?.facts ?? {}

  const [providerCycleKey, setProviderCycleKey] = useState(() => seedString(seedFrom?.provider_cycle_key))
  const [applicantSegment, setApplicantSegment] = useState(() => seedString(seedFrom?.applicant_segment, 'default'))
  const [officialCycleUrl, setOfficialCycleUrl] = useState(() => seedString(seedFrom?.official_cycle_url, officialHomeUrl ?? ''))
  const [publicStatus, setPublicStatus] = useState<PublicStatusValue | ''>(() => (seedFrom?.public_status ?? '') as PublicStatusValue | '')
  const [statusValidUntil, setStatusValidUntil] = useState(() => toDateTimeInput(seedFrom?.status_valid_until))
  // Not seeded: "last verified" and "evidence is current" are claims that
  // someone checked the source today. Copying last cycle's values forward
  // would assert verification work that has not happened.
  const [lastVerifiedAt, setLastVerifiedAt] = useState('')
  const [destinations, setDestinations] = useState<string[]>(() => seedCodes(facts.destinations, taxonomies.destinations))
  // The extractor emits level_mentions from its own keyword list, which does
  // not always intersect the degree taxonomy - "bachelors" is a real possible
  // mention but is not a published degree code. Keeping an unmatched code
  // would leave the select visually empty while still passing the
  // "levels.length" submit check, so it would fail as a 422 on publish.
  const [levels, setLevels] = useState<string[]>(() => (
    seedFrom ? seedCodes(facts.levels, taxonomies.degrees) : seedCodes(prefill?.levels, taxonomies.degrees)
  ))
  const [originMode, setOriginMode] = useState<OriginMode>(() => (facts.origin_mode as OriginMode) ?? 'unknown')
  const [origins, setOrigins] = useState<string[]>(() => seedCodes(facts.origins, taxonomies.countries))
  const [fieldMode, setFieldMode] = useState<FieldMode>(() => (facts.field_mode as FieldMode) ?? 'unknown')
  const [fields, setFields] = useState<string[]>(() => seedCodes(facts.fields, taxonomies.fields))
  const [programmeNames, setProgrammeNames] = useState(() => (
    Array.isArray(facts.programme_names) ? facts.programme_names.filter((item): item is string => typeof item === 'string').join(', ') : ''
  ))
  const [evidenceFresh, setEvidenceFresh] = useState(false)
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

  // The key is carried over so the reviewer can see what the last cycle was
  // called and edit from it, but it has to change: the backend rejects a
  // duplicate key with a 409. Blocking here turns that into a message next to
  // the field instead of a failed request after the form is filled in.
  const duplicateCycleKey = Boolean(seedFrom && providerCycleKey.trim() === seedFrom.provider_cycle_key)

  const canSubmit = Boolean(
    providerCycleKey.trim() && !duplicateCycleKey && officialCycleUrl.trim() && publicStatus && destinations.length && levels.length &&
    (originMode !== 'restricted' || origins.length) && (fieldMode !== 'restricted' || fields.length)
  )

  const submit = async () => {
    if (!canSubmit || submitting || !publicStatus) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await publishCycle(scholarshipId, {
        provider_cycle_key: providerCycleKey.trim(),
        applicant_segment: applicantSegment.trim() || 'default',
        official_cycle_url: officialCycleUrl.trim(),
        public_status: publicStatus,
        status_valid_until: toIsoOrUndefined(statusValidUntil),
        last_verified_at: toIsoOrUndefined(lastVerifiedAt),
        destinations,
        levels,
        origin_mode: originMode,
        origins: originMode === 'restricted' ? origins : [],
        field_mode: fieldMode,
        fields: fieldMode === 'restricted' ? fields : [],
        programme_names: programmeNames.split(',').map((item) => item.trim()).filter(Boolean),
        evidence_fresh: evidenceFresh,
        deadline_at: toIsoOrUndefined(deadlineAt),
        deadline_precision: deadlinePrecision,
        deadline_timezone: deadlineTimezone.trim() || undefined,
        eligibility_note: eligibilityNote.trim() || undefined,
        expected_reopen_month: expectedReopenMonth ? Number(expectedReopenMonth) : undefined,
        funding_type: fundingType || undefined,
      })
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
          {submitting ? 'Publishing…' : 'Publish'}
        </button>
      </PanelActions>

      <PanelBody>
        {heading ? <h3 className="admin-panel-heading">{heading}</h3> : null}

        {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}

        {seedFrom ? (
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
