import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Template System - SonicJS',
  description:
    'Modern server-side rendering template system built with TypeScript, HTMX, Alpine.js, and TailwindCSS for SonicJS.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
