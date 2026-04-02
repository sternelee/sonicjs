import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Groups',
  description:
    'On this page, we’ll dive into the different group endpoints you can use to manage groups programmatically.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
