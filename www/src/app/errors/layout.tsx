import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Errors',
  description:
    'In this guide, we will talk about what happens when something goes wrong while you work with the API.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
