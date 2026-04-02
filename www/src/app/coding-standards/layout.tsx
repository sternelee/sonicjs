import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Coding Standards - SonicJS',
  description:
    'Coding standards and naming conventions for contributing to SonicJS',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
