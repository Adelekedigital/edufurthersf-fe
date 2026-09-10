import { useState } from 'react'

const embedUrl = process.env.NEXT_PUBLIC_SUBSTACK_EMBED_URL

export function NewsletterSignup({ compact = false, collapsible = false }: { compact?: boolean; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(!collapsible)
  const headingId = compact ? 'modal-newsletter-heading' : 'newsletter-heading'
  return <section className={'newsletter-signup' + (compact ? ' newsletter-signup-modal' : '') + (collapsible ? ' newsletter-signup-collapsible' : '')} aria-labelledby={headingId}>
    <div className="newsletter-copy"><p className="form-kicker">{compact ? 'Free scholarship ebook' : 'Free scholarship guide'}</p><h2 id={headingId}>{compact ? 'Get the Scholarship Ebook' : 'Get the scholarship guide'}</h2><p>{compact ? 'Subscribe to receive 45+ scholarship opportunities and future updates.' : "Subscribe through Substack and receive the guide through the publication's welcome email."}</p></div>
    {collapsible && !expanded ? <button className="newsletter-expand" type="button" aria-expanded="false" onClick={() => setExpanded(true)}>Get the Scholarship Ebook</button> : embedUrl ? <iframe className="substack-embed" src={embedUrl} title="Subscribe to the Edufurther scholarship newsletter" loading="lazy" /> : <p className="newsletter-unavailable">Newsletter signup is not configured in this environment.</p>}
  </section>
}
