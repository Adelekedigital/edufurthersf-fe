const embedUrl = process.env.NEXT_PUBLIC_SUBSTACK_EMBED_URL

export function NewsletterSignup() {
  return <section className="newsletter-signup" aria-labelledby="newsletter-heading">
    <div className="newsletter-copy"><p className="form-kicker">Free scholarship guide</p><h2 id="newsletter-heading">Get the scholarship guide</h2><p>Subscribe through Substack and receive the guide through the publication&apos;s welcome email.</p></div>
    {embedUrl ? <iframe className="substack-embed" src={embedUrl} title="Subscribe to the Edufurther scholarship newsletter" loading="lazy" /> : <p className="newsletter-unavailable">Newsletter signup is not configured in this environment.</p>}
  </section>
}