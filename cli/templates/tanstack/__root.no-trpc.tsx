import { createRootRoute, HeadContent, Link, Scripts } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { siteConfig } from '~/lib/site-config'

import appCss from '../styles.css?url'

const Devtools = import.meta.env.DEV ? lazy(() => import('~/components/devtools')) : () => null

const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var m=window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&m));}catch(e){}})();`

export const Route = createRootRoute({
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
        name: 'description',
        content: siteConfig.description,
      },
      {
        title: siteConfig.name,
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
  notFoundComponent: () => (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <h1 className="font-bold text-4xl tracking-tight">404 - Not Found</h1>
      <p className="mt-2 text-muted-foreground">The page you are looking for does not exist.</p>
      <Link
        className="mt-6 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
        to="/"
      >
        Go back home
      </Link>
    </div>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
