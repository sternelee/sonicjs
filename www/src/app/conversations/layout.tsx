import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conversations',
  description:
    'On this page, we’ll dive into the different conversation endpoints you can use to manage conversations programmatically.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
