import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Messages',
  description:
    'On this page, we’ll dive into the different message endpoints you can use to manage messages programmatically.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
