import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Workflow Plugin - SonicJS',
  description:
    'Content workflow management for SonicJS with approval chains, scheduled publishing, state transitions, and role-based permissions.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
