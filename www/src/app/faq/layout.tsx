import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ - SonicJS',
  description:
    'Frequently asked questions about SonicJS including installation, features, deployment, performance, pricing, and support.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
