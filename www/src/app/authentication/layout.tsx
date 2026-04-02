import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication - SonicJS',
  description:
    'Secure your SonicJS application with JWT authentication, role-based access control, and user management.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
