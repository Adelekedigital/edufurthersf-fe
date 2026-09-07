'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cacheSearchResponse, getSavedSearch, getTaxonomies, searchScholarships } from './api'
import type { ApiError, Option, Scholarship, SearchInput, Taxonomies } from './types'
import { SiteFooter } from '../components/shell/SiteFooter'
import { SiteHeader } from '../components/shell/SiteHeader'
import { FinderStepper } from '../components/finder/FinderStepper'
import { ScholarshipCard } from '../components/finder/ScholarshipCard'
import { CountryCombobox } from '../components/finder/CountryCombobox'
import { PrimaryButton } from '../components/ui/PrimaryButton'
import { NewsletterSignup } from '../components/finder/NewsletterSignup'

type FormState = { origin: string; destinations: string[]; field: string; degree: string }
const emptyForm: FormState = { origin: '', destinations: [], field: '', degree: '' }
const label = (options: Option[], code: string) => options.find((item) => item.code === code)?.label ?? code
const searchProfileKey = (searchId: string) => 'edufurther:search-profile:' + searchId

function readSearchProfile(searchId: string) {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(window.sessionStorage.getItem(searchProfileKey(searchId)) ?? 'null') as SearchInput | null } catch { return null }
}

function writeSearchProfile(searchId: string, input: SearchInput) {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(searchProfileKey(searchId), JSON.stringify({ ...input, cursor: undefined })) } catch { /* Storage may be unavailable. */ }
}

