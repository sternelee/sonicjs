import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Routing & Middleware - SonicJS',
  description:
    'Complete guide to routing and middleware in SonicJS using Hono framework, including authentication, authorization, logging, and plugin middleware.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
