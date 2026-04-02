import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contacts',
  description:
    'On this page, we’ll dive into the different contact endpoints you can use to manage contacts programmatically.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
