import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics Plugin - SonicJS',
  description:
    'Built-in analytics and insights for SonicJS with page view tracking, user sessions, custom events, real-time monitoring, and detailed reports.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
