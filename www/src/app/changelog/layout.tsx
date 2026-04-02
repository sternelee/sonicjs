import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Changelog - SonicJS',
  description:
    'Complete changelog of SonicJS from 2018 to present, documenting all features, improvements, and bug fixes across 3,683+ commits.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
