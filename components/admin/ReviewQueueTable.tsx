'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { bulkDecideReviews, getProviders, getReviewQueue } from '../../app/admin/api'
import { getTaxonomies } from '../../app/api'
import type { ProviderRead, PublishPrefill, ReviewDecisionResponse, ReviewTaskSummary } from '../../app/admin/types'
import type { Taxonomies } from '../../app/types'
import { Badge, type BadgeTone } from './Badge'
import { excerptPreview } from './ExcerptText'
import { PublishCycleModal } from './PublishCycleModal'
import { ReviewDecisionDrawer } from './ReviewDecisionDrawer'

const MAX_BULK_SELECTION = 10

// The backend scores priority as "lower sorts first" (see edufurtherSF-BE
// domain/review_priority.py): tasks start at 50 (ambiguous link) or 100 (new
// candidate), then subtract quality signals - authority source -20, funding
// -10, deadline -10, degree level -5, AI evidence -10.
//
// Thresholds are set against the real dev distribution (867 open tasks:
// 75x18, 80x1, 85x141, 90x217, 95x1, 100x489), not the theoretical range.
// Nothing scores below 75 in practice, so banding on the theoretical midpoint
// put 98% of the queue in one bucket. In signal terms: 100 means nothing was
// extracted at all, ~90 means a single signal, <=80 means several. An
// ambiguous-link task (base 50) would also land in the top band, correctly.
function priorityBand(score: number): { label: string; tone: BadgeTone } {
  if (score <= 80) return { label: 'High', tone: 'warning' }
  if (score <= 90) return { label: 'Medium', tone: 'neutral' }
  return { label: 'Low', tone: 'muted' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((item): item is string => typeof item === 'string')
  return strings.length ? strings : undefined
}

// draft_recommendation/extracted_facts are a deliberately thin, honest
// "reviewer head start" (see edufurtherSF-BE domain/review_draft.py) - raw
// text matches, never parsed dates or taxonomy codes. Only level_mentions
// and eligibility_phrase are safe to carry into structured form fields;
// funding/deadline mentions are shown as read-only hints instead of guessed.
function extractPublishPrefill(draftRecommendation: Record<string, unknown> | null): PublishPrefill {
  const facts = isRecord(draftRecommendation?.proposed_facts) ? draftRecommendation.proposed_facts : null
  if (!facts) return {}
  return {
    levels: stringArray(facts.level_mentions),
    eligibilityNote: typeof facts.eligibility_phrase === 'string' ? facts.eligibility_phrase : undefined,
    fundingMentions: stringArray(facts.funding_mentions),
    deadlineMentions: stringArray(facts.deadline_mentions),
  }
}

function formatAge(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const columnHelper = createColumnHelper<ReviewTaskSummary>()

type LoadState = 'loading' | 'ready' | 'error'

export function ReviewQueueTable({ reviewerName }: { reviewerName: string }) {
  const [tasks, setTasks] = useState<ReviewTaskSummary[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderRead[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomies | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeTask, setActiveTask] = useState<ReviewTaskSummary | null>(null)
  const [bulkReason, setBulkReason] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [publishPrompt, setPublishPrompt] = useState<{ scholarshipId: string; scholarshipName: string; officialHomeUrl: string; prefill: PublishPrefill } | null>(null)
  const [publishModalOpen, setPublishModalOpen] = useState(false)

  // Offset for the next page equals how many currently-open tasks are loaded
  // so far. Deciding on a task removes it from `tasks` *and* resolves it
  // server-side (it drops out of state=open), so both counts shrink together
  // and the invariant holds even after approvals/rejections in between pages.
  const loadPage = useCallback(async (offset: number) => {
    const response = await getReviewQueue('open', offset)
    setTasks((current) => (offset === 0 ? response.data : [...current, ...response.data]))
    setOpenCount(response.open_count)
  }, [])

  useEffect(() => {
    let active = true
    setLoadState('loading')
    Promise.all([loadPage(0), getProviders(), getTaxonomies()])
      .then(([, providerResponse, taxonomyResponse]) => {
        if (!active) return
        setProviders(providerResponse.data)
        setTaxonomies(taxonomyResponse)
        setLoadState('ready')
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Could not load the review queue.')
        setLoadState('error')
      })
    return () => { active = false }
  }, [loadPage])

  const removeTask = (reviewTaskId: string) => {
    setTasks((current) => current.filter((task) => task.review_task_id !== reviewTaskId))
    setOpenCount((current) => Math.max(0, current - 1))
    setSelected((current) => {
      if (!current.has(reviewTaskId)) return current
      const next = new Set(current)
      next.delete(reviewTaskId)
      return next
    })
  }

  const toggleSelected = (reviewTaskId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(reviewTaskId)) next.delete(reviewTaskId)
      else if (next.size < MAX_BULK_SELECTION) next.add(reviewTaskId)
      return next
    })
  }

  const bulkReject = async () => {
    if (selected.size === 0 || !bulkReason.trim() || bulkSubmitting) return
    setBulkSubmitting(true)
    setBulkError(null)
    const annotatedReason = `Reviewed by ${reviewerName} — ${bulkReason.trim()}`
    try {
      const result = await bulkDecideReviews(
        Array.from(selected).map((reviewTaskId) => ({ review_task_id: reviewTaskId, decision: 'reject' as const, reason: annotatedReason }))
      )
      for (const item of result.results) {
        if (item.success) removeTask(item.review_task_id)
      }
      const failed = result.results.filter((item) => !item.success)
      if (failed.length) {
        setBulkError(`${failed.length} item(s) could not be rejected: ${failed.map((item) => item.error).filter(Boolean).join('; ')}`)
      } else {
        setBulkReason('')
      }
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Bulk reject failed.')
    } finally {
      setBulkSubmitting(false)
    }
  }

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: '',
      cell: (info) => (
        <input
          type="checkbox"
          checked={selected.has(info.row.original.review_task_id)}
          onChange={() => toggleSelected(info.row.original.review_task_id)}
          aria-label={`Select ${info.row.original.raw_title ?? 'this candidate'}`}
        />
      ),
    }),
    columnHelper.accessor('raw_title', {
      header: 'Candidate',
      cell: (info) => (
        <div className="admin-cell-title">
          <button type="button" className="admin-link-button" onClick={() => setActiveTask(info.row.original)}>
            {info.getValue() ?? 'Untitled candidate'}
          </button>
          {info.row.original.raw_excerpt ? <p className="admin-cell-excerpt">{excerptPreview(info.row.original.raw_excerpt)}</p> : null}
        </div>
      ),
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => {
        const score = info.getValue()
        const { label, tone } = priorityBand(score)
        return <Badge tone={tone} title={`Priority score ${score} - lower sorts first`}>{label}</Badge>
      },
    }),
    columnHelper.accessor('created_at', { header: 'Age', cell: (info) => formatAge(info.getValue()) }),
  ], [selected])

  const table = useReactTable({ data: tasks, columns, getCoreRowModel: getCoreRowModel() })

  if (loadState === 'loading') return <p className="admin-status">Loading the review queue…</p>
  if (loadState === 'error') return <p className="admin-auth-error" role="alert">{loadError}</p>

  return (
    <div className={`admin-review-queue${activeTask ? ' admin-review-queue-with-drawer' : ''}`}>
      <div className="admin-queue-header">
        <h1>Review queue</h1>
        <p>{openCount} open item{openCount === 1 ? '' : 's'}</p>
      </div>

      {selected.size > 0 ? (
        <div className="admin-bulk-bar">
          <span>{selected.size} selected</span>
          <input
            type="text"
            value={bulkReason}
            onChange={(event) => setBulkReason(event.target.value)}
            placeholder="Reason for rejecting all selected"
            aria-label="Reason for bulk rejection"
          />
          <button type="button" onClick={bulkReject} disabled={bulkSubmitting || !bulkReason.trim()}>
            {bulkSubmitting ? 'Rejecting…' : 'Reject selected'}
          </button>
          {bulkError ? <span className="admin-auth-error" role="alert">{bulkError}</span> : null}
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <p className="admin-status">Nothing waiting for review.</p>
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

      {tasks.length < openCount ? (
        <button type="button" className="admin-link-button" onClick={() => loadPage(tasks.length)}>Load more</button>
      ) : null}

      {publishPrompt && !publishModalOpen ? (
        <div className="admin-toast">
          <span>Approved. Publish a cycle for &quot;{publishPrompt.scholarshipName}&quot; now?</span>
          <button type="button" onClick={() => setPublishModalOpen(true)}>Publish now</button>
          <button type="button" className="admin-link-button" onClick={() => setPublishPrompt(null)}>Dismiss</button>
        </div>
      ) : null}

      {activeTask ? (
        <ReviewDecisionDrawer
          // Remount per candidate: switching rows with the panel open must not
          // carry the previous decision's form state across.
          key={activeTask.review_task_id}
          task={activeTask}
          reviewerName={reviewerName}
          providers={providers}
          awardTypes={taxonomies?.award_types ?? []}
          onProviderCreated={(provider) => setProviders((current) => [...current, provider])}
          onClose={() => setActiveTask(null)}
          onDecided={(reviewTaskId, decision, result: ReviewDecisionResponse, approvedInfo) => {
            const decidedTask = tasks.find((task) => task.review_task_id === reviewTaskId)
            removeTask(reviewTaskId)
            setActiveTask(null)
            if (decision === 'approve' && result.scholarship_id && approvedInfo) {
              setPublishPrompt({
                scholarshipId: result.scholarship_id,
                scholarshipName: approvedInfo.canonicalName || decidedTask?.raw_title || 'this scholarship',
                officialHomeUrl: approvedInfo.officialHomeUrl,
                prefill: extractPublishPrefill(decidedTask?.draft_recommendation ?? null),
              })
            }
          }}
        />
      ) : null}

      {publishPrompt && publishModalOpen && taxonomies ? (
        <PublishCycleModal
          scholarshipId={publishPrompt.scholarshipId}
          scholarshipName={publishPrompt.scholarshipName}
          officialHomeUrl={publishPrompt.officialHomeUrl}
          taxonomies={taxonomies}
          prefill={publishPrompt.prefill}
          onClose={() => setPublishModalOpen(false)}
          onPublished={() => { setPublishModalOpen(false); setPublishPrompt(null) }}
        />
      ) : null}
    </div>
  )
}