export function Finder({ searchId, selectedScholarshipId }: { searchId?: string; selectedScholarshipId?: string }) {
  const router = useRouter()
  const modalOpenedFromResults = useRef(false)
  const restoredSearch = useRef<string | null>(null)
  const [activeSearchId, setActiveSearchId] = useState(searchId ?? '')
  const [taxonomies, setTaxonomies] = useState<Taxonomies | null>(null)
  const [taxonomyError, setTaxonomyError] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [results, setResults] = useState<Scholarship[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [validation, setValidation] = useState<Record<string, string>>({})
  const [showOtherDestination, setShowOtherDestination] = useState(false)
  const [otherDestinations, setOtherDestinations] = useState<string[]>([])

  useEffect(() => { getTaxonomies().then(setTaxonomies).catch(() => setTaxonomyError(true)) }, [])
  useEffect(() => {
    if (!searchId || restoredSearch.current === searchId) return
    restoredSearch.current = searchId
    setActiveSearchId(searchId)
    getSavedSearch(searchId).then((response) => {
      const filters = response.filters ?? readSearchProfile(searchId)
      if (filters) setForm({ origin: filters.origin_country, destinations: filters.target_countries, field: filters.field ?? '', degree: filters.program_level })
      setResults(response.data)
      setNextCursor(response.next_cursor)
      setWarnings(response.meta.warnings ?? [])
      setSearched(true)
    }).catch((caught) => { setSearched(true); setError(caught as ApiError) })
  }, [searchId])

  const selectedLabels = useMemo(() => form.destinations.map((code) => label(taxonomies?.destinations ?? [], code)), [form.destinations, taxonomies])
  const update = (key: keyof FormState, value: string | string[]) => setForm((current) => ({ ...current, [key]: value }))
  const toggle = (code: string) => update('destinations', form.destinations.includes(code) ? form.destinations.filter((item) => item !== code) : [...form.destinations, code])
  const toggleOtherDestination = () => { const checked = !showOtherDestination; setShowOtherDestination(checked); if (!checked) setOtherDestinations([]) }

  async function submit(event: FormEvent, cursor?: string) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!form.origin) next.origin = 'Select your country of origin.'
    const targetCountries = Array.from(new Set([...form.destinations, ...(showOtherDestination ? otherDestinations : [])]))
    if (!targetCountries.length) next.destinations = 'Select at least one destination.'
    if (!form.degree) next.degree = 'Select what you are applying for.'
    setValidation(next)
    if (Object.keys(next).length) return
    setLoading(true); setError(null)
    const input: SearchInput = { origin_country: form.origin, program_level: form.degree, target_countries: targetCountries, limit: 20, ...(form.field ? { field: form.field } : {}), ...(cursor ? { cursor } : {}) }
    try {
      const response = await searchScholarships(input)
      const returnedSearchId = response.meta.search_id ?? activeSearchId
      if (!cursor && returnedSearchId) { cacheSearchResponse(returnedSearchId, response); writeSearchProfile(returnedSearchId, input); setActiveSearchId(returnedSearchId); router.push('/search/' + encodeURIComponent(returnedSearchId)) }
      setResults((current) => cursor ? [...current, ...response.data] : response.data)
      setNextCursor(response.next_cursor); setWarnings(response.meta.warnings ?? []); setSearched(true)
    } catch (caught) { setError(caught as ApiError) } finally { setLoading(false) }
  }

  const openDetails = (identifier: string) => { if (!activeSearchId) return; modalOpenedFromResults.current = true; router.push('/search/' + encodeURIComponent(activeSearchId) + '?scholarship=' + encodeURIComponent(identifier)) }
  const closeDetails = () => { if (modalOpenedFromResults.current) { modalOpenedFromResults.current = false; router.back() } else if (activeSearchId) router.replace('/search/' + encodeURIComponent(activeSearchId)) }
  const refineSearch = () => { if (searchId || activeSearchId) router.replace('/'); else setSearched(false) }

  return <div className="finder-app"><SiteHeader /><section className="finder-hero"><h1>Let&apos;s find scholarships that fit you.</h1><p>Get a shortlist of verified funding opportunities for your Master&apos;s or PhD&mdash;without spending hours chasing outdated links.</p><div className="hero-points"><span>&#10003;&nbsp; No sign up required</span><span>&#10003;&nbsp; Free to use</span></div></section><FinderStepper step={searched ? 2 : 1} /><main className="finder-main">
    {!searched && <section className="form-panel" aria-labelledby="form-heading"><form onSubmit={submit} noValidate>
      <label className="form-question">Where are you from? {taxonomies && <CountryCombobox options={taxonomies.countries} value={form.origin} onChange={(code) => update('origin', code)} ariaLabel="Search for your country of origin" ariaInvalid={!!validation.origin} />}<small>Helps us identify scholarships you&apos;re eligible to apply for</small>{validation.origin && <em className="error-text">{validation.origin}</em>}</label>
      <fieldset className="destination-control"><legend>Where do you want to study?</legend><div className="option-grid">{taxonomies?.destinations.map((item) => <label className={`option-chip ${form.destinations.includes(item.code) ? 'selected' : ''}`} key={item.code}><input type="checkbox" checked={form.destinations.includes(item.code)} onChange={() => toggle(item.code)} />{item.label}</label>)}<label className={`option-chip ${!!taxonomies?.destinations.length && form.destinations.length === taxonomies.destinations.length ? 'selected' : ''}`}><input type="checkbox" checked={!!taxonomies?.destinations.length && form.destinations.length === taxonomies.destinations.length} onChange={(event) => update('destinations', event.target.checked ? (taxonomies?.destinations.map((item) => item.code) ?? []) : [])} />I&apos;m open to any of these</label><div className={`option-chip ${showOtherDestination ? 'selected' : ''}`} role="checkbox" aria-checked={showOtherDestination} tabIndex={0} onPointerDown={(event) => { event.preventDefault(); toggleOtherDestination() }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleOtherDestination() } }}>Somewhere else</div></div>{showOtherDestination && taxonomies && <><div className="country-selections" aria-label="Selected alternate destination countries">{otherDestinations.map((code) => <span className="country-selection" key={code}>{label(taxonomies.countries, code)}<button type="button" aria-label={'Remove ' + label(taxonomies.countries, code)} onClick={() => setOtherDestinations((current) => current.filter((item) => item !== code))}>&times;</button></span>)}</div><CountryCombobox options={taxonomies.countries} value="" ariaLabel="Search for another destination country" clearOnSelect clearValueOnSearch={false} excludeCodes={otherDestinations} onChange={(code) => setOtherDestinations((current) => current.includes(code) ? current : [...current, code])} /></>}{validation.destinations && <em className="error-text">{validation.destinations}</em>}</fieldset>
      <label className="form-question">What do you want to study? <select value={form.field} onChange={(e) => update('field', e.target.value)}><option value="">Select your field of study</option>{taxonomies?.fields.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}</select></label>
      <fieldset className="choice-control"><legend>What is your highest level of qualification?</legend><div className="option-grid"><label className="option-chip"><input type="radio" name="qualification" />HND</label><label className="option-chip"><input type="radio" name="qualification" />Bachelor&apos;s degree (BSc)</label><label className="option-chip"><input type="radio" name="qualification" />Master&apos;s degree (MSc)</label><label className="option-chip"><input type="radio" name="qualification" />Doctoral program (PhD)</label></div></fieldset>
      <fieldset className="choice-control"><legend>What are you applying for?</legend><div className="option-grid">{taxonomies?.degrees.map((item) => <label className={`option-chip ${form.degree === item.code ? 'selected' : ''}`} key={item.code}><input type="radio" name="degree" value={item.code} checked={form.degree === item.code} onChange={() => update('degree', item.code)} />{item.code === 'masters' ? "Master's degree (MSc)" : 'Doctoral program (PhD)'}</label>)}</div>{validation.degree && <em className="error-text">{validation.degree}</em>}</fieldset>
      {(!taxonomies || taxonomyError) && <div className={`form-alert ${taxonomyError ? 'is-error' : ''}`} role={taxonomyError ? 'alert' : undefined}>{taxonomyError ? 'We couldn&apos;t load the search options. Refresh to try again.' : 'Loading search options&hellip;'}</div>}{error && !searched && <div className="form-alert is-error" role="alert">{error.retryAfter ? `Search is busy. Try again in ${error.retryAfter} seconds.` : error.message}</div>}<PrimaryButton type="submit" disabled={loading}>{loading ? 'Searching&hellip;' : 'Find my scholarships'}</PrimaryButton>
    </form></section>}
    {searched && <section className="results-panel" aria-live="polite"><div className="results-toolbar"><div><p className="form-kicker">Your matches</p><h2>{results.length ? 'Scholarships that fit you' : 'We couldn&apos;t find a match yet'}</h2><p>{results.length ? 'Review each opportunity carefully on the official provider website.' : 'Try changing a destination or leaving your field of study open.'}</p></div><button className="outline-button" type="button" onClick={refineSearch}>Refine my search</button></div>{error && <div className="form-alert is-error" role="alert">{error.retryAfter ? `Search is busy. Try again in ${error.retryAfter} seconds.` : error.message}</div>}{warnings.map((warning) => <div className="form-alert warning" key={warning}>We don&apos;t have verified coverage for {warning.replace('no_verified_coverage:', '').split(',').join(' and ')} yet.</div>)}{results.length > 0 && <div className="result-list">{results.map((result) => <ScholarshipCard key={`${result.scholarship_id}-${result.cycle_id}`} result={result} destinations={taxonomies?.destinations ?? []} countries={taxonomies?.countries ?? []} degrees={taxonomies?.degrees ?? []} fundingTypes={taxonomies?.funding_types ?? []} matchProfile={{ origin_country: form.origin, program_level: form.degree, ...(form.field ? { field: form.field } : {}) }} searchId={activeSearchId || undefined} detailsOpen={selectedScholarshipId ? selectedScholarshipId === result.scholarship_id : undefined} onDetailsOpen={activeSearchId ? openDetails : undefined} onDetailsClose={activeSearchId ? closeDetails : undefined} />)}</div>}{nextCursor && <button className="load-more" type="button" onClick={(event) => submit(event, nextCursor)} disabled={loading}>{loading ? 'Loading&hellip;' : 'Load more scholarships'}</button>}<NewsletterSignup /></section>}
  </main><SiteFooter /></div>
}