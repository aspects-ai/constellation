import type { Metadata } from 'next'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import './globals.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/code-highlight/styles.css'

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
      <body>
        <MantineProvider 
          defaultColorScheme="dark"
          theme={{
            primaryColor: 'blue',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
            headings: {
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
            },
          }}
        >
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  )
}