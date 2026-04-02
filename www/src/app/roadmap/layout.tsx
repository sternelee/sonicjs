import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Roadmap - SonicJS',
  description:
    'Development roadmap and progress tracking for SonicJS. See completed features, current work, and planned enhancements.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
