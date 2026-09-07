'use client'

import { useMemo, useState } from 'react'
import type { Option } from '../../app/types'

export function CountryCombobox({ options, value, onChange }: { options: Option[]; value: string; onChange: (code: string) => void }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())), [options, query])
  return <div className="country-combobox"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a country" aria-label="Search for another destination country" autoComplete="off" /><div className="country-options" role="listbox">{filtered.slice(0, 8).map((option) => <button type="button" role="option" aria-selected={value === option.code} key={option.code} onClick={() => { onChange(option.code); setQuery(option.label) }}>{option.label}</button>)}{filtered.length === 0 && <span className="country-empty">No country found</span>}</div></div>
}
