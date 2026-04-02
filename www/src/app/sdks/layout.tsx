import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Protocol SDKs',
  description:
    'Protocol offers fine-tuned JavaScript, Ruby, PHP, Python, and Go libraries to make your life easier and give you the best experience when consuming the API.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
