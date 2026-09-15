'use client'

import { useMemo, useState } from 'react'
import { CountryCombobox } from '../finder/CountryCombobox'
import { createProvider } from '../../app/admin/api'
import type { ProviderRead } from '../../app/admin/types'
import type { Option } from '../../app/types'

type ProviderPickerProps = {
  providers: ProviderRead[]
  value: string
  onChange: (providerId: string) => void
  onProviderCreated: (provider: ProviderRead) => void
  /** Country taxonomy for the create form. Falls back to a code field if the
   * taxonomy request failed, so adding a provider still works. */
  countries?: Option[]
  /** Off when picking a provider to filter by: creating one from a filter
   * would not filter to anything, and the extra control below the input
   * knocked the field out of line with the rest of the filter row. */
  allowCreate?: boolean
}

export function ProviderPicker({ providers, value, onChange, onProviderCreated, countries = [], allowCreate = true }: ProviderPickerProps) {
  const options = useMemo(() => providers.map((provider) => ({ code: provider.provider_id, label: provider.name })), [providers])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [domains, setDomains] = useState('')
  const [country, setCountry] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const submitCreate = async () => {
    const approvedDomains = domains.split(',').map((item) => item.trim()).filter(Boolean)
    if (!name.trim() || approvedDomains.length === 0) {
      setCreateError('Provider name and at least one approved domain are required.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const provider = await createProvider({ name: name.trim(), approved_domains: approvedDomains, country: country.trim() || undefined })
      onProviderCreated(provider)
      onChange(provider.provider_id)
      setShowCreate(false)
      setName('')
      setDomains('')
      setCountry('')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create the provider.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="admin-provider-picker">
      <CountryCombobox options={options} value={value} onChange={onChange} ariaLabel="Provider" placeholder="Search for a provider" />
      {!allowCreate ? null : !showCreate ? (
        <button type="button" className="admin-link-button" onClick={() => setShowCreate(true)}>
          Can&apos;t find it? Add a new provider
        </button>
      ) : (
        <div className="admin-inline-form">
          <label className="admin-field">
            <span>Provider name</span>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="admin-field">
            <span>Approved domains (comma-separated)</span>
            <input type="text" value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="example.edu, example.org" />
          </label>
          {countries.length ? (
            // Nobody knows the provider's ISO code off the top of their head,
            // and a typo here is silently accepted by the API.
            <div className="admin-field">
              <span className="admin-field-label">Country (optional)</span>
              <CountryCombobox options={countries} value={country} onChange={setCountry} ariaLabel="Provider country" />
            </div>
          ) : (
            <label className="admin-field">
              <span>Country (optional, 2-3 letter code)</span>
              <input type="text" value={country} onChange={(event) => setCountry(event.target.value.toUpperCase())} maxLength={3} />
            </label>
          )}
          {createError ? <p className="admin-auth-error" role="alert">{createError}</p> : null}
          <div className="admin-inline-form-actions">
            <button type="button" className="admin-auth-submit" onClick={submitCreate} disabled={creating}>{creating ? 'Creating…' : 'Create provider'}</button>
            <button type="button" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
