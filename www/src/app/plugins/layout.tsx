import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Plugin System - SonicJS',
  description:
    'Extend SonicJS with plugins for authentication, rich text editing, email, and more. Learn about core and community plugins.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
