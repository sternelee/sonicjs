import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Community - SonicJS',
  description:
    'Join the SonicJS community. Find resources, contribute to the project, get support, and connect with other developers.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
