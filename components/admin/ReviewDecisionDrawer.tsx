'use client'

import { useEffect, useRef, useState } from 'react'
import { decideReview } from '../../app/admin/api'
import type { AdminApiError, ProviderRead, ReviewDecision, ReviewDecisionResponse, ReviewTaskSummary } from '../../app/admin/types'
import type { Option } from '../../app/types'
import { ExcerptText } from './ExcerptText'
import { ProviderPicker } from './ProviderPicker'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type ReviewDecisionDrawerProps = {
  task: ReviewTaskSummary
  reviewerName: string
  providers: ProviderRead[]
  awardTypes: Option[]
  onProviderCreated: (provider: ProviderRead) => void
  onClose: () => void
  onDecided: (reviewTaskId: string, decision: ReviewDecision, result: ReviewDecisionResponse, approvedInfo?: { canonicalName: string; officialHomeUrl: string }) => void
}

/** Side panel for reviewing one candidate.
 *
 * Deliberately non-modal: the point is to keep the queue readable and
 * clickable so a reviewer can work straight down 800+ items without the
 * panel closing and losing their place between each one. That rules out
 * <dialog>.showModal(), which makes the rest of the page inert.
 *
 * The parent keys this by review_task_id so switching rows remounts it -
 * otherwise the previous candidate's typed reason and provider would carry
 * over into the next decision.
 */
export function ReviewDecisionDrawer({ task, reviewerName, providers, awardTypes, onProviderCreated, onClose, onDecided }: ReviewDecisionDrawerProps) {
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [decision, setDecision] = useState<ReviewDecision>('reject')
  const [providerId, setProviderId] = useState('')
  const [canonicalName, setCanonicalName] = useState(task.raw_title ?? '')
  const [officialHomeUrl, setOfficialHomeUrl] = useState('')
  const [slug, setSlug] = useState(slugify(task.raw_title ?? ''))
  const [slugTouched, setSlugTouched] = useState(false)
  const [awardType, setAwardType] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    reasonRef.current?.focus()
    return () => {
      // Nothing traps focus here, so returning it to the row that opened the
      // panel is what keeps keyboard users from landing back on <body>.
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    // Document-level rather than on the panel: focus may well be back in the
    // list (that is the point of a non-modal panel) when Escape is pressed.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleCanonicalNameChange = (value: string) => {
    setCanonicalName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const canSubmitApprove = providerId && officialHomeUrl.trim() && slug.trim() && awardType && reason.trim()
  const canSubmit = decision === 'reject' ? Boolean(reason.trim()) : Boolean(canSubmitApprove)

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    const annotatedReason = `Reviewed by ${reviewerName} — ${reason.trim()}`
    try {
      const result = await decideReview(task.review_task_id, decision === 'approve'
        ? {
            decision,
            provider_id: providerId,
            canonical_name: canonicalName.trim() || undefined,
            official_home_url: officialHomeUrl.trim(),
            slug: slug.trim(),
            award_type: awardType,
            reason: annotatedReason,
          }
        : { decision, reason: annotatedReason })
      onDecided(task.review_task_id, decision, result, decision === 'approve' ? { canonicalName: canonicalName.trim(), officialHomeUrl: officialHomeUrl.trim() } : undefined)
    } catch (submitError) {
      const apiError = submitError as AdminApiError
      setError(apiError.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside className="admin-drawer" aria-label={`Review: ${task.raw_title ?? 'Untitled candidate'}`}>
      <div className="admin-drawer-inner">
        <header className="admin-modal-header">
          <h2>{task.raw_title ?? 'Untitled candidate'}</h2>
          <button className="modal-close" type="button" aria-label="Close review panel" onClick={onClose}>{'×'}</button>
        </header>

        {task.raw_excerpt ? <ExcerptText text={task.raw_excerpt} /> : null}
        {task.source_url ? <a href={task.source_url} target="_blank" rel="noreferrer" className="admin-modal-source">View source</a> : null}

        <div className="admin-decision-toggle" role="radiogroup" aria-label="Decision">
          <button type="button" role="radio" aria-checked={decision === 'reject'} className={decision === 'reject' ? 'active' : ''} onClick={() => setDecision('reject')}>Reject</button>
          <button type="button" role="radio" aria-checked={decision === 'approve'} className={decision === 'approve' ? 'active' : ''} onClick={() => setDecision('approve')}>Approve</button>
        </div>

        {decision === 'approve' ? (
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Provider</span>
              <ProviderPicker providers={providers} value={providerId} onChange={setProviderId} onProviderCreated={onProviderCreated} />
            </label>
            <label className="admin-field">
              <span>Canonical name</span>
              <input type="text" value={canonicalName} onChange={(event) => handleCanonicalNameChange(event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Official home URL</span>
              <input type="url" value={officialHomeUrl} onChange={(event) => setOfficialHomeUrl(event.target.value)} placeholder="https://" />
            </label>
            <label className="admin-field">
              <span>Slug</span>
              <input type="text" value={slug} onChange={(event) => { setSlug(event.target.value); setSlugTouched(true) }} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
            </label>
            <label className="admin-field">
              <span>Award type</span>
              <select value={awardType} onChange={(event) => setAwardType(event.target.value)}>
                <option value="">Select…</option>
                {awardTypes.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        <label className="admin-field">
          <span>Reason{decision === 'approve' ? ' (internal note)' : ''}</span>
          <textarea ref={reasonRef} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </label>

        {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}

        <div className="admin-modal-actions">
          <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="admin-auth-submit" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? 'Saving…' : decision === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </aside>
  )
}
