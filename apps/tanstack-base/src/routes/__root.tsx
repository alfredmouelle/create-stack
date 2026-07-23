import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { lazy, Suspense } from 'react'
import type { AppRouter } from '~/server/api/root'

import appCss from '../styles.css?url'

// Dev-only: devtools are code-split out of the production bundle.
const Devtools = import.meta.env.DEV ? lazy(() => import('~/components/devtools')) : () => null

// Pre-hydration: set theme class to avoid flash of wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var m=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&m));}catch(e){}})();`

interface RouterContext {
  queryClient: QueryClient
  trpc: TRPCOptionsProxy<AppRouter>
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'App',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '32x32',
      },
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: anti-FOUC theme script */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
