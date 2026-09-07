import { useState } from 'react'
import type { MatchProfile, Option, Scholarship } from '../../app/types'
import { ScholarshipDetailsModal } from './ScholarshipDetailsModal'

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
  const date = formatDate(result.deadline_at)
  if (!date) return 'No fixed deadline'
  return result.deadline_precision === 'datetime' ? date : 'By ' + date
}

function formatStatus(status: Scholarship['status_detail']) {
  return status.replaceAll('_', ' ')
}

export function ScholarshipCard({ result, destinations, countries, degrees, fundingTypes, matchProfile, searchId, detailsOpen: controlledDetailsOpen, onDetailsOpen, onDetailsClose }: { result: Scholarship; destinations: Option[]; countries: Option[]; degrees: Option[]; fundingTypes: Option[]; matchProfile: MatchProfile; searchId?: string; detailsOpen?: boolean; onDetailsOpen?: (identifier: string) => void; onDetailsClose?: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const destination = result.destinations.map((code) => label(destinations, code) ?? code).join(', ') || 'Destination unavailable'
  const providerCountry = label(countries, result.provider_country) ?? result.provider_country
  const degree = (result.degree_levels ?? []).map((code) => label(degrees, code) ?? code).join(', ') || 'Not specified'
  const funding = label(fundingTypes, result.funding_type) ?? result.funding_type ?? 'Not specified'
  const reopen = result.expected_reopen_month ? 'Likely reopens ' + monthNames[result.expected_reopen_month] : null
  const isDetailsOpen = controlledDetailsOpen ?? detailsOpen
  const openDetails = () => { onDetailsOpen ? onDetailsOpen(result.scholarship_id) : setDetailsOpen(true) }
  const closeDetails = () => { onDetailsClose ? onDetailsClose() : setDetailsOpen(false) }
  const eligibilityNote = typeof result.eligibility_note === 'string' && result.eligibility_note.trim() ? result.eligibility_note : 'Eligibility information is not available for this opportunity yet.'

  return <article className="result-card has-eligibility">
    <div className={'result-top'}><span className={'status status-' + result.status_detail}>{formatStatus(result.status_detail)}</span><span className={'fit fit-' + result.fit}>{result.fit === 'confirmed' ? 'Matches your criteria' : 'Possible match'}</span></div>
    <h3>{result.name}</h3>
    <p className="provider">{result.provider}{providerCountry ? ' - ' + providerCountry : ''}</p>
    <div className="result-details">
      <div><span>Funding type</span><strong>{funding}</strong></div>
      <div><span>Degree</span><strong>{degree}</strong></div>
      <div><span>Study destination</span><strong>{destination}</strong></div>
      <div><span>Deadline</span><strong>{reopen ?? formatDeadline(result)}</strong></div>
    </div>
    <p className="eligibility"><strong>Eligibility note:</strong> {eligibilityNote}</p>
    <div className="result-footer"><span>Last verified: {formatDate(result.last_verified_at) ?? 'Not verified'}</span><button className="official-link details-link" type="button" onClick={openDetails}>View details <span aria-hidden="true">&rarr;</span></button></div>
    {isDetailsOpen && <ScholarshipDetailsModal result={result} countries={countries} degrees={degrees} fundingTypes={fundingTypes} matchProfile={matchProfile} searchId={searchId} onClose={closeDetails} />}
  </article>
}
