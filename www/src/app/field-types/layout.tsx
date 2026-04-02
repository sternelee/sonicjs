import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Field Types Reference - SonicJS',
  description:
    'Complete reference for all SonicJS collection field types including text, number, boolean, date, select, media, richtext, and structured types.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
