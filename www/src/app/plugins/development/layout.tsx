import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Plugin Development Guide',
  description:
    'Learn how to create custom plugins for SonicJS',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
