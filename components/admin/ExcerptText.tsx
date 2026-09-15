/** Rendering for scraped discovery excerpts.
 *
 * The raw text is markdown-ish and not clean prose: blank-line separated
 * blocks, some prefixed with "###", joined by "[...]" where the scraper
 * dropped a section. Rendered as a single <p> the newlines collapse and the
 * markers show up mid-sentence, which is what made these unreadable.
 */

const OMISSION = /\s*\[(?:…|\.\.\.)\]\s*/
const HEADING = /^#{1,6}\s+/
/** Scrapers mark whole sentences as "###" fairly often. Emphasising a long
 *  run of text just makes the panel heavy, so only short lines - the ones
 *  that read like actual headings - get the treatment. */
const MAX_SUBHEAD_LENGTH = 80

type Block = { kind: 'text' | 'subhead' | 'gap'; value: string }

export function parseExcerpt(text: string): Block[] {
  const blocks: Block[] = []
  for (const paragraph of text.split(/\n\s*\n/)) {
    // A "[...]" can sit mid-line, joining two scraped sections; surface it as
    // a real break rather than leaving the literal marker in the sentence.
    const parts = paragraph.split(OMISSION)
    parts.forEach((part, index) => {
      if (index > 0) blocks.push({ kind: 'gap', value: '' })
      const trimmed = part.replace(/\s+/g, ' ').trim()
      if (!trimmed) return
      const withoutMarker = trimmed.replace(HEADING, '')
      const isSubhead = HEADING.test(trimmed) && withoutMarker.length <= MAX_SUBHEAD_LENGTH
      blocks.push({ kind: isSubhead ? 'subhead' : 'text', value: withoutMarker })
    })
  }
  return blocks.filter((block, index, all) => block.kind !== 'gap' || (index > 0 && index < all.length - 1))
}

/** Single-line, marker-free version for table rows. */
export function excerptPreview(text: string): string {
  return parseExcerpt(text)
    .filter((block) => block.kind !== 'gap')
    .map((block) => block.value)
    .join(' ')
}

export function ExcerptText({ text }: { text: string }) {
  const blocks = parseExcerpt(text)
  return (
    // The panel scrolls but holds no focusable content, so without tabIndex a
    // keyboard user cannot reach anything past the first screen of the
    // evidence they are being asked to judge.
    <div className="admin-excerpt" tabIndex={0} role="region" aria-label="Candidate excerpt">
      {blocks.map((block, index) =>
        block.kind === 'gap' ? (
          // Scraped content was dropped here - say so rather than implying the
          // two halves are continuous prose.
          <p className="admin-excerpt-gap" key={index}>&middot; &middot; &middot;</p>
        ) : block.kind === 'subhead' ? (
          <p className="admin-excerpt-subhead" key={index}>{block.value}</p>
        ) : (
          <p key={index}>{block.value}</p>
        )
      )}
    </div>
  )
}
