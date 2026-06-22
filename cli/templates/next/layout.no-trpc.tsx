import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ThemeProvider } from '~/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'App',
  description: 'Next.js base.',
  authors: [{ name: 'Alfred MOUELLE', url: 'https://alfredmouelle.com' }],
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
