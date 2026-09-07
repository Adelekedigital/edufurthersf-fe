import { useEffect, useRef, useState } from 'react'
import { getMatchExplanation, getScholarshipDetail } from '../../app/api'
import type { MatchProfile, Option, Scholarship, ScholarshipDetail } from '../../app/types'
import { NewsletterSignup } from './NewsletterSignup'

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const modalCachePrefix = 'edufurther:modal:'

function label(options: Option[], code: string | null | undefined) {
  if (!code) return null
  return options.find((item) => item.code === code)?.label ?? code
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return null
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatDeadline(result: Scholarship) {
  if (result.expected_reopen_month) return 'Likely reopens ' + monthNames[result.expected_reopen_month]
  const date = formatDate(result.deadline_at)
  return date ? (result.deadline_precision === 'datetime' ? date : 'By ' + date) : 'No fixed deadline'
}

type ModalCache = { detail: ScholarshipDetail; matchExplanation: string | null; explanationUnavailable: boolean }

function readModalCache(searchId: string | undefined, scholarshipId: string) {
  if (!searchId || typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.sessionStorage.getItem(modalCachePrefix + searchId + ':' + scholarshipId) ?? 'null') as ModalCache | null
    return value?.detail ? value : null
  } catch {
    return null
  }
}

function writeModalCache(searchId: string | undefined, scholarshipId: string, value: ModalCache) {
  if (!searchId || typeof window === 'undefined') return
  try { window.sessionStorage.setItem(modalCachePrefix + searchId + ':' + scholarshipId, JSON.stringify(value)) } catch { /* Storage may be unavailable. */ }
}

export function ScholarshipDetailsModal({ result, countries, degrees, fundingTypes, matchProfile, searchId, onClose }: { result: Scholarship; countries: Option[]; degrees: Option[]; fundingTypes: Option[]; matchProfile: MatchProfile; searchId?: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [detail, setDetail] = useState<ScholarshipDetail | null>(null)
  const [matchExplanation, setMatchExplanation] = useState<string | null>(null)
  const [explanationLoading, setExplanationLoading] = useState(true)
  const [explanationUnavailable, setExplanationUnavailable] = useState(false)
  const displayed = detail ?? result
  const isReopening = displayed.status_detail === 'likely_to_reopen' || displayed.status === 'expected_to_reopen'
  const destination = displayed.destinations.map((code) => label(countries, code) ?? code).join(', ') || 'Destination unavailable'
  const degree = (displayed.degree_levels ?? []).map((code) => label(degrees, code) ?? code).join(', ') || 'Not specified'
  const funding = label(fundingTypes, displayed.funding_type) ?? displayed.funding_type ?? 'Not specified'
  const eligibilityNote = typeof displayed.eligibility_note === 'string' && displayed.eligibility_note.trim() ? displayed.eligibility_note : 'Eligibility information is not available for this opportunity yet.'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])

  useEffect(() => {
    let active = true
    const cached = readModalCache(searchId, result.scholarship_id)
    if (cached) {
      queueMicrotask(() => {
        if (!active) return
        setDetail(cached.detail)
        setMatchExplanation(cached.matchExplanation)
        setExplanationUnavailable(cached.explanationUnavailable)
        setExplanationLoading(false)
      })
      return () => { active = false }
    }
    Promise.allSettled([getScholarshipDetail(result.scholarship_id), getMatchExplanation(result.scholarship_id, matchProfile)]).then(([detailResponse, explanationResponse]) => {
      if (!active) return
      const nextDetail = detailResponse.status === 'fulfilled' ? detailResponse.value : result
      const nextExplanation = explanationResponse.status === 'fulfilled' ? explanationResponse.value.match_explanation ?? null : null
      const nextUnavailable = explanationResponse.status === 'rejected'
      setDetail(detailResponse.status === 'fulfilled' ? detailResponse.value : null)
      setMatchExplanation(nextExplanation)
      setExplanationUnavailable(nextUnavailable)
      setExplanationLoading(false)
      writeModalCache(searchId, result.scholarship_id, { detail: nextDetail, matchExplanation: nextExplanation, explanationUnavailable: nextUnavailable })
    })
    return () => { active = false }
  // Depend on stable profile fields and the search key so rerenders do not refetch the same modal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchProfile.field, matchProfile.origin_country, matchProfile.program_level, result.scholarship_id, searchId])

  return <dialog className="details-modal" ref={dialogRef} aria-labelledby="details-modal-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="details-modal-inner">
      <header className="details-modal-header">
        <div><h2 id="details-modal-title">{displayed.name}</h2><p>{displayed.provider}{displayed.provider_country ? ' &middot; ' + (label(countries, displayed.provider_country) ?? displayed.provider_country) : ''}</p></div>
        <button className="modal-close" type="button" aria-label="Close scholarship details" onClick={onClose}>&times;</button>
      </header>
      {isReopening ? <>
        <section className="modal-preparation"><h3>How to prepare</h3><ul><li>Gather academic references and supporting documents.</li><li>Draft a focused research or study proposal.</li><li>Review the official provider requirements before the next cycle.</li></ul></section>
        <NewsletterSignup compact />
        <div className="modal-callout"><p>This programme is not currently accepting applications. Check the official source for the next confirmed opening date.</p><a className="modal-primary" href={displayed.official_url} target="_blank" rel="noreferrer">View official scholarship <span aria-hidden="true">&rarr;</span></a></div>
      </> : <>
        <dl className="modal-facts">
          <div><dt>Field</dt><dd>{displayed.field_names?.join(', ') || 'Not specified'}</dd></div>
          <div><dt>Funding</dt><dd>{funding}</dd></div>
          <div><dt>Study destination</dt><dd>{destination}</dd></div>
          <div><dt>Degree</dt><dd>{degree}</dd></div>
          <div><dt>Deadline</dt><dd>{formatDeadline(displayed)}</dd></div>
        </dl>
        <section className="modal-explanation" aria-live="polite"><h3>Why this may fit</h3>{explanationLoading ? <p>Checking this opportunity against your answers...</p> : matchExplanation ? <p>{matchExplanation}</p> : <p>{explanationUnavailable ? 'Personalized guidance is unavailable right now.' : 'Personalized guidance is not available for this opportunity yet.'}</p>}</section>
        <section className="modal-eligibility"><h3>Eligibility note</h3><p>{eligibilityNote}</p>{displayed.caveats?.map((caveat) => <p key={caveat}>{caveat}</p>)}</section>
        <div className="modal-callout"><p>Review the official source for the complete eligibility criteria, required documents and application instructions.</p><a className="modal-primary" href={displayed.official_url} target="_blank" rel="noreferrer">Go to official application <span aria-hidden="true">&rarr;</span></a></div>
      </>}
    </div>
  </dialog>
}