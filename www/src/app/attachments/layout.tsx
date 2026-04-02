import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Attachments',
  description:
    'On this page, we’ll dive into the different attachment endpoints you can use to manage attachments programmatically.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
