'use client'

import { useEffect, useRef, useState } from 'react'
import { withdrawScholarship } from '../../app/admin/api'
import type { AdminApiError, WithdrawResponse } from '../../app/admin/types'

type WithdrawModalProps = {
  scholarshipId: string
  scholarshipName: string
  reviewerName: string
  onClose: () => void
  onWithdrawn: (scholarshipId: string, result: WithdrawResponse) => void
}

export function WithdrawModal({ scholarshipId, scholarshipName, reviewerName, onClose, onWithdrawn }: WithdrawModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialog.showModal()
    // See ReviewDecisionModal - React's autoFocus no-ops here since elements
    // inside a <dialog> aren't focusable until showModal() runs.
    reasonRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
      previouslyFocused?.focus()
    }
  }, [])

  const submit = async () => {
    if (!reason.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await withdrawScholarship(scholarshipId, { reason: `Withdrawn by ${reviewerName} — ${reason.trim()}` })
      onWithdrawn(scholarshipId, result)
    } catch (submitError) {
      const apiError = submitError as AdminApiError
      setError(apiError.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog className="admin-modal admin-modal-narrow" ref={dialogRef} aria-labelledby="withdraw-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
      <div className="admin-modal-inner">
        <header className="admin-modal-header">
          <h2 id="withdraw-title">Withdraw {scholarshipName}</h2>
          <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>{'×'}</button>
        </header>
        <p className="admin-modal-excerpt">This immediately removes the record and every published cycle from public results.</p>
        <label className="admin-field">
          <span>Reason</span>
          <textarea ref={reasonRef} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </label>
        {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}
        <div className="admin-modal-actions">
          <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="admin-danger-button" onClick={submit} disabled={!reason.trim() || submitting}>
            {submitting ? 'Withdrawing…' : 'Withdraw'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
