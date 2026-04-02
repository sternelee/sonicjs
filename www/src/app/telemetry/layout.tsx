import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Telemetry - SonicJS',
  description:
    'Learn about SonicJS anonymous telemetry data collection, what data is collected, how to opt-out, and our commitment to privacy.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
