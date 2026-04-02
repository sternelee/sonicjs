import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Caching',
  description:
    'Learn about SonicJS three-tier caching system for optimal performance',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
