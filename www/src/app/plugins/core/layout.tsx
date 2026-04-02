import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Core Plugins - SonicJS',
  description:
    'Complete reference for SonicJS core plugins including authentication, email, magic link auth, media management, caching, database tools, and seed data.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
