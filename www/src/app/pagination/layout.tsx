import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pagination',
  description:
    'In this guide, we will look at how to work with paginated responses when querying the Protocol API',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
