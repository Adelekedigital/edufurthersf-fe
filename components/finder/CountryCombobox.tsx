'use client'

import { useMemo, useState } from 'react'
import type { Option } from '../../app/types'

type CountryComboboxProps = {
  options: Option[]
  value: string
  onChange: (code: string) => void
  ariaLabel: string
  ariaInvalid?: boolean
}

export function CountryCombobox({ options, value, onChange, ariaLabel, ariaInvalid }: CountryComboboxProps) {
  const selectedLabel = options.find((option) => option.code === value)?.label ?? ''
  const [query, setQuery] = useState(selectedLabel)
  const filtered = useMemo(() => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())), [options, query])


  return <div className="country-combobox"><input role="combobox" value={query} onChange={(event) => { const nextQuery = event.target.value; setQuery(nextQuery); if (nextQuery !== selectedLabel) onChange('') }} placeholder="Search for a country" aria-label={ariaLabel} aria-invalid={ariaInvalid} aria-expanded="true" aria-controls={`${ariaLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-options`} autoComplete="off" /><div className="country-options" id={`${ariaLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-options`} role="listbox">{filtered.map((option) => <button type="button" role="option" aria-selected={value === option.code} key={option.code} onClick={() => { onChange(option.code); setQuery(option.label) }}>{option.label}</button>)}{filtered.length === 0 && <span className="country-empty">No country found</span>}</div></div>
}