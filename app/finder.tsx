'use client'

/* eslint-disable react/no-unescaped-entities */
import { FormEvent, useEffect, useRef, useState } from 'react'
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

type FormState = { origin: string; destinations: string[]; field: string; degree: string; qualification: string }
type ViewState = 'form' | 'searching' | 'results' | 'error'
type FinderDraft = FormState & { otherDestinations: string[]; showOtherDestination: boolean }
const emptyForm: FormState = { origin: '', destinations: [], field: '', degree: '', qualification: '' }
const label = (options: Option[], code: string) => options.find((item) => item.code === code)?.label ?? code
const searchProfileKey = (searchId: string) => 'edufurther:search-profile:' + searchId
const qualificationKey = (searchId: string) => 'edufurther:qualification:' + searchId
const pendingDraftKey = 'edufurther:pending-refine-draft'

function readSessionJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(window.sessionStorage.getItem(key) ?? 'null') as T | null } catch { return null }
}
function writeSessionJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage may be unavailable. */ }
}
function removeSessionItem(key: string) {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(key) } catch { /* Storage may be unavailable. */ }
}
const readSearchProfile = (searchId: string) => readSessionJSON<SearchInput>(searchProfileKey(searchId))
const writeSearchProfile = (searchId: string, input: SearchInput) => writeSessionJSON(searchProfileKey(searchId), { ...input, cursor: undefined })
// Qualification isn't part of the backend's SearchInput contract, so it can't ride along with the
// search profile above; it needs its own per-search cache to survive the '/' -> '/search/{id}' remount.
const readQualification = (searchId: string) => readSessionJSON<string>(qualificationKey(searchId)) ?? ''
const writeQualification = (searchId: string, value: string) => writeSessionJSON(qualificationKey(searchId), value)
const readPendingDraft = () => readSessionJSON<FinderDraft>(pendingDraftKey)
const writePendingDraft = (draft: FinderDraft) => writeSessionJSON(pendingDraftKey, draft)
const clearPendingDraft = () => removeSessionItem(pendingDraftKey)
function splitDestinations(taxonomies: Taxonomies, targetCountries: string[]) {
  const taxonomyCodes = new Set(taxonomies.destinations.map((item) => item.code))
  return {
    destinations: targetCountries.filter((code) => taxonomyCodes.has(code)),
    otherDestinations: targetCountries.filter((code) => !taxonomyCodes.has(code)),
  }
}

