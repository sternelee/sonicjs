import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Database - SonicJS',
  description:
    'Comprehensive guide to SonicJS database architecture using Cloudflare D1, Drizzle ORM, migrations, schema, and query patterns.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
