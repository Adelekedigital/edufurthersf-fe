'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

type DrawerProps = {
  title: string
  /** Wider variant for long forms (publishing) than for triage panels. */
  wide?: boolean
  /** Focused on open; the panel falls back to its own container otherwise. */
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
}

/** Slide-in side panel shared by the review, publish and withdraw flows.
 *
 * Deliberately non-modal: the list beside it stays readable and clickable so
 * a reviewer can work down the queue without the panel closing between
 * items. That rules out <dialog>.showModal(), which makes the rest of the
 * page inert, so focus and Escape are handled here instead.
 *
 * Children are expected to be a <PanelActions> followed by a <PanelBody>.
 * The panel itself does not scroll - the body does - so the action bar stays
 * pinned below the header and the buttons are reachable without scrolling a
 * long form to the bottom first.
 */
export function Drawer({ title, wide, initialFocusRef, onClose, children }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    ;(initialFocusRef?.current ?? panelRef.current)?.focus()
    return () => {
      // Nothing traps focus here, so returning it to whatever opened the panel
      // is what stops keyboard users landing back on <body>.
      previouslyFocused?.focus()
    }
    // Focus once per mount; consumers remount (via key) when the subject changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Document-level: focus may legitimately be back in the list by the time
    // Escape is pressed, which is the whole point of a non-modal panel.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside
      ref={panelRef}
      className={`admin-drawer${wide ? ' admin-drawer-wide' : ''}`}
      aria-label={title}
      tabIndex={-1}
    >
      <div className="admin-drawer-inner">
        <header className="admin-panel-header">
          <h2>{title}</h2>
          <button className="modal-close" type="button" aria-label="Close panel" onClick={onClose}>{'×'}</button>
        </header>
        {children}
      </div>
    </aside>
  )
}

/** The panel's pinned action bar. Sits directly under the header, outside the
 * scrolling body, so "Cancel" and the primary action are always in view. */
export function PanelActions({ children }: { children: ReactNode }) {
  return <div className="admin-panel-actions">{children}</div>
}

/** The panel's scrolling region. Owns the overflow so the action bar above it
 * stays put, and is a flex column so a flexible field can absorb slack height. */
export function PanelBody({ children }: { children: ReactNode }) {
  return <div className="admin-panel-body">{children}</div>
}
