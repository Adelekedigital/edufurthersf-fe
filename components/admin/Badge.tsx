export type BadgeTone = 'positive' | 'warning' | 'negative' | 'neutral' | 'muted'

export function Badge({ tone, title, children }: { tone: BadgeTone; title?: string; children: React.ReactNode }) {
  return <span className={`admin-badge admin-badge-${tone}`} title={title}>{children}</span>
}
