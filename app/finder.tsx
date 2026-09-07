'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { getTaxonomies, searchScholarships } from './api'
import type { ApiError, Option, Scholarship, SearchInput, Taxonomies } from './types'
import { SiteFooter } from '../components/shell/SiteFooter'
import { SiteHeader } from '../components/shell/SiteHeader'
import { FinderStepper } from '../components/finder/FinderStepper'
import { ScholarshipCard } from '../components/finder/ScholarshipCard'
import { CountryCombobox } from '../components/finder/CountryCombobox'
import { PrimaryButton } from '../components/ui/PrimaryButton'

type FormState = { origin: string; destinations: string[]; field: string; degree: string }
const emptyForm: FormState = { origin: '', destinations: [], field: '', degree: '' }
const label = (options: Option[], code: string) => options.find((item) => item.code === code)?.label ?? code

export function Finder() {
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
  const [otherDestination, setOtherDestination] = useState('')

  useEffect(() => { getTaxonomies().then(setTaxonomies).catch(() => setTaxonomyError(true)) }, [])
  const selectedLabels = useMemo(() => form.destinations.map((code) => label(taxonomies?.destinations ?? [], code)), [form.destinations, taxonomies])
  const update = (key: keyof FormState, value: string | string[]) => setForm((current) => ({ ...current, [key]: value }))
  const toggle = (code: string) => update('destinations', form.destinations.includes(code) ? form.destinations.filter((item) => item !== code) : [...form.destinations, code])
  const toggleOtherDestination = () => { const checked = !showOtherDestination; setShowOtherDestination(checked); if (!checked) setOtherDestination('') }

  async function submit(event: FormEvent, cursor?: string) {
    event.preventDefault(); const next: Record<string, string> = {}
    if (!form.origin) next.origin = 'Select your country of origin.'
    const targetCountries = Array.from(new Set([...form.destinations, ...(showOtherDestination && otherDestination ? [otherDestination] : [])]))
    if (!targetCountries.length) next.destinations = 'Select at least one destination.'
    if (!form.degree) next.degree = 'Select what you are applying for.'
    setValidation(next); if (Object.keys(next).length) return
    setLoading(true); setError(null)
    const input: SearchInput = { origin_country: form.origin, program_level: form.degree, target_countries: targetCountries, limit: 20, ...(form.field ? { field: form.field } : {}), ...(cursor ? { cursor } : {}) }
    try { const response = await searchScholarships(input); setResults((current) => cursor ? [...current, ...response.data] : response.data); setNextCursor(response.next_cursor); setWarnings(response.meta.warnings ?? []); setSearched(true) } catch (caught) { setError(caught as ApiError) } finally { setLoading(false) }
  }

  return <div className="finder-app"><SiteHeader /><section className="finder-hero"><h1>Let’s find scholarships that fit you.</h1><p>Get a shortlist of verified funding opportunities for your Master&apos;s or PhD—without spending hours chasing outdated links.</p><div className="hero-points"><span>✓&nbsp; No sign up required</span><span>✓&nbsp; Free to use</span></div></section><FinderStepper step={searched ? 2 : 1} /><main className="finder-main">
    {!searched && <section className="form-panel" aria-labelledby="form-heading"><form onSubmit={submit} noValidate>
      <label className="form-question">Where are you from? {taxonomies && <CountryCombobox options={taxonomies.countries} value={form.origin} onChange={(code) => update('origin', code)} ariaLabel="Search for your country of origin" ariaInvalid={!!validation.origin} />}<small>Helps us identify scholarships you&apos;re eligible to apply for</small>{validation.origin && <em className="error-text">{validation.origin}</em>}</label>
      <fieldset className="destination-control"><legend>Where do you want to study?</legend><div className="option-grid">{taxonomies?.destinations.map((item) => <label className={`option-chip ${form.destinations.includes(item.code) ? 'selected' : ''}`} key={item.code}><input type="checkbox" checked={form.destinations.includes(item.code)} onChange={() => toggle(item.code)} />{item.label}</label>)}<label className={`option-chip ${!!taxonomies?.destinations.length && form.destinations.length === taxonomies.destinations.length ? 'selected' : ''}`}><input type="checkbox" checked={!!taxonomies?.destinations.length && form.destinations.length === taxonomies.destinations.length} onChange={(event) => update('destinations', event.target.checked ? (taxonomies?.destinations.map((item) => item.code) ?? []) : [])} />I&apos;m open to any of these</label><div className={`option-chip ${showOtherDestination ? 'selected' : ''}`} role="checkbox" aria-checked={showOtherDestination} tabIndex={0} onPointerDown={(event) => { event.preventDefault(); toggleOtherDestination() }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleOtherDestination() } }}>Somewhere else</div></div>{showOtherDestination && taxonomies && <CountryCombobox options={taxonomies.countries} value={otherDestination} ariaLabel="Search for another destination country" onChange={setOtherDestination} />}{validation.destinations && <em className="error-text">{validation.destinations}</em>}</fieldset>
      <label className="form-question">What do you want to study? <select value={form.field} onChange={(e) => update('field', e.target.value)}><option value="">Select your field of study</option>{taxonomies?.fields.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}</select></label>
      <fieldset className="choice-control"><legend>What is your highest level of qualification?</legend><div className="option-grid"><label className="option-chip"><input type="radio" name="qualification" />HND</label><label className="option-chip"><input type="radio" name="qualification" />Bachelor&apos;s degree (BSc)</label><label className="option-chip"><input type="radio" name="qualification" />Master&apos;s degree (MSc)</label><label className="option-chip"><input type="radio" name="qualification" />Doctoral program (PhD)</label></div></fieldset>
      <fieldset className="choice-control"><legend>What are you applying for?</legend><div className="option-grid">{taxonomies?.degrees.map((item) => <label className={`option-chip ${form.degree === item.code ? 'selected' : ''}`} key={item.code}><input type="radio" name="degree" value={item.code} checked={form.degree === item.code} onChange={() => update('degree', item.code)} />{item.code === 'masters' ? "Master's degree (MSc)" : 'Doctoral program (PhD)'}</label>)}</div>{validation.degree && <em className="error-text">{validation.degree}</em>}</fieldset>
      {(!taxonomies || taxonomyError) && <div className={`form-alert ${taxonomyError ? 'is-error' : ''}`} role={taxonomyError ? 'alert' : undefined}>{taxonomyError ? 'We couldn’t load the search options. Refresh to try again.' : 'Loading search options…'}</div>}{error && <div className="form-alert is-error" role="alert">{error.retryAfter ? `Search is busy. Try again in ${error.retryAfter} seconds.` : error.message}</div>}<PrimaryButton type="submit" disabled={loading}>{loading ? 'Searching…' : 'Find my scholarships'}</PrimaryButton>
    </form></section>}
    {searched && <section className="results-panel" aria-live="polite"><div className="results-toolbar"><div><p className="form-kicker">Your matches</p><h2>{results.length ? 'Scholarships that fit you' : 'We couldn’t find a match yet'}</h2><p>{results.length ? 'Review each opportunity carefully on the official provider website.' : 'Try changing a destination or leaving your field of study open.'}</p></div><button className="outline-button" type="button" onClick={() => setSearched(false)}>Refine my search</button></div>{warnings.map((warning) => <div className="form-alert warning" key={warning}>We don&apos;t have verified coverage for {warning.replace('no_verified_coverage:', '').split(',').join(' and ')} yet.</div>)}{results.length > 0 && <div className="result-list">{results.map((result) => <ScholarshipCard key={`${result.scholarship_id}-${result.cycle_id}`} result={result} destinations={taxonomies?.destinations ?? []} countries={taxonomies?.countries ?? []} degrees={taxonomies?.degrees ?? []} fundingTypes={taxonomies?.funding_types ?? []} />)}</div>}{nextCursor && <button className="load-more" type="button" onClick={(event) => submit(event, nextCursor)} disabled={loading}>{loading ? 'Loading…' : 'Load more scholarships'}</button>}</section>}
  </main>{!searched && <SiteFooter />}{searched && <SiteFooter />}</div>
}
