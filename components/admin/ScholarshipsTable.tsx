'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { getProviders, getScholarships } from '../../app/admin/api'
import { getTaxonomies } from '../../app/api'
import type { ProviderRead, ScholarshipAdminRead, ScholarshipFilters } from '../../app/admin/types'
import type { Taxonomies } from '../../app/types'
import { Badge, type BadgeTone } from './Badge'
import { ProviderPicker } from './ProviderPicker'
import { PublishCycleModal } from './PublishCycleModal'
import { WithdrawModal } from './WithdrawModal'

const LIFECYCLE_STATES = ['discovered', 'needs_review', 'published', 'withdrawn']
const PUBLIC_STATUSES = ['open_verified', 'expected_to_reopen', 'status_unknown']

const BADGE_TONES: Record<string, BadgeTone> = {
  discovered: 'neutral',
  needs_review: 'warning',
  published: 'positive',
  withdrawn: 'negative',
  open_verified: 'positive',
  expected_to_reopen: 'warning',
  status_unknown: 'neutral',
}

function StateBadge({ value }: { value: string }) {
  return <Badge tone={BADGE_TONES[value] ?? 'neutral'}>{value.replace(/_/g, ' ')}</Badge>
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—'
  const date = new Date(isoDate)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const columnHelper = createColumnHelper<ScholarshipAdminRead>()

type LoadState = 'loading' | 'ready' | 'error'

export function ScholarshipsTable({ reviewerName }: { reviewerName: string }) {
  const [scholarships, setScholarships] = useState<ScholarshipAdminRead[]>([])
  const [total, setTotal] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [supportDataError, setSupportDataError] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderRead[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomies | null>(null)

  const [filters, setFilters] = useState<ScholarshipFilters>({})
  const [qDraft, setQDraft] = useState('')
  const [providerFilterId, setProviderFilterId] = useState('')

  const [publishTarget, setPublishTarget] = useState<ScholarshipAdminRead | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<ScholarshipAdminRead | null>(null)

  const loadPage = useCallback(async (currentFilters: ScholarshipFilters, offset: number) => {
    const response = await getScholarships(currentFilters, offset)
    setScholarships((current) => (offset === 0 ? response.data : [...current, ...response.data]))
    setTotal(response.total)
  }, [])

  useEffect(() => {
    let active = true
    setLoadState('loading')
    loadPage(filters, 0)
      .then(() => { if (active) setLoadState('ready') })
      .catch((error) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Could not load scholarships.')
        setLoadState('error')
      })
    return () => { active = false }
  }, [filters, loadPage])

  useEffect(() => {
    let active = true
    Promise.all([getProviders(), getTaxonomies()]).then(([providerResponse, taxonomyResponse]) => {
      if (!active) return
      setProviders(providerResponse.data)
      setTaxonomies(taxonomyResponse)
    }).catch((error) => {
      if (!active) return
      // The scholarship list itself still works without this, but publishing
      // and filtering by provider silently can't function - surface it
      // rather than leaving "Publish cycle" looking like a dead button.
      setSupportDataError(error instanceof Error ? error.message : 'Could not load providers/taxonomies.')
    })
    return () => { active = false }
  }, [])

  const replaceScholarship = (scholarshipId: string, updater: (current: ScholarshipAdminRead) => ScholarshipAdminRead) => {
    setScholarships((current) => current.map((item) => (item.scholarship_id === scholarshipId ? updater(item) : item)))
  }

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Scholarship',
      cell: (info) => (
        <div className="admin-cell-title">
          <strong>{info.getValue()}</strong>
          <p className="admin-cell-excerpt">{info.row.original.provider_name}</p>
        </div>
      ),
    }),
    columnHelper.accessor('lifecycle_state', {
      header: 'Lifecycle',
      cell: (info) => <StateBadge value={info.getValue()} />,
    }),
    columnHelper.accessor('cycles', {
      header: 'Cycles',
      cell: (info) => {
        const cycles = info.getValue()
        if (!cycles.length) return <span className="admin-status">No cycle yet</span>
        return (
          <ul className="admin-cycle-list">
            {cycles.map((cycle) => (
              <li key={cycle.cycle_id}>
                <StateBadge value={cycle.evaluated_public_status} />
                {' '}{cycle.provider_cycle_key}
              </li>
            ))}
          </ul>
        )
      },
    }),
    columnHelper.display({
      id: 'last_verified',
      header: 'Last verified',
      cell: (info) => {
        const dates = info.row.original.cycles.map((cycle) => cycle.last_verified_at).filter((value): value is string => Boolean(value))
        if (!dates.length) return '—'
        return formatDate(dates.sort().at(-1) ?? null)
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const scholarship = info.row.original
        const withdrawn = scholarship.lifecycle_state === 'withdrawn'
        return (
          <div className="admin-row-actions">
            <button
              type="button"
              className="admin-link-button"
              disabled={withdrawn || !taxonomies}
              title={!taxonomies && !withdrawn ? 'Waiting on taxonomy data to load…' : undefined}
              onClick={() => setPublishTarget(scholarship)}
            >
              Publish cycle
            </button>
            <button type="button" className="admin-link-button admin-danger-link" disabled={withdrawn} onClick={() => setWithdrawTarget(scholarship)}>Withdraw</button>
          </div>
        )
      },
    }),
  ], [taxonomies])

  const table = useReactTable({ data: scholarships, columns, getCoreRowModel: getCoreRowModel() })

  if (loadState === 'error') return <p className="admin-auth-error" role="alert">{loadError}</p>

  return (
    <div className="admin-scholarships">
      <div className="admin-queue-header">
        <h1>Scholarships</h1>
        <p>{total} total</p>
      </div>

      {supportDataError ? (
        <p className="admin-auth-error" role="alert">
          Could not load providers/taxonomies ({supportDataError}). Filtering by provider and publishing are unavailable until this loads.
        </p>
      ) : null}

      <div className="admin-filters">
        <form
          className="admin-filter-search"
          onSubmit={(event) => { event.preventDefault(); setFilters((current) => ({ ...current, q: qDraft.trim() || undefined })) }}
        >
          <input type="text" value={qDraft} onChange={(event) => setQDraft(event.target.value)} placeholder="Search by name" aria-label="Search scholarships" />
          <button type="submit">Search</button>
        </form>

        <label className="admin-field admin-filter-field">
          <span>Lifecycle state</span>
          <select value={filters.lifecycle_state ?? ''} onChange={(event) => setFilters((current) => ({ ...current, lifecycle_state: event.target.value || undefined }))}>
            <option value="">All</option>
            {LIFECYCLE_STATES.map((state) => <option key={state} value={state}>{state.replace(/_/g, ' ')}</option>)}
          </select>
        </label>

        <label className="admin-field admin-filter-field">
          <span>Public status</span>
          <select value={filters.public_status ?? ''} onChange={(event) => setFilters((current) => ({ ...current, public_status: event.target.value || undefined }))}>
            <option value="">All</option>
            {PUBLIC_STATUSES.map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
          </select>
        </label>

        <div className="admin-field admin-filter-field">
          <span>Provider</span>
          <ProviderPicker
            providers={providers}
            value={providerFilterId}
            onChange={(providerId) => { setProviderFilterId(providerId); setFilters((current) => ({ ...current, provider_id: providerId || undefined })) }}
            onProviderCreated={(provider) => setProviders((current) => [...current, provider])}
          />
        </div>
      </div>

      {loadState === 'loading' && scholarships.length === 0 ? (
        <p className="admin-status">Loading scholarships…</p>
      ) : scholarships.length === 0 ? (
        <p className="admin-status">No scholarships match these filters.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scholarships.length < total ? (
        <button type="button" className="admin-link-button" onClick={() => loadPage(filters, scholarships.length)}>Load more</button>
      ) : null}

      {publishTarget && taxonomies ? (
        <PublishCycleModal
          scholarshipId={publishTarget.scholarship_id}
          scholarshipName={publishTarget.name}
          officialHomeUrl={publishTarget.official_home_url}
          taxonomies={taxonomies}
          onClose={() => setPublishTarget(null)}
          onPublished={(scholarshipId, result) => {
            replaceScholarship(scholarshipId, (current) => ({ ...current, lifecycle_state: result.lifecycle_state }))
            setPublishTarget(null)
            loadPage(filters, 0)
          }}
        />
      ) : null}

      {withdrawTarget ? (
        <WithdrawModal
          scholarshipId={withdrawTarget.scholarship_id}
          scholarshipName={withdrawTarget.name}
          reviewerName={reviewerName}
          onClose={() => setWithdrawTarget(null)}
          onWithdrawn={(scholarshipId, result) => {
            replaceScholarship(scholarshipId, (current) => ({ ...current, lifecycle_state: result.lifecycle_state }))
            setWithdrawTarget(null)
          }}
        />
      ) : null}
    </div>
  )
}
