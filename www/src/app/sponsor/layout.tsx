import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Sponsor SonicJS - Support the World's Fastest Headless CMS",
  description:
    "Support SonicJS development through GitHub Sponsors or Open Collective. Tax-deductible donations available via 501(c)(3). Help keep the world's fastest headless CMS free and actively maintained.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
