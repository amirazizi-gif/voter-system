import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Voter Database - P.175 PAPAR',
  description: 'Voter management system for P.175 PAPAR',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}