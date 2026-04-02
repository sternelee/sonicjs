import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Agents - SonicJS',
  description:
    'Discover the AI-powered Claude agents that help automate development, releases, SEO, and marketing tasks for the SonicJS project.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
