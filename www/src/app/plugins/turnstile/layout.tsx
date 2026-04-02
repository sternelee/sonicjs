import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Turnstile Plugin (Bot Protection) - SonicJS',
  description:
    'Protect your forms and APIs from bots using Cloudflare Turnstile - a CAPTCHA-free, privacy-preserving bot protection solution.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
