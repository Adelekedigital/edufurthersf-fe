import type { Option, Scholarship } from '../../app/types'

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not verified'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return 'Not verified'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function ScholarshipCard({ result, destinations }: { result: Scholarship; destinations: Option[] }) {
  const destination = (result.destinations ?? []).map((code) => destinations.find((item) => item.code === code)?.label ?? code).join(', ') || 'Destination unavailable'
  return <article className="result-card"><div className="result-top"><span className={`status status-${result.status_detail}`}>{result.status_detail.replaceAll('_', ' ')}</span><span className={`fit fit-${result.fit}`}>{result.fit === 'confirmed' ? 'Matches your criteria' : 'Possible match'}</span></div><h3>{result.name}</h3><p className="provider">{result.provider}</p><div className="result-meta"><span>Study destination: {destination}</span><span>Last verified: {formatDate(result.last_verified_at)}</span></div>{result.eligibility_note && <p className="eligibility"><strong>Eligibility note:</strong> {result.eligibility_note}</p>}<a className="official-link" href={result.official_url} target="_blank" rel="noreferrer">View official scholarship <span aria-hidden="true">→</span></a></article>
}