import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Troubleshooting Guide - SonicJS',
  description:
    'Common issues, error codes, and solutions for SonicJS. Debug authentication, database, cache, email, and plugin problems.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
