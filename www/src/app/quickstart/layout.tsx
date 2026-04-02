import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quickstart - SonicJS',
  description:
    'Get SonicJS up and running in under 60 seconds. Learn how to install, configure, and create your first content.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
