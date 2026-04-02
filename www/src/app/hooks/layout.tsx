import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hook Reference - SonicJS',
  description:
    'Complete reference for SonicJS hooks - event-driven extensibility points for customizing application behavior, content lifecycle, authentication, and more.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
