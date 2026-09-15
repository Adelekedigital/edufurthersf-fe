'use client'

import { useState, type Ref } from 'react'
import { withdrawScholarship } from '../../app/admin/api'
import { PanelActions, PanelBody } from './Drawer'
import type { AdminApiError, WithdrawResponse } from '../../app/admin/types'

type WithdrawFormProps = {
  scholarshipId: string
  reviewerName: string
  firstFieldRef?: Ref<HTMLTextAreaElement>
  onCancel: () => void
  onWithdrawn: (scholarshipId: string, result: WithdrawResponse) => void
}

/** Withdraw form, hosted by the scholarship's panel rather than owning one -
 * the panel title already names the scholarship being withdrawn. */
export function WithdrawForm({ scholarshipId, reviewerName, firstFieldRef, onCancel, onWithdrawn }: WithdrawFormProps) {
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
    <>
      <PanelActions>
        <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="button" className="admin-danger-button" onClick={submit} disabled={!reason.trim() || submitting}>
          {submitting ? 'Withdrawing…' : 'Withdraw'}
        </button>
      </PanelActions>

      <PanelBody>
        <h3 className="admin-panel-heading">Withdraw this scholarship</h3>
        <p className="admin-panel-excerpt">This immediately removes the record and every published cycle from public results.</p>
        {error ? <p className="admin-auth-error" role="alert">{error}</p> : null}
        <label className="admin-field admin-field-reason">
          <span>Reason</span>
          {/* The reason is the whole form here, so it gets the taller box. */}
          <textarea ref={firstFieldRef} value={reason} onChange={(event) => setReason(event.target.value)} rows={8} />
        </label>
      </PanelBody>
    </>
  )
}
