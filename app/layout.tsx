import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scholarship Finder | Edufurther',
  description: 'Find scholarships matched to your academic background, country and study plans.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
