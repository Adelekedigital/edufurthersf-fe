function LogoGlyph({ variant }: { variant: 'full' | 'mark' }) {
  const viewBox = variant === 'full' ? '0 0 314 60' : '0 0 120 60'
  return <svg className={'brand-' + variant} viewBox={viewBox} aria-hidden="true" focusable="false"><use href={'/edufurther-brand.svg#' + variant} /></svg>
}

export function Brand() {
  return <span className="brand" role="img" aria-label="Edufurther"><LogoGlyph variant="full" /><LogoGlyph variant="mark" /></span>
}
