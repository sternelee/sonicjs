import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Astro Integration - SonicJS',
  description:
    'Complete guide to integrating SonicJS headless CMS with Astro. Build blazing-fast static and server-rendered websites with edge-first performance.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
