const embedUrl = process.env.NEXT_PUBLIC_SUBSTACK_EMBED_URL

export function NewsletterSignup({ compact = false }: { compact?: boolean }) {
  const headingId = compact ? 'modal-newsletter-heading' : 'newsletter-heading'
  return <section className={'newsletter-signup' + (compact ? ' newsletter-signup-modal' : '')} aria-labelledby={headingId}>
    <div className="newsletter-copy"><p className="form-kicker">{compact ? 'Stay updated' : 'Free scholarship guide'}</p><h2 id={headingId}>{compact ? 'Get scholarship updates by email' : 'Get the scholarship guide'}</h2><p>{compact ? 'Subscribe through Substack for new scholarship opportunities and guidance.' : "Subscribe through Substack and receive the guide through the publication's welcome email."}</p></div>
    {embedUrl ? <iframe className="substack-embed" src={embedUrl} title="Subscribe to the Edufurther scholarship newsletter" loading="lazy" /> : <p className="newsletter-unavailable">Newsletter signup is not configured in this environment.</p>}
  </section>
}
