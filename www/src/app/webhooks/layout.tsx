import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Webhooks',
  description:
    'In this guide, we will look at how to register and consume webhooks to integrate your app with Protocol.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
