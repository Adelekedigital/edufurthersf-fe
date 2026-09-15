'use client'

import { useRef, useState } from 'react'
import { withdrawScholarship } from '../../app/admin/api'
import { Drawer } from './Drawer'
import type { AdminApiError, WithdrawResponse } from '../../app/admin/types'

type WithdrawDrawerProps = {
  scholarshipId: string
  scholarshipName: string
  reviewerName: string
  onClose: () => void
  onWithdrawn: (scholarshipId: string, result: WithdrawResponse) => void
}

export function WithdrawDrawer({ scholarshipId, scholarshipName, reviewerName, onClose, onWithdrawn }: WithdrawDrawerProps) {
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <Drawer title={`Withdraw ${scholarshipName}`} initialFocusRef={reasonRef} onClose={onClose}>
        <p className="admin-panel-excerpt">This immediately removes the record and every published cycle from public results.</p>
        <label className="admin-field admin-field-reason">
          <span>Reason</span>
          <textarea ref={reasonRef} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </label>
        {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}
        <div className="admin-panel-actions">
          <button type="button" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="admin-danger-button" onClick={submit} disabled={!reason.trim() || submitting}>
            {submitting ? 'Withdrawing…' : 'Withdraw'}
          </button>
        </div>
    </Drawer>
  )
}