export function Finder({ searchId, selectedScholarshipId }: { searchId?: string; selectedScholarshipId?: string }) {
  const router = useRouter()
  const requestId = useRef(0)
  const lastSubmittedInput = useRef<SearchInput | null>(null)
  const modalOpenedFromResults = useRef(false)
  const pendingNavigationRef = useRef<string | null>(null)
  const [navigationTick, setNavigationTick] = useState(0)
  const [initialDraft] = useState<FinderDraft | null>(() => searchId ? null : readPendingDraft())
  const initialForm = initialDraft ? { origin: initialDraft.origin ?? '', destinations: initialDraft.destinations ?? [], field: initialDraft.field ?? '', degree: initialDraft.degree ?? '', qualification: initialDraft.qualification ?? '' } : emptyForm
  const [activeSearchId, setActiveSearchId] = useState(searchId ?? '')
  const [taxonomies, setTaxonomies] = useState<Taxonomies | null>(null)
  const [taxonomyError, setTaxonomyError] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [results, setResults] = useState<Scholarship[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [view, setView] = useState<ViewState>(searchId ? 'searching' : 'form')
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [validation, setValidation] = useState<Record<string, string>>({})
  const [showOtherDestination, setShowOtherDestination] = useState(initialDraft?.showOtherDestination ?? Boolean(initialDraft?.otherDestinations?.length))
  const [otherDestinations, setOtherDestinations] = useState<string[]>(initialDraft?.otherDestinations ?? [])
  const [pendingModalId, setPendingModalId] = useState<string | null>(selectedScholarshipId ?? null)

  useEffect(() => { getTaxonomies().then(setTaxonomies).catch(() => setTaxonomyError(true)) }, [])
  useEffect(() => {
    if (initialDraft) clearPendingDraft()
  }, [initialDraft])
  useEffect(() => {
    if (!searchId || !taxonomies) return
    const thisRequest = ++requestId.current
    getSavedSearch(searchId).then((response) => {
      if (thisRequest !== requestId.current) return
      const filters = response.filters ?? readSearchProfile(searchId)
      if (filters) {
        const split = splitDestinations(taxonomies, filters.target_countries)
        setForm({ origin: filters.origin_country, destinations: split.destinations, field: filters.field ?? '', degree: filters.program_level, qualification: readQualification(searchId) })
        setOtherDestinations(split.otherDestinations)
        setShowOtherDestination(split.otherDestinations.length > 0)
        lastSubmittedInput.current = filters
        writeSearchProfile(searchId, filters)
      }
      setActiveSearchId(searchId)
      setResults(response.data)
      setNextCursor(response.next_cursor)
      setWarnings(response.meta.warnings ?? [])
      setError(null)
      setView('results')
    }).catch((caught) => {
      if (thisRequest === requestId.current) { setError(caught as ApiError); setView('error') }
    })
    return () => { requestId.current += 1 }
  }, [searchId, taxonomies])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs local modal state to the URL-derived prop (browser back/forward, deep links).
    setPendingModalId(selectedScholarshipId ?? null)
  }, [searchId, selectedScholarshipId])
  useEffect(() => {
    if (!pendingNavigationRef.current) return
    const target = pendingNavigationRef.current
    pendingNavigationRef.current = null
    router.push(target)
  }, [navigationTick, router])

  const update = (key: keyof FormState, value: string | string[]) => setForm((current) => ({ ...current, [key]: value }))
  const toggleDestination = (code: string) => update('destinations', form.destinations.includes(code) ? form.destinations.filter((item) => item !== code) : [...form.destinations, code])
  // A country checked as a primary destination shouldn't also show as a "Somewhere else" chip; derive the
  // visible list instead of mutating otherDestinations so unchecking the primary destination restores it.
  const visibleOtherDestinations = otherDestinations.filter((code) => !form.destinations.includes(code))
  const toggleOtherDestination = () => { const next = !showOtherDestination; setShowOtherDestination(next); if (!next) setOtherDestinations([]) }

  async function submit(event: FormEvent, cursor?: string) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!form.origin) next.origin = 'Select your country of origin.'
    const targetCountries = Array.from(new Set([...form.destinations, ...(showOtherDestination ? otherDestinations : [])]))
    if (!targetCountries.length) next.destinations = 'Select at least one destination.'
    if (!form.degree) next.degree = 'Select what you are applying for.'
    setValidation(next)
    if (Object.keys(next).length) return
    const input: SearchInput = { origin_country: form.origin, program_level: form.degree, target_countries: targetCountries, limit: 20, ...(form.field ? { field: form.field } : {}), ...(cursor ? { cursor } : {}) }
    const thisRequest = ++requestId.current
    lastSubmittedInput.current = input
    setError(null)
    if (cursor) setLoadingMore(true)
    else { setView('searching'); setResults([]); setNextCursor(null); setWarnings([]); setPendingModalId(null) }
    try {
      const response = await searchScholarships(input)
      if (thisRequest !== requestId.current) return
      const returnedSearchId = response.meta.search_id ?? activeSearchId
      if (!cursor && returnedSearchId) {
        cacheSearchResponse(returnedSearchId, response)
        writeSearchProfile(returnedSearchId, input)
        writeQualification(returnedSearchId, form.qualification)
        setActiveSearchId(returnedSearchId)
        router.push('/search/' + encodeURIComponent(returnedSearchId))
        return
      }
      setResults((current) => cursor ? [...current, ...response.data] : response.data)
      setNextCursor(response.next_cursor)
      setWarnings(response.meta.warnings ?? [])
      setView('results')
    } catch (caught) {
      if (thisRequest === requestId.current) { setError(caught as ApiError); setView(cursor ? 'results' : 'form') }
    } finally {
      if (thisRequest === requestId.current) setLoadingMore(false)
    }
  }

  const openDetails = (identifier: string) => {
    if (!activeSearchId) return
    setPendingModalId(identifier)
    modalOpenedFromResults.current = true
    // Defer the URL sync to the next commit (via the effect above) so the modal has already
    // rendered from local state before the route changes, instead of racing a bare timer.
    pendingNavigationRef.current = '/search/' + encodeURIComponent(activeSearchId) + '?scholarship=' + encodeURIComponent(identifier)
    setNavigationTick((tick) => tick + 1)
  }
  const closeDetails = () => {
    setPendingModalId(null)
    if (modalOpenedFromResults.current) { modalOpenedFromResults.current = false; router.back() }
    else if (activeSearchId) router.replace('/search/' + encodeURIComponent(activeSearchId))
  }
  const refineSearch = () => {
    const fallback = activeSearchId ? readSearchProfile(activeSearchId) : null
    const input = lastSubmittedInput.current ?? fallback
    const targetCountries = Array.from(new Set([...form.destinations, ...(showOtherDestination ? otherDestinations : [])]))
    const split = taxonomies ? splitDestinations(taxonomies, targetCountries) : { destinations: targetCountries, otherDestinations: [] }
    writePendingDraft({ origin: form.origin || input?.origin_country || '', field: form.field || input?.field || '', degree: form.degree || input?.program_level || '', qualification: form.qualification, destinations: split.destinations, otherDestinations: split.otherDestinations, showOtherDestination: showOtherDestination || split.otherDestinations.length > 0 })
    requestId.current += 1
    setPendingModalId(null); setResults([]); setNextCursor(null); setWarnings([]); setError(null); setActiveSearchId(''); setView('form')
    router.replace('/')
  }

  const formPanel = <section className="form-panel" aria-labelledby="form-heading"><form onSubmit={submit} noValidate>
    <label className="form-question">Where are you from? {taxonomies && <CountryCombobox options={taxonomies.countries} value={form.origin} onChange={(code) => update('origin', code)} ariaLabel="Search for your country of origin" ariaInvalid={!!validation.origin} />}<small>Helps us identify scholarships you're eligible to apply for</small>{validation.origin && <em className="error-text">{validation.origin}</em>}</label>
    <fieldset className="destination-control"><legend>Where do you want to study?</legend><div className="option-grid">{taxonomies?.destinations.map((item) => <label className={`option-chip ${form.destinations.includes(item.code) ? 'selected' : ''}`} key={item.code}><input type="checkbox" checked={form.destinations.includes(item.code)} onChange={() => toggleDestination(item.code)} />{item.label}</label>)}<label className={`option-chip ${!!taxonomies?.destinations.length && form.destinations.length === taxonomies.destinations.length ? 'selected' : ''}`}><input type="checkbox" checked={!!taxonomies?.destinations.length && form.destinations.length === taxonomies.destinations.length} onChange={(event) => update('destinations', event.target.checked ? (taxonomies?.destinations.map((item) => item.code) ?? []) : [])} />I'm open to any of these</label><div className={`option-chip ${showOtherDestination ? 'selected' : ''}`} role="checkbox" aria-checked={showOtherDestination} tabIndex={0} onPointerDown={(event) => { event.preventDefault(); toggleOtherDestination() }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleOtherDestination() } }}>Somewhere else</div></div>{showOtherDestination && taxonomies && <><div className="country-selections" aria-label="Selected alternate destination countries">{visibleOtherDestinations.map((code) => <span className="country-selection" key={code}>{label(taxonomies.countries, code)}<button type="button" aria-label={'Remove ' + label(taxonomies.countries, code)} onClick={() => setOtherDestinations((current) => current.filter((item) => item !== code))}>{'\u00d7'}</button></span>)}</div><CountryCombobox options={taxonomies.countries} value="" ariaLabel="Search for another destination country" clearOnSelect clearValueOnSearch={false} excludeCodes={[...otherDestinations, ...form.destinations]} onChange={(code) => setOtherDestinations((current) => current.includes(code) ? current : [...current, code])} /></>}{validation.destinations && <em className="error-text">{validation.destinations}</em>}</fieldset>
    <label className="form-question">What do you want to study? <select value={form.field} onChange={(event) => update('field', event.target.value)}><option value="">Select your field of study</option>{taxonomies?.fields.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}</select></label>
    <fieldset className="choice-control"><legend>What is your highest level of qualification?</legend><div className="option-grid">{[{ code: 'hnd', label: 'HND' }, { code: 'bachelors', label: "Bachelor's degree (BSc)" }, { code: 'masters', label: "Master's degree (MSc)" }, { code: 'doctorate', label: 'Doctoral program (PhD)' }].map((item) => <label className={`option-chip ${form.qualification === item.code ? 'selected' : ''}`} key={item.code}><input type="radio" name="qualification" checked={form.qualification === item.code} onChange={() => update('qualification', item.code)} />{item.label}</label>)}</div></fieldset>
    <fieldset className="choice-control"><legend>What are you applying for?</legend><div className="option-grid">{taxonomies?.degrees.map((item) => <label className={`option-chip ${form.degree === item.code ? 'selected' : ''}`} key={item.code}><input type="radio" name="degree" value={item.code} checked={form.degree === item.code} onChange={() => update('degree', item.code)} />{item.code === 'masters' ? "Master's degree (MSc)" : 'Doctoral program (PhD)'}</label>)}</div>{validation.degree && <em className="error-text">{validation.degree}</em>}</fieldset>
    {(!taxonomies || taxonomyError) && <div className={`form-alert ${taxonomyError ? 'is-error' : ''}`} role={taxonomyError ? 'alert' : undefined}>{taxonomyError ? "We couldn't load the search options. Refresh to try again." : 'Loading search options...'}</div>}{error && <div className="form-alert is-error" role="alert">{error.retryAfter ? `Search is busy. Try again in ${error.retryAfter} seconds.` : error.message}</div>}<PrimaryButton type="submit" disabled={loadingMore}>Find my scholarships</PrimaryButton>
  </form></section>

  const resultsPanel = <section className="results-panel" aria-live="polite"><div className="results-toolbar"><div><p className="form-kicker">Your matches</p><h2>{results.length ? 'Scholarships that fit you' : "We couldn't find a match yet"}</h2><p>{results.length ? 'Review each opportunity carefully on the official provider website.' : 'Try changing a destination or leaving your field of study open.'}</p></div><button className="outline-button" type="button" onClick={refineSearch}>Refine my search</button></div>{error && <div className="form-alert is-error" role="alert">{error.retryAfter ? `Search is busy. Try again in ${error.retryAfter} seconds.` : error.message}</div>}{warnings.map((warning) => <div className="form-alert warning" key={warning}>We don't have verified coverage for {warning.replace('no_verified_coverage:', '').split(',').join(' and ')} yet.</div>)}{results.length > 0 && <div className="result-list">{results.map((result) => <ScholarshipCard key={`${result.scholarship_id}-${result.cycle_id}`} result={result} destinations={taxonomies?.destinations ?? []} countries={taxonomies?.countries ?? []} degrees={taxonomies?.degrees ?? []} fundingTypes={taxonomies?.funding_types ?? []} matchProfile={{ origin_country: form.origin, program_level: form.degree, ...(form.field ? { field: form.field } : {}) }} searchId={activeSearchId || undefined} detailsOpen={selectedScholarshipId || pendingModalId ? selectedScholarshipId === result.scholarship_id || pendingModalId === result.scholarship_id : undefined} onDetailsOpen={activeSearchId ? openDetails : undefined} onDetailsClose={activeSearchId ? closeDetails : undefined} />)}</div>}{nextCursor && <button className="load-more" type="button" onClick={(event) => submit(event, nextCursor)} disabled={loadingMore}>{loadingMore ? 'Loading...' : 'Load more scholarships'}</button>}<NewsletterSignup /></section>

  const stateContent = view === 'searching' ? <section className="search-loading" role="status" aria-live="polite" aria-busy="true"><div className="loading-spinner" aria-hidden="true" /><h2>Finding scholarships...</h2><p>We're matching your answers with verified opportunities.</p><div className="loading-skeleton" aria-hidden="true"><i /><i /><i /></div></section> : view === 'results' ? resultsPanel : view === 'error' ? <section className="form-panel"><div className="form-alert is-error" role="alert">{error?.retryAfter ? `Search is busy. Try again in ${error.retryAfter} seconds.` : error?.message ?? 'We could not load this search.'}</div><button className="outline-button" type="button" onClick={() => router.replace('/')}>Return to finder</button></section> : formPanel
  return <div className="finder-app"><SiteHeader /><section className="finder-hero"><h1>Let's find scholarships that fit you.</h1><p>Get a shortlist of verified funding opportunities for your Master's or PhD - without spending hours chasing outdated links.</p><div className="hero-points"><span>{'\u2713'} No sign up required</span><span>{'\u2713'} Free to use</span></div></section><FinderStepper step={view === 'results' ? 2 : 1} /><main className="finder-main">{stateContent}</main><SiteFooter /></div>
}