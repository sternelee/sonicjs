import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Testing Guide - SonicJS',
  description:
    'Comprehensive testing guide for SonicJS covering unit tests with Vitest, end-to-end testing with Playwright, and manual API testing with Postman.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
