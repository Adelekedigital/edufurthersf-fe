'use client'

import { useMemo } from 'react'
import { CountryCombobox } from '../finder/CountryCombobox'
import type { Option } from '../../app/types'

type MultiSelectComboboxProps = {
  options: Option[]
  values: string[]
  onChange: (values: string[]) => void
  /** Used for the add-field's accessible name and the selected-items region. */
  label: string
  placeholder?: string
}

/** Searchable multi-select with removable chips.
 *
 * Replaces a native <select multiple>, which does not scale here: the origin
 * list is 249 options and real cycles select a median of 43 of them (max 140),
 * so ctrl-clicking through a six-row window is impractical and one stray click
 * clears the whole selection. Built on the same CountryCombobox the public
 * finder uses for the same job.
 */
export function MultiSelectCombobox({ options, values, onChange, label, placeholder }: MultiSelectComboboxProps) {
  const labelFor = useMemo(() => {
    const byCode = new Map(options.map((option) => [option.code, option.label] as const))
    return (code: string) => byCode.get(code) ?? code
  }, [options])

  const add = (code: string) => {
    if (!code || values.includes(code)) return
    onChange([...values, code])
  }

  const remove = (code: string) => onChange(values.filter((item) => item !== code))

  return (
    <div className="admin-multiselect">
      {values.length > 0 && (
        <>
          <div className="admin-multiselect-meta">
            <span>{values.length} selected</span>
            <button type="button" className="admin-link-button" onClick={() => onChange([])}>Clear all</button>
          </div>
          <div className="country-selections admin-multiselect-chips" aria-label={`Selected ${label}`}>
            {values.map((code) => (
              <span className="country-selection" key={code}>
                {labelFor(code)}
                <button type="button" aria-label={`Remove ${labelFor(code)}`} onClick={() => remove(code)}>{'×'}</button>
              </span>
            ))}
          </div>
        </>
      )}
      <CountryCombobox
        options={options}
        value=""
        ariaLabel={`Add ${label}`}
        placeholder={placeholder ?? `Search ${label}`}
        clearOnSelect
        clearValueOnSearch={false}
        excludeCodes={values}
        onChange={add}
      />
    </div>
  )
}
