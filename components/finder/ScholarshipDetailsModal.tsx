import { useEffect, useRef } from 'react'
import type { Option, Scholarship } from '../../app/types'

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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
  if (result.expected_reopen_month) return `Likely reopens ${monthNames[result.expected_reopen_month]}`
  const date = formatDate(result.deadline_at)
  return date ? (result.deadline_precision === 'datetime' ? date : `By ${date}`) : 'No fixed deadline'
}

export function ScholarshipDetailsModal({ result, countries, degrees, fundingTypes, onClose }: { result: Scholarship; countries: Option[]; degrees: Option[]; fundingTypes: Option[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isReopening = result.status_detail === 'likely_to_reopen' || result.status === 'expected_to_reopen'
  const destination = result.destinations.map((code) => label(countries, code) ?? code).join(', ') || 'Destination unavailable'
  const degree = (result.degree_levels ?? []).map((code) => label(degrees, code) ?? code).join(', ') || 'Not specified'
  const funding = label(fundingTypes, result.funding_type) ?? result.funding_type ?? 'Not specified'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])

  return <dialog className="details-modal" ref={dialogRef} aria-labelledby="details-modal-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="details-modal-inner">
      <header className="details-modal-header">
        <div><h2 id="details-modal-title">{result.name}</h2><p>{result.provider}{result.provider_country ? ` · ${label(countries, result.provider_country) ?? result.provider_country}` : ''}</p></div>
        <button className="modal-close" type="button" aria-label="Close scholarship details" onClick={onClose}>×</button>
      </header>
      {isReopening ? <>
        <section className="modal-preparation"><h3>How to prepare</h3><ul><li>Gather academic references and supporting documents.</li><li>Draft a focused research or study proposal.</li><li>Review the official provider requirements before the next cycle.</li></ul></section>
        <div className="modal-callout"><p>This programme is not currently accepting applications. Check the official source for the next confirmed opening date.</p><a className="modal-primary" href={result.official_url} target="_blank" rel="noreferrer">View official scholarship <span aria-hidden="true">→</span></a></div>
      </> : <>
        <dl className="modal-facts">
          <div><dt>Field</dt><dd>{result.field_names?.join(', ') || 'Not specified'}</dd></div>
          <div><dt>Funding</dt><dd>{funding}</dd></div>
          <div><dt>Study destination</dt><dd>{destination}</dd></div>
          <div><dt>Degree</dt><dd>{degree}</dd></div>
          <div><dt>Eligibility</dt><dd>{result.eligibility_note || 'Review the official provider requirements.'}</dd></div>
          <div><dt>Deadline</dt><dd>{formatDeadline(result)}</dd></div>
        </dl>
        <div className="modal-callout"><p>Review the official source for the complete eligibility criteria, required documents and application instructions.</p><a className="modal-primary" href={result.official_url} target="_blank" rel="noreferrer">Go to official application <span aria-hidden="true">→</span></a></div>
      </>}
    </div>
  </dialog>
}
