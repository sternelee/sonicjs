import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Search Plugin - SonicJS',
  description:
    'AI-powered semantic search for your SonicJS content using Cloudflare Vectorize and Workers AI for natural language queries and intelligent search.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
