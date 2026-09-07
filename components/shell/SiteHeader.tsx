import Link from 'next/link'
import { Brand } from '../ui/Brand'

export function SiteHeader() {
  return <header className="site-header"><Link className="brand-link" href="/"><Brand /></Link><a className="about-button" href="#about">About Edufurther</a></header>
}
