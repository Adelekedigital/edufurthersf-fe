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
  const date = formatDate(result.deadline_at)
  if (!date) return 'No fixed deadline'
  return result.deadline_precision === 'datetime' ? date : 'By ' + date
}

function formatStatus(status: Scholarship['status_detail']) {
  return status.replaceAll('_', ' ')
}

export function ScholarshipCard({ result, destinations, countries, degrees, fundingTypes }: { result: Scholarship; destinations: Option[]; countries: Option[]; degrees: Option[]; fundingTypes: Option[] }) {
  const destination = result.destinations.map((code) => label(destinations, code) ?? code).join(', ') || 'Destination unavailable'
  const providerCountry = label(countries, result.provider_country) ?? result.provider_country
  const degree = (result.degree_levels ?? []).map((code) => label(degrees, code) ?? code).join(', ') || 'Not specified'
  const funding = label(fundingTypes, result.funding_type) ?? result.funding_type ?? 'Not specified'
  const reopen = result.expected_reopen_month ? 'Likely reopens ' + monthNames[result.expected_reopen_month] : null

  return <article className="result-card">
    <div className={'result-top'}><span className={'status status-' + result.status_detail}>{formatStatus(result.status_detail)}</span><span className={'fit fit-' + result.fit}>{result.fit === 'confirmed' ? 'Matches your criteria' : 'Possible match'}</span></div>
    <h3>{result.name}</h3>
    <p className="provider">{result.provider}{providerCountry ? ' - ' + providerCountry : ''}</p>
    <div className="result-details">
      <div><span>Funding type</span><strong>{funding}</strong></div>
      <div><span>Degree</span><strong>{degree}</strong></div>
      <div><span>Study destination</span><strong>{destination}</strong></div>
      <div><span>Deadline</span><strong>{reopen ?? formatDeadline(result)}</strong></div>
    </div>
    <div className="result-footer"><span>Last verified: {formatDate(result.last_verified_at) ?? 'Not verified'}</span><a className="official-link" href={result.official_url} target="_blank" rel="noreferrer">View official scholarship <span aria-hidden="true">&#8594;</span></a></div>
    {result.eligibility_note && <p className="eligibility"><strong>Eligibility note:</strong> {result.eligibility_note}</p>}
  </article>
}
