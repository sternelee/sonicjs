import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security - SonicJS',
  description:
    'SonicJS security architecture, hardening measures, and responsible disclosure policy.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
