import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scholarship Finder | Edufurther',
  description: 'Find verified scholarships matched to your study plans.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
