import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Reference',
  description:
    'Complete REST API reference for SonicJS headless CMS',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
