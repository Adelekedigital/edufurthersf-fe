function LogoGlyph({ variant }: { variant: 'full' | 'mark' }) {
  return <svg className={'brand-' + variant} aria-hidden="true"><use href={'/edufurther-brand.svg#' + variant} /></svg>
}

export function Brand() {
  return <span className="brand" role="img" aria-label="Edufurther"><LogoGlyph variant="full" /><LogoGlyph variant="mark" /></span>
}
