import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ThemeProvider } from '~/components/theme-provider'
import { TRPCReactProvider } from '~/trpc/react'
import './globals.css'

export const metadata: Metadata = {
  title: 'App',
  description: 'Next.js base.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      // the SVG carries the dark-mode variant; browsers that support it win over the .ico
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
