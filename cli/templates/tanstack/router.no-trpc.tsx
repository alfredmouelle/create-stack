import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ThemeProvider } from './components/theme-provider'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',

    Wrap: (props: { children: ReactNode }) => (
      <ThemeProvider defaultTheme="system">{props.children}</ThemeProvider>
    ),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
