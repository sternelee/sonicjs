import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Email Templates Plugin - SonicJS',
  description:
    'Comprehensive email template management for SonicJS with themes, Markdown content, variable substitution, delivery tracking, and SendGrid integration.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
