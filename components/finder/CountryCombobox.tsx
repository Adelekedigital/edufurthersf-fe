'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())), [options, query])

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [])



  const select = (code: string) => {
    const option = options.find((item) => item.code === code)
    if (!option) return
    onChange(code)
    setQuery(option.label)
    setActiveIndex(-1)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((current) => {
        if (!filtered.length) return -1
        if (event.key === 'ArrowDown') return current < filtered.length - 1 ? current + 1 : 0
        return current > 0 ? current - 1 : filtered.length - 1
      })
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault()
      select(filtered[activeIndex].code)
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const optionId = `${ariaLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-options`
  return <div className="country-combobox" ref={rootRef}><input role="combobox" value={query} onChange={(event) => { const nextQuery = event.target.value; setQuery(nextQuery); if (nextQuery !== selectedLabel) onChange(''); setOpen(true); setActiveIndex(0) }} onClick={() => setOpen((current) => !current)} onKeyDown={handleKeyDown} placeholder="Search for a country" aria-label={ariaLabel} aria-invalid={ariaInvalid} aria-expanded={open} aria-controls={optionId} aria-activedescendant={open && activeIndex >= 0 ? `${optionId}-${filtered[activeIndex].code}` : undefined} autoComplete="off" />{open && <div className="country-options" id={optionId} role="listbox">{filtered.map((option, index) => <button type="button" role="option" id={`${optionId}-${option.code}`} aria-selected={value === option.code} className={index === activeIndex ? 'active' : ''} key={option.code} onClick={() => select(option.code)}>{option.label}</button>)}{filtered.length === 0 && <span className="country-empty">No country found</span>}</div>}</div>
}