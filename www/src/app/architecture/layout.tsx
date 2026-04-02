import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Architecture - SonicJS',
  description:
    'Comprehensive guide to the SonicJS system architecture, covering Cloudflare Workers, request lifecycle, plugin system, caching, and data flow patterns.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
