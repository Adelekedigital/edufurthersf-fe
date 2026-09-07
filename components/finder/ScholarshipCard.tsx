import type { Option, Scholarship } from '../../app/types'

function formatDate(value: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) }

export function ScholarshipCard({ result, destinations, selectedDestination }: { result: Scholarship; destinations: Option[]; selectedDestination: string }) {
  const destination = destinations.find((item) => item.code === selectedDestination)?.label ?? selectedDestination
  return <article className="result-card"><div className="result-top"><span className={`status status-${result.status_detail}`}>{result.status_detail.replaceAll('_', ' ')}</span><span className={`fit fit-${result.fit}`}>{result.fit === 'confirmed' ? 'Matches your criteria' : 'Possible match'}</span></div><h3>{result.name}</h3><p className="provider">{result.provider}</p><div className="result-meta"><span>↳ {destination}</span><span>◷ Verified {formatDate(result.last_verified_at)}</span></div>{result.eligibility_note && <p className="eligibility"><strong>Eligibility note:</strong> {result.eligibility_note}</p>}<a className="official-link" href={result.official_url} target="_blank" rel="noreferrer">View official scholarship <span aria-hidden="true">↗</span></a></article>
}
