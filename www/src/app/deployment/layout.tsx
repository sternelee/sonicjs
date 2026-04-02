import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Production Deployment',
  description:
    'Deploy SonicJS to Cloudflare Workers and production environments',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
