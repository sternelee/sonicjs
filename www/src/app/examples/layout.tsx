import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Examples - SonicJS',
  description:
    'Real-world examples and use cases for SonicJS including blogs, e-commerce, documentation sites, and multi-tenant applications.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
