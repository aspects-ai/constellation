import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ConstellationFS Demo',
  description: 'Interactive AI coding assistant powered by ConstellationFS',
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